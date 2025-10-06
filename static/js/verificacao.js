// static/js/verificacao.js

// Função para exibir mensagens na área de mensagens (reutilizada de form.js)
function displayMessage(message, type) {
    const messageArea = document.getElementById('messageArea');
    if (!messageArea) {
        console.error("Elemento 'messageArea' não encontrado.");
        return;
    }
    // Melhoria: Limpa classes e conteúdo antes de adicionar, para evitar sobreposição
    messageArea.innerHTML = '';
    messageArea.className = ''; // Remove todas as classes existentes
    const p = document.createElement("p");
    p.className = type; // Adiciona a classe 'success' ou 'error'
    p.textContent = message;
    messageArea.appendChild(p);
    messageArea.classList.add("show-message"); // Adiciona a classe para ativar a transição de opacidade

    setTimeout(() => {
        messageArea.classList.remove("show-message"); // Inicia o fade-out
        // Se você tem transição CSS, pode querer um delay extra aqui para a transição terminar antes de limpar
        // setTimeout(() => {
        //     messageArea.innerHTML = '';
        // }, 500); // Exemplo: 500ms para transição de opacidade
    }, 5000); // A mensagem fica visível por 5 segundos
}

document.addEventListener("DOMContentLoaded", function () {
    const codeInputs = document.querySelectorAll(".code-input");
    const verificationForm = document.getElementById("verificacaoForm");
    const resendCodeLink = document.getElementById("resendCodeLink");
    const displayEmail = document.getElementById("displayEmail"); // Elemento para exibir o email

    // --- Obter e Exibir Email da URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('email');
    if (emailFromUrl) {
        // Pré-preenche o input de email se ele existir e for read-only
        const emailHiddenInput = document.getElementById('emailHidden'); // Assumindo que você tem um input hidden ou read-only para o email
        if (emailHiddenInput) {
            emailHiddenInput.value = emailFromUrl;
        }
        displayEmail.textContent = emailFromUrl;
    } else {
        displayEmail.textContent = 'seu email'; // Fallback se o email não estiver na URL
        console.warn("Email não encontrado na URL. O reenviar código pode não funcionar.");
    }

    // --- Lógica para Inputs de Código (Auto-foco, Backspace, Colar) ---
    codeInputs.forEach((input, index) => {
        input.addEventListener("input", (e) => {
            let value = e.target.value;

            // Permitir apenas números
            if (!/^\d$/.test(value)) {
                e.target.value = "";
                return;
            }

            // Avança automaticamente se houver próximo input
            if (value.length === 1 && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
        });

        input.addEventListener("keydown", (e) => {
            // Se a tecla for Backspace e o campo estiver vazio, move para o campo anterior
            if (e.key === "Backspace" && index > 0 && input.value.length === 0) {
                codeInputs[index - 1].focus();
            }
        });

        input.addEventListener("paste", (e) => {
            e.preventDefault(); // Evita que o usuário cole valores inválidos
            let pasteData = (e.clipboardData || window.clipboardData).getData("text");
            let numbers = pasteData.replace(/\D/g, "").split(""); // Mantém apenas números

            // Preencher os inputs automaticamente com os números colados
            numbers.forEach((num, i) => {
                if (index + i < codeInputs.length) {
                    codeInputs[index + i].value = num;
                    if (index + i < codeInputs.length - 1) {
                        codeInputs[index + i + 1].focus();
                    }
                }
            });
            // Após colar, foca no último campo preenchido ou no próximo
            if (index + numbers.length - 1 < codeInputs.length) {
                codeInputs[Math.min(index + numbers.length -1, codeInputs.length - 1)].focus();
            }
        });
    });

    // --- Lógica de Envio do Formulário de Verificação ---
    if (verificationForm) {
        verificationForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            // Concatena os valores de todos os inputs de código
            const code = Array.from(codeInputs).map(input => input.value).join('');
            // Pega o email do elemento HTML que o exibe (ou de um input hidden, se existir)
            const email = emailFromUrl || displayEmail.textContent; 

            if (code.length !== 6) { // O código agora é de 6 dígitos
                displayMessage('Por favor, insira o código completo de 6 dígitos.', 'error');
                return;
            }
            if (!email || email === 'seu email') {
                 displayMessage('Email não encontrado para verificação. Volte à página de cadastro.', 'error');
                 return;
            }

            try {
                const response = await fetch('/verify_email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: email, code: code })
                });

                const data = await response.json();

                console.log("Resposta do backend (verify_email):", data);
                console.log("URL de redirecionamento (verify_email):", data.redirect_url); // Deve ser /sucesso

                if (response.ok) {
                    displayMessage(data.message, 'success');
                    if (data.redirect_url) {
                        setTimeout(() => {
                            window.location.href = data.redirect_url; // <-- CORRIGIDO AQUI! Vai para /sucesso
                        }, 1500);
                    } else {
                        console.warn("Verificação de sucesso, mas sem URL de redirecionamento na resposta do backend.");
                        // Fallback, pode ser um redirecionamento manual se a URL não vier
                        // window.location.href = '/sucesso';
                    }
                } else {
                    displayMessage(data.detail || 'Erro na verificação do código.', 'error');
                }
            } catch (error) {
                console.error('Erro na requisição de verificação:', error);
                displayMessage('Ocorreu um erro ao verificar o código. Verifique sua conexão ou tente novamente.', 'error');
            }
        });
    }

    // --- Lógica para Reenviar o Código ---
    if (resendCodeLink) {
        resendCodeLink.addEventListener('click', async (event) => {
            event.preventDefault();
            const email = emailFromUrl || displayEmail.textContent; // Pega o email da URL ou do elemento

            if (!email || email === 'seu email') {
                displayMessage('Não foi possível reenviar o código sem um email. Por favor, volte à página de cadastro.', 'error');
                return;
            }

            displayMessage('Enviando novo código...', 'info'); // Mensagem de feedback

            try {
                const response = await fetch('/resend_verification_code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: email })
                });

                const data = await response.json();

                if (response.ok) {
                    displayMessage(data.message, 'success');
                } else {
                    displayMessage(data.detail || 'Erro ao reenviar o código.', 'error');
                }
            } catch (error) {
                console.error('Erro na requisição de reenviar código:', error);
                displayMessage('Ocorreu um erro ao reenviar o código. Verifique sua conexão ou tente novamente.', 'error');
            }
        });
    }
});