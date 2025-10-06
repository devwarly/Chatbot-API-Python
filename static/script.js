// static/js/chat.js

document.addEventListener("DOMContentLoaded", () => {
    const chatForm = document.getElementById("chat-form");
    const userInput = document.getElementById("user-input");
    const chatBox = document.getElementById("chat-box");
    const menuDesktopToggleButton = document.getElementById("menu_toggle_button");
    const menuMobileToggleButton = document.getElementById("menu_mobile_toggle");
    const navMenu = document.getElementById("menu");
    const iconMenu = document.getElementById("iconMenu");
    const allNavOpcs = document.querySelectorAll(".nav_opcs");
    const newChatButton = document.getElementById("newChat");
    const languagePg = document.getElementById("language_pg");
    const showOptionsBtn = document.getElementById("showOptionsBtn");
    const optionsContainer = document.getElementById("optionsContainer");
    const chatInputWrapper = document.getElementById("chat-input-wrapper");

    const mouseClickOverlay = document.createElement('div');
    mouseClickOverlay.classList.add('mouse_over');
    document.body.appendChild(mouseClickOverlay);

    const limiteLarguraMenu = 60; // Largura do menu colapsado em desktop

    // --- Tratamento das Opções de Idioma ---
    if (showOptionsBtn && optionsContainer) {
        showOptionsBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            optionsContainer.classList.toggle("show");
        });

        document.addEventListener("click", (event) => {
            if (optionsContainer.classList.contains("show") &&
                !optionsContainer.contains(event.target) &&
                !showOptionsBtn.contains(event.target)) {
                optionsContainer.classList.remove("show");
            }
        });
    }

    document.querySelectorAll(".option").forEach((option) => {
        option.addEventListener("click", () => {
            optionsContainer.classList.remove("show");
        });
    });

    function applyTranslations(lang) {
        document.querySelectorAll('.lang-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll(`.lang-${lang}`).forEach(el => el.classList.add('active'));

        const placeholderKey = `data-placeholder-${lang}`;
        if (userInput && userInput.hasAttribute(placeholderKey)) {
            userInput.placeholder = userInput.getAttribute(placeholderKey);
        }

        if (languagePg) {
            languagePg.setAttribute('lang', lang === 'pt' ? 'pt-BR' : (lang === 'en' ? 'en' : 'es'));
        }
    }

    window.changeLanguage = function (lang) {
        applyTranslations(lang);
        localStorage.setItem("selectedLanguage", lang);
        optionsContainer.classList.remove("show");
    };

    const savedLanguage = localStorage.getItem("selectedLanguage");
    if (savedLanguage) {
        applyTranslations(savedLanguage);
    } else {
        applyTranslations("pt");
    }

    // --- Alternar Menu e Responsividade ---
    const updateMenuState = () => {
        const isMobile = window.innerWidth <= 768;
        const header = document.querySelector("header");
        const divChat = document.querySelector(".div_chat");

        if (isMobile) {
            if (navMenu.classList.contains("expanded")) {
                mouseClickOverlay.style.display = "block";
            } else {
                mouseClickOverlay.style.display = "none";
            }
            header.style.paddingLeft = "20px";
            divChat.style.paddingLeft = "20px";
            chatInputWrapper.style.left = "0";
            chatInputWrapper.style.width = "100%";

            iconMenu.className = "bi bi-list";
            iconMenu.style.fontSize = "25px";
        } else {
            mouseClickOverlay.style.display = "none";

            const isMenuExpanded = navMenu.classList.contains("expanded");
            const menuLeftOffset = isMenuExpanded ? 200 : 60;

            header.style.paddingLeft = `${menuLeftOffset + 20}px`;
            divChat.style.paddingLeft = `${menuLeftOffset + 20}px`;
            chatInputWrapper.style.left = `${menuLeftOffset}px`;
            chatInputWrapper.style.width = `calc(100% - ${menuLeftOffset}px)`;

            iconMenu.className = isMenuExpanded ? "bi bi-x-lg" : "bi bi-list";
            iconMenu.style.fontSize = "25px";
        }

        allNavOpcs.forEach((opc) => {
            if (navMenu.classList.contains("expanded")) {
                opc.classList.add("nav_opcs_expanded");
            } else {
                opc.classList.remove("nav_opcs_expanded");
            }
        });
    };

    const observerMenu = new ResizeObserver(updateMenuState);
    observerMenu.observe(navMenu);
    window.addEventListener('resize', updateMenuState);

    updateMenuState();

    if (menuDesktopToggleButton) {
        menuDesktopToggleButton.addEventListener("click", () => {
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) {
                if (navMenu.offsetWidth <= limiteLarguraMenu) {
                    navMenu.style.width = "200px";
                    navMenu.classList.add("expanded");
                } else {
                    navMenu.style.width = "60px";
                    navMenu.classList.remove("expanded");
                }
            } else {
                 navMenu.classList.toggle("expanded");
            }
        });
    }

    if (menuMobileToggleButton) {
        menuMobileToggleButton.addEventListener("click", () => {
            navMenu.classList.toggle("expanded");
        });
    }

    mouseClickOverlay.addEventListener("click", () => {
        navMenu.classList.remove("expanded");
    });

    // --- Botão Novo Chat ---
    if (newChatButton) {
        newChatButton.addEventListener("click", async () => {
            chatBox.innerHTML = `
                <div class="wellcome">
                    <h2 class="lang-content active lang-pt">Olá, <span class="user-name-display">Usuário</span></h2>
                    <h2 class="lang-content lang-en">Hello, <span class="user-name-display">User</span></h2>
                    <h2 class="lang-content lang-es">¡Hola, <span class="user-name-display">User</span></h2>
                </div>
            `;
            applyTranslations(localStorage.getItem("selectedLanguage") || "pt");

            try {
                const response = await fetch("/reset_chat", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || `Erro HTTP! status: ${response.status}`);
                }
                console.log("Chat reiniciado no backend.");
            } catch (error) {
                console.error("Erro ao reiniciar chat no backend:", error);
                addMessage("bot", `Não foi possível reiniciar a conversa completamente: ${error.message}. Tente recarregar a página.`);
            }
            userInput.focus();
        });
    }

    // --- Pop-up de Confirmação de Cópia ---
    function showCopyConfirmation() {
        let confirmationDiv = document.getElementById("copy-confirmation");
        if (!confirmationDiv) {
            confirmationDiv = document.createElement("div");
            confirmationDiv.id = "copy-confirmation";
            confirmationDiv.classList.add("copy-confirmation");
            confirmationDiv.textContent = "Copiado!";
            document.body.appendChild(confirmationDiv);
        }

        confirmationDiv.classList.add("show");
        setTimeout(() => {
            confirmationDiv.classList.remove("show");
        }, 1500);
    }

    // --- Conversão de Markdown para HTML e Destaque de Sintaxe ---
    function convertMarkdownToHtml(markdownText) {
        let htmlText = markdownText;

        // 1. Trata blocos de código (```language\ncode\n```)
        // Usa um placeholder temporário para evitar que o markdown dentro do código seja processado
        const codeBlockPlaceholder = "____CODE_BLOCK_PLACEHOLDER____";
        const codeBlocks = [];
        htmlText = htmlText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            // Escapa caracteres HTML dentro do bloco de código
            const escapedCode = code
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
            codeBlocks.push(`<pre><code class="language-${lang || 'plaintext'}">${escapedCode}</code></pre>`);
            return codeBlockPlaceholder;
        });

        // 2. Títulos (H1: #, H2: ##)
        htmlText = htmlText.replace(/^#\s(.+)$/gm, '<h1 class="message-h1">$1</h1>');
        htmlText = htmlText.replace(/^##\s(.+)$/gm, '<h2 class="message-h2">$1</h2>');

        // 3. Listas (Numeradas e com Marcadores)
        // Regex mais robusto para capturar múltiplos itens de lista
        htmlText = htmlText.replace(/(\n|^)(\d+\.\s.*(?:\n\d+\.\s.*)*)/g, (match, p1, p2) => {
            const items = p2.split('\n').map(item => `<li>${item.replace(/^\d+\.\s/, '')}</li>`).join('');
            return `${p1}<ol>${items}</ol>`;
        });
        htmlText = htmlText.replace(/(\n|^)(-\s.*(?:\n-\s.*)*)/g, (match, p1, p2) => {
            const items = p2.split('\n').map(item => `<li>${item.replace(/^- /, '')}</li>`).join('');
            return `${p1}<ul>${items}</ul>`;
        });
        
        // 4. Negrito (**texto**)
        htmlText = htmlText.replace(/\*\*(.*?)\*\*/g, '<span class="message-bold">$1</span>');
        
        // 5. Itálico (*texto* ou _texto_)
        htmlText = htmlText.replace(/\*(.*?)\*/g, '<span class="message-italic">$1</span>');
        htmlText = htmlText.replace(/_([^_]+)_/g, '<span class="message-italic">$1</span>');

        // 6. Código Inline (`código`)
        htmlText = htmlText.replace(/`(.*?)`/g, '<code>$1</code>');

        // 7. Parágrafos e Quebras de Linha
        // Converte quebras de linha duplas em <p> (parágrafo), e simples em <br>
        // Importante: Executar após processar blocos de código e listas
        htmlText = htmlText.replace(/\n\n/g, '<p>');
        htmlText = htmlText.replace(/\n/g, '<br>');

        // 8. Substitui placeholders pelos blocos de código reais
        let codeBlockIndex = 0;
        htmlText = htmlText.replace(new RegExp(codeBlockPlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), () => {
            return codeBlocks[codeBlockIndex++];
        });

        // 9. Sanitização HTML Final (segurança contra XSS)
        // Cria um elemento temporário para que o navegador "parseie" o HTML.
        // Ao pegar o innerHTML de volta, scripts maliciosos são removidos.
        const tempElement = document.createElement('div');
        tempElement.innerHTML = htmlText;
        htmlText = tempElement.innerHTML;

        return htmlText;
    }

    function addMessage(sender, message) {
        if (!message.trim()) return; // Não adiciona mensagens vazias

        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", sender);

        const contentDiv = document.createElement("div");
        contentDiv.classList.add("message-content");

        if (sender === "bot") {
            // Mensagens do bot são convertidas de Markdown para HTML
            contentDiv.innerHTML = convertMarkdownToHtml(message);
        } else {
            // Mensagens do usuário são escapadas para segurança
            const escapedMessage = message
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
            
            // Aplica um destaque básico (se quiser) no texto do usuário
            contentDiv.innerHTML = escapedMessage.replace(
                /\*([^*]+)\*/g,
                '<span class="highlighted-text">$1</span>'
            );
        }

        messageDiv.appendChild(contentDiv);

        if (sender === "bot") {
            // Adiciona ícone de copiar para mensagens do bot
            const copyIcon = document.createElement("i");
            copyIcon.classList.add("bi", "bi-copy", "copy-icon");
            copyIcon.title = "Copiar";
            copyIcon.addEventListener("click", () => {
                // Copia o texto original do Markdown/texto puro, não o HTML renderizado
                navigator.clipboard
                    .writeText(message)
                    .then(() => {
                        showCopyConfirmation();
                    })
                    .catch((err) => {
                        console.error("Falha ao copiar texto: ", err);
                    });
            });
            messageDiv.appendChild(copyIcon);
        }

        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight; // Rola para o final do chat
    }

    let currentLoadingIndicator = null;

    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Previne o recarregamento da página

        const message = userInput.value.trim();
        if (message === "") return; // Ignora mensagens vazias

        addMessage("user", message); // Adiciona a mensagem do usuário ao chat

        userInput.value = ""; // Limpa o campo de entrada

        const welcomeMessage = chatBox.querySelector('.wellcome');
        if (welcomeMessage) {
            welcomeMessage.remove(); // Remove a mensagem de boas-vindas após o primeiro envio
        }

        // Exibe o indicador de carregamento
        currentLoadingIndicator = document.createElement("div");
        currentLoadingIndicator.classList.add("loading-indicator", "show");
        currentLoadingIndicator.innerHTML =
            '<div class="spinner"></div> Processando...';
        chatBox.appendChild(currentLoadingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;

        // Obtém o idioma selecionado
        const currentLanguage = localStorage.getItem("selectedLanguage") || "pt";

        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: message,
                    language: currentLanguage,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                // Lança um erro com o detalhe do backend ou status HTTP
                throw new Error(
                    errorData.detail || `Erro HTTP! status: ${response.status}`
                );
            }

            const data = await response.json();
            addMessage("bot", data.response); // Adiciona a resposta do bot
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            // Exibe o erro detalhado no chat
            addMessage("bot", `Ops! Algo deu errado: ${error.message}. Por favor, tente novamente.`);
        } finally {
            // Esconde o indicador de carregamento
            if (currentLoadingIndicator) {
                currentLoadingIndicator.remove();
                currentLoadingIndicator = null;
            }
            userInput.focus(); // Retorna o foco para o campo de entrada
        }
    });
});

// Função para uma ação de login (apenas um alerta no momento)
function logar_se() {
    alert('Essa função ainda não está funcionando!');
}