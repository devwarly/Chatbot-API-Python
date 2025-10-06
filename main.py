import os
import logging
import uvicorn
import asyncio
from typing import Awaitable, Callable
import aiomysql
from fastapi import FastAPI, HTTPException, Request, Depends 
from fastapi.responses import HTMLResponse, JSONResponse 
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from settings.config import Config 

from db.dependencies import startup_db_pool, shutdown_db_pool, get_db_connection 


from auth import routes as auth_routes
from chat import routes as chat_routes
from common_deps import templates

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
load_dotenv()

config = Config()

cleanup_task = None


async def cleanup_old_conversations(conn: aiomysql.Connection):
    """Executa a limpeza de conversas mais antigas que 3 dias no MySQL."""
    SQL_CLEANUP_MESSAGES = """
        DELETE FROM mensagens
        WHERE id_conversa IN (
            SELECT id FROM conversas
            WHERE data_atualizacao < DATE_SUB(NOW(), INTERVAL 3 DAY)
        );
    """
    
    SQL_CLEANUP_CONVERSATIONS = """
        DELETE FROM conversas
        WHERE data_atualizacao < DATE_SUB(NOW(), INTERVAL 3 DAY);
    """

    async with conn.cursor() as cur:
        try:

            await cur.execute(SQL_CLEANUP_MESSAGES)
            messages_count = cur.rowcount

            await cur.execute(SQL_CLEANUP_CONVERSATIONS)
            conversations_count = cur.rowcount

            await conn.commit()
            logger.info(f"Limpeza de conversas antigas concluída: {messages_count} mensagens e {conversations_count} conversas deletadas.")
            
        except Exception as e:
            await conn.rollback()
            logger.error(f"Erro durante a limpeza de conversas antigas: {e}", exc_info=True)


async def schedule_cleanup():
    """Agenda a tarefa de limpeza para rodar a cada 24 horas."""
 
    from db.dependencies import get_db_connection 
    
    interval_seconds = 24 * 3600 
    logger.info(f"Agendando tarefa de limpeza para rodar a cada {interval_seconds} segundos (3 dias de retenção).")

    await asyncio.sleep(20) 
    
    while True:
        try:
            async for conn in get_db_connection():
                await cleanup_old_conversations(conn)

                break 

        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Erro inesperado na tarefa agendada: {e}")
            
        await asyncio.sleep(interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida do pool de conexões do DB e a tarefa de limpeza."""
    global cleanup_task

    try:
        await startup_db_pool(config) 

        cleanup_task = asyncio.create_task(schedule_cleanup()) 
        
        logger.info("Aplicação iniciada com sucesso (Lifespan).")
    except RuntimeError as e:
        logger.error(f"Falha na inicialização do DB: {e}")
        raise e 
        
    yield 

    if cleanup_task:
        logger.info("Cancelando tarefa de limpeza de conversas...")
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            logger.info("Tarefa de limpeza cancelada com sucesso.")
        except Exception as e:
            logger.error(f"Erro ao cancelar tarefa de limpeza: {e}")

    await shutdown_db_pool()
    logger.info("Aplicação encerrada (Lifespan).")

app = FastAPI(lifespan=lifespan)


app.add_middleware(SessionMiddleware, secret_key=config.SESSION_SECRET_KEY)

app.mount("/static", StaticFiles(directory="static"), name="static")



@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Rota inicial que carrega o template 'index.html'."""
    user_id = request.session.get("user_id")
    user_first_name = "Usuário"
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "user_id": user_id, "user_name": user_first_name}
    )

app.include_router(auth_routes.router, tags=["auth"])
app.include_router(chat_routes.router, tags=["chat"])

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
