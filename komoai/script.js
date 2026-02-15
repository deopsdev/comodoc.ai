document.addEventListener('DOMContentLoaded', () => {
    
    const sendButton = document.getElementById('send-button'); 
    const userInput = document.getElementById('user-input');   
    const chatMessages = document.getElementById('chat-messages'); 
    const chatContainer = document.getElementById('chat-container');
    const inputArea = document.querySelector('.input-area');
    const footer = document.querySelector('footer');
    const headerEl = document.querySelector('header');
    function adjustLayout() {
        const inputH = inputArea ? inputArea.offsetHeight : 0;
        const footerH = footer ? footer.offsetHeight : 0;
        const headerH = headerEl ? headerEl.offsetHeight : 0;
        const extra = 16;
        chatMessages.style.paddingBottom = (inputH + footerH + extra) + 'px';
        if (inputArea) {
            inputArea.style.bottom = (footerH + 8) + 'px';
        }
        if (chatContainer) {
            chatContainer.style.bottom = (inputH + footerH + extra) + 'px';
            const topExtra = 20;
            chatContainer.style.top = (headerH + topExtra) + 'px';
        }
        const containerTop = chatContainer ? chatContainer.getBoundingClientRect().top : 0;
        const available = Math.max(120, window.innerHeight - (containerTop + inputH + footerH + extra));
        chatMessages.style.height = available + 'px';
        chatMessages.style.maxHeight = available + 'px';
        chatMessages.style.paddingTop = extra + 'px';
    }
    adjustLayout();
    window.addEventListener('resize', adjustLayout);

    let conversationHistory = [
        { role: 'system', content: [
            'You are Komo — a privacy-first multilingual AI assistant.',
            'Default: reply in English. If the user writes in another language, reply in that language.',
            'Translate only when explicitly requested; preserve meaning and tone.',
            'Avoid mixing languages; use clear, natural sentences.',
            'Keep formatting and line breaks; do not add extra commentary.'
        ].join('\\n') }
    ];

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(sender);
        
        const formattedText = text.split('\n').map(line => {
            if (line.trim() === '') return '<br>'; 
            return `<p>${line}</p>`; 
        }).join(''); 
        
        messageDiv.innerHTML = formattedText;
        chatMessages.appendChild(messageDiv);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
        adjustLayout();
    }

    async function sendMessage() {
        const text = userInput.value.trim();
        
        if (text === '') return;

        addMessage(text, 'user');
        userInput.value = '';

        conversationHistory.push({ role: 'user', content: text });

        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('message', 'system');
        loadingDiv.textContent = 'Komo thinking...';
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const response = await fetch('/chat', {
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/json', 
                },
                body: JSON.stringify({ 
                    messages: conversationHistory
                })
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            
            chatMessages.removeChild(loadingDiv);

            if (data.error) {
                addMessage('Error: ' + data.error, 'system');
            } else {
                addMessage(data.reply, 'ai');
                conversationHistory.push({ role: 'assistant', content: data.reply });
            }

        } catch (error) {
            console.error('Error:', error); 
            if (chatMessages.contains(loadingDiv)) chatMessages.removeChild(loadingDiv);
            addMessage('Sorry, an error occurred. Please make sure the server is running.', 'system');
        }
    }

    sendButton.addEventListener('click', sendMessage);

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage(); 
        }
    });

    const saveButton = document.getElementById('save-button');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const now = new Date();
            const header = `Komo AI — Chat Transcript\nDate: ${now.toISOString()}\n`;
            const parts = [header];
            for (let i = 1; i < conversationHistory.length; i++) {
                const msg = conversationHistory[i];
                if (msg.role === 'system') continue;
                const role = msg.role === 'user' ? 'User' : 'Komo';
                parts.push(`${role}: ${msg.content}`);
            }
            const chatHistory = parts.join('\n\n');
            const blob = new Blob([chatHistory], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.download = `komo-chat-${timestamp}.txt`;
            
            document.body.appendChild(a); 
            a.click(); 
            document.body.removeChild(a); 
            URL.revokeObjectURL(url); 
        });
    }
});
