
import os
import pytest
from playwright.sync_api import Page, expect

def test_mobile_menu_scroll_bug(page: Page):
    """
    Tests that resizing the window from mobile to desktop view
    correctly removes the 'overflow: hidden' style from the body.
    """
    file_path = os.path.abspath('index.html')
    page.goto(f'file://{file_path}')

    # 1. Set mobile viewport and open the menu
    page.set_viewport_size({"width": 767, "height": 800})
    menu_toggle = page.locator('.mobile-menu-toggle')
    menu_toggle.click()

    # 2. Verify body overflow is hidden
    body = page.locator('body')
    expect(body).to_have_attribute('style', 'overflow: hidden;')

    # 3. Resize to desktop view
    page.set_viewport_size({"width": 1200, "height": 800})

    # 4. Assert that the overflow style is removed
    # This is where the test is expected to fail before the fix
    expect(body).not_to_have_attribute('style', 'overflow: hidden;')
