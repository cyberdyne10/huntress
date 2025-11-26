
document.addEventListener('DOMContentLoaded', () => {
    const rotator = document.getElementById('word-rotator');
    if (!rotator) return;

    const words = [
        "Chaos",
        "Breaches",
        "Blindspots",
        "Downtime",
        "Disruption",
        "Exposure",
        "Liability",
        "Intrusion",
        "Infiltration"
    ];

    let wordIndex = 0;
    let letterIndex = 0;
    let isDeleting = false;

    function type() {
        const currentWord = words[wordIndex];

        if (isDeleting) {
            // Deleting
            rotator.textContent = currentWord.substring(0, letterIndex - 1);
            letterIndex--;
        } else {
            // Typing
            rotator.textContent = currentWord.substring(0, letterIndex + 1);
            letterIndex++;
        }

        if (!isDeleting && letterIndex === currentWord.length) {
            // Pause at the end of the word
            setTimeout(() => { isDeleting = true; }, 2000);
        } else if (isDeleting && letterIndex === 0) {
            // Move to the next word
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
        }

        const typingSpeed = isDeleting ? 100 : 200;
        setTimeout(type, typingSpeed);
    }

    type();
});
