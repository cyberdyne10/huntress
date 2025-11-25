
import os
import pytest
from playwright.sync_api import sync_playwright, expect

@pytest.fixture(scope="session")
def browser_instance():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()

def test_logo_loads_on_root_page(browser_instance):
    page = browser_instance.new_page()

    # Get the absolute path to the HTML file
    file_path = os.path.abspath('index.html')

    # Navigate to the local HTML file
    page.goto(f'file://{file_path}')

    # Wait for the logo to be visible
    logo = page.locator('img[alt="Cyber-Logic Networks Logo"]')
    expect(logo).to_be_visible()

    # Check if the image source is root-relative
    logo_src = logo.get_attribute('src')
    assert logo_src == '/images/logo.png', f"Expected logo src to be root-relative, but it was {logo_src}"

    page.close()

def test_logo_loads_on_nested_page(browser_instance):
    page = browser_instance.new_page()

    # Get the absolute path to the HTML file
    file_path = os.path.abspath('about/our-story.html')

    # Navigate to the local HTML file
    page.goto(f'file://{file_path}')

    # Wait for the logo to be visible
    logo = page.locator('img[alt="Cyber-Logic Networks Logo"]')
    expect(logo).to_be_visible()

    # Check if the image source is root-relative
    logo_src = logo.get_attribute('src')
    assert logo_src == '/images/logo.png', f"Expected logo src to be root-relative, but it was {logo_src}"

    page.close()
