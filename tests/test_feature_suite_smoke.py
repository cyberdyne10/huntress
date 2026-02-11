from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_new_docs_exist():
    assert (ROOT / "docs" / "AUTH.md").exists()
    assert (ROOT / "docs" / "OPERATIONS.md").exists()


def test_new_pages_exist():
    assert (ROOT / "status.html").exists()
    assert (ROOT / "admin.html").exists()
    assert (ROOT / "sitemap.xml").exists()
    assert (ROOT / "robots.txt").exists()


def test_auth_and_admin_routes_declared():
    app_js = (ROOT / "server" / "app.js").read_text(encoding="utf-8")
    assert "/api/auth/login" in app_js
    assert "/api/auth/me" in app_js
    assert "/api/admin/overview" in app_js
    assert "/api/crm/webhook/status" in app_js
