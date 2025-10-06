Opa\! Com certeza. Seu projeto está bem estruturado, e a documentação a seguir ajudará qualquer pessoa a entendê-lo e configurá-lo.

Aqui está a documentação completa para seu projeto backend do FalaAI, incluindo a descrição, o arquivo `.env` de exemplo e as instruções de configuração.

-----

# Documentação do Backend do FalaAI 🤖

## 1\. Descrição do Projeto

O **FalaAI** é o backend de um aplicativo de chatbot conversacional robusto, construído com **FastAPI** (Python) e utilizando a inteligência artificial do **Google Gemini (LangChain)**.

Este projeto foca em fornecer uma experiência de chat persistente e segura. Ele implementa um sistema completo de **Autenticação (Login/Registro)**, **Verificação de Email por Link** e um **Gerenciamento de Conversas** que persiste o histórico de chat no banco de dados.

### 🌟 Principais Recursos:

  * **Chat Conversacional com Gemini:** Integração via LangChain e `gemini-2.5-flash` para respostas rápidas e contextuais.
  * **Histórico Persistente:** O histórico de chat é salvo e recuperado do banco de dados (MySQL/TiDB), mantendo o contexto via `ConversationSummaryBufferMemory`.
  * **Autenticação Segura:** Login, Registro e Atualização de Perfil com hashing de senha robusto usando **Argon2** (`passlib`).
  * **Verificação de Email:** Novo fluxo de autenticação que exige a verificação do email por **link único** (token UUID) antes de permitir o login, usando o **SendGrid** para envio de emails em segundo plano.
  * **Geração de Títulos Automática:** Criação de títulos concisos para novas conversas em background, mantendo a interface de usuário organizada.
  * **Limpeza de Dados Agendada:** Uma tarefa de background (utilizando o ciclo de vida do FastAPI) limpa conversas antigas para otimizar o banco de dados.
  * **Estrutura Modular:** Código organizado em módulos (`auth`, `chat`, `db`, `utils`) para facilitar a manutenção e escalabilidade.

-----

## 2\. Configuração de Variáveis de Ambiente (`.env`)

Crie um arquivo chamado **`.env`** na raiz do seu projeto e preencha-o com as informações abaixo. Estas chaves são **essenciais** para a segurança e funcionalidade do aplicativo.

```dotenv
# ====================================================================
# VARIÁVEIS DE AMBIENTE DO BACKEND FASTAPI - FALA AI
# Crie o arquivo .env na raiz do projeto e preencha com suas credenciais.
# ====================================================================

# --- 1. CHAVES DE SEGURANÇA ---
# Chave secreta para criptografar as sessões (SessionMiddleware) do FastAPI.
# Use uma string longa e aleatória (ex: gerada com 'openssl rand -hex 32').
SESSION_SECRET_KEY="SUA_CHAVE_SECRETA_MUITO_LONGA_E_ALEATORIA_AQUI"

# --- 2. CONFIGURAÇÃO DO GOOGLE GEMINI (IA) ---
# Chave da API do Google Gemini.
# Necessária para a LangChain e o funcionamento do Chat.
GEMINI_API_KEY="SUA_CHAVE_GEMINI_API_AQUI"

# --- 3. CONFIGURAÇÃO DO BANCO DE DADOS (MySQL/TiDB) ---
# Usado pelo aiomysql para conexões persistentes via pool.

DB_HOST="SEU_HOST_DO_BANCO_DE_DADOS_AQUI"
DB_USER="SEU_USUARIO_DO_BANCO_DE_DADOS_AQUI"
DB_PASSWORD="SUA_SENHA_DO_BANCO_DE_DADOS_AQUI"
DB_NAME="falaai_db"
DB_PORT=4000
# DICA: Para o TiDB Cloud, use a porta 4000 e 'ssl=True' no db/dependencies.py

# --- 4. CONFIGURAÇÃO DE ENVIO DE EMAIL (SENDGRID) ---
# Usado para enviar o link de verificação de email no registro e reenvio.

# Chave da API do SendGrid.
SENDGRID_API_KEY="SUA_CHAVE_SENDGRID_API_AQUI"
# Email do remetente (deve ser um email verificado no SendGrid).
EMAIL_USER="noreply@seuservico.com" 
```

-----

## 3\. Estrutura do Backend

| Caminho | Arquivo | Descrição |
| :--- | :--- | :--- |
| `/` | `main.py` | Ponto de entrada do FastAPI. Configura o `Lifespan` (pool DB e limpeza agendada), `SessionMiddleware` e monta as rotas. |
| `/` | `common_deps.py` | Define a instância do `Jinja2Templates` e a função de dependência `get_current_user` para extrair o ID da sessão. |
| `/auth` | `models.py` | Modelos Pydantic para as rotas de autenticação: `UserRegister`, `UserLogin` e `VerifyCode`. |
| `/auth` | `routes.py` | Contém todas as rotas de autenticação (`/login`, `/register`, `/logout`, `/profile`, `/verify_link/{token}`). Lida com hashing de senha (Argon2) e gestão de sessão. |
| `/chat` | `models.py` | Modelo Pydantic para a mensagem do chat: `Message`. |
| `/chat` | `llm_config.py` | Gerencia a inicialização dos LLMs (Gemini), define os `PromptTemplates` e contém a dependência crítica `get_user_conversation_instance` (LangChain Memory/Cache). |
| `/chat` | `routes.py` | Rotas do chat: `/chat` (página HTML), `/chat/message` (API de conversa), `/conversations` (lista de chats) e `/conversation/{id}` (mensagens de um chat). Lida com a criação/persistência no DB. |
| `/db` | `dependencies.py` | Gerencia o **pool de conexões** `aiomysql` (`startup`/`shutdown`) e o `get_db_connection` (FastAPI `Depends`). |
| `/settings` | `config.py` | Carrega todas as variáveis de ambiente e as encapsula na classe `Config` para uso centralizado. |
| `/utils` | `email_sender.py` | Funções assíncronas para o envio de emails via **SendGrid API**, usadas para o processo de verificação de link. |

-----

## 4\. Comandos Essenciais

### 4.1. Instalação de Dependências

Certifique-se de usar um ambiente virtual e instale todas as bibliotecas necessárias.

```bash
# Crie o ambiente virtual (opcional, mas recomendado)
python3 -m venv venv
source venv/bin/activate

# Instale as dependências (assumindo que já estão no seu requirements.txt)
pip install fastapi uvicorn python-dotenv pydantic aiomysql passlib[argon2] \
    langchain-google-genai langchain langchain-core sendgrid aiofiles jinja2
```

### 4.2. Execução do Servidor

Para iniciar o servidor usando `uvicorn` (com recarregamento automático durante o desenvolvimento):

```bash
uvicorn main:app --reload
```

O backend estará acessível em `http://127.0.0.1:8000`.

### 4.3. Estrutura do Banco de Dados (SQL)

Você precisará criar a estrutura de tabelas para que o backend funcione corretamente.

**Tabela `usuarios`:**

```sql
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    termos_registro BOOLEAN NOT NULL,
    data_registro DATETIME NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(36) NULL, -- UUID para o link de verificação
    code_expiration DATETIME NULL,
    profile_pic_url VARCHAR(255) DEFAULT '/static/images/default_profile.png'
);
```

**Tabela `conversas`:**

```sql
CREATE TABLE conversas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    titulo_conversa VARCHAR(50) DEFAULT 'Nova Conversa',
    data_criacao DATETIME NOT NULL,
    data_atualizacao DATETIME NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);
```

**Tabela `mensagens`:**

```sql
CREATE TABLE mensagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_conversa INT NOT NULL,
    remetente ENUM('usuario', 'ia') NOT NULL,
    conteudo TEXT NOT NULL,
    data_envio DATETIME NOT NULL,
    FOREIGN KEY (id_conversa) REFERENCES conversas(id) ON DELETE CASCADE
);
```
