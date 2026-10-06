// NovaOffice Hub Controller
let currentFilter = 'all';
let allDocuments = [];

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  lucide.createIcons();
  loadDocuments();

  // Search input binding
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        renderDocumentList(e.target.value.trim().toLowerCase());
      }, 200);
    });
  }

  // File upload binding
  const uploadInput = document.getElementById('fileUploadInput');
  if (uploadInput) {
    uploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await uploadFile(file);
      uploadInput.value = '';
    });
  }
});

async function loadDocuments(inTrash = false) {
  try {
    const res = await fetch(`/api/documents${inTrash ? '?trash=true' : ''}`);
    if (!res.ok) throw new Error('Không thể tải danh sách tài liệu');
    allDocuments = await res.json();
    renderDocumentList();
  } catch (err) {
    showToast('Lỗi khi tải tài liệu: ' + err.message, 'error');
  }
}

async function filterDocuments(type) {
  const prevFilter = currentFilter;
  currentFilter = type;
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
    tab.classList.add('hover:text-slate-900');
  });
  const activeTab = document.getElementById(`filter-${type}`);
  if (activeTab) {
    activeTab.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
    activeTab.classList.remove('hover:text-slate-900');
  }

  const titleEl = document.getElementById('sectionTitle');
  const emptyTrashBtn = document.getElementById('btnEmptyTrash');

  if (type === 'trash') {
    if (titleEl) titleEl.innerText = 'Thùng Rác & Tài Liệu Đã Xóa';
    if (emptyTrashBtn) emptyTrashBtn.classList.remove('hidden');
    await loadDocuments(true);
  } else {
    if (titleEl) titleEl.innerText = 'Tài Liệu Gần Đây';
    if (emptyTrashBtn) emptyTrashBtn.classList.add('hidden');
    if (prevFilter === 'trash') {
      await loadDocuments(false);
    } else {
      const searchQuery = document.getElementById('searchInput')?.value.trim().toLowerCase();
      renderDocumentList(searchQuery);
    }
  }
}

function renderDocumentList(searchQuery = '') {
  const tableBody = document.getElementById('documentListTable');
  if (!tableBody) return;

  let filtered = allDocuments;
  if (currentFilter !== 'all' && currentFilter !== 'trash') {
    filtered = filtered.filter(d => d.type === currentFilter);
  }
  if (searchQuery) {
    filtered = filtered.filter(d => 
      d.title.toLowerCase().includes(searchQuery) ||
      (d.tags && d.tags.some(t => t.toLowerCase().includes(searchQuery)))
    );
  }

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="py-12 text-center text-slate-400">
          <div class="flex flex-col items-center justify-center space-y-2">
            <i data-lucide="${currentFilter === 'trash' ? 'trash-2' : 'folder-open'}" class="w-8 h-8 text-slate-300"></i>
            <span class="text-sm">${currentFilter === 'trash' ? 'Thùng rác trống. Chưa có tệp nào bị xóa!' : 'Chưa có tài liệu nào trong mục này'}</span>
            ${currentFilter !== 'trash' ? '<button onclick="createNewDocument(\'doc\')" class="text-xs text-blue-600 font-semibold hover:underline">Tạo tài liệu mới</button>' : ''}
          </div>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  tableBody.innerHTML = filtered.map(doc => {
    const typeBadge = getTypeBadge(doc.type);
    const formattedDate = formatDate(doc.updated_at);
    const formattedSize = formatSize(doc.size_bytes);
    const openUrl = getOpenUrl(doc);

    return `
      <tr class="hover:bg-slate-50/80 transition-colors group">
        <!-- Title & Icon -->
        <td class="py-3 px-4 font-medium text-slate-800">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center ${typeBadge.bg} ${typeBadge.color}">
              <i data-lucide="${typeBadge.icon}" class="w-4 h-4"></i>
            </div>
            <div class="truncate max-w-xs md:max-w-md">
              ${currentFilter === 'trash' ? `
                <span class="font-semibold text-slate-500 line-through">${escapeHtml(doc.title)}</span>
              ` : `
                <a href="${openUrl}" onclick="event.preventDefault(); openInWorkspace('${openUrl}', '${escapeHtml(doc.title).replace(/'/g, "\\'")}', '${doc.type}', '${doc.id}')" class="font-semibold hover:text-blue-600 transition">${escapeHtml(doc.title)}</a>
              `}
              ${doc.tags && doc.tags.length > 0 ? `
                <div class="flex gap-1 mt-0.5">
                  ${doc.tags.map(t => `<span class="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded">${t}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        </td>

        <!-- Type -->
        <td class="py-3 px-4">
          <span class="text-xs px-2.5 py-1 rounded-full font-medium ${typeBadge.bg} ${typeBadge.color}">
            ${typeBadge.label}
          </span>
        </td>

        <!-- Updated -->
        <td class="py-3 px-4 text-xs text-slate-500 hidden sm:table-cell">
          ${formattedDate}
        </td>

        <!-- Size -->
        <td class="py-3 px-4 text-xs text-slate-400 hidden md:table-cell">
          ${formattedSize}
        </td>

        <!-- Actions -->
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end space-x-1 opacity-80 group-hover:opacity-100 transition">
            ${currentFilter === 'trash' ? `
              <button onclick="restoreDocument('${doc.id}', '${doc.type}')" class="px-2.5 py-1 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition" title="Khôi phục tài liệu">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                <span>Khôi phục</span>
              </button>
              <button onclick="permanentlyDeleteDocument('${doc.id}', '${doc.type}')" class="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition" title="Xóa vĩnh viễn khỏi máy">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                <span>Xóa hẳn</span>
              </button>
            ` : `
              <a href="${openUrl}" onclick="event.preventDefault(); openInWorkspace('${openUrl}', '${escapeHtml(doc.title).replace(/'/g, "\\'")}', '${doc.type}', '${doc.id}')" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg" title="Mở">
                <i data-lucide="external-link" class="w-4 h-4"></i>
              </a>
              ${doc.type !== 'pdf' ? `
              <button onclick="duplicateDocument('${doc.id}')" class="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg" title="Nhân bản">
                <i data-lucide="copy" class="w-4 h-4"></i>
              </button>
              ` : ''}
              <button onclick="deleteDocument('${doc.id}', '${doc.type}')" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg" title="Chuyển vào thùng rác">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function getTypeBadge(type) {
  switch (type) {
    case 'doc':
      return { label: 'Văn bản', icon: 'file-text', bg: 'bg-blue-50', color: 'text-blue-600' };
    case 'sheet':
      return { label: 'Bảng tính', icon: 'table', bg: 'bg-emerald-50', color: 'text-emerald-600' };
    case 'slide':
      return { label: 'Thuyết trình', icon: 'presentation', bg: 'bg-amber-50', color: 'text-amber-600' };
    case 'pdf':
      return { label: 'PDF', icon: 'file-check-2', bg: 'bg-rose-50', color: 'text-rose-600' };
    default:
      return { label: 'Tệp', icon: 'file', bg: 'bg-slate-50', color: 'text-slate-600' };
  }
}

function openInWorkspace(url, title, type, id) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'NOVA_OPEN_TAB',
      id: id ? `tab-${type}-${id}` : `tab-${type}-${Date.now()}`,
      title: title || 'Tài liệu',
      appType: type || 'doc',
      url: url
    }, '*');
  } else {
    window.location.href = url;
  }
}

function getOpenUrl(doc) {
  if (doc.type === 'pdf') {
    return `/pdf?file=${encodeURIComponent(doc.id)}`;
  }
  return `/${doc.type}?id=${doc.id}`;
}

async function createNewDocument(type) {
  try {
    const titles = {
      doc: 'Văn bản không tên',
      sheet: 'Bảng tính không tên',
      slide: 'Bài thuyết trình mới'
    };
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titles[type] || 'Tài liệu mới',
        type: type,
        tags: [type]
      })
    });
    if (!res.ok) throw new Error('Không thể tạo tài liệu');
    const newDoc = await res.json();
    openInWorkspace(`/${type}?id=${newDoc.id}`, newDoc.title, type, newDoc.id);
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

async function createFromTemplate(templateKey) {
  try {
    let payload = {};
    if (templateKey === 'doc_report') {
      payload = {
        title: 'Báo Cáo Tiến Độ Dự Án',
        type: 'doc',
        tags: ['báo cáo', 'mẫu'],
        content: {
          html: `
            <h1>BÁO CÁO TIẾN ĐỘ DỰ ÁN</h1>
            <p><strong>Ngày lập:</strong> ${new Date().toLocaleDateString('vi-VN')} &nbsp;|&nbsp; <strong>Người thực hiện:</strong> Ban Quản Lý</p>
            <hr>
            <h2>1. Mục Tiêu & Tổng Quan</h2>
            <p>Tóm tắt các mục tiêu chính của dự án trong giai đoạn hiện tại. Đánh giá mức độ hoàn thành so với kế hoạch ban đầu.</p>
            <h2>2. Các Hạng Mục Đã Hoàn Thành</h2>
            <ul>
              <li>Hoàn thành khảo sát yêu cầu người dùng</li>
              <li>Xây dựng kiến trúc hệ thống và cơ sở dữ liệu</li>
              <li>Triển khai phiên bản thử nghiệm Alpha v1.0</li>
            </ul>
            <h2>3. Bảng Phân Công Nhiệm Vụ</h2>
            <table border="1" style="width:100%; border-collapse:collapse;">
              <tr><th>Hạng mục</th><th>Người phụ trách</th><th>Trạng thái</th><th>Hạn chót</th></tr>
              <tr><td>Thiết kế giao diện</td><td>Nguyễn Văn A</td><td>Hoàn thành</td><td>01/10/2026</td></tr>
              <tr><td>Lập trình API Backend</td><td>Trần Thị B</td><td>Đang kiểm thử</td><td>08/10/2026</td></tr>
              <tr><td>Viết tài liệu hướng dẫn</td><td>Lê Văn C</td><td>Đang thực hiện</td><td>12/10/2026</td></tr>
            </table>
            <h2>4. Khó Khăn & Đề Xuất</h2>
            <blockquote>Cần bổ sung nhân sự kiểm thử hiệu năng trước đợt phát hành chính thức.</blockquote>
          `
        }
      };
    } else if (templateKey === 'sheet_finance') {
      payload = {
        title: 'Kế Hoạch Tài Chính & Thu Chi',
        type: 'sheet',
        tags: ['tài chính', 'mẫu'],
        content: {
          activeSheet: "Thu Chi Q4",
          sheets: {
            "Thu Chi Q4": {
              data: {
                "A1": { "value": "Hạng Mục Thu Chi", "bold": true, "bg": "#f8fafc" },
                "B1": { "value": "Tháng 10", "bold": true, "bg": "#f8fafc" },
                "C1": { "value": "Tháng 11", "bold": true, "bg": "#f8fafc" },
                "D1": { "value": "Tháng 12", "bold": true, "bg": "#f8fafc" },
                "E1": { "value": "Tổng Quý", "bold": true, "bg": "#e2e8f0" },
                "A2": { "value": "Doanh thu bán hàng" },
                "B2": { "value": 120000000 },
                "C2": { "value": 145000000 },
                "D2": { "value": 180000000 },
                "E2": { "formula": "=SUM(B2:D2)", "bold": true },
                "A3": { "value": "Chi phí vận hành" },
                "B3": { "value": 45000000 },
                "C3": { "value": 48000000 },
                "D3": { "value": 52000000 },
                "E3": { "formula": "=SUM(B3:D3)", "bold": true },
                "A4": { "value": "Lợi nhuận gộp", "bold": true },
                "B4": { "formula": "=B2-B3", "bold": true, "color": "#16a34a" },
                "C4": { "formula": "=C2-C3", "bold": true, "color": "#16a34a" },
                "D4": { "formula": "=D2-D3", "bold": true, "color": "#16a34a" },
                "E4": { "formula": "=E2-E3", "bold": true, "color": "#16a34a" },
              }
            }
          }
        }
      };
    } else if (templateKey === 'slide_pitch') {
      payload = {
        title: 'Pitch Deck Giới Thiệu Sản Phẩm',
        type: 'slide',
        tags: ['pitching', 'mẫu'],
        content: {
          theme: "modern-dark",
          slides: [
            {
              id: "slide-1",
              title: "NovaOffice Suite",
              subtitle: "Nền Tảng Văn Phòng Thế Hệ Mới Cho Doanh Nghiệp Hiện Đại",
              layout: "title-slide"
            },
            {
              id: "slide-2",
              title: "Vấn Đề & Thách Thức",
              layout: "bullet-list",
              bullets: [
                "Phần mềm văn phòng truyền thống nặng nề, cồng kềnh",
                "Chi phí bản quyền đám mây đắt đỏ định kỳ",
                "Mối lo ngại về an ninh dữ liệu khi đưa lên máy chủ bên thứ ba",
                "Thiếu sự đồng bộ liền mạch giữa văn bản, bảng tính và trình chiếu"
              ]
            },
            {
              id: "slide-3",
              title: "Giải Pháp Toàn Diện Của Chúng Tôi",
              layout: "bullet-list",
              bullets: [
                "Chạy hoàn toàn cục bộ (offline-first) với tốc độ tức thì",
                "Bảo mật tuyệt đối: Mọi dữ liệu nằm trọn trong máy của bạn",
                "Tương thích 100% định dạng chuẩn: .docx, .xlsx, .pptx, PDF",
                "Giao diện hiện đại, tối giản và thông minh"
              ]
            }
          ]
        }
      };
    } else if (templateKey === 'doc_meeting') {
      payload = {
        title: 'Biên Bản Cuộc Họp Chiến Lược',
        type: 'doc',
        tags: ['họp', 'mẫu'],
        content: {
          html: `
            <h1>BIÊN BẢN CUỘC HỌP NỘI BỘ</h1>
            <p><strong>Thời gian:</strong> 09:00 - 10:30, ${new Date().toLocaleDateString('vi-VN')}<br>
            <strong>Địa điểm:</strong> Phòng họp A / Trực tuyến<br>
            <strong>Chủ trì:</strong> Giám đốc Kỹ thuật<br>
            <strong>Thành phần tham dự:</strong> Đội ngũ Phát triển & Vận hành</p>
            <hr>
            <h2>1. Nội Dung Thảo Luận</h2>
            <p>Đánh giá hiệu suất hệ thống NovaOffice và kế hoạch mở rộng các tính năng xuất báo cáo.</p>
            <h2>2. Quyết Định Thống Nhất</h2>
            <ul>
              <li>Áp dụng bộ công thức mở rộng cho NovaSheet</li>
              <li>Tối ưu hóa tốc độ xuất file Word và PDF trong dưới 1 giây</li>
              <li>Hỗ trợ phím tắt chuẩn quốc tế cho trình soạn thảo</li>
            </ul>
            <h2>3. Kế Hoạch Hành Động (Action Items)</h2>
            <table border="1" style="width:100%; border-collapse:collapse;">
              <tr><th>Công việc</th><th>Phụ trách</th><th>Hạn hoàn thành</th></tr>
              <tr><td>Kiểm thử giao diện responsive</td><td>Team QA</td><td>Trong tuần</td></tr>
              <tr><td>Phát hành bản cài đặt tự động</td><td>Team DevOps</td><td>Thứ Sáu tới</td></tr>
            </table>
          `
        }
      };
    } else if (templateKey === 'doc_leave') {
      payload = {
        title: 'Đơn Xin Nghỉ Phép',
        type: 'doc',
        tags: ['hành chính', 'mẫu', 'nghỉ phép'],
        content: {
          html: `
            <div style="text-align: center; font-weight: bold; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 13pt;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p style="margin: 0; font-size: 12pt;">Độc lập - Tự do - Hạnh phúc</p>
              <p style="margin: 5px 0 0 0;">---------------o0o---------------</p>
            </div>
            <h1 style="text-align: center; margin-top: 25px; margin-bottom: 20px;">ĐƠN XIN NGHỈ PHÉP</h1>
            <p><strong>Kính gửi:</strong></p>
            <ul>
              <li>Ban Giám Đốc Công ty</li>
              <li>Trưởng Phòng Quản trị & Nhân sự</li>
              <li>Trưởng bộ phận phụ trách trực tiếp</li>
            </ul>
            <p>Tôi tên là: ............................................................................ Mã nhân viên: ..............................</p>
            <p>Hiện đang công tác tại vị trí / bộ phận: ..................................................................................</p>
            <p>Nay tôi làm đơn này kính xin được nghỉ phép trong khoảng thời gian:</p>
            <p>Từ ngày ....../....../202... đến hết ngày ....../....../202... (Tổng cộng: ...... ngày)</p>
            <p><strong>Lý do nghỉ phép:</strong> ................................................................................................................</p>
            <p><strong>Bàn giao công việc:</strong> Tôi đã bàn giao lại toàn bộ công việc đang phụ trách cho đồng nghiệp: ......................................................</p>
            <p>Tôi cam kết sẽ có mặt tại công ty đúng ngày và hoàn thành tốt công việc được giao.</p>
            <br>
            <table style="width: 100%; border: none; margin-top: 20px;">
              <tr style="border: none;">
                <td style="width: 50%; text-align: center; border: none;">
                  <strong>Ý KIẾN CỦA QUẢN LÝ</strong><br>
                  <em>(Ký và ghi rõ họ tên)</em>
                </td>
                <td style="width: 50%; text-align: center; border: none;">
                  <em>Ngày ..... tháng ..... năm 202...</em><br>
                  <strong>NGƯỜI LÀM ĐƠN</strong><br>
                  <em>(Ký và ghi rõ họ tên)</em>
                </td>
              </tr>
            </table>
          `
        }
      };
    } else if (templateKey === 'doc_contract') {
      payload = {
        title: 'Hợp Đồng Lao Động Mẫu',
        type: 'doc',
        tags: ['hợp đồng', 'pháp lý', 'mẫu'],
        content: {
          html: `
            <div style="text-align: center; font-weight: bold; margin-bottom: 15px;">
              <p style="margin: 0; font-size: 13pt;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p style="margin: 0; font-size: 12pt;">Độc lập - Tự do - Hạnh phúc</p>
              <p style="margin: 5px 0 0 0;">---------------------</p>
            </div>
            <h1 style="text-align: center; margin-top: 20px; margin-bottom: 20px;">HỢP ĐỒNG LAO ĐỘNG</h1>
            <p style="text-align: center; font-style: italic;">Số: ......./HĐLĐ-2026</p>
            <p>Hôm nay, ngày ..... tháng ..... năm 2026, tại trụ sở công ty, chúng tôi gồm các bên:</p>
            <p><strong>BÊN A (NGƯỜI SỬ DỤNG LAO ĐỘNG):</strong></p>
            <p>Công ty: ...................................................................................................................................</p>
            <p>Đại diện bởi: .............................................................. Chức vụ: ..................................................</p>
            <p>Địa chỉ: .....................................................................................................................................</p>
            <p><strong>BÊN B (NGƯỜI LAO ĐỘNG):</strong></p>
            <p>Họ và tên: ................................................................. Ngày sinh: ....../....../..................................</p>
            <p>CCCD/CMND số: ................................................ Nơi cấp: ........................................................</p>
            <p>Địa chỉ thường trú: .....................................................................................................................</p>
            <hr>
            <h2>ĐIỀU 1: THỜI HẠN VÀ CÔNG VIỆC HỢP ĐỒNG</h2>
            <p>- Loại hợp đồng: Hợp đồng lao động xác định thời hạn (12 tháng).</p>
            <p>- Vị trí chuyên môn: ..................................................................................................................</p>
            <h2>ĐIỀU 2: CHẾ ĐỘ LÀM VIỆC VÀ TIỀN LƯƠNG</h2>
            <p>- Thời gian làm việc: 8 giờ/ngày, từ Thứ Hai đến Thứ Sáu hàng tuần.</p>
            <p>- Mức lương chính: ................................ VNĐ/tháng (Chưa bao gồm các khoản phụ cấp).</p>
            <p>- Hình thức trả lương: Chuyển khoản ngân hàng vào ngày 05 hàng tháng.</p>
            <h2>ĐIỀU 3: ĐIỀU KHOẢN THI HÀNH</h2>
            <p>Hợp đồng này được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>
            <br>
            <table style="width: 100%; border: none; margin-top: 20px;">
              <tr style="border: none;">
                <td style="width: 50%; text-align: center; border: none;">
                  <strong>ĐẠI DIỆN BÊN A</strong><br>
                  <em>(Ký tên và đóng dấu)</em>
                </td>
                <td style="width: 50%; text-align: center; border: none;">
                  <strong>ĐẠI DIỆN BÊN B</strong><br>
                  <em>(Ký và ghi rõ họ tên)</em>
                </td>
              </tr>
            </table>
          `
        }
      };
    } else if (templateKey === 'sheet_project') {
      payload = {
        title: 'Kế Hoạch & Tiến Độ Dự Án',
        type: 'sheet',
        tags: ['dự án', 'kế hoạch', 'mẫu'],
        content: {
          activeSheet: "Kế Hoạch Sprint",
          sheets: {
            "Kế Hoạch Sprint": {
              data: {
                "A1": { "value": "Mã Task", "bold": true, "bg": "#f1f5f9" },
                "B1": { "value": "Tên Hạng Mục Công Việc", "bold": true, "bg": "#f1f5f9" },
                "C1": { "value": "Người Phụ Trách", "bold": true, "bg": "#f1f5f9" },
                "D1": { "value": "Ngày Bắt Đầu", "bold": true, "bg": "#f1f5f9" },
                "E1": { "value": "Hạn Chót", "bold": true, "bg": "#f1f5f9" },
                "F1": { "value": "Tiến Độ (%)", "bold": true, "bg": "#f1f5f9" },
                "G1": { "value": "Trạng Thái", "bold": true, "bg": "#e2e8f0" },
                "A2": { "value": "TASK-101" },
                "B2": { "value": "Thiết kế giao diện NovaOffice" },
                "C2": { "value": "Nguyễn Văn A" },
                "D2": { "value": "01/10/2026" },
                "E2": { "value": "05/10/2026" },
                "F2": { "value": "100%", "format": "percent" },
                "G2": { "formula": '=IF(F2="100%", "Hoàn thành", "Đang làm")', "bold": true, "color": "#16a34a" },
                "A3": { "value": "TASK-102" },
                "B3": { "value": "Hoàn thiện bộ 4 mô đun văn phòng" },
                "C3": { "value": "Trần Thị B" },
                "D3": { "value": "03/10/2026" },
                "E3": { "value": "10/10/2026" },
                "F3": { "value": "90%", "format": "percent" },
                "G3": { "formula": '=IF(F3="100%", "Hoàn thành", "Đang làm")', "bold": true, "color": "#ea580c" },
                "A4": { "value": "TASK-103" },
                "B4": { "value": "Đóng gói file exe độc lập hoàn chỉnh" },
                "C4": { "value": "Lê Văn C" },
                "D4": { "value": "06/10/2026" },
                "E4": { "value": "12/10/2026" },
                "F4": { "value": "60%", "format": "percent" },
                "G4": { "formula": '=IF(F4="100%", "Hoàn thành", "Đang làm")', "bold": true, "color": "#ea580c" }
              }
            }
          }
        }
      };
    }

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Không thể tạo mẫu tài liệu');
    const doc = await res.json();
    openInWorkspace(`/${doc.type}?id=${doc.id}`, doc.title, doc.type, doc.id);
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

async function duplicateDocument(id) {
  try {
    const res = await fetch(`/api/documents/${id}/duplicate`, { method: 'POST' });
    if (!res.ok) throw new Error('Nhân bản thất bại');
    showToast('Đã nhân bản tài liệu thành công!');
    await loadDocuments(currentFilter === 'trash');
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

async function deleteDocument(id, type) {
  if (!confirm('Bạn có chắc chắn muốn chuyển tài liệu này vào thùng rác không?')) return;
  try {
    const res = await fetch(`/api/documents/${id}?type=${type}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Không thể xóa tài liệu');
    showToast('Đã chuyển tài liệu vào thùng rác!');
    await loadDocuments(currentFilter === 'trash');
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

async function restoreDocument(id, type) {
  try {
    const res = await fetch(`/api/documents/${id}/restore?type=${type}`, { method: 'POST' });
    if (!res.ok) throw new Error('Không thể khôi phục tài liệu');
    showToast('Đã khôi phục tài liệu thành công!');
    await loadDocuments(true);
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

async function permanentlyDeleteDocument(id, type) {
  if (!confirm('Hành động này sẽ xóa vĩnh viễn tài liệu khỏi máy tính và KHÔNG THỂ khôi phục. Bạn có chắc không?')) return;
  try {
    const res = await fetch(`/api/documents/${id}?type=${type}&permanent=true`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Không thể xóa vĩnh viễn tài liệu');
    showToast('Đã xóa vĩnh viễn tài liệu!');
    await loadDocuments(true);
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

async function confirmEmptyTrash() {
  if (!confirm('Bạn có chắc chắn muốn dọn sạch toàn bộ thùng rác không? Tất cả tài liệu trong thùng rác sẽ bị xóa vĩnh viễn!')) return;
  try {
    const res = await fetch('/api/documents/trash/empty', { method: 'POST' });
    if (!res.ok) throw new Error('Không thể dọn thùng rác');
    showToast('Đã dọn sạch thùng rác thành công!');
    await loadDocuments(true);
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  showToast('Đang tải lên và xử lý tệp...', 'info');

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Tải tệp lên thất bại');
    const data = await res.json();
    if (data.redirect) {
      openInWorkspace(data.redirect, file.name, 'doc', 'upload');
    } else {
      showToast('Đã tải lên tệp: ' + file.name);
      await loadDocuments();
    }
  } catch (err) {
    showToast('Lỗi tải tệp: ' + err.message, 'error');
  }
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatSize(bytes) {
  if (!bytes) return '1 KB';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'error' ? 'alert-triangle' : (type === 'info' ? 'info' : 'check-circle');
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-5 h-5 ${type === 'error' ? 'text-rose-400' : 'text-emerald-400'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  lucide.createIcons({ root: toast });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('nova_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    updateThemeIcon(true);
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('nova_theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
  showToast(isDark ? 'Đã bật chế độ Tối (Dark Mode)' : 'Đã bật chế độ Sáng (Light Mode)');
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('darkModeIcon');
  if (!icon) return;
  icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
  lucide.createIcons({ root: document.getElementById('darkModeBtn') });
}

async function openStorageFolder() {
  try {
    const res = await fetch('/api/system/show-in-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast(data.message, 'info');
    } else {
      showToast('Không thể mở thư mục: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi mở thư mục lưu trữ', 'error');
  }
}

