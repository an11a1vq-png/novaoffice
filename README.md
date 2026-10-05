# 🏢 NovaOffice Suite - Bộ Ứng Dụng Văn Phòng Hiện Đại

**NovaOffice Suite** là bộ công cụ văn phòng cục bộ thế hệ mới (Local Offline-First Office Suite), kết hợp sức mạnh của backend **Python 3.11 (FastAPI, python-docx, openpyxl, python-pptx, reportlab)** và giao diện **Web hiện đại** (Tailwind CSS, Canvas, Lucide Icons, Chart.js).

---

## 🌟 Các Phân Hệ Ứng Dụng

### 1. 📝 NovaDoc (Soạn Thảo Văn Bản - Word)
- **Thanh Ribbon đa thẻ (Multi-Tab Ribbon):** Thiết kế chuẩn Microsoft Office 365 / Google Docs: `[Trang chủ]`, `[Chèn]`, `[Bố cục]`, `[Xem]`, `[✨ Nova AI Copilot]`.
- **Mục lục tài liệu động (Document Outline):** Tự động phát hiện các tiêu đề H1, H2, H3 trong văn bản, hiển thị cây phân cấp điều hướng bên trái và cuộn mượt mà đến từng phần khi nhấp chuột.
- **Thanh thước căn dòng (Document Ruler):** Thước đo tỷ lệ cm trực quan ở đầu trang giấy A4.
- **Chế độ tập trung toàn màn hình (Zen Mode):** Nhấn `F11` hoặc nút "Tập trung" để ẩn toàn bộ thanh công cụ, mở ra không gian viết thuần túy không xao nhãng.
- **Tìm kiếm & Thay thế (Find & Replace):** Nhấn `Ctrl + F` để mở hộp thoại tìm kiếm, đếm số lượng kết quả, thay thế từng vị trí hoặc "Thay thế tất cả".
- **Chế độ Sáng / Tối (Dark & Light Mode):** Tùy chỉnh theme với độ tương phản cao, dịu mắt ban đêm và lưu trạng thái vào trình duyệt.
- Đầy đủ tính năng định dạng: Font chữ, cỡ chữ, in đậm, in nghiêng, gạch chân, màu chữ, highlight, canh lề, danh sách số/chấm.
- Chèn bảng biểu, ảnh URL, siêu liên kết, hộp ghi chú (Callout box), tem ngày giờ.
- Tự động đếm số từ, ký tự và ước tính thời gian đọc.
- **Tự động lưu (Auto-save)** liên tục sau mỗi thao tác.
- **Xuất file định dạng chuẩn**:
  - File Microsoft Word (`.docx`)
  - File in / PDF (`.pdf`)

### 2. 📊 NovaSheet (Bảng Tính Thông Minh - Excel)
- **Quản lý đa trang tính (Multi-Sheet Tabs):** Hỗ trợ nhiều Sheet trong cùng một file (`Trang tính 1`, `Trang tính 2`,...). Nhấn `+` để thêm sheet mới, nhấp đúp để đổi tên trực tiếp, xóa sheet không cần thiết.
- **Sắp xếp cột dữ liệu (Column Sorting):** Chọn bất kỳ cột nào và bấm `Sắp xếp A → Z` hoặc `Sắp xếp Z → A` để sắp xếp toàn bộ dữ liệu bảng.
- **Thao tác dòng linh hoạt:** Chèn thêm dòng mới phía trên hoặc xóa dòng hiện tại với 1 click.
- **Tìm kiếm trong bảng tính:** Nhấn "Tìm trong bảng" để tự động nhảy và cuộn đến ô dữ liệu khớp từ khóa.
- Lưới tính tương tác mượt mà gồm 26 cột (A-Z) và 60 hàng với sticky headers.
- Thanh công thức (Formula Bar) hiển thị tọa độ ô hoạt động và biểu thức tính.
- **Bộ máy tính toán công thức thời gian thực**: `=SUM(...)`, `=AVERAGE(...)`, `=COUNT(...)`, `=MAX(...)`, `=MIN(...)`, `=IF(...)`, `=A1+B1`,...
- **Trực quan hóa biểu đồ (Chart.js)**: Chọn vùng dữ liệu và vẽ biểu đồ Cột (Bar), Đường (Line), Tròn (Pie) tức thì.
- **Xuất file chuẩn**: File Excel (`.xlsx`) đa sheet và file CSV.

### 3. 📽️ NovaSlide (Thiết Kế Thuyết Trình - PowerPoint)
- **Hiệu ứng chuyển cảnh (Slide Transitions):** Tùy chọn hiệu ứng `Mờ dần (Fade)`, `Trượt ngang (Slide)`, `Phóng to (Zoom)` hoặc không hiệu ứng, áp dụng mượt mà khi trình chiếu.
- Trình tạo slide tỷ lệ chuẩn màn ảnh rộng **16:9** Widescreen.
- Quản lý danh sách slide: Thêm mới, nhân bản (Duplicate), di chuyển thứ tự lên/xuống, xóa.
- Hệ thống mẫu bố cục (Layouts): Trang tiêu đề, Danh sách ý chính, So sánh 2 cột, Trích dẫn lớn.
- Bộ sưu tập Themes chuyên nghiệp: Dark Slate, Clean Light, Corporate Blue, Emerald.
- **Chế độ Trình Chiếu Toàn Màn Hình (Presentation Mode)**: Nhấn `F5` để trình diễn với các phím mũi tên điều hướng hoặc phím Space.
- **Xuất file chuẩn**: File Microsoft PowerPoint (`.pptx`).

### 4. 📄 NovaPDF (Trình Đọc & Quản Lý PDF)
- Trình đọc PDF tích hợp PDF.js với khả năng chuyển trang, phóng to, thu nhỏ và in ấn.

### 5. 🗂️ Office Hub (Trung Tâm Điều Khiển)
- Bảng điều khiển tập trung, tìm kiếm tài liệu tức thì, lọc theo phân hệ, đổi theme Sáng/Tối.
- Tải lên file từ máy tính (`.docx`, `.xlsx`, `.pdf`, `.txt`, `.md`).

### 6. ✨ Nova AI Copilot (Trợ Lý AI Tự Động Sửa & Biên Soạn File Cục Bộ)
- **100% Offline & Bảo Mật:** Vận hành trực tiếp thông qua mô hình `qwen2.5:3b` trên **Ollama Cục Bộ** (`http://localhost:11434`), không gửi bất kỳ dữ liệu văn phòng nào ra ngoài.
- **✨ Rà soát & Tự Sửa Toàn Bộ File (Full-Document Auto-Fix):** 1 click để AI tự động quét toàn bộ văn bản, sửa triệt để các lỗi chính tả tiếng Việt, chuẩn hóa ngữ pháp và câu từ công sở, đi kèm thông báo **Hoàn tác (Undo)** tức thì nếu muốn khôi phục bản cũ.
- **⚡ Trợ Lý AI Tại Chỗ (Inline Copilot - `Ctrl + K`):** Bôi đen bất kỳ đoạn văn bản nào và nhấn `Ctrl + K`:
  - Thanh công cụ nổi xuất hiện ngay tại vị trí con trỏ chuột.
  - Các lệnh mẫu 1 chạm: *Sửa lỗi & trau chuốt*, *Văn phong trang trọng*, *Rút gọn súc tích*, *Mở rộng chi tiết*, *Dịch tiếng Anh*.
  - Nhập yêu cầu tùy ý (prompt) bằng tiếng Việt.
  - Bản xem trước Diff nổi bật trực tiếp trong văn bản với hai lựa chọn: **[✓ Áp dụng]** hoặc **[✕ Hủy bỏ]**.
- **Thanh trợ lý AI Sidecar Drawer:** Trượt ra từ cạnh phải tại mọi ứng dụng, hỗ trợ trò chuyện đa lượt (Multi-turn Chat) và nút *"Chèn vào tài liệu"*.
- **NovaSheet AI:** Nhập câu hỏi tiếng Việt, AI tự sinh công thức Excel chuẩn và điền thẳng vào ô đang chọn, phân tích xu hướng bảng số liệu.
- **NovaSlide AI:** Nhập chủ đề bất kỳ, AI tự động sinh dàn ý 3-5 slide hoàn chỉnh với tiêu đề, bố cục và gạch đầu dòng.


---

## 📦 Bản Cài Đặt Desktop & File Chạy Độc Lập (.exe)

Bạn có thể chia sẻ trực tiếp các file trong thư mục `dist/` cho bất kỳ ai sử dụng mà không cần cài đặt Python:

1. **`dist/NovaOffice_Setup.exe` (Bộ Cài Đặt Khuyên Dùng):**
   - Bộ cài đặt chuẩn Windows, tự động giải nén và thiết lập ứng dụng vào máy tính.
   - Hoàn toàn **không yêu cầu quyền Administrator (UAC)**, ai tải về cũng cài được ngay trong 3 giây.
   - Tự động tạo **Lối tắt (Shortcut) có Icon đẹp mắt trên Màn hình chính (Desktop)** và **Menu Start**.
   - Có sẵn công cụ gỡ cài đặt sạch sẽ (`Uninstall.bat`).
2. **`dist/NovaOffice_Portable.exe` (Bản Di Động 1 File Duy Nhất ~40MB):**
   - Chỉ gồm 1 file `.exe` duy nhất, không cần cài đặt, tải về nhấp đúp là dùng ngay, thuận tiện copy vào USB.
   - Lưu trữ tài liệu an toàn trong thư mục `Documents\NovaOffice` của máy tính.

---

## 🚀 Hướng Dẫn Khởi Chạy (Chạy từ mã nguồn)

### Cách 1: Khởi chạy nhanh bằng File Batch (Khuyên dùng trên Windows)
Chỉ cần nhấp đúp chuột vào file:
```
d:\office\run.bat
```
Hệ thống sẽ tự động bật máy chủ và mở trình duyệt mặc định tại địa chỉ: `http://127.0.0.1:8000`.

### Cách 2: Khởi chạy bằng dòng lệnh
Mở Terminal hoặc PowerShell tại thư mục `d:\office` và gõ:
```powershell
python main.py
```

---

## ⌨️ Phím Tắt Tiện Dụng

| Phím tắt | Chức năng | Phân hệ áp dụng |
|---|---|---|
| `Ctrl + S` | Lưu tài liệu ngay lập tức | NovaDoc, NovaSheet, NovaSlide |
| `Ctrl + P` | In ấn / Xuất file PDF | NovaDoc, NovaPDF |
| `Ctrl + B` | In đậm văn bản / ô | NovaDoc, NovaSheet |
| `Ctrl + I` | In nghiêng văn bản / ô | NovaDoc, NovaSheet |
| `Ctrl + U` | Gạch chân văn bản | NovaDoc |
| `Ctrl + Z` | Hoàn tác (Undo) | NovaDoc |
| `Ctrl + Y` | Làm lại (Redo) | NovaDoc |
| `F5` | Bật chế độ Trình Chiếu toàn màn hình | NovaSlide |
| `Phím mũi tên` / `Tab` | Di chuyển giữa các ô trong bảng tính | NovaSheet |
| `Mũi tên Trái / Phải` / `Space` | Chuyển slide tiếp theo / trước đó khi trình chiếu | NovaSlide |
| `Esc` | Thoát chế độ trình chiếu | NovaSlide |

---

## 📂 Cấu Trúc Mã Nguồn

```
d:\office\
├── app\
│   ├── config.py             # Cấu hình cổng, đường dẫn lưu trữ
│   ├── main.py               # Máy chủ FastAPI & API Endpoints
│   ├── models\
│   │   └── document.py       # Pydantic Schemas
│   └── services\
│       ├── storage.py        # Dịch vụ CRUD và quản lý file cục bộ
│       ├── docx_service.py   # Chuyển đổi và xuất file Word .docx
│       ├── xlsx_service.py   # Xử lý và xuất file Excel .xlsx
│       ├── pptx_service.py   # Xử lý và xuất file PowerPoint .pptx
│       └── pdf_service.py    # Xử lý và xuất file PDF
├── static\
│   ├── css\style.css         # Hệ thống giao diện hiện đại & Dark/Light mode
│   ├── js\
│   │   ├── hub.js            # Điều khiển Dashboard Hub
│   │   ├── doc.js            # Bộ điều khiển soạn thảo văn bản
│   │   ├── sheet.js          # Bộ điều khiển bảng tính & biểu đồ
│   │   ├── slide.js          # Bộ điều khiển slide & trình chiếu
│   │   └── pdf.js            # Bộ điều khiển xem PDF
│   ├── index.html            # Giao diện Office Hub
│   ├── doc.html              # Giao diện NovaDoc
│   ├── sheet.html            # Giao diện NovaSheet
│   ├── slide.html            # Giao diện NovaSlide
│   └── pdf.html              # Giao diện NovaPDF
├── data\                     # Nơi lưu trữ tài liệu người dùng
│   ├── docs\                 # Tài liệu văn bản
│   ├── sheets\               # Bảng tính
│   ├── slides\               # Bài thuyết trình
│   └── uploads\              # Tệp tải lên
├── tests\
│   └── test_api.py           # Bộ kiểm thử tự động
├── main.py                   # Script khởi chạy và tự động mở trình duyệt
├── run.bat                   # Script kích hoạt 1-click cho Windows
├── requirements.txt          # Thư viện phụ thuộc
└── README.md                 # Hướng dẫn sử dụng
```

---

## 🧪 Kiểm Thử Tự Động (Automated Testing)

Chạy lệnh sau để kiểm tra toàn bộ hệ thống API và dịch vụ xuất file:
```powershell
python -m unittest discover -s tests -v
```
Toàn bộ các bài test sẽ kiểm tra:
1. Tải các trang giao diện (`/`, `/doc`, `/sheet`, `/slide`, `/pdf`).
2. Vòng đời CRUD tài liệu (Tạo mới, Đọc, Cập nhật tự động, Nhân bản, Xóa).
3. Xuất file Microsoft Word (`.docx`).
4. Xuất file Microsoft Excel (`.xlsx`).
5. Xuất file Microsoft PowerPoint (`.pptx`).
6. Xuất file định dạng PDF (`.pdf`).
