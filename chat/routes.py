import os
import logging
import datetime
import uuid
import asyncio 
from typing import Dict, Any, Optional 

import aiomysql
from fastapi import APIRouter, Request, HTTPException, Depends, status
from fastapi.responses import HTMLResponse, JSONResponse
from langchain.chains import ConversationChain
from langchain_core.messages import HumanMessage, AIMessage
from langchain.memory import ConversationSummaryBufferMemory
from langchain_community.chat_message_histories import ChatMessageHistory


from db.dependencies import get_db_connection
from common_deps import get_current_user, templates

from chat.models import Message 
from chat.llm_config import (
   
    get_user_conversation_instance as get_conversation_state_dep, 
    user_conversations_instances, 
    templates_by_lang,
    get_llm_title_generator,
    TITLE_GENERATION_PROMPT,
    initialize_llms # Adicionei o initialize_llms se for usado na rota /conversations
)

router = APIRouter()
logger = logging.getLogger(__name__)


async def generate_chat_title(user_message: str) -> str:
    """Gera um título conciso usando o LLM."""
    try:
        
        llm_title_generator = get_llm_title_generator() 
        
        prompt = TITLE_GENERATION_PROMPT.format(first_message=user_message)
        
       
        response = await llm_title_generator.ainvoke(prompt)
        
        title = response.content.strip().replace('"', '').replace('\n', ' ').strip()
        
      
        return title[:50] if len(title) > 0 else "Nova Conversa"
        
    except Exception as e:
        logger.error(f"Erro ao gerar título da conversa: {e}", exc_info=True)
        return "Conversa Sem Título"



async def update_conversation_title(conversation_id: int, user_message: str, conn: aiomysql.Connection):
    """Função separada para atualizar o título da conversa em segundo plano."""
    new_title = await generate_chat_title(user_message)
    
    
    cursor_title = await conn.cursor()
    try:
        await cursor_title.execute(
            "UPDATE conversas SET titulo_conversa = %s WHERE id = %s",
            (new_title, conversation_id)
        )
        await conn.commit()
        logger.info(f"Título da conversa {conversation_id} atualizado para: '{new_title}'")
    except Exception as title_err:
        logger.error(f"Erro ao atualizar título da conversa {conversation_id}: {title_err}", exc_info=True)
    finally:
        await cursor_title.close()



@router.get("/conversations", response_class=JSONResponse)
async def get_conversations_list(
    user_id: Optional[int] = Depends(get_current_user),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    cursor = await conn.cursor(aiomysql.DictCursor)
    conversations_list = []
    try:
        await cursor.execute(
            """
            SELECT id, titulo_conversa, data_criacao, data_atualizacao 
            FROM conversas 
            WHERE id_usuario = %s 
            ORDER BY data_atualizacao DESC
            """, 
            (user_id,)
        )
        conversations_raw = await cursor.fetchall()
        
        for conv in conversations_raw:
            if isinstance(conv.get('data_criacao'), datetime.datetime):
                conv['data_criacao'] = int(conv['data_criacao'].timestamp() * 1000)
            if isinstance(conv.get('data_atualizacao'), datetime.datetime):
                conv['data_atualizacao'] = int(conv['data_atualizacao'].timestamp() * 1000)
            
            conversations_list.append(conv)
            
    except Exception as e:
        logger.error(f"Erro ao buscar lista de conversas para o usuário {user_id}: {e}")

        return JSONResponse(content=[], status_code=status.HTTP_200_OK)
    finally:
        await cursor.close()

    return JSONResponse(content=conversations_list, status_code=status.HTTP_200_OK)


@router.get("/chat", response_class=HTMLResponse)
async def get_chat_page(
    request: Request, 
    user_id: int = Depends(get_current_user),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    user_first_name = "Usuário"
    profile_pic_url = "/static/images/default_profile.png"
    
    if user_id:
        cursor = await conn.cursor(aiomysql.DictCursor)
        try:
            await cursor.execute("SELECT nome, profile_pic_url FROM usuarios WHERE id = %s", (user_id,))
            user_record = await cursor.fetchone()
                
            if user_record:
                if user_record['nome']:
                    user_full_name = user_record['nome']
                    user_first_name = user_full_name.split(' ')[0]
                if user_record['profile_pic_url']:
                    profile_pic_url = user_record['profile_pic_url']
        finally:
            await cursor.close()
            
    return templates.TemplateResponse("chat.html", {
        "request": request, 
        "user_id": user_id, 
        "user_name": user_first_name,
        "profile_pic_url": profile_pic_url
    })


@router.get("/conversation/{conversation_id}", response_class=JSONResponse)
async def get_conversation_messages(
    conversation_id: int,
    user_id: int = Depends(get_current_user),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """Retorna as mensagens de uma conversa específica e atualiza a cadeia de memória."""
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Acesso não autorizado.")

    cursor = await conn.cursor(aiomysql.DictCursor) 
    history_messages = []
    
    try:
        await cursor.execute(
            "SELECT id FROM conversas WHERE id = %s AND id_usuario = %s",
            (conversation_id, user_id)
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversa não encontrada ou não pertence ao usuário.")

        await cursor.execute(
            "SELECT remetente, conteudo, data_envio FROM mensagens WHERE id_conversa = %s ORDER BY data_envio ASC",
            (conversation_id,)
        )
        messages = await cursor.fetchall()
        

        for msg_data in messages:
            if msg_data['remetente'] == 'usuario':
                history_messages.append(HumanMessage(content=msg_data['conteudo']))
            
            else: 
                history_messages.append(AIMessage(content=msg_data['conteudo']))
                

        for msg in messages:
            if isinstance(msg.get('data_envio'), datetime.datetime):
                msg['data_envio'] = msg['data_envio'].isoformat()
             
            if msg['remetente'] == 'usuario':
                msg['remetente'] = 'usuario' 
            else:
                msg['remetente'] = 'bot'

        return JSONResponse(content=messages, status_code=status.HTTP_200_OK)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Erro ao buscar mensagens da conversa {conversation_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro ao buscar mensagens.")
    finally:
        await cursor.close()




@router.post("/chat/message", response_class=JSONResponse)
async def chat_message_endpoint(
    message_data: Message,
    request: Request,
    user_conversation_state: Dict[str, Any] = Depends(get_conversation_state_dep),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    user_id = request.session.get("user_id")
    user_conversation = user_conversation_state.get("chain")
    current_conversation_id = user_conversation_state.get("current_conversation_id")
    user_message = message_data.message

 
    is_verified = False
    if user_id is not None:
        cursor_check = await conn.cursor()
        try:
            await cursor_check.execute("SELECT email_verified FROM usuarios WHERE id = %s", (user_id,))
            user_data = await cursor_check.fetchone()
            if user_data:
                is_verified = bool(user_data['email_verified'])
        finally:
            await cursor_check.close()
            

    is_persistence_allowed = user_id is not None and is_verified

    is_new_conversation = False
    
    if is_persistence_allowed and current_conversation_id is None:
        cursor_new = await conn.cursor()
        try:

            await cursor_new.execute(
                "INSERT INTO conversas (id_usuario, titulo_conversa, data_criacao, data_atualizacao) VALUES (%s, %s, %s, %s)",
                (user_id, 'Nova Conversa...', datetime.datetime.now(), datetime.datetime.now())
            )
            
            new_id = cursor_new.lastrowid
            
            await conn.commit() 

            if new_id:
                current_conversation_id = new_id
                
                logger.info(f"Nova conversa {current_conversation_id} criada para o usuário {user_id} usando lastrowid.")
                
                # ATUALIZA o estado da conversa para uso imediato e persistência
                user_conversation_state["current_conversation_id"] = current_conversation_id
                
                is_new_conversation = True
            else:
                 # Rollback e log de erro se o ID não foi recuperado
                 await conn.rollback()
                 logger.error("Falha ao obter o ID (lastrowid) após a criação da conversa. Rollback executado.")
                 current_conversation_id = None
                 
        except Exception as new_conv_err:
            logger.error(f"Erro ao criar nova conversa no DB: {new_conv_err}", exc_info=True)
            await conn.rollback()
            current_conversation_id = None 
        finally:
             await cursor_new.close()

    user_conversation.prompt = templates_by_lang["pt"]
    ai_response = await user_conversation.ainvoke({"input": user_message})
    ai_text = ai_response["response"]

    if is_new_conversation and is_persistence_allowed and current_conversation_id is not None:

        asyncio.create_task(update_conversation_title(current_conversation_id, user_message, conn))


    if is_persistence_allowed and current_conversation_id is not None:
        cursor_persist = await conn.cursor()
        try:
            await cursor_persist.execute(
                "INSERT INTO mensagens (id_conversa, remetente, conteudo, data_envio) VALUES (%s, %s, %s, %s)",
                (current_conversation_id, 'usuario', user_message, datetime.datetime.now())
            )

            await cursor_persist.execute(
                "INSERT INTO mensagens (id_conversa, remetente, conteudo, data_envio) VALUES (%s, %s, %s, %s)",
                (current_conversation_id, 'ia', ai_text, datetime.datetime.now()) 
            )

            await cursor_persist.execute(
                "UPDATE conversas SET data_atualizacao = %s WHERE id = %s",
                (datetime.datetime.now(), current_conversation_id)
            )
            
            await conn.commit()
            logger.info(f"Mensagem do usuário e resposta da IA salvas na conversa {current_conversation_id}")
        except Exception as save_err:
            logger.error(f"Erro ao salvar mensagens no DB: {save_err}", exc_info=True)
        finally:
            await cursor_persist.close()
            
    elif user_id is not None and not is_verified:
        return JSONResponse(
            content={"response": "Sua conta ainda não foi verificada. Por favor, verifique seu email para que eu possa salvar nosso histórico. Você pode reeunviar o link através da tela de Login."}, 
            status_code=status.HTTP_403_FORBIDDEN 
        )


    return JSONResponse(content={"response": ai_text, "language": "pt"})


@router.post("/reset_chat", response_class=JSONResponse)
async def reset_chat_endpoint(
    request: Request,
    user_id: int = Depends(get_current_user),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """
    Reseta a conversa atual do usuário na memória, mas NÃO cria uma nova entrada no DB.
    A nova entrada será criada na primeira mensagem enviada (/chat/message).
    """
    key_to_delete = user_id if user_id is not None else request.session.get("session_id")
    
    if key_to_delete in user_conversations_instances:
      
        del user_conversations_instances[key_to_delete]
        logger.info(f"Instância de conversa resetada da memória para {key_to_delete}")

    return JSONResponse(content={"message": "Chat reiniciado com sucesso."}, status_code=status.HTTP_200_OK)