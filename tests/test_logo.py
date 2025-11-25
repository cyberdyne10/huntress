
import os
import pytest
from playwright.sync_api import Page, expect

def test_logo_loads_on_root_page(page: Page):
    """
    Tests that the logo is visible on the root page (index.html)
    and uses the correct external URL.
    """
    # Get the absolute path to the HTML file
    file_path = os.path.abspath('index.html')

    # Navigate to the local HTML file
    page.goto(f'file://{file_path}')

    # Wait for the logo to be visible
    logo = page.locator('img[alt="Cyber-Logic Networks Logo"]')
    expect(logo).to_be_visible()

    # Check if the image source is the new external URL
    logo_src = logo.get_attribute('src')
    expected_src = "https://cyberlogicnetwork.com/wp-content/uploads/2024/09/brand-log.png"
    assert logo_src == expected_src, f"Expected logo src to be '{expected_src}', but it was '{logo_src}'"

def test_logo_loads_on_nested_page(page: Page):
    """
    Tests that the logo is visible on a nested page (about/our-story.html)
    and uses the correct external URL.
    """
    # Get the absolute path to the HTML file
    file_path = os.path.abspath('about/our-story.html')

    # Navigate to the local HTML file
    page.goto(f'file://{file_path}')

    # Wait for the logo to be visible
    logo = page.locator('img[alt="Cyber-Logic Networks Logo"]')
    expect(logo).to_be_visible()

    # Check if the image source is the new external URL
    logo_src = logo.get_attribute('src')
    expected_src = "https://cyberlogicnetwork.com/wp-content/uploads/2024/09/brand-log.png"
    assert logo_src == expected_src, f"Expected logo src to be '{expected_src}', but it was '{logo_src}'"
