document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('send-button');
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');

    // Store conversation history
    let conversationHistory = [
        { role: 'system', content: 'You are Komodoc, a helpful, friendly, and secure AI assistant.' }
    ];

    // Function to add a message to the chat
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        
        // Convert newlines to line breaks for better readability
        // Also handling basic Markdown-like paragraphs
        const formattedText = text.split('\n').map(line => {
            if (line.trim() === '') return '<br>'; // Preserve empty lines as spacing
            return `<p>${line}</p>`; // Wrap lines in paragraphs
        }).join('');
        
        messageDiv.innerHTML = formattedText; // Use innerHTML to render tags
        chatMessages.appendChild(messageDiv);
        
        // Scroll to the bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Function to handle sending the message
    async function sendMessage() {
        const text = userInput.value.trim();
        if (text === '') return;

        // Add user message
        addMessage(text, 'user');
        userInput.value = '';

        // Add to history
        conversationHistory.push({ role: 'user', content: text });

        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('message', 'system');
        loadingDiv.textContent = 'Komodoc thinking...';
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            // Call local backend
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages: conversationHistory })
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            
            // Remove loading indicator
            chatMessages.removeChild(loadingDiv);

            // Add AI response
            if (data.error) {
                addMessage('Error: ' + data.error, 'system');
            } else {
                addMessage(data.reply, 'ai');
                // Add AI reply to history
                conversationHistory.push({ role: 'assistant', content: data.reply });
            }

        } catch (error) {
            console.error('Error:', error);
            chatMessages.removeChild(loadingDiv);
            addMessage('Sorry, I encountered an error. Please ensure the server is running.', 'system');
        }
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);

    // Save chat functionality
    const saveButton = document.getElementById('save-button');
    saveButton.addEventListener('click', () => {
        let chatHistory = "==================================================\n";
        chatHistory += "             KOMODOC AI - CHAT HISTORY            \n";
        chatHistory += "==================================================\n";
        chatHistory += `Date: ${new Date().toLocaleString()}\n`;
        chatHistory += "--------------------------------------------------\n\n";

        // Use the conversationHistory array for cleaner data source
        // Skipping the first system message
        for (let i = 1; i < conversationHistory.length; i++) {
            const msg = conversationHistory[i];
            const role = msg.role === 'user' ? 'YOU' : 'KOMODOC';
            
            chatHistory += `[${role}]\n`;
            chatHistory += `${msg.content}\n`;
            chatHistory += "--------------------------------------------------\n\n";
        }
        
        chatHistory += "==================================================\n";
        chatHistory += "End of Transcript\n";
        chatHistory += "==================================================";

        const blob = new Blob([chatHistory], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const timestamp = now.getFullYear() + '-' + 
                          String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(now.getDate()).padStart(2, '0') + '_' + 
                          String(now.getHours()).padStart(2, '0') + '-' + 
                          String(now.getMinutes()).padStart(2, '0') + '-' + 
                          String(now.getSeconds()).padStart(2, '0');
        a.download = `chat-history-${timestamp}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});
