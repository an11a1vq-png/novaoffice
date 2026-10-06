import unittest
from fastapi.testclient import TestClient
from app.main import app
import desktop

client = TestClient(app)

class TestMultiTabWorkspaceSystem(unittest.TestCase):
    def test_workspace_route(self):
        resp = client.get("/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/html", resp.headers["content-type"])
        content = resp.text
        self.assertIn("tabStrip", content)
        self.assertIn("workspace.js", content)
        self.assertIn("NovaOffice", content)

    def test_hub_route(self):
        resp = client.get("/hub")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/html", resp.headers["content-type"])
        content = resp.text
        self.assertIn("Bộ Ứng Dụng Văn Phòng", content)
        self.assertIn("fileUploadInput", content)

    def test_workspace_alias_route(self):
        resp = client.get("/workspace")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("tabStrip", resp.text)

    def test_individual_app_routes(self):
        for route in ["/doc", "/sheet", "/slide", "/pdf"]:
            resp = client.get(route)
            self.assertEqual(resp.status_code, 200)
            self.assertIn("text/html", resp.headers["content-type"])

    def test_system_open_window_endpoint(self):
        # Test endpoint presence (do not actually spawn infinite windows in tests)
        self.assertTrue(hasattr(app, "routes"))
        route_paths = [getattr(r, "path", "") for r in app.routes]
        self.assertIn("/api/system/open-window", route_paths)

    def test_desktop_helpers(self):
        port = desktop.find_free_port(8900, max_attempts=5)
        self.assertTrue(8900 <= port < 8910)
        # Verify function find_active_novaoffice_server exists
        self.assertTrue(callable(desktop.find_active_novaoffice_server))

if __name__ == "__main__":
    unittest.main()
