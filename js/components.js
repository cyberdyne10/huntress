// Header and Footer Injection
document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
    loadFooter();
});

function loadHeader() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;


    // Based on Huntress.com structure
    const headerHTML = `
    <header>
        <div class="container header-container">
            <a href="/index.html" class="logo">
                <img src="https://cyberlogicnetwork.com/wp-content/uploads/2024/09/brand-log.png" alt="Cyber-Logic Networks Logo" style="max-height: 60px; width: auto; object-fit: contain;">
            </a>

            <nav>
                <ul class="main-nav">
                    <li>
                        <a href="#">Platform</a>
                        <ul class="dropdown">
                            <li><span class="dropdown-section-title">Managed Security Platform</span></li>
                            <li><a href="/platform/managed-edr.html">Managed EDR</a></li>
                            <li><a href="/platform/managed-sat.html">Managed SAT</a></li>
                            <li><a href="/platform/managed-itdr.html">Managed ITDR</a></li>
                            <li><a href="/platform/managed-siem.html">Managed SIEM</a></li>
                            <li><a href="/platform/overview.html">Platform Overview</a></li>
                        </ul>
                    </li>
                    <li>
                        <a href="#">Solutions</a>
                        <ul class="dropdown">
                            <li><span class="dropdown-section-title">By Topic</span></li>
                            <li><a href="/solutions/phishing.html">Phishing</a></li>
                            <li><a href="/solutions/compliance.html">Compliance</a></li>
                            <li><a href="/solutions/bec.html">Business Email Compromise</a></li>
                            <li><span class="dropdown-section-title">By Industry</span></li>
                            <li><a href="/solutions/education.html">Education</a></li>
                            <li><a href="/solutions/finance.html">Finance</a></li>
                            <li><a href="/solutions/healthcare.html">Healthcare</a></li>
                        </ul>
                    </li>
                    <li>
                        <a href="#">Why Cyber-Logic</a>
                        <ul class="dropdown">
                             <li><a href="/about/who-we-serve.html">Who We Serve</a></li>
                             <li><a href="/about/soc.html">The Cyber-Logic SOC</a></li>
                             <li><a href="/about/case-studies.html">Case Studies</a></li>
                        </ul>
                    </li>
                    <li>
                        <a href="#">Resources</a>
                        <ul class="dropdown">
                            <li><a href="/resources/blog.html">Blog</a></li>
                            <li><a href="/resources/events.html">Upcoming Events</a></li>
                            <li><a href="/resources/docs.html">Support Documentation</a></li>
                        </ul>
                    </li>
                     <li>
                        <a href="/pricing.html">Pricing</a>
                    </li>
                     <li>
                        <a href="/about/our-story.html">About</a>
                    </li>
                    <li class="mobile-only-link">
                        <a href="/demo.html">Get a Demo</a>
                    </li>
                </ul>
            </nav>

            <div class="cta-group">
                <a href="/demo.html" class="btn btn-primary">Get a Demo</a>
            </div>

            <button class="mobile-menu-toggle">
                ☰
            </button>
        </div>
    </header>
    `;

    headerPlaceholder.innerHTML = headerHTML;

    // Add simple active state logic
    const currentPath = window.location.pathname;
    const links = headerPlaceholder.querySelectorAll('nav ul.main-nav > li > a');

    // Find the link that is the best match for the current path
    let bestMatch = null;
    let longestMatch = 0;

    links.forEach(link => {
        const linkHref = link.getAttribute('href');
        // Check if the current path ends with the link's href and is a better match than the last one
        if (currentPath.endsWith(linkHref) && linkHref.length > longestMatch) {
            bestMatch = link;
            longestMatch = linkHref.length;
        }
    });

    // Special case for the root directory. If no other match is found and we are at the root, activate the home link.
    if (!bestMatch && (currentPath.endsWith('/') || currentPath.endsWith('/index.html'))) {
        const homeLink = headerPlaceholder.querySelector('nav ul.main-nav > li > a[href="/index.html"]');
        if (homeLink) {
            bestMatch = homeLink;
        }
    }

    if (bestMatch) {
        bestMatch.classList.add('active');
    }

    // Mobile toggle logic
    const toggle = headerPlaceholder.querySelector('.mobile-menu-toggle');
    const nav = headerPlaceholder.querySelector('nav'); // Select the nav container

    // Initial check for mobile view visibility
    // CSS media queries handle the display of the toggle button,
    // but we can ensure aria-attributes are set.
    toggle.setAttribute('aria-label', 'Toggle navigation menu');
    toggle.setAttribute('aria-expanded', 'false');

    toggle.addEventListener('click', () => {
        nav.classList.toggle('mobile-menu-open');
        const isOpen = nav.classList.contains('mobile-menu-open');

        toggle.setAttribute('aria-expanded', isOpen);
        toggle.textContent = isOpen ? '✕' : '☰';

        // Lock body scroll when menu is open
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    });

    // Add a resize observer to handle the case where the user resizes the window
    // while the mobile menu is open.
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            if (entry.target === nav) {
                const isMobile = window.innerWidth < 768;
                if (!isMobile && nav.classList.contains('mobile-menu-open')) {
                    nav.classList.remove('mobile-menu-open');
                    toggle.setAttribute('aria-expanded', 'false');
                    toggle.textContent = '☰';
                    document.body.style.overflow = '';
                }
            }
        }
    });

    resizeObserver.observe(nav);
}

function loadFooter() {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;

    const footerHTML = `
    <footer>
        <div class="container">
            <div class="footer-grid">
                <div class="footer-col">
                    <h4>Platform</h4>
                    <ul>
                        <li><a href="/platform/managed-edr.html">Managed EDR</a></li>
                        <li><a href="/platform/managed-sat.html">Managed SAT</a></li>
                        <li><a href="/platform/managed-itdr.html">Managed ITDR</a></li>
                        <li><a href="/platform/managed-siem.html">Managed SIEM</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Solutions</h4>
                    <ul>
                        <li><a href="/solutions/phishing.html">Phishing</a></li>
                        <li><a href="/solutions/compliance.html">Compliance</a></li>
                        <li><a href="/solutions/bec.html">Business Email Compromise</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Company</h4>
                    <ul>
                         <li><a href="/about/our-story.html">Our Story</a></li>
                         <li><a href="/about/careers.html">Careers</a></li>
                         <li><a href="/about/contact.html">Contact Us</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Contact</h4>
                    <p style="color: var(--text-muted); margin-bottom: 10px;">
                        Protecting your network with logic and precision.
                    </p>
                    <a href="/demo.html" class="btn btn-outline" style="font-size: 0.9rem;">Request Demo</a>
                </div>
            </div>

            <div class="footer-bottom">
                <p>&copy; 2025 CYBER-LOGIC NETWORKS. All Rights Reserved.</p>
            </div>
        </div>
    </footer>
    `;

    footerPlaceholder.innerHTML = footerHTML;

    // Create a placeholder for the chat widget
    const chatWidgetPlaceholder = document.createElement('div');
    chatWidgetPlaceholder.id = 'chat-widget-placeholder';
    document.body.appendChild(chatWidgetPlaceholder);

    const chatWidgetHTML = `
        <div id="chat-widget-container">
            <div id="chat-bubble">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <div id="chat-window">
                <div id="chat-header">
                    <span>AI Assistant</span>
                    <button id="chat-close" aria-label="Close chat">&times;</button>
                </div>
                <div id="chat-log">
                    <div class="chat-message bot">Hi there! How can I help you today?</div>
                </div>
                <div id="chat-input-container">
                    <input type="text" id="chat-input" placeholder="Type a message..." aria-label="Chat input">
                    <button id="chat-send" aria-label="Send message">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-send"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
            </div>
        </div>
    `;
    chatWidgetPlaceholder.innerHTML = chatWidgetHTML;

    // Load the chat script and initialize the widget once it's loaded
    const chatScript = document.createElement('script');
    chatScript.src = '/js/chat.js';
    chatScript.onload = () => {
        // This function is defined in js/chat.js
        if (typeof initializeChatWidget === 'function') {
            initializeChatWidget();
        }
    };
    document.body.appendChild(chatScript);
}
