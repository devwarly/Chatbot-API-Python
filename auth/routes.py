import os
import logging 
import datetime
import asyncio
import uuid 
from typing import Optional 

import aiomysql
from fastapi import APIRouter, Request, HTTPException, Depends, status, Form, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
import aiofiles
from passlib.context import CryptContext 

from db.dependencies import get_db_connection
from common_deps import get_current_user, templates 
from auth.models import UserRegister, UserLogin, VerifyCode 

from utils.email_sender import send_verification_link_email 

router = APIRouter()
logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto") 


def hash_password(password: str) -> str:
    """Gera o hash da senha usando bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha em texto plano corresponde ao hash."""
    return pwd_context.verify(plain_password, hashed_password)


@router.get("/login", response_class=HTMLResponse)
async def get_login_page(request: Request):
    """Serve a página de login."""
    return templates.TemplateResponse("login.html", {"request": request})

@router.get("/cadastro", response_class=HTMLResponse)
async def get_cadastro_page(request: Request):
    """Serve a página de cadastro."""
    return templates.TemplateResponse("cadastro.html", {"request": request})

@router.get("/verificacao", response_class=HTMLResponse)
async def get_verificacao_page(request: Request, email: str = None):
    """Serve a página de verificação de email."""
    return templates.TemplateResponse("verificacao.html", {"request": request, "email": email})

@router.get("/sucesso", response_class=HTMLResponse)
async def get_sucess_page(request: Request):
    """Serve a página de sucesso após a verificação."""
    return templates.TemplateResponse("sucesso.html", {"request": request})

@router.get("/profile", response_class=HTMLResponse)
async def get_profile_page(
    request: Request,
    user_id: int = Depends(get_current_user),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """Serve a página de perfil com os dados do usuário."""
    if not user_id:
        return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)
    
    cursor = await conn.cursor()
    try:
        await cursor.execute(
            "SELECT id, nome, email, email_verified, termos_registro, data_registro, profile_pic_url FROM usuarios WHERE id = %s",
            (user_id,)
        )
        user_record = await cursor.fetchone()

        if not user_record:
            request.session.pop("user_id", None)
            return RedirectResponse(url="/login", status_code=status.HTTP_302_FOUND)

        if user_record['data_registro']:
            user_record['data_registro'] = user_record['data_registro'].strftime("%d/%m/%Y %H:%M:%S")

        user_info = {
            "id": user_record['id'],
            "nome_completo": user_record['nome'],
            "email": user_record['email'],
            "email_verified": bool(user_record['email_verified']),
            "termos_registro": bool(user_record['termos_registro']),
            "data_registro": user_record['data_registro'],
            "profile_pic_url": user_record['profile_pic_url']
        }

        return templates.TemplateResponse("profile.html", {"request": request, "user_info": user_info})
    except Exception as e:
        logger.error(f"Erro ao carregar dados do perfil para o usuário {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro ao carregar dados do perfil.")
    finally:
        await cursor.close()


@router.get("/verify_link/{verification_token}", response_class=RedirectResponse)
async def verify_email_link(
    verification_token: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """Verifica o token do link de email e ativa o usuário."""
    cursor = await conn.cursor()
    try:
        await cursor.execute(
            "SELECT id, code_expiration, email_verified FROM usuarios WHERE verification_code = %s",
            (verification_token,)
        )
        user_record = await cursor.fetchone()

        if not user_record:

            logger.warning(f"Tentativa de verificação com token inválido: {verification_token}")
 
            return RedirectResponse(url="/login?error=invalid_token", status_code=status.HTTP_302_FOUND)

        if user_record['email_verified']:
            return RedirectResponse(url="/sucesso", status_code=status.HTTP_302_FOUND)

        now = datetime.datetime.now()
        if user_record['code_expiration'] < now:
            logger.warning(f"Token expirado para o usuário {user_record['id']}.")
            return RedirectResponse(url="/login?error=expired_token", status_code=status.HTTP_302_FOUND)

        await cursor.execute(
            "UPDATE usuarios SET email_verified = TRUE, verification_code = NULL, code_expiration = NULL WHERE id = %s",
            (user_record['id'],)
        )
        await conn.commit()

        logger.info(f"Email verificado com sucesso para o usuário {user_record['id']} via link.")

        return RedirectResponse(url="/verificado", status_code=status.HTTP_302_FOUND)

    except Exception as e:
        await conn.rollback()
        logger.error(f"Erro ao verificar email via link: {e}", exc_info=True)
        return RedirectResponse(url="/login?error=verification_error", status_code=status.HTTP_302_FOUND)
    finally:
        await cursor.close()

@router.post("/register", response_class=JSONResponse)
async def register_user(
    request: Request,
    user_data: UserRegister,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """
    Registra um novo usuário, faz o hash da senha (Argon2), define a sessão e envia o email de verificação por link.
    """
    cursor = await conn.cursor()
    try:
        await cursor.execute("SELECT id FROM usuarios WHERE email = %s", (user_data.email,))
        if await cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este email já está registrado. Por favor, faça login ou use outro email."
            )

       # Hashing da senha 
        try:
            hashed_password = hash_password(user_data.senha)
        except ValueError as ve:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
            
        # Gerar TOKEN de verificação
        verification_token = str(uuid.uuid4()) 
        code_expiration = datetime.datetime.now() + datetime.timedelta(hours=24) 
        
        # Inserir o novo usuário no banco de dados.
        await cursor.execute(
            "INSERT INTO usuarios (nome, email, senha, termos_registro, data_registro, verification_code, code_expiration, email_verified, profile_pic_url) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (user_data.nome, user_data.email, hashed_password, user_data.termos_registro, datetime.datetime.now(), verification_token, code_expiration, False, '/static/images/default_profile.png')
        )
        
        new_user_id = cursor.lastrowid
        
        await conn.commit()

        if not new_user_id:
           
            await cursor.execute("SELECT id FROM usuarios WHERE email = %s", (user_data.email,))
            user_record = await cursor.fetchone()
            if user_record:
                new_user_id = user_record[0]
            else:
                raise Exception("Falha ao recuperar o ID do novo usuário.")
                
        request.session["user_id"] = new_user_id
        

        base_url = str(request.base_url) 
        verification_url = f"{base_url.rstrip('/')}/verify_link/{verification_token}"
        
        asyncio.create_task(send_verification_link_email(user_data.email, verification_url))

        logger.info(f"Novo usuário registrado (e logado, não verificado): {user_data.email}")
        

        return JSONResponse(
            content={"message": "Cadastro concluído. Verifique seu email. Caso não receba, vefifique sua caixa de SPAM", "redirect_url": "/sucesso"},
            status_code=status.HTTP_201_CREATED
        )

    except HTTPException as e:
        await conn.rollback()
        raise e
    except Exception as e:
        await conn.rollback()
        logger.error(f"Erro ao registrar usuário: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno do servidor ao registrar usuário: {str(e)}"
        )
    finally:
        await cursor.close()

@router.post("/login", response_class=JSONResponse)
async def login_user(
    user_data: UserLogin,
    request: Request,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """
    Login de usuário. Agora verifica se 'email_verified' é True.
    Se não for, envia uma mensagem de erro, sem redirecionar para a rota /verificacao antiga.
    """
    cursor = await conn.cursor()
    try:
        await cursor.execute("SELECT id, senha, email_verified, email FROM usuarios WHERE email = %s", (user_data.email,))
        user_record = await cursor.fetchone()

        if not user_record:
            logger.warning(f"Tentativa de login falha para {user_data.email}: Email não encontrado.")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha inválidos.")

        hashed_password_from_db = user_record['senha']
        is_password_valid = verify_password(user_data.senha, hashed_password_from_db) # Usa a função robusta

        if not is_password_valid:
            logger.warning(f"Tentativa de login falha para {user_data.email}: Credenciais inválidas.")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha inválidos.")

        if not user_record.get('email_verified', False):
            logger.warning(f"Tentativa de login falha para {user_data.email}: Email não verificado.")


            return JSONResponse(
                content={
                    "message": "Sua conta não está verificada. Por favor, verifique seu email e tente novamente.",

                },
                status_code=status.HTTP_403_FORBIDDEN 
            )

        request.session["user_id"] = user_record['id']
        request.session.pop("session_id", None)

        logger.info(f"Usuário {user_record['id']} logado com sucesso.")

        return JSONResponse(
            content={"message": "Login realizado com sucesso!", "user_id": user_record['id'], "redirect_url": "/chat"},
            status_code=status.HTTP_200_OK
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Erro interno do servidor ao fazer login: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Erro ao fazer login: {str(e)}")
    finally:
        await cursor.close()
        
@router.get("/verificado", response_class=HTMLResponse)
async def get_verified_page(request: Request):
    """Serve a página de sucesso após a verificação por link."""
    return templates.TemplateResponse("verificado.html", {"request": request})

@router.post("/resend_verification_code", response_class=JSONResponse)
async def resend_verification_link(
    request: Request,
    email: str = Form(...),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """Gera um novo TOKEN de verificação e o envia por email (link)."""
    cursor = await conn.cursor()
    try:
        # 1. Buscar usuário
        await cursor.execute(
            "SELECT id, email_verified, verification_code FROM usuarios WHERE email = %s",
            (email,)
        )
        user_record = await cursor.fetchone()

        if not user_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

        if user_record['email_verified']:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este email já está verificado. Por favor, faça login.")

        new_verification_token = user_record.get('verification_code') or str(uuid.uuid4())
 
        new_code_expiration = datetime.datetime.now() + datetime.timedelta(hours=24) 

        await cursor.execute(
            "UPDATE usuarios SET verification_code = %s, code_expiration = %s WHERE id = %s",
            (new_verification_token, new_code_expiration, user_record['id'])
        )
        await conn.commit()

        base_url = str(request.base_url) 
        verification_url = f"{base_url.rstrip('/')}/verify_link/{new_verification_token}"
        asyncio.create_task(send_verification_link_email(email, verification_url))

        logger.info(f"Novo link de verificação enviado para {email}.")

        return JSONResponse(
            content={"message": "Novo link de verificação enviado para seu email."},
            status_code=status.HTTP_200_OK
        )

    except HTTPException as e:
        await conn.rollback()
        raise e
    except Exception as e:
        await conn.rollback()
        logger.error(f"Erro ao reenviar link para {email}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao reenviar link.")
    finally:
        await cursor.close()
        
@router.post("/logout", response_class=JSONResponse)
async def logout_user(request: Request):
    """Rota para deslogar o usuário."""
    user_id = request.session.get("user_id")
    request.session.pop("user_id", None)
    request.session.pop("session_id", None)
    logger.info(f"Usuário {user_id if user_id else 'não logado'} deslogado com sucesso.")
    return JSONResponse(content={"message": "Logout realizado com sucesso!", "redirect_url": "/login"}, status_code=status.HTTP_200_OK)


@router.put("/profile/update", response_class=JSONResponse)
async def update_profile(
    nome_completo: Optional[str] = Form(None), 
    email: Optional[str] = Form(None),
    senha: Optional[str] = Form(None), 
    profile_pic: Optional[UploadFile] = File(None), 
    user_id: int = Depends(get_current_user),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """Atualiza as informações de perfil, senha e foto."""
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Você precisa estar logado para atualizar o perfil.")

    cursor = await conn.cursor()
    try:
        update_fields = []
        params = []

        await cursor.execute("SELECT nome, email, senha, profile_pic_url, email_verified FROM usuarios WHERE id = %s", (user_id,))
        current_user_data = await cursor.fetchone()
        if not current_user_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
        if not current_user_data.get('email_verified', False):
            is_only_email_change = (
                (nome_completo is None or nome_completo == current_user_data['nome']) and
                (senha is None) and
                (profile_pic is None) and
                (email is not None and email != current_user_data['email'])
            )        
        
            if not is_only_email_change:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sua conta precisa ser verificada para alterar o perfil. Altere o email se precisar reenviar o link.")

        update_fields = []
        params = []
        if nome_completo and nome_completo.strip() and nome_completo != current_user_data['nome']:
            update_fields.append("nome = %s")
            params.append(nome_completo.strip())
            logger.info(f"Usuário {user_id}: Nome atualizado para '{nome_completo.strip()}'.")
 
        if senha and len(senha) >= 6: 
            if len(senha.encode('utf8')) > 72:
                 raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A nova senha é muito longa. O limite é de 72 caracteres.")

            hashed_new_password = hash_password(senha)
            update_fields.append("senha = %s") 
            params.append(hashed_new_password)
            logger.info(f"Usuário {user_id}: Senha atualizada (hashed).")
        elif senha and len(senha) < 6:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A nova senha deve ter pelo menos 6 caracteres.")
 
        if email and email.strip() and email != current_user_data['email']:
            await cursor.execute("SELECT id FROM usuarios WHERE email = %s AND id != %s", (email, user_id))
            if await cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este email já está em uso por outro usuário.")

            update_fields.append("email = %s")
            params.append(email)
            update_fields.append("email_verified = %s")
            params.append(False)

            new_verification_token = str(uuid.uuid4())
            new_code_expiration = datetime.datetime.now() + datetime.timedelta(hours=24)
            update_fields.append("verification_code = %s")
            params.append(new_verification_token)
            update_fields.append("code_expiration = %s")
            params.append(new_code_expiration)
 
            base_url = str(request.base_url) 
            verification_url = f"{base_url.rstrip('/')}/verify_link/{new_verification_token}"
            asyncio.create_task(send_verification_link_email(email, verification_url))

        # 5. Lógica para Upload de Foto de Perfil
        if profile_pic and profile_pic.filename:
            upload_dir = "static/uploads/profile_pics"
            os.makedirs(upload_dir, exist_ok=True)

            file_extension = profile_pic.filename.split(".")[-1]
            new_filename = f"{uuid.uuid4()}.{file_extension}"
            file_path = os.path.join(upload_dir, new_filename)

            content = await profile_pic.read()
            async with aiofiles.open(file_path, "wb") as buffer: 
                await buffer.write(content)
                
            profile_pic_url = f"/static/uploads/profile_pics/{new_filename}"
            update_fields.append("profile_pic_url = %s")
            params.append(profile_pic_url)
        
        if not update_fields:
            return JSONResponse(content={"message": "Nenhuma alteração detectada."}, status_code=status.HTTP_200_OK)

        query = f"UPDATE usuarios SET {', '.join(update_fields)} WHERE id = %s"
        params.append(user_id) 

        await cursor.execute(query, tuple(params))
        await conn.commit()
        
        response_content = {"message": "Perfil atualizado com sucesso!"}
        if "profile_pic_url = %s" in update_fields:
             response_content["profile_pic_url"] = profile_pic_url
             
        if any("email = %s" in f for f in update_fields):
            response_content["redirect_url"] = "/login"
            response_content["message"] = "Email atualizado! Por favor, verifique seu novo email para continuar logado. Caso não receba, verifique a caixa de SPAM."

        return JSONResponse(content=response_content, status_code=status.HTTP_200_OK)

    except HTTPException as e:
        await conn.rollback()
        raise e
    except Exception as e:
        await conn.rollback()
        logger.error(f"Erro interno do servidor ao atualizar perfil: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro ao atualizar perfil.")
    finally:
        await cursor.close()
