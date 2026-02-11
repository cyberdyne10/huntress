document.addEventListener('DOMContentLoaded', () => {
  loadHeader();
  loadFooter();
});

function loadHeader() {
  const headerPlaceholder = document.getElementById('header-placeholder');
  if (!headerPlaceholder) return;

  headerPlaceholder.innerHTML = `
  <header>
    <div class="container header-container">
      <a href="/index.html" class="logo">
        <img src="https://cyberlogicnetwork.com/wp-content/uploads/2024/09/brand-log.png" alt="Cyber-Logic Networks Logo" style="max-height: 60px; width: auto; object-fit: contain;">
      </a>
      <nav>
        <ul class="main-nav">
          <li><a href="#">Platform</a>
            <ul class="dropdown">
              <li><a href="/platform/overview.html">Platform Overview</a></li>
              <li><a href="/soc-preview.html">SOC Dashboard Preview</a></li>
              <li><a href="/trust-center.html">Trust Center</a></li>
            </ul>
          </li>
          <li><a href="#">Solutions</a>
            <ul class="dropdown">
              <li><a href="/solutions/finance.html">Finance</a></li>
              <li><a href="/solutions/healthcare.html">Healthcare</a></li>
              <li><a href="/solutions/education.html">Education</a></li>
              <li><a href="/solutions/smb.html">SMB</a></li>
            </ul>
          </li>
          <li><a href="/about/case-studies.html">Case Studies</a></li>
          <li><a href="/resources/resource-center.html">Resources</a></li>
          <li><a href="/pricing.html">Pricing</a></li>
          <li class="mobile-only-link"><a href="/portal.html">Client Portal</a></li>
        </ul>
      </nav>
      <div class="cta-group">
        <a href="/portal.html" class="btn btn-outline nav-cta-secondary">Portal</a>
        <a href="/demo.html" class="btn btn-primary">Get a Demo</a>
      </div>
      <button class="mobile-menu-toggle" aria-label="Toggle navigation menu" aria-expanded="false">☰</button>
    </div>
  </header>`;

  const currentPath = window.location.pathname;
  const links = headerPlaceholder.querySelectorAll('nav ul.main-nav > li > a');
  let bestMatch = null;
  let longestMatch = 0;

  links.forEach((link) => {
    const linkHref = link.getAttribute('href');
    if (linkHref.startsWith('/') && currentPath.endsWith(linkHref) && linkHref.length > longestMatch) {
      bestMatch = link;
      longestMatch = linkHref.length;
    }
  });

  if (!bestMatch && (currentPath.endsWith('/') || currentPath.endsWith('/index.html'))) {
    const homeLink = headerPlaceholder.querySelector('a[href="/index.html"]');
    if (homeLink) bestMatch = homeLink;
  }
  if (bestMatch) bestMatch.classList.add('active');

  const toggle = headerPlaceholder.querySelector('.mobile-menu-toggle');
  const nav = headerPlaceholder.querySelector('nav');

  toggle.addEventListener('click', () => {
    nav.classList.toggle('mobile-menu-open');
    const isOpen = nav.classList.contains('mobile-menu-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.textContent = isOpen ? '✕' : '☰';
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768 && nav.classList.contains('mobile-menu-open')) {
      nav.classList.remove('mobile-menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
      document.body.style.overflow = '';
    }
  });
}

function loadFooter() {
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (!footerPlaceholder) return;

  footerPlaceholder.innerHTML = `
  <footer>
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <h4>Platform</h4>
          <ul>
            <li><a href="/soc-preview.html">SOC Preview</a></li>
            <li><a href="/trust-center.html">Trust Center</a></li>
            <li><a href="/portal.html">Client Portal</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Solutions</h4>
          <ul>
            <li><a href="/solutions/finance.html">Finance</a></li>
            <li><a href="/solutions/healthcare.html">Healthcare</a></li>
            <li><a href="/solutions/education.html">Education</a></li>
            <li><a href="/solutions/smb.html">SMB</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Learn</h4>
          <ul>
            <li><a href="/about/case-studies.html">Case Studies</a></li>
            <li><a href="/resources/resource-center.html">Resource Center</a></li>
            <li><a href="/pricing.html">Pricing Calculator</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Contact</h4>
          <p style="color: var(--text-muted); margin-bottom: 10px;">Security outcomes, delivered 24/7.</p>
          <a href="/demo.html" class="btn btn-outline" style="font-size: .9rem;">Request Demo</a>
        </div>
      </div>
      <div class="footer-bottom"><p>&copy; 2026 CYBER-LOGIC NETWORKS. All Rights Reserved.</p></div>
    </div>
  </footer>`;
}
