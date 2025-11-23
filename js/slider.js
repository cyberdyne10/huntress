document.addEventListener('DOMContentLoaded', () => {
    const track = document.querySelector('.testimonial-track');
    if (!track) return;

    const cards = Array.from(track.children);
    const prevBtn = document.querySelector('.slider-prev');
    const nextBtn = document.querySelector('.slider-next');
    const dotsContainer = document.querySelector('.slider-dots');

    if (!cards.length) return;

    let currentIndex = 2; // Start with the 3rd one active (like screenshot) or 0
    if (currentIndex >= cards.length) currentIndex = 0;

    function updateSlider() {
        // Get dimensions
        const container = track.parentElement;
        const containerWidth = container.offsetWidth;
        // Assume all cards are same width, measure the active one or first one
        const card = cards[0];
        const cardStyle = window.getComputedStyle(card);
        const cardWidth = card.offsetWidth;
        const marginRight = parseFloat(cardStyle.marginRight) || 0;
        const gap = 30; // We will enforce this in CSS, but good to check.
        // Actually, let's rely on the CSS gap property of the flex container if possible,
        // but for calculation we might need to be explicit if we use transform.

        // Let's assume the track is a flex container with gap: 30px
        const effectiveGap = 30;

        // Update classes
        cards.forEach((c, index) => {
            c.classList.remove('active');
            if (index === currentIndex) {
                c.classList.add('active');
            }
        });

        // Calculate translation to center the active card
        // Center of container = containerWidth / 2
        // Center of active card relative to track start = (currentIndex * (cardWidth + effectiveGap)) + (cardWidth / 2)

        const centerOfCard = (currentIndex * (cardWidth + effectiveGap)) + (cardWidth / 2);
        const centerOfContainer = containerWidth / 2;

        // We want: track position + centerOfCard = centerOfContainer
        // track position = centerOfContainer - centerOfCard

        const translate = centerOfContainer - centerOfCard;

        track.style.transform = `translateX(${translate}px)`;

        // Update dots
        if (dotsContainer) {
            const dots = Array.from(dotsContainer.children);
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === currentIndex);
            });
        }
    }

    // Create dots if container exists
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        cards.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.classList.add('slider-dot');
            dot.ariaLabel = `Go to slide ${index + 1}`;
            dot.addEventListener('click', () => {
                currentIndex = index;
                updateSlider();
            });
            dotsContainer.appendChild(dot);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % cards.length;
            updateSlider();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + cards.length) % cards.length;
            updateSlider();
        });
    }

    // Handle resize
    window.addEventListener('resize', () => {
        // Debounce?
        updateSlider();
    });

    // Initial call after a short delay to ensure layout is ready
    setTimeout(updateSlider, 100);
});
