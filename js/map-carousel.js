document.addEventListener('DOMContentLoaded', () => {
    // Map Tooltip Logic
    const mapPins = document.querySelectorAll('.map-pin');

    mapPins.forEach(pin => {
        const tooltip = pin.nextElementSibling; // The div following the pin containing the tooltip text

        if (tooltip) {
            // Show on hover
            pin.addEventListener('mouseenter', () => {
                tooltip.style.opacity = '1';
            });

            pin.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
            });

            // Toggle on click
            pin.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentOpacity = window.getComputedStyle(tooltip).opacity;
                // Close all others
                document.querySelectorAll('.map-pin + div').forEach(t => t.style.opacity = '0');

                tooltip.style.opacity = currentOpacity === '1' ? '0' : '1';
            });
        }
    });

    // Close tooltips when clicking elsewhere
    document.addEventListener('click', () => {
        document.querySelectorAll('.map-pin + div').forEach(t => t.style.opacity = '0');
    });

    // Splide Carousel Logic (Basic Custom Implementation to match the provided HTML structure)
    const splideList = document.getElementById('splide07-list');
    const prevBtn = document.querySelector('.splide__arrow--prev');
    const nextBtn = document.querySelector('.splide__arrow--next');

    if (splideList && prevBtn && nextBtn) {
        let currentSlide = 0;
        // The provided HTML has clones and complexity, but let's try to make it work simply first.
        // We need to count actual slides. The HTML has ids like splide07-slide01 to 06 and clones.
        // Let's grab all 'li' that are not clones for indexing, but scrolling involves all.

        const slides = Array.from(splideList.children);
        const cardWidth = 420; // Approximate width + margin defined in CSS

        // Initialize position
        function updateCarousel() {
            const offset = -(currentSlide * cardWidth);
            splideList.style.transform = `translateX(${offset}px)`;
        }

        nextBtn.addEventListener('click', () => {
            currentSlide++;
            if (currentSlide >= slides.length - 2) { // Stop before running out
                currentSlide = 0; // Loop back (simple)
            }
            updateCarousel();
        });

        prevBtn.addEventListener('click', () => {
            currentSlide--;
            if (currentSlide < 0) {
                currentSlide = slides.length - 3;
            }
            updateCarousel();
        });
    }
});
