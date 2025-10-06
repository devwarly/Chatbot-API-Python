// static/js/profile.js

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("profile-update-form");
    const picUpload = document.getElementById("profile-pic-upload");
    const picPreview = document.getElementById("profile-pic-preview");
    const passwordInput = document.getElementById("senha");
    const confirmPasswordInput = document.getElementById("confirm_senha");
    const messageContainer = document.getElementById("message-container");
    const saveButton = document.getElementById("save-button");
    const emailInput = document.getElementById("email");
    const resendButton = document.getElementById("resend-verification-button");
    // 🌟 NOVO: Obtém o botão de logout
    const logoutButton = document.getElementById('logout-button');

    const ALERT_ICONS = {
        'success': '<i class="bi bi-check-circle-fill"></i>',
        'error': '<i class="bi bi-exclamation-triangle-fill"></i>',
        'warning': '<i class="bi bi-info-circle-fill"></i>'
    };

    // Função de mensagem aprimorada (mantida)
    function displayMessage(text, type = 'success') {
        const messageContainer = document.getElementById("message-container");
        if (!messageContainer) return;

        // Mapeia o tipo para a classe CSS e pega o ícone
        const cssClass = type === 'error' ? 'error' : (type === 'warning' ? 'warning' : 'success');
        const iconHtml = ALERT_ICONS[cssClass];

        // Limpa o conteúdo anterior
        messageContainer.innerHTML = '';

        // 1. Cria a estrutura do Alerta
        const alertDiv = document.createElement('div');
        alertDiv.classList.add('profile-alert', `alert-${cssClass}`);

        alertDiv.innerHTML = `
            <div class="alert-content">
                ${iconHtml}
                <span>${text}</span>
            </div>
            <button class="alert-close-btn" onclick="this.parentNode.style.opacity = '0'; setTimeout(() => this.parentNode.remove(), 300);">
                <i class="bi bi-x-lg"></i>
            </button>
        `;

        messageContainer.appendChild(alertDiv);

        // 2. Adiciona o timeout para sumir automaticamente
        setTimeout(() => {
            // Usa a opacidade para transição suave
            alertDiv.style.opacity = '0';
            setTimeout(() => {
                alertDiv.remove();
            }, 300); // Espera a transição
        }, 5000);
    }

    // 🛑 FUNÇÃO CUSTOMIZADA DE CONFIRMAÇÃO (Substitui window.confirm)
    function showCustomConfirm(message, callback) {
        const existingModal = document.getElementById('custom-confirm-modal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="custom-confirm-modal" class="custom-modal-overlay">
                <div class="custom-modal-content">
                    <i class="bi bi-box-arrow-right modal-icon-warning"></i>
                    <h3>Confirmação Necessária</h3>
                    <p>${message}</p>
                    <div class="modal-buttons">
                        <button id="modal-cancel" class="btn-secondary-modal">Cancelar</button>
                        <button id="modal-confirm" class="btn-primary-modal">Sair da Conta</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('custom-confirm-modal');
        const btnConfirm = document.getElementById('modal-confirm');
        const btnCancel = document.getElementById('modal-cancel');

        const closeModal = () => modal.remove();

        btnConfirm.addEventListener('click', () => {
            closeModal();
            callback(true); // Executa o callback de confirmação
        });

        btnCancel.addEventListener('click', () => {
            closeModal();
            callback(false); // Executa o callback de cancelamento
        });

        modal.addEventListener('click', (e) => {
            if (e.target.id === 'custom-confirm-modal') {
                closeModal(); // Fecha ao clicar fora
                callback(false);
            }
        });
    }

    // 🛑 FUNÇÃO DE LOGOUT (Movida para o JS e usando o modal customizado)
    async function handleLogout() {
        showCustomConfirm("Tem certeza que deseja encerrar sua sessão?", async (confirmed) => {
            if (!confirmed) {
                return;
            }
            
            // Simula o clique no botão para aplicar o loading visual (opcional)
            if (logoutButton) {
                logoutButton.disabled = true;
                logoutButton.textContent = "Saindo...";
            }

            try {
                const response = await fetch("/logout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });
                const data = await response.json();

                if (response.ok && data.redirect_url) {
                    window.location.href = data.redirect_url;
                } else {
                    displayMessage("Falha ao sair da conta. Tente novamente.", 'error');
                }
            } catch (error) {
                console.error("Erro ao fazer logout:", error);
                displayMessage("Erro de conexão ao sair da conta.", 'error');
            } finally {
                if (logoutButton) {
                    logoutButton.disabled = false;
                    logoutButton.textContent = "Sair da Conta";
                }
            }
        });
    }

    // --- Lógica de Reenvio do Link (Mantida) ---
    async function resendVerificationLink(email) {
        // ... (código da função resendVerificationLink) ...
        if (!email) {
            displayMessage("Email não encontrado para reenvio.", 'error');
            return;
        }

        if (resendButton) {
            resendButton.disabled = true;
            resendButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Enviando...';
        }

        displayMessage("Enviando link de verificação...", 'warning');

        try {
            // A rota /resend_verification_code no backend espera um Form, não JSON
            const response = await fetch('/resend_verification_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `email=${encodeURIComponent(email)}`
            });

            const data = await response.json();

            if (response.ok) {
                displayMessage(data.message, 'success');
            } else {
                displayMessage(data.detail || 'Erro ao reenviar o link. Tente novamente mais tarde.', 'error');
            }
        } catch (error) {
            console.error('Erro na requisição de reenvio:', error);
            displayMessage('Ocorreu um erro de conexão ao reenviar o link.', 'error');
        } finally {
            if (resendButton) {
                resendButton.disabled = false;
                resendButton.innerHTML = '<i class="bi bi-envelope-check"></i> Reenviar Link de Verificação';
            }
        }
    }


    // --- 1. Pré-visualização da Foto de Perfil (Mantida) ---
    if (picUpload && picPreview) {
        picUpload.addEventListener("change", function (event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    picPreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // --- 2. Envio do Formulário (Formulário Multipart) (Mantida) ---
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const newPassword = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            // Validação de Senha no Frontend
            if (newPassword && newPassword !== confirmPassword) {
                displayMessage("As senhas não coincidem. Por favor, verifique.", 'error');
                return;
            }

            if (newPassword && newPassword.length < 6) {
                displayMessage("A nova senha deve ter pelo menos 6 caracteres.", 'error');
                return;
            }

            // Desabilita botão e mostra loading
            saveButton.disabled = true;
            saveButton.textContent = "Salvando...";
            messageContainer.innerHTML = '';

            // CRIAÇÃO DO OBJETO FormData (necessário para arquivos e campos)
            const formData = new FormData(form);

            // Se a senha estiver vazia, removemos os campos do FormData para que o backend os ignore.
            if (!newPassword) {
                formData.delete('senha');
                formData.delete('confirm_senha');
            }

            // Remove campos que não queremos enviar ou campos vazios não obrigatórios
            if (!formData.get('profile_pic') || formData.get('profile_pic').name === '') {
                formData.delete('profile_pic');
            }


            try {
                const response = await fetch("/profile/update", {
                    method: "PUT",
                    // NÃO defina Content-Type, FormData faz isso automaticamente
                    body: formData,
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.detail || `Erro HTTP! Status: ${response.status}`);
                }

                displayMessage(data.message);

                // Atualiza a URL da foto de perfil se o backend retornar uma nova
                if (data.profile_pic_url && picPreview) {
                    picPreview.src = data.profile_pic_url;
                }

                // Lida com alteração de email (redireciona para login/verificação)
                if (data.redirect_url) {
                    displayMessage(data.message + " Redirecionando...", 'warning');
                    setTimeout(() => {
                        window.location.href = data.redirect_url; // Vai para /login
                    }, 2000);
                }

                // Limpa campos de senha após o sucesso
                passwordInput.value = '';
                confirmPasswordInput.value = '';

            } catch (error) {
                console.error("Erro na atualização do perfil:", error);
                displayMessage(`Falha ao atualizar perfil: ${error.message}`, 'error');
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = "Salvar Alterações";
            }
        });
    }

    // 🌟 NOVO LISTENER: Ativa o reenvio do link de verificação
    if (resendButton) {
        resendButton.addEventListener('click', () => {
            // Usa o valor atual do campo de email
            const currentEmail = emailInput.value.trim();
            resendVerificationLink(currentEmail);
        });
    }
    
    // 🛑 NOVO LISTENER: Ativa o modal de confirmação de logout
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
});