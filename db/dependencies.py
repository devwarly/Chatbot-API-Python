import logging
import aiomysql
from fastapi import HTTPException
from settings.config import Config

logger = logging.getLogger(__name__)

db_pool = None

async def startup_db_pool(config: Config):
    """Cria o pool de conexão do banco de dados na inicialização da aplicação."""
    global db_pool
    try:
        db_pool = await aiomysql.create_pool(
            host=config.DB_HOST,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            db=config.DB_NAME,
            port=config.DB_PORT,
            autocommit=True,
            cursorclass=aiomysql.DictCursor,
            ssl=True 
        )
        logger.info("Pool de conexão do MySQL criado com sucesso!")
    except Exception as e:
        logger.error(f"Erro ao criar pool de conexão do MySQL: {e}", exc_info=True)
        raise RuntimeError("Não foi possível conectar ao banco de dados.") 

async def shutdown_db_pool():
    """Fecha o pool de conexão do banco de dados no desligamento da aplicação."""
    global db_pool
    if db_pool:
        db_pool.close()
        await db_pool.wait_closed()
        logger.info("Pool de conexão do MySQL fechado.")

async def get_db_connection():
    """Obtém uma conexão do pool de banco de dados e a libera após o uso (FastAPI Depends)."""
    if db_pool is None:
        logger.error("Tentativa de obter conexão de DB antes do pool ser criado.")
        raise HTTPException(status_code=500, detail="Serviço de banco de dados indisponível.")
    
    async with db_pool.acquire() as conn:
        yield conn