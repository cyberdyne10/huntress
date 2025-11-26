document.addEventListener('DOMContentLoaded', () => {
    const rotator = document.getElementById('word-rotator');
    if (!rotator) return;

    const words = [
        "Enterprise",
        "Endpoints",
        "Future",
        "Profits",
        "Identities",
        "Business",
        "Organization",
        "Data",
        "Peace of Mind"
    ];

    let currentIndex = 0;
    rotator.textContent = words[currentIndex];

    setInterval(() => {
        // Start fade out
        rotator.classList.add('hidden');

        // Wait for fade out to complete (matching CSS transition time)
        setTimeout(() => {
            // Update word
            currentIndex = (currentIndex + 1) % words.length;
            rotator.textContent = words[currentIndex];

            // Start fade in
            rotator.classList.remove('hidden');
        }, 500); // 0.5s match with CSS

    }, 2500); // Change every 2.5 seconds (0.5s transition + 2s visible)
});