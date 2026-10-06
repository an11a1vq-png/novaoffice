import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure app can be imported
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.main import app

class TestPhase4OfficeHubAndPdf(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_hub_page_elements(self):
        """Test Hub HTML has trash tabs and template cards."""
        res = self.client.get("/hub")
        self.assertEqual(res.status_code, 200)
        html = res.text
        self.assertIn("Kho Biểu Mẫu Chuẩn", html)
        self.assertIn("doc_leave", html)
        self.assertIn("doc_contract", html)
        self.assertIn("sheet_project", html)
        self.assertIn("Thùng rác", html)
        self.assertIn("confirmEmptyTrash()", html)

    def test_02_pdf_page_elements(self):
        """Test NovaPDF viewer HTML and endpoints."""
        res = self.client.get("/pdf")
        self.assertEqual(res.status_code, 200)
        html = res.text
        self.assertIn("fitWidth()", html)
        self.assertIn("rotatePage()", html)
        self.assertIn("downloadPdf()", html)

        # Test PDF export route
        export_res = self.client.post("/api/export/pdf", json={
            "title": "Kiểm thử PDF",
            "html_content": "<h1>Xin chào từ NovaOffice</h1><p>Tài liệu kiểm thử</p>"
        })
        self.assertEqual(export_res.status_code, 200)
        self.assertTrue(export_res.content.startswith(b"%PDF"))

    def test_03_soft_delete_and_restore_workflow(self):
        """Test moving doc to trash, listing in trash, restoring, and emptying trash."""
        # 1. Create a doc
        create_res = self.client.post("/api/documents", json={
            "title": "Tài Liệu Kiểm Thử Thùng Rác",
            "type": "doc",
            "content": {"html": "<p>Nội dung thử nghiệm</p>"}
        })
        self.assertEqual(create_res.status_code, 200)
        doc = create_res.json()
        doc_id = doc["id"]

        # 2. Check doc is in active list
        list_res = self.client.get("/api/documents?trash=false")
        self.assertEqual(list_res.status_code, 200)
        active_ids = [d["id"] for d in list_res.json()]
        self.assertIn(doc_id, active_ids)

        # 3. Soft delete (move to trash)
        del_res = self.client.delete(f"/api/documents/{doc_id}?type=doc&permanent=false")
        self.assertEqual(del_res.status_code, 200)

        # 4. Doc should NOT be in active list
        list_active_res = self.client.get("/api/documents?trash=false")
        active_ids = [d["id"] for d in list_active_res.json()]
        self.assertNotIn(doc_id, active_ids)

        # 5. Doc SHOULD be in trash list
        list_trash_res = self.client.get("/api/documents?trash=true")
        self.assertEqual(list_trash_res.status_code, 200)
        trash_ids = [d["id"] for d in list_trash_res.json()]
        self.assertIn(doc_id, trash_ids)

        # 6. Restore doc
        restore_res = self.client.post(f"/api/documents/{doc_id}/restore?type=doc")
        self.assertEqual(restore_res.status_code, 200)

        # 7. Doc should be back in active list
        list_active_again = self.client.get("/api/documents?trash=false")
        active_ids_again = [d["id"] for d in list_active_again.json()]
        self.assertIn(doc_id, active_ids_again)

        # 8. Move back to trash and permanently delete
        self.client.delete(f"/api/documents/{doc_id}?type=doc&permanent=false")
        perm_del_res = self.client.delete(f"/api/documents/{doc_id}?type=doc&permanent=true")
        self.assertEqual(perm_del_res.status_code, 200)

        # Verify not in trash anymore
        list_trash_again = self.client.get("/api/documents?trash=true")
        trash_ids_again = [d["id"] for d in list_trash_again.json()]
        self.assertNotIn(doc_id, trash_ids_again)

    def test_04_empty_trash_endpoint(self):
        """Test empty trash functionality."""
        # Create 2 docs and soft delete them
        doc1 = self.client.post("/api/documents", json={"title": "Trash 1", "type": "sheet", "content": {}}).json()
        doc2 = self.client.post("/api/documents", json={"title": "Trash 2", "type": "slide", "content": {}}).json()

        self.client.delete(f"/api/documents/{doc1['id']}?type=sheet")
        self.client.delete(f"/api/documents/{doc2['id']}?type=slide")

        # Verify both in trash
        trash_res = self.client.get("/api/documents?trash=true")
        trash_ids = [d["id"] for d in trash_res.json()]
        self.assertIn(doc1["id"], trash_ids)
        self.assertIn(doc2["id"], trash_ids)

        # Empty trash
        empty_res = self.client.post("/api/documents/trash/empty")
        self.assertEqual(empty_res.status_code, 200)

        # Verify trash is clean
        trash_after_res = self.client.get("/api/documents?trash=true")
        trash_after_ids = [d["id"] for d in trash_after_res.json()]
        self.assertNotIn(doc1["id"], trash_after_ids)
        self.assertNotIn(doc2["id"], trash_after_ids)

if __name__ == "__main__":
    unittest.main()
