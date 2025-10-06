document.addEventListener("DOMContentLoaded", () => {
    // FUNÇÃO AUXILIAR: Exibir mensagens de feedback
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

    // O ID do formulário é 'registerForm' (conforme o código JS)
    const registerForm = document.getElementById("registerForm");

    if (registerForm) {
        // Obtém referências a todos os campos de input
        const nomeInput = document.getElementById("nomeCompleto");
        const emailInput = document.getElementById("email");
        const senhaInput = document.getElementById("senha");
        const confirmarSenhaInput = document.getElementById("confirmarSenha");
        const termosCheckbox = document.getElementById("terms");
        const submitButton = document.getElementById("registerSubmitButton");

        // Garante que todos os elementos necessários estão presentes
        if (!nomeInput || !emailInput || !senhaInput || !confirmarSenhaInput || !termosCheckbox || !submitButton) {
            console.error("Um ou mais elementos do formulário não foram encontrados. Verifique as IDs.");
            return;
        }

        // --- Lógica de Validação e Ativação do Botão ---
        const checkFormValidity = () => {
            const isNomeFilled = nomeInput.value.trim() !== "";
            const isEmailFilled = emailInput.value.trim() !== "";
            // Usamos 8 caracteres no JS para dar uma mensagem clara ao usuário
            const isSenhaValid = senhaInput.value.trim() !== "" && senhaInput.value.length >= 8;
            const arePasswordsMatching = senhaInput.value === confirmarSenhaInput.value;
            const areTermsAccepted = termosCheckbox.checked;

            return isNomeFilled && isEmailFilled && isSenhaValid && arePasswordsMatching && areTermsAccepted;
        };

        const updateButtonState = () => {
            if (checkFormValidity()) {
                submitButton.disabled = false;
                submitButton.classList.remove("button-inactive");
                submitButton.classList.add("button-active");
            } else {
                submitButton.disabled = true;
                submitButton.classList.remove("button-active");
                submitButton.classList.add("button-inactive");
            }
        };

        // Adiciona listeners para verificar a validade em tempo real
        [nomeInput, emailInput, senhaInput, confirmarSenhaInput].forEach(input => input.addEventListener("input", updateButtonState));
        termosCheckbox.addEventListener("change", updateButtonState);

        // Define o estado inicial do botão
        updateButtonState();

        // --- Lógica de Submissão do Formulário ---
        registerForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            // Revalidação final (Frontend)
            if (!checkFormValidity()) {
                displayMessage("Por favor, preencha todos os campos corretamente e aceite os termos (mínimo 8 caracteres para senha).", "error");
                return;
            }

            submitButton.disabled = true; // Desabilita o botão ao iniciar a requisição

            const nome = nomeInput.value.trim();
            const email = emailInput.value.trim();
            const senha = senhaInput.value.trim();
            const termosRegistro = termosCheckbox.checked;

            try {
                const payload = {
                    nome: nome,
                    email: email,
                    senha: senha,
                    termos_registro: termosRegistro,
                };

                const response = await fetch("/register", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                });

                // Tenta ler o JSON de forma robusta
                const responseText = await response.text();
                let responseData;

                try {
                    responseData = JSON.parse(responseText);
                } catch (jsonError) {
                    // Se o parse falhar, a resposta não é JSON (pode ser erro 500 puro)
                    console.error(`Falha ao decodificar JSON (Status ${response.status}). Resposta bruta:`, responseText.substring(0, 500));
                    throw new Error(`Resposta inválida do servidor (Status ${response.status}).`);
                }

                // Linhas de log que você estava vendo:
                console.log("Resposta do backend:", responseData);
                console.log("URL de redirecionamento:", responseData.redirect_url);


                if (!response.ok) {
                    // Captura a mensagem de erro detalhada do FastAPI (chave 'detail')
                    const errorMessage = responseData.detail || responseData.message || `Erro do Servidor (Status ${response.status})`;
                    throw new Error(errorMessage);
                }

                // Cadastro bem-sucedido (Status 201)
                displayMessage(responseData.message || "Cadastro realizado com sucesso! Vá para o login e verifique seu email.", "success");

                if (responseData.redirect_url) {
                    setTimeout(() => {
                        window.location.href = responseData.redirect_url; // Vai para /login
                    }, 2000); // Aumentei o delay para o usuário ler a mensagem
                }

            } catch (error) {
                console.error("Erro na requisição Fetch:", error);
                displayMessage(error.message || "Ocorreu um erro desconhecido. Verifique sua conexão.", "error");
            } finally {
                submitButton.disabled = false; // Reabilita o botão
            }
        });
    }
});
