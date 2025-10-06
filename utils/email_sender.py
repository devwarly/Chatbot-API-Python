import os
import logging 
import asyncio
from typing import Optional

from dotenv import load_dotenv

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

logger = logging.getLogger(__name__)

load_dotenv()

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
SENDER_EMAIL = os.getenv("EMAIL_USER") 

def _send_email_sync_sendgrid(sender, receiver, subject, html_content):
    """
    Função síncrona para enviar email usando a biblioteca SendGrid.
    Executada em um thread separado (via asyncio.to_thread).
    """
    if not SENDGRID_API_KEY or not sender:
        logger.error("SENDGRID_API_KEY ou EMAIL_USER não configurados.")
        return False 

    try:
        message = Mail(
            from_email=sender,
            to_emails=receiver,
            subject=subject,
            html_content=html_content
        )
 
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        
        if response.status_code == 202:
            return True
        else:
            logger.error(f"Falha ao enviar email via SendGrid. Status: {response.status_code}, Corpo: {response.body.decode('utf-8') if response.body else 'Sem Corpo'}")
            return False

    except Exception as e:
        logger.error(f"Erro na chamada da API do SendGrid: {e}", exc_info=True)
        return False


async def send_verification_link_email(receiver_email, verification_url, subject="Ação Necessária: Verifique Seu Email e Ative Sua Conta FalaAI"):
    """
    Envia um email com um LINK de verificação usando a API do SendGrid.
    """
    if not SENDER_EMAIL or not SENDGRID_API_KEY:
        logger.error("Credenciais do SendGrid/EMAIL não configuradas. Envio de email falhou.")
        return False
        
    html_content = f"""
    <html>
        <body>
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #007bff;">Bem-vindo(a) ao FalaAI!</h2>
                <p>Obrigado por se juntar à nossa comunidade. Para garantir a segurança e ativar todos os recursos da sua conta, precisamos que você verifique seu endereço de e-mail.</p>

                <p style="margin: 25px 0;">
                    <a href="{verification_url}" style="
                        display: inline-block; 
                        padding: 12px 25px; 
                        background-color: #00e5ff; 
                        color: #0d0d0d; 
                        text-decoration: none; 
                        border-radius: 6px; 
                        font-weight: bold;
                        font-size: 16px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    ">Verificar Meu Email Agora</a>
                </p>

                <p>O link de verificação expira em 24 horas.</p>

                <p>Se você não solicitou este registro, por favor, ignore este e-mail. Nenhuma ação será tomada em sua conta.</p>

                <br>
                <p style="font-size: 0.9em; color: #666;">
                    Atenciosamente,<br>
                    Equipe FalaAI
                </p>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                
                <p style="font-size: 0.75em; color: #999;">
                    Este e-mail é essencial para o serviço e foi enviado para {receiver_email}.<br>
                    [Endereço Físico Exigido por Lei, Ex: Rua Fictícia, 123, Cidade, País, CEP 00000-000]<br>
                    <a href="#" style="color: #999;">Opções de descadastro</a> (Recomendamos não se descadastrar de emails de segurança).
                </p>
            </div>
        </body>
    </html>
    """

    try:
        success = await asyncio.to_thread(_send_email_sync_sendgrid, 
            SENDER_EMAIL, 
            receiver_email, 
            subject,
            html_content
        )
        
        if success:
            logger.info(f"Link de verificação enviado com sucesso para {receiver_email} via SendGrid API.")
        return success
        
    except Exception as e:
        logger.error(f"Erro fatal ao agendar envio de email para {receiver_email}: {e}", exc_info=True)
        return False
        
def generate_verification_code(length=6):
    """Função legada para gerar códigos numéricos."""
    return ''.join(random.choices('0123456789', k=length))

async def send_verification_email(receiver_email, code, subject="Seu Código de Verificação do FalaAI"):
    """Função legada: não usada no novo fluxo."""
    logger.warning("send_verification_email (código numérico) chamado, mas o fluxo primário é o link.")
    return False
