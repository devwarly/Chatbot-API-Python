import os
from dotenv import load_dotenv


load_dotenv() 

EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USER = os.getenv("EMAIL_USER") 
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD") 



class Config:
    """
    Classe de configuração para o aplicativo FastAPI,
    usando Variáveis de Ambiente do Render ou TiDB Cloud.
    """

    SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "SUA_CHAVE_DE_FALLBACK")
  
    DB_HOST = os.getenv("DB_HOST", "SEU_HOST_TIDB_AQUI")
    
  
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "SUA_SENHA_LOCAL")
    DB_NAME = os.getenv("DB_NAME", "falaai_db")
    DB_PORT = int(os.getenv("DB_PORT", 4000))
    
    EMAIL_USER = os.getenv("EMAIL_USER")
    EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD") 