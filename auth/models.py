from pydantic import BaseModel, EmailStr
from typing import Optional

class UserRegister(BaseModel):
    """Modelo para registro de novo usuário."""
    nome: str
    email: EmailStr
    senha: str
    termos_registro: bool

class UserLogin(BaseModel):
    """Modelo para login de usuário."""
    email: str
    senha: str

class VerifyCode(BaseModel):
    """Modelo para verificação de código de email."""
    email: str
    code: str
