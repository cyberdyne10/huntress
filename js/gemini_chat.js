// IMPORTANT: Load the API key from a secure source, e.g., environment variables.
const API_KEY = 'YOUR_API_KEY'; // Replace with a secure method of key retrieval.
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

function initializeChatWidget() {
    const chatWidget = document.getElementById('terminal-chat-widget');
    const toggleBubble = document.getElementById('terminal-toggle-bubble');
    const closeButton = document.getElementById('terminal-close');
    const terminalInput = document.getElementById('terminal-input');
    const terminalOutput = document.getElementById('terminal-output');

    toggleBubble.addEventListener('click', () => {
        chatWidget.classList.toggle('open');
    });

    closeButton.addEventListener('click', () => {
        chatWidget.classList.remove('open');
    });

    terminalInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const message = terminalInput.value.trim();
            if (message) {
                appendMessage('user', message);
                terminalInput.value = '';
                callGeminiAPI(message);
            }
        }
    });

    function appendMessage(sender, message) {
        const messageElement = document.createElement('p');
        if (sender === 'user') {
            messageElement.className = 'user-message';
            messageElement.textContent = `> ${message}`;
        } else {
            messageElement.className = 'system-response';
            messageElement.textContent = `System: ${message}`;
        }
        terminalOutput.appendChild(messageElement);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    async function callGeminiAPI(message) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': API_KEY,
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: message
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            const botMessage = data.candidates[0].content.parts[0].text;
            appendMessage('system', botMessage);

        } catch (error) {
            console.error('Error calling Gemini API:', error);
            appendMessage('system', 'Error: Could not connect to the AI model.');
        }
    }

    // Signal that the widget is initialized and ready for interaction
    document.body.setAttribute('data-chat-widget-ready', 'true');
}
