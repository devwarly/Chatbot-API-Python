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
    const chatInputWrapper = document.getElementById("chat-input-wrapper");

    const mouseClickOverlay = document.createElement('div');
    mouseClickOverlay.classList.add('mouse_over');
    document.body.appendChild(mouseClickOverlay);

    // Obtém o nome do usuário
    const userName = document.body.getAttribute('data-user-name') || "Usuário";

    const limiteLarguraMenu = 60;

    const historyList = document.getElementById("conversation-history-list");

    // --- Funções Auxiliares de Loading ---
    let currentLoadingIndicator = null;

    function addLoadingIndicator(element) {
        removeLoadingIndicator();

        const indicator = document.createElement("div");
        indicator.id = "temp-history-loading";
        indicator.classList.add("loading-indicator", "show");
        indicator.innerHTML = '<div class="spinner"></div> Carregando...';
        element.appendChild(indicator);
        currentLoadingIndicator = indicator;
    }

    function removeLoadingIndicator() {
        const tempIndicator = document.getElementById("temp-history-loading");
        if (tempIndicator) tempIndicator.remove();
        if (currentLoadingIndicator) {
            currentLoadingIndicator.remove();
            currentLoadingIndicator = null;
        }
    }
    // --- Fim Funções Auxiliares de Loading ---


    // 🛑 INÍCIO DA LÓGICA DE OCULTAR MENSAGEM NO FOCO (Focus/Blur)
    if (userInput && chatBox) {
        let isTyping = false;

        // 1. Oculta o texto assim que o usuário digita o primeiro caractere
        userInput.addEventListener('input', () => {
            const welcomeMessage = chatBox.querySelector('.wellcome');
            if (welcomeMessage && chatBox.children.length === 1) {
                if (userInput.value.trim().length > 0) {
                    welcomeMessage.style.display = 'none';
                    isTyping = true;
                } else {
                    // Se ele deletar tudo, a mensagem reaparece
                    welcomeMessage.style.display = 'block';
                    isTyping = false;
                }
            }
        });

        // 2. Garante que se a pessoa apenas clicar (focusin) e não digitar nada, a mensagem não suma.
        // A visibilidade é controlada puramente pelo evento 'input'.

        // Se a tela for reaberta ou o input perder o foco e a mensagem tiver sido escondida, 
        // ela deve reaparecer se o campo estiver vazio.
        userInput.addEventListener('blur', () => {
            const welcomeMessage = chatBox.querySelector('.wellcome');
            // Se não houver texto digitado (e a mensagem existir), restaura a visibilidade.
            if (welcomeMessage && userInput.value.trim() === '' && chatBox.children.length === 1) {
                welcomeMessage.style.display = 'block';
            }
        });
    }

    // Função para carregar uma conversa específica
    async function loadConversation(conversationId) {
        if (!conversationId || !chatBox) return;

        // 🛑 NOVIDADE: Salva o ID da conversa ativa no localStorage
        localStorage.setItem('lastActiveConversationId', conversationId);

        chatBox.innerHTML = ''; // Limpa o chat atual
        addLoadingIndicator(chatBox);

        try {
            // Remove a classe 'active' de todos os itens e aplica no item clicado
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
            });

            const clickedItem = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
            if (clickedItem) {
                clickedItem.classList.add('active');
            }

            const response = await fetch(`/conversation/${conversationId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Falha ao carregar a conversa.");
            }
            const messages = await response.json();

            removeLoadingIndicator();

            // Adiciona todas as mensagens
            messages.forEach(msg => {
                addMessage(msg.remetente === 'usuario' ? 'user' : 'bot', msg.conteudo);
            });

            chatBox.scrollTop = chatBox.scrollHeight;

        } catch (error) {
            removeLoadingIndicator();
            console.error("Erro ao carregar conversa:", error);
            addMessage("bot", `Erro ao carregar o histórico: ${error.message}`);
        }
    }

    // FUNÇÃO DE RENDERIZAÇÃO DO HISTÓRICO CORRIGIDA
    async function renderConversationHistory() {
        if (!historyList || !chatBox) {
            console.warn("Elemento chatBox ou historyList não encontrado. Não é possível renderizar.");
            return;
        }

        historyList.innerHTML = '<li class="loading-history">Carregando histórico...</li>';

        try {
            const response = await fetch("/conversations");
            if (!response.ok) {
                throw new Error(`Falha ao buscar histórico de conversas. Status: ${response.status}`);
            }

            const rawConversations = await response.json();

            const conversations = Array.isArray(rawConversations) ? rawConversations : [];

            historyList.innerHTML = '';

            const titleElement = document.querySelector('.chat-history-title');
            if (titleElement) {
                if (conversations.length === 1 && conversations[0].id === 0) {
                    titleElement.style.display = 'none';
                } else {
                    titleElement.style.display = conversations.length > 0 ? 'block' : 'none';
                }
            }

            if (conversations.length === 0) {
                historyList.innerHTML = '<li class="no-history">Nenhum histórico disponível.</li>';
                return;
            }

            // Variáveis de controle para o carregamento
            let firstConversationId = null;
            const savedConversationId = localStorage.getItem('lastActiveConversationId');
            let conversationToLoad = null;


            conversations.forEach((conv, index) => {
                if (conv.id === 0) {
                    historyList.innerHTML = `<li class="no-history">${conv.titulo_conversa}</li>`;
                    if (conversations.length === 1) return;
                }

                if (conv.id !== 0) {
                    if (firstConversationId === null) {
                        firstConversationId = conv.id;
                    }

                    const listItem = document.createElement("li");
                    listItem.classList.add("conversation-item");

                    const dateValue = conv.data_atualizacao;
                    const lastUpdatedDate = dateValue ? new Date(dateValue) : new Date();

                    const formattedDate = lastUpdatedDate.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });

                    listItem.innerHTML = `
                        <span class="conv-title">${conv.titulo_conversa}</span>
                        <span class="conv-date">${formattedDate}</span>
                    `;

                    listItem.dataset.conversationId = conv.id;

                    // Define qual conversa será carregada e qual item será marcado como ativo
                    if (conv.id == savedConversationId) {
                        conversationToLoad = conv.id;
                    }

                    // Adiciona o Event Listener
                    listItem.addEventListener("click", (event) => {
                        event.preventDefault();
                        loadConversation(conv.id);
                    });

                    historyList.appendChild(listItem);
                }
            });

            // 🛑 LÓGICA DE CARREGAMENTO AJUSTADA:

            // 1. Prioriza o ID salvo no localStorage. Se não houver, usa o mais recente.
            if (!conversationToLoad) {
                conversationToLoad = firstConversationId;
            }

            // 2. Verifica o estado 'new' (após clique em Novo Chat)
            const isNewChat = chatBox.dataset.currentConversationId === 'new';

            // Se for um novo chat, remove o marcador e não carrega nada.
            if (isNewChat) {
                chatBox.removeAttribute('data-currentConversationId');
                return;
            }

            // 3. Carrega a conversa se houver uma e o chatbox estiver vazio (ou apenas com o welcome)
            if (conversationToLoad && chatBox.children.length <= 1) {
                loadConversation(conversationToLoad);
            }

        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
            if (historyList) {
                historyList.innerHTML = `<li class="error-history">Erro ao carregar histórico: ${error.message}</li>`;
            }
        }
    }

    // Chamada inicial para carregar o histórico
    renderConversationHistory();

    // --- Pop-up de Confirmação de Cópia (Mantida) ---
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

    // --- Conversão de Markdown para HTML e Destaque de Sintaxe (Mantida) ---
    function convertMarkdownToHtml(markdownText) {
        let htmlText = markdownText;

        const codeBlockPlaceholder = "____CODE_BLOCK_PLACEHOLDER____";
        const codeBlocks = [];
        htmlText = htmlText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const escapedCode = code
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
            codeBlocks.push(`<pre><code class="language-${lang || 'plaintext'}">${escapedCode}</code></pre>`);
            return codeBlockPlaceholder;
        });

        htmlText = htmlText.replace(/^#\s(.+)$/gm, '<h1 class="message-h1">$1</h1>');
        htmlText = htmlText.replace(/^##\s(.+)$/gm, '<h2 class="message-h2">$1</h2>');

        htmlText = htmlText.replace(/(\n|^)(\d+\.\s.*(?:\n\d+\.\s.*)*)/g, (match, p1, p2) => {
            const items = p2.split('\n').map(item => `<li>${item.replace(/^\d+\.\s/, '')}</li>`).join('');
            return `${p1}<ol>${items}</ol>`;
        });
        htmlText = htmlText.replace(/(\n|^)(-\s.*(?:\n-\s.*)*)/g, (match, p1, p2) => {
            const items = p2.split('\n').map(item => `<li>${item.replace(/^- /, '')}</li>`).join('');
            return `${p1}<ul>${items}</ul>`;
        });

        htmlText = htmlText.replace(/\*\*(.*?)\*\*/g, '<span class="message-bold">$1</span>');

        htmlText = htmlText.replace(/\*(.*?)\*/g, '<span class="message-italic">$1</span>');
        htmlText = htmlText.replace(/_([^_]+)_/g, '<span class="message-italic">$1</span>');

        htmlText = htmlText.replace(/`(.*?)`/g, '<code>$1</code>');

        htmlText = htmlText.replace(/\n\n/g, '<p>');
        htmlText = htmlText.replace(/\n/g, '<br>');

        let codeBlockIndex = 0;
        htmlText = htmlText.replace(new RegExp(codeBlockPlaceholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), () => {
            return codeBlocks[codeBlockIndex++];
        });

        const tempElement = document.createElement('div');
        tempElement.innerHTML = htmlText;
        htmlText = tempElement.innerHTML;

        return htmlText;
    }

    function addMessage(sender, message) {
        if (!message.trim() || !chatBox) return;

        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", sender);

        const contentDiv = document.createElement("div");
        contentDiv.classList.add("message-content");

        if (sender === "bot") {
            contentDiv.innerHTML = convertMarkdownToHtml(message);
        } else {
            const escapedMessage = message
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

            contentDiv.innerHTML = escapedMessage.replace(
                /\*([^*]+)\*/g,
                '<span class="highlighted-text">$1</span>'
            );
        }

        messageDiv.appendChild(contentDiv);

        if (sender === "bot") {
            const copyIcon = document.createElement("i");
            copyIcon.classList.add("bi", "bi-copy", "copy-icon");
            copyIcon.title = "Copiar";
            copyIcon.addEventListener("click", () => {
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
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // --- Rota de Envio de Mensagem ---
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const message = userInput.value.trim();
        if (message === "") return;

        addMessage("user", message);

        userInput.value = "";

        // 🛑 MUDANÇA: Remoção INSTANTÂNEA da mensagem de boas-vindas
        const welcomeMessage = chatBox ? chatBox.querySelector('.wellcome') : null;
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        currentLoadingIndicator = document.createElement("div");
        currentLoadingIndicator.classList.add("loading-indicator", "show");
        currentLoadingIndicator.innerHTML =
            '<div class="spinner"></div> Processando...';

        if (chatBox) {
            chatBox.appendChild(currentLoadingIndicator);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        const currentLanguage = "pt";

        try {
            const response = await fetch("/chat/message", {
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
                throw new Error(
                    errorData.detail || `Erro HTTP! status: ${response.status}`
                );
            }

            const data = await response.json();
            addMessage("bot", data.response);

            // Recarrega o histórico após a primeira mensagem
            setTimeout(renderConversationHistory, 500);

        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            addMessage("bot", `Ops! Algo deu errado: ${error.message}. Por favor, tente novamente.`);
        } finally {
            if (currentLoadingIndicator) {
                currentLoadingIndicator.remove();
                currentLoadingIndicator = null;
            }
            userInput.focus();
        }
    });

    // --- Botão Novo Chat (CORRIGIDO) ---
    if (newChatButton && chatBox) {
        newChatButton.addEventListener("click", async () => {
            // 🛑 NOVIDADE: Limpa o ID ativo no localStorage
            localStorage.removeItem('lastActiveConversationId');

            // 1. Limpa a seleção visual ativa na barra lateral
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
            });

            // 2. Define o estado para 'new' para impedir o carregamento automático
            chatBox.dataset.currentConversationId = 'new';

            // 3. Limpa o chat box e exibe a mensagem de boas-vindas
            chatBox.innerHTML = `
                <div class="wellcome">
                    <h2 class="lang-content active lang-pt">Olá, <span class="user-name-display">${userName}</span></h2>
                </div>
            `;

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

            renderConversationHistory();
            userInput.focus();
        });
    }

    // --- Alternar Menu e Responsividade (Mantida) ---
    const updateMenuState = () => {
        const isMobile = window.innerWidth <= 768;
        const header = document.querySelector("header");
        const divChat = document.querySelector(".div_chat");

        const languagePg = document.getElementById("language_pg");
        if (languagePg) languagePg.setAttribute('lang', 'pt-BR');

        if (userInput) {
            userInput.placeholder = userInput.getAttribute('data-placeholder-pt') || "Fala Aí😉";
        }

        if (isMobile) {
            if (navMenu && navMenu.classList.contains("expanded")) {
                mouseClickOverlay.style.display = "block";
            } else {
                mouseClickOverlay.style.display = "none";
            }
            if (header) header.style.paddingLeft = "20px";
            if (divChat) divChat.style.paddingLeft = "20px";
            if (chatInputWrapper) {
                chatInputWrapper.style.left = "0";
                chatInputWrapper.style.width = "100%";
            }


            iconMenu.className = "bi bi-list";
            iconMenu.style.fontSize = "25px";
        } else {
            mouseClickOverlay.style.display = "none";

            const isMenuExpanded = navMenu ? navMenu.classList.contains("expanded") : false;
            const menuLeftOffset = isMenuExpanded ? 200 : 60;

            if (header) header.style.paddingLeft = `${menuLeftOffset + 20}px`;
            if (divChat) divChat.style.paddingLeft = `${menuLeftOffset + 20}px`;
            if (chatInputWrapper) {
                chatInputWrapper.style.left = `${menuLeftOffset}px`;
                chatInputWrapper.style.width = `calc(100% - ${menuLeftOffset}px)`;
            }

            iconMenu.className = isMenuExpanded ? "bi bi-x-lg" : "bi bi-list";
            iconMenu.style.fontSize = "25px";
        }

        allNavOpcs.forEach((opc) => {
            if (navMenu && navMenu.classList.contains("expanded")) {
                opc.classList.add("nav_opcs_expanded");
            } else {
                opc.classList.remove("nav_opcs_expanded");
            }
        });
    };

    if (navMenu) {
        const observerMenu = new ResizeObserver(updateMenuState);
        observerMenu.observe(navMenu);
    }

    window.addEventListener('resize', updateMenuState);

    updateMenuState();

    if (menuDesktopToggleButton && navMenu) {
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

    if (menuMobileToggleButton && navMenu) {
        menuMobileToggleButton.addEventListener("click", () => {
            navMenu.classList.toggle("expanded");
        });
    }

    mouseClickOverlay.addEventListener("click", () => {
        if (navMenu) {
            navMenu.classList.remove("expanded");
        }
    });
});