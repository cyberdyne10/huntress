import pytest
from playwright.sync_api import Page, expect
import os

def test_primary_buttons_hidden_on_mobile(page: Page):
    # Load the page
    page.goto(f"file://{os.path.abspath('index.html')}")

    # Set viewport to mobile size
    page.set_viewport_size({"width": 375, "height": 667})

    # Wait for header
    page.wait_for_selector('header')

    # Check that all primary buttons are hidden
    primary_btns = page.locator('a.btn.btn-primary')

    # Ensure there are at least some buttons to check
    expect(primary_btns.first).to_be_attached()

    # Check each one is not visible
    for i in range(primary_btns.count()):
        expect(primary_btns.nth(i)).to_be_hidden()

def test_primary_buttons_visible_on_desktop(page: Page):
    # Load the page
    page.goto(f"file://{os.path.abspath('index.html')}")

    # Set viewport to desktop size
    page.set_viewport_size({"width": 1280, "height": 800})

    # Wait for header
    page.wait_for_selector('header')

    # Check that primary buttons are visible
    primary_btns = page.locator('a.btn.btn-primary')

    expect(primary_btns.first).to_be_visible()
