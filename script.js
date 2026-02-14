document.addEventListener('DOMContentLoaded', () => {
    
    const sendButton = document.getElementById('send-button'); 
    const userInput = document.getElementById('user-input');   
    const chatMessages = document.getElementById('chat-messages'); 

    let conversationHistory = [
        { role: 'system', content: [
            'You are Komo — a privacy-first multilingual AI assistant.',
            'Respond in the user’s language by default; detect it automatically.',
            'When the user requests translation, translate faithfully into the requested target language.',
            'Preserve meaning, tone, names, numbers, units, and code blocks.',
            'Keep original formatting and line breaks; avoid extra commentary unless asked.',
            'For non‑Latin scripts, include romanization when helpful.'
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
