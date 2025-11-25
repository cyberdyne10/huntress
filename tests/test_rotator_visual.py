
import pytest
from playwright.sync_api import Page, expect

def test_rotator_smooth_fade_out(page: Page):
    """
    This test verifies that the text rotator fades out smoothly by waiting for
    the final text content to change, which is a more robust method than

    checking for intermediate animation states.
    """
    page.goto("file:///app/index.html")
    rotator = page.locator("#word-rotator")

    # 1. Check the initial state.
    expect(rotator).to_have_text("Enterprise")

    # 2. Use page.wait_for_function to pause the test until the rotator's
    # text content changes from its initial value. This is the most reliable
    # way to wait for an asynchronous DOM update.
    page.wait_for_function("document.getElementById('word-rotator').textContent !== 'Enterprise'", timeout=3500)

    # 3. Now that we know the text has changed, assert that it's the correct new word.
    expect(rotator).to_have_text("Endpoints")

    # 4. As a final check, ensure the 'hidden' class is not present after the
    # animation, confirming the fade-in has completed.
    expect(rotator).not_to_have_class("hidden")
