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
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 0L37.3205 10V30L20 40L2.67949 30V10L20 0Z" fill="#00e5ff" fill-opacity="0.2"/>
                    <path d="M20 5L32.9904 12.5V27.5L20 35L7.00962 27.5V12.5L20 5Z" stroke="#00e5ff" stroke-width="2"/>
                    <circle cx="20" cy="20" r="5" fill="#00e5ff"/>
                </svg>
                CYBER-LOGIC <span>NETWORKS</span>
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
                </ul>
            </nav>

            <div class="cta-group">
                <a href="/demo.html" class="btn btn-primary">Get a Demo</a>
            </div>

            <button class="mobile-menu-toggle" style="display:none; background:none; border:none; color: white; font-size: 1.5rem;">
                ☰
            </button>
        </div>
    </header>
    `;

    headerPlaceholder.innerHTML = headerHTML;

    // Add simple active state logic
    const currentPath = window.location.pathname;
    const links = headerPlaceholder.querySelectorAll('a');
    links.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.style.color = 'var(--primary-color)';
        }
    });

    // Mobile toggle logic
    const toggle = headerPlaceholder.querySelector('.mobile-menu-toggle');
    const nav = headerPlaceholder.querySelector('.main-nav');

    if(window.innerWidth <= 768) {
        toggle.style.display = 'block';
    }

    toggle.addEventListener('click', () => {
        if (nav.style.display === 'flex') {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
            nav.style.flexDirection = 'column';
            nav.style.position = 'absolute';
            nav.style.top = '80px';
            nav.style.left = '0';
            nav.style.width = '100%';
            nav.style.background = '#0f172a';
            nav.style.padding = '20px';
        }
    });
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
}
