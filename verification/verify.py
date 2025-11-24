from playwright.sync_api import sync_playwright

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate desktop
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        # 1. Desktop Verification
        page.goto("http://localhost:8000/index.html")
        page.wait_for_load_state("networkidle")

        # Check Sticky (Fixed) Header
        # Scroll down
        page.evaluate("window.scrollTo(0, 500)")
        page.wait_for_timeout(500)
        page.screenshot(path="verification/desktop_scrolled.png")

        # Check hover effect on card (simulate)
        card = page.locator(".why-us-card").first
        card.hover()
        page.wait_for_timeout(300)
        page.screenshot(path="verification/desktop_hover.png")

        # 2. Mobile Verification
        # Emulate iPhone 12
        iphone = p.devices['iPhone 12']
        context = browser.new_context(**iphone)
        page_mobile = context.new_page()
        page_mobile.goto("http://localhost:8000/index.html")
        page_mobile.wait_for_load_state("networkidle")

        # Check Mobile Header (initial state)
        page_mobile.screenshot(path="verification/mobile_initial.png")

        # Open Menu
        toggle = page_mobile.locator(".mobile-menu-toggle")
        toggle.click()
        page_mobile.wait_for_timeout(500) # Wait for transition/render

        # Check Overlay
        page_mobile.screenshot(path="verification/mobile_menu_open.png")

        browser.close()

if __name__ == "__main__":
    verify_changes()
