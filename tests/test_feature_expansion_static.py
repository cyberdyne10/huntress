from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_new_pages_exist():
    required = [
        ROOT / 'soc-preview.html',
        ROOT / 'portal.html',
        ROOT / 'trust-center.html',
        ROOT / 'resources' / 'resource-center.html',
        ROOT / 'solutions' / 'smb.html',
        ROOT / 'docs' / 'FEATURES-EXPANSION.md',
    ]
    for page in required:
        assert page.exists(), f'Missing expected file: {page}'


def test_demo_page_has_booking_form():
    html = (ROOT / 'demo.html').read_text(encoding='utf-8')
    assert 'id="booking-form"' in html
    assert 'id="slotId"' in html


def test_pricing_has_calculator():
    html = (ROOT / 'pricing.html').read_text(encoding='utf-8')
    assert 'id="pricing-calc"' in html
    assert 'id="pricing-result"' in html
