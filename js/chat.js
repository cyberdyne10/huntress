function initializeChatWidget() {
    const chatBubble = document.getElementById('chat-bubble');
    const chatWindow = document.getElementById('chat-window');
    const chatClose = document.getElementById('chat-close');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatLog = document.getElementById('chat-log');

    // If elements aren't found, do nothing.
    if (!chatBubble || !chatWindow || !chatClose || !chatInput || !chatSend || !chatLog) {
        return;
    }

    // Toggle chat window
    chatBubble.addEventListener('click', () => {
        chatWindow.classList.toggle('open');
    });

    chatClose.addEventListener('click', () => {
        chatWindow.classList.remove('open');
    });

    // Handle sending messages
    const sendMessage = () => {
        const messageText = chatInput.value.trim();
        if (messageText === '') return;

        // Display user message
        const userMessage = document.createElement('div');
        userMessage.className = 'chat-message user';
        userMessage.textContent = messageText;
        chatLog.appendChild(userMessage);

        chatInput.value = '';
        chatLog.scrollTop = chatLog.scrollHeight; // Scroll to bottom

        // Simulate bot response
        setTimeout(() => {
            const botMessage = document.createElement('div');
            botMessage.className = 'chat-message bot';
            botMessage.textContent = "Thanks for your message! An AI agent will be with you shortly.";
            chatLog.appendChild(botMessage);
            chatLog.scrollTop = chatLog.scrollHeight; // Scroll to bottom
        }, 1000);
    };

    chatSend.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}
