// Removido o atributo 'fill="#393a37"' dos paths.

const ICON_ERROR_BI = '<i class="bi bi-exclamation-octagon-fill"></i>';
const ICON_SUCCESS_BI = '<i class="bi bi-check-circle-fill"></i>';
const ICON_INFO_BI = '<i class="bi bi-info-circle-fill"></i>';
const ICON_CLOSE_BI = '<i class="bi bi-x-lg"></i>';

function displayMessage(message, type) {
    const messageArea = document.getElementById('messageArea');
    if (!messageArea) {
        console.error("Elemento 'messageArea' não encontrado.");
        return;
    }

    // Mapeamento dos ícones Bootstrap para os tipos de mensagem
    let iconHtml;
    switch (type) {
        case 'success':
            iconHtml = ICON_SUCCESS_BI;
            break;
        case 'error':
            iconHtml = ICON_ERROR_BI;
            break;
        case 'info':
            iconHtml = ICON_INFO_BI;
            break;
        default:
            iconHtml = ICON_INFO_BI; // Padrão
    }
    
    // Limpa o timeout anterior, se houver, e o conteúdo
    if (messageArea.messageTimeout) {
        clearTimeout(messageArea.messageTimeout);
    }
    
    messageArea.className = `message-area ${type}`; // Define a classe de cor e a base

    // Constrói o novo HTML com a estrutura de alerta
    messageArea.innerHTML = `
        <div class="alert">
            <div class="alert__icon">${iconHtml}</div>
            <div class="alert__title">${message}</div>
            <div class="alert__close" id="closeAlert">${ICON_CLOSE_BI}</div>
        </div>
    `;

    // 1. Adiciona a classe para mostrar
    messageArea.classList.add("show-message"); 

    // 2. Adiciona o listener para fechar manualmente
    const closeButton = document.getElementById('closeAlert');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            // Nota: Você deve ter a função hideMessage definida em seu escopo global ou local.
            hideMessage(messageArea, messageArea.messageTimeout);
        });
    }

    // 3. Configura o fechamento automático após 5 segundos
    messageArea.messageTimeout = setTimeout(() => {
        hideMessage(messageArea);
    }, 5000);
}

// Função auxiliar para esconder a mensagem
function hideMessage(messageArea, timeoutId = null) {
    messageArea.classList.remove("show-message");
    
    // Limpa o timeout se estiver definido
    if (timeoutId) {
        clearTimeout(timeoutId);
    }

    // Limpa o conteúdo após a transição de opacidade terminar (0.4s do CSS)
    setTimeout(() => {
        messageArea.innerHTML = "";
        messageArea.className = "message-area"; // Reseta as classes
    }, 400); 
}

document.addEventListener("DOMContentLoaded", () => {
    // É crucial que o ID do formulário em login.html seja 'loginForm'
    const loginForm = document.getElementById("loginForm");

    // Verifica se o formulário de login existe na página atual
    if (loginForm) {
        // Obtém referências aos campos de input e ao botão de submit
        const emailInput = document.getElementById('email');
        const senhaInput = document.getElementById('senha');
        // O ID do botão deve ser 'loginSubmitButton' no HTML
        const submitButton = document.getElementById('loginSubmitButton');

        // Se algum elemento essencial faltar (após corrigir o HTML), pare aqui.
        if (!emailInput || !senhaInput || !submitButton) {
            console.error("Elementos essenciais do formulário de login (email, senha ou botão) não foram encontrados. Verifique o login.html.");
            return;
        }

        // Função para verificar se todos os campos obrigatórios estão preenchidos
        const checkFormValidity = () => {
            const isEmailFilled = emailInput.value.trim() !== '';
            const isSenhaFilled = senhaInput.value.trim() !== '';
            // Para login, não precisamos de validação de minLength aqui.
            return isEmailFilled && isSenhaFilled;
        };

        // Função para atualizar o estado (habilitado/desabilitado) e a cor do botão
        const updateButtonState = () => {
            if (checkFormValidity()) {
                submitButton.disabled = false;
                submitButton.classList.remove('button-inactive');
                submitButton.classList.add('button-active');
            } else {
                submitButton.disabled = true;
                submitButton.classList.remove('button-active');
                submitButton.classList.add('button-inactive');
            }
        };

        // Adiciona listeners de evento para cada campo para verificar a validade em tempo real
        emailInput.addEventListener('input', updateButtonState);
        senhaInput.addEventListener('input', updateButtonState);

        // Define o estado inicial do botão ao carregar a página
        updateButtonState();

        loginForm.addEventListener('submit', async function (event) {
            event.preventDefault(); // Previne o envio padrão do formulário

            if (!checkFormValidity()) {
                displayMessage('Por favor, preencha todos os campos.', 'error');
                return;
            }

            // Desabilita o botão para evitar múltiplos envios
            submitButton.disabled = true;
            submitButton.textContent = 'Entrando...';

            const email = emailInput.value.trim();
            const senha = senhaInput.value.trim();

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email,
                        senha: senha
                    })
                });

                // Tenta ler o JSON de forma robusta
                const responseText = await response.text();
                let data;

                try {
                    data = JSON.parse(responseText);
                } catch (jsonError) {
                    throw new Error(`Resposta inválida do servidor. Status: ${response.status}.`);
                }

                // --- Lógica Principal de Tratamento de Resposta ---
                if (response.ok) { // Status 200 OK: Login bem-sucedido
                    displayMessage(data.message, 'success');
                    setTimeout(() => {
                        window.location.href = data.redirect_url || '/chat';
                    }, 1500);
                } else {
                    // 🌟 MUDANÇA CRÍTICA: Trata o 403 (Não Verificado) e oferece o link de reenvio
                    if (response.status === 403) {
                        let msg = data.message || 'Sua conta não está verificada.';

                        // Cria um botão de Reenvio no lugar da mensagem de erro
                        const reenvioLink = `<a href="#" id="resendVerificationLink" style="font-weight: bold; color: var(--highlight-color); text-decoration: underline;">Clique aqui para reenviar o link.</a>`;

                        displayMessage(`${msg}<br>${reenvioLink}`, 'error');

                        // Adiciona o Listener ao novo link de reenvio
                        document.getElementById('resendVerificationLink')?.addEventListener('click', async (e) => {
                            e.preventDefault();
                            await resendVerificationCode(email);
                        });

                    } else {
                        // Erro padrão (e.g., 401: Credenciais inválidas)
                        displayMessage(data.detail || 'Erro no login. Verifique suas credenciais.', 'error');
                    }
                }
                // 🌟 NOVO: Função para Reenvio do Link de Verificação
                async function resendVerificationCode(email) {
                    displayMessage('Enviando novo link...', 'info');
                    try {
                        const response = await fetch('/resend_verification_code', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            // O backend espera um Form, não JSON. 
                            body: `email=${encodeURIComponent(email)}`
                        });

                        const data = await response.json();

                        if (response.ok) {
                            displayMessage(data.message, 'success');
                        } else {
                            displayMessage(data.detail || 'Erro ao reenviar o link.', 'error');
                        }
                    } catch (error) {
                        console.error('Erro na requisição de reenvio:', error);
                        displayMessage('Ocorreu um erro de conexão ao reenviar o link.', 'error');
                    }
                }

            } catch (error) {
                console.error('Erro na requisição:', error);
                displayMessage(error.message || 'Ocorreu um erro ao tentar fazer login. Tente novamente.', 'error');
            } finally {
                // Reabilita o botão e restaura o texto
                submitButton.disabled = false;
                submitButton.textContent = 'Logar';
                updateButtonState(); // Restaura o estado de cor
            }
        });
    }
});