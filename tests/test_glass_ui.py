import pytest
from playwright.sync_api import Page, expect
import os

def test_premium_glass_cards(page: Page):
    # Create verification directory if it doesn't exist
    os.makedirs("verification", exist_ok=True)

    # Navigate to the local index.html file
    file_path = os.path.abspath('index.html')
    page.goto(f'file://{file_path}')

    # Wait for the hero section to be visible
    hero_section = page.locator(".cl-section")
    expect(hero_section).to_be_visible()

    # Locate the glass cards container
    glass_container = page.locator(".premium-glass-container")
    expect(glass_container).to_be_visible()

    # Take a screenshot of the initial state
    glass_container.screenshot(path="verification/glass_cards_initial.png")

    # Hover over the second card to test the animation
    second_card = page.locator(".premium-glass-card").nth(1)
    second_card.hover()

    # Wait for the transition to complete
    page.wait_for_timeout(500) # 0.3s transition + buffer

    # Take a screenshot of the hover state
    glass_container.screenshot(path="verification/glass_cards_hover.png")
