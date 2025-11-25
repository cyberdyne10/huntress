
import os
import pytest
from playwright.sync_api import Page, expect

def test_active_link_has_class_and_no_inline_style(page: Page):
    """
    Tests that the active navigation link has the 'active' class
    and does not have an inline style attribute.
    """
    # Get the absolute path to the pricing.html file
    file_path = os.path.abspath('pricing.html')
    page.goto(f'file://{file_path}')

    # Find the link that points to the pricing page
    nav_link = page.locator('nav ul.main-nav > li > a[href="/pricing.html"]')

    # 1. Assert that the link has the 'active' class
    expect(nav_link).to_have_class('active')

    # 2. Assert that the link does not have an inline style attribute
    style_attribute = nav_link.get_attribute('style')
    assert style_attribute is None, f"Expected no inline style, but found: {style_attribute}"
