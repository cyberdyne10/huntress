import pytest
from playwright.sync_api import Page, expect
import os

def test_mobile_h1_font_size(page: Page):
    # Load the page
    page.goto(f"file://{os.path.abspath('index.html')}")

    # Set viewport to mobile size
    page.set_viewport_size({"width": 375, "height": 667})

    # Wait for h1 to be visible
    h1 = page.locator('h1').first
    expect(h1).to_be_visible()

    # Check computed style
    font_size = h1.evaluate("element => window.getComputedStyle(element).fontSize")
    print(f"Mobile Font Size: {font_size}")
    assert font_size == "28px"

    line_height = h1.evaluate("element => window.getComputedStyle(element).lineHeight")
    # line-height 1.2 * 28px = 33.6px
    print(f"Mobile Line Height: {line_height}")
    # Computed line-height might be in px. 1.2 * 28 = 33.6.
    # Depending on browser, it might be 33.6px or slightly different due to rounding.
    # We can check if it's close or if it reports 'normal' or a value.
    # However, since the CSS sets it to unitless 1.2, computed style usually returns the px value.

    # Verify desktop size is different
    page.set_viewport_size({"width": 1280, "height": 800})
    font_size_desktop = h1.evaluate("element => window.getComputedStyle(element).fontSize")
    print(f"Desktop Font Size: {font_size_desktop}")
    assert font_size_desktop != "28px"
