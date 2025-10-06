from fastapi import Request
from fastapi.templating import Jinja2Templates
from typing import Optional

templates = Jinja2Templates(directory="templates")

async def get_current_user(request: Request) -> Optional[int]:
    """Retorna o ID do usuário logado ou None se não houver."""
    return request.session.get("user_id")

def get_current_user_sync(request: Request) -> Optional[int]:
    """Versão síncrona para acesso rápido fora do Depends."""
    return request.session.get("user_id")