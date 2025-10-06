import os
import logging
import uuid
import datetime
from typing import Dict, Any, Optional

from langchain_google_genai import ChatGoogleGenerativeAI 
from langchain.chains import ConversationChain
from langchain.memory import ConversationSummaryBufferMemory
from langchain_core.messages import HumanMessage, AIMessage
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain.prompts import PromptTemplate
from fastapi import Request, Depends

import aiomysql 


logger = logging.getLogger(__name__)

_llm = None
_llm_title_generator = None
user_conversations_instances: Dict[Any, Dict[str, Any]] = {}

def initialize_llms():
    """Inicializa os LLMs de forma segura e única."""
    global _llm, _llm_title_generator
    if _llm is not None:
        return

    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        logger.error("GEMINI_API_KEY não encontrada nas variáveis de ambiente.")
        raise RuntimeError("GEMINI_API_KEY não encontrada.")

    _llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash", 
        temperature=0.2,
        google_api_key=gemini_api_key
    )
    _llm_title_generator = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash", 
        temperature=0, 
        google_api_key=gemini_api_key
    )
    logger.info("LLMs inicializados com sucesso.")

def get_llm_title_generator() -> ChatGoogleGenerativeAI:
    """Retorna a instância do LLM para geração de títulos, inicializando se necessário."""
    initialize_llms()
    if _llm_title_generator is None:
        raise RuntimeError("llm_title_generator não inicializado.")
    return _llm_title_generator


templates_by_lang = {
    "pt": PromptTemplate(
        input_variables=["history", "input"], 
        template="""**Você é o Fala Aí, um assistente de IA amigável, prestativo e otimista, construído com a tecnologia Gemini da Google.**

**Sua Missão e Estilo:**
1. **Seja cortês e acessível:** Responda de forma clara, direta e com um tom positivo e encorajador.
2. **Seja preciso:** Forneça informações factuais e relevantes. Se não souber de algo, diga que não tem a informação, mas mantenha a cortesia (ex: "Isso é algo que eu não tenho como responder, mas posso ajudar com...").
3. **Mantenha o contexto:** Use o histórico da conversa para manter a coerência nas respostas.
4. **Responda em Português do Brasil** e use a linguagem natural de um bom conversador.
5. **Seja objetivo e conciso**, mas não rude. Evite respostas muito longas, a menos que o usuário peça um detalhamento.


Histórico da Conversa:
{history}

Pergunta do Usuário:
{input}

Sua Resposta:"""
    ),
}

TITLE_GENERATION_PROMPT = """Você é um especialista em sumarização. Receberá a primeira mensagem de uma conversa. Sua tarefa é criar um título muito conciso e descritivo (máximo de 5 palavras) para essa conversa. O título deve ser em Português do Brasil.

Primeira mensagem: {first_message}
Título:"""



async def get_user_conversation_instance(
    request: Request,
    user_id: Optional[int] = Depends(lambda: None),
    conn = Depends(lambda: None) 
) -> Dict[str, Any]:
    """
    Obtém ou cria uma instância de ConversationChain para o usuário (logado ou anônimo).
    Retorna o dicionário contendo a 'chain' e o 'current_conversation_id'.
    """

    initialize_llms() 
    

    global _llm
    llm = _llm 
 
    key = None
    if user_id is None:
        session_id = request.session.get("session_id")
        if not session_id:
            session_id = str(uuid.uuid4())
            request.session["session_id"] = session_id
        key = session_id
    else:
        key = user_id

    if key in user_conversations_instances:
        return user_conversations_instances[key]


    if user_id is None:

        memory = ConversationSummaryBufferMemory(
            llm=llm, 
            max_token_limit=4000, 
            return_messages=True, 
            memory_key="history"
        )
        
        user_conversations_instances[key] = {
            "chain": ConversationChain(
                llm=llm, 
                memory=memory, 
                prompt=templates_by_lang["pt"],
                input_key="input"
            ), 
            "current_conversation_id": None
        }
        
        return user_conversations_instances[key]
        
    else:
        if conn is None:
             raise RuntimeError("Conexão de banco de dados não injetada para usuário logado.")
        
        cursor = await conn.cursor(aiomysql.DictCursor)
        
        await cursor.execute(
            "SELECT id, titulo_conversa FROM conversas WHERE id_usuario = %s ORDER BY data_atualizacao DESC LIMIT 1",
            (user_id,)
        )
        last_conversation = await cursor.fetchone()
        
        conversation_id = None
        history_messages = []
        
        if last_conversation:
            conversation_id = last_conversation['id']
            await cursor.execute(
                "SELECT remetente, conteudo FROM mensagens WHERE id_conversa = %s ORDER BY data_envio ASC",
                (conversation_id,)
            )
            messages_data = await cursor.fetchall()
            
            for msg_data in messages_data:
                if msg_data['remetente'] == 'usuario':
                    history_messages.append(HumanMessage(content=msg_data['conteudo']))
                else:
                    history_messages.append(AIMessage(content=msg_data['conteudo']))
            
            logger.info(f"Carregada conversa {conversation_id} para o usuário {user_id}")
        else:
            logger.info(f"Nenhuma conversa encontrada para o usuário {user_id}. Será criada na primeira mensagem.")
            
        await cursor.close()

        memory = ConversationSummaryBufferMemory(
            llm=llm, 
            max_token_limit=4000, 
            return_messages=True,
            chat_memory=ChatMessageHistory(messages=history_messages), 
            memory_key="history"
        )
        user_conversations_instances[key] = {
            "chain": ConversationChain(
                llm=llm, 
                memory=memory, 
                prompt=templates_by_lang["pt"], 
                input_key="input"
            ), 
            "current_conversation_id": conversation_id
        }
        
        return user_conversations_instances[key]