import pytest
from playwright.sync_api import Page, expect
import os

def test_terminal_chat_widget(page: Page):
    # Create verification directory if it doesn't exist
    os.makedirs("verification", exist_ok=True)

    # Listen for console events
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

    # Navigate to the local index.html file
    file_path = os.path.abspath('index.html')
    page.goto(f'file://{file_path}')

    # Wait for the chat widget to signal that it is ready
    page.wait_for_selector('body[data-chat-widget-ready="true"]')

    # Locate the terminal toggle bubble and click it
    toggle_bubble = page.locator("#terminal-toggle-bubble")
    expect(toggle_bubble).to_be_visible()
    toggle_bubble.click()

    # Locate the terminal chat widget and take a screenshot
    chat_widget = page.locator("#terminal-chat-widget")
    expect(chat_widget).to_be_visible()
    chat_widget.screenshot(path="verification/terminal_chat_widget.png")
