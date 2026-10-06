// NovaDoc Word Processor Controller v2.0
let currentDocId = null;
let saveTimer = null;
let isSaving = false;
let currentSelectionRange = null;
let lastBackupHtml = null;

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  lucide.createIcons();

  const urlParams = new URLSearchParams(window.location.search);
  currentDocId = urlParams.get('id');

  if (currentDocId) {
    await loadDocument(currentDocId);
  } else {
    await createDefaultDoc();
  }

  setupEventListeners();
  updateStats();
  updateOutline();
});

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

// Multi-Tab Ribbon Switching
function switchRibbonTab(tabId) {
  document.querySelectorAll('.ribbon-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.ribbon-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });
}

// Document Load / Save
async function createDefaultDoc() {
  try {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Văn bản không tên',
        type: 'doc',
        tags: ['văn bản']
      })
    });
    if (!res.ok) throw new Error('Không thể khởi tạo tài liệu');
    const doc = await res.json();
    currentDocId = doc.id;
    window.history.replaceState(null, '', `/doc?id=${doc.id}`);
    document.getElementById('docTitleInput').value = doc.title;
    document.getElementById('docEditor').innerHTML = doc.content?.html || '<h1>Tài liệu mới</h1><p>Bắt đầu nhập nội dung tại đây...</p>';
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

async function loadDocument(id) {
  try {
    setSaveStatus('loading');
    const res = await fetch(`/api/documents/${id}?type=doc`);
    if (!res.ok) throw new Error('Không tìm thấy tài liệu');
    const doc = await res.json();
    
    document.getElementById('docTitleInput').value = doc.title || 'Văn bản không tên';
    document.getElementById('docEditor').innerHTML = doc.content?.html || '<p><br></p>';
    setSaveStatus('saved');
    updateOutline();

    if (window.parent && window.parent !== window && doc.title) {
      window.parent.postMessage({ type: 'NOVA_UPDATE_TAB_TITLE', title: doc.title }, '*');
    }
  } catch (err) {
    showToast('Lỗi khi mở tài liệu: ' + err.message, 'error');
  }
}

function setupEventListeners() {
  const editor = document.getElementById('docEditor');
  const titleInput = document.getElementById('docTitleInput');

  // Intercept back button to switch tab instead of navigating away
  const backBtn = document.querySelector('a[href="/"]');
  if (backBtn && window.parent && window.parent !== window) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.parent.postMessage({ type: 'NOVA_SWITCH_TAB', tabId: 'tab-hub' }, '*');
    });
  }

  // Auto-save on input
  editor.addEventListener('input', () => {
    scheduleAutoSave();
    updateStats();
    updateOutline();
  });

  // Save on title change
  titleInput.addEventListener('input', () => {
    scheduleAutoSave();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'NOVA_UPDATE_TAB_TITLE', title: titleInput.value.trim() || 'Văn bản không tên' }, '*');
    }
  });

  // Track selection for Inline Copilot
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
      const text = selection.toString().trim();
      if (text.length > 0) {
        currentSelectionRange = selection.getRangeAt(0).cloneRange();
      }
    }
  });

  // Global Shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl + S: Save
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveDocument();
    }
    // Ctrl + P: Print
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      exportPdf();
    }
    // Ctrl + K: Inline Copilot
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openInlineCopilot();
    }
    // Ctrl + F: Find & Replace
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      openFindReplace();
    }
    // Ctrl + Enter: Page Break
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      insertPageBreak();
    }
    // F11: Zen Mode
    if (e.key === 'F11') {
      e.preventDefault();
      toggleZenMode();
    }
    // Escape: Close modals / Zen
    if (e.key === 'Escape') {
      closeInlineCopilot();
      closeFindReplace();
      toggleVersionHistory(false);
      if (document.body.classList.contains('zen-mode')) toggleZenMode(false);
    }
  });
}

function scheduleAutoSave() {
  setSaveStatus('typing');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDocument();
  }, 1200);
}

async function saveDocument() {
  if (!currentDocId || isSaving) return;
  isSaving = true;
  setSaveStatus('saving');

  const title = document.getElementById('docTitleInput').value.trim() || 'Văn bản không tên';
  const html = document.getElementById('docEditor').innerHTML;

  try {
    const res = await fetch(`/api/documents/${currentDocId}?type=doc`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        content: { html: html }
      })
    });
    if (!res.ok) throw new Error('Lỗi khi lưu');
    setSaveStatus('saved');
    saveVersionSnapshot(false);
  } catch (err) {
    setSaveStatus('error');
    showToast('Lưu tự động thất bại: ' + err.message, 'error');
  } finally {
    isSaving = false;
  }
}

function setSaveStatus(status) {
  const container = document.getElementById('saveStatus');
  if (!container) return;

  if (status === 'saving' || status === 'loading') {
    container.innerHTML = `
      <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-blue-500"></i>
      <span>Đang lưu...</span>
    `;
  } else if (status === 'typing') {
    container.innerHTML = `
      <i data-lucide="pencil" class="w-3.5 h-3.5 text-amber-500"></i>
      <span>Đang nhập...</span>
    `;
  } else if (status === 'saved') {
    container.innerHTML = `
      <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-500"></i>
      <span>Đã lưu</span>
    `;
  } else if (status === 'error') {
    container.innerHTML = `
      <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-rose-500"></i>
      <span>Lỗi lưu</span>
    `;
  }
  lucide.createIcons({ root: container });
}

function updateStats() {
  const editor = document.getElementById('docEditor');
  const text = editor ? editor.innerText || '' : '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const readTime = Math.max(1, Math.ceil(words / 200));

  const wordEl = document.getElementById('wordCount');
  const charEl = document.getElementById('charCount');
  const readEl = document.getElementById('readTime');

  if (wordEl) wordEl.innerText = `${words} từ`;
  if (charEl) charEl.innerText = `${chars} ký tự`;
  if (readEl) readEl.innerText = `${readTime} phút đọc`;
}

// Document Outline Navigation
function updateOutline() {
  const editor = document.getElementById('docEditor');
  const outlineList = document.getElementById('outlineList');
  if (!editor || !outlineList) return;

  const headings = editor.querySelectorAll('h1, h2, h3');
  if (headings.length === 0) {
    outlineList.innerHTML = `<div class="text-slate-400 p-2 italic text-center text-[11px]">Chưa có tiêu đề H1/H2/H3</div>`;
    return;
  }

  let html = '';
  headings.forEach((h, index) => {
    const text = h.innerText.trim();
    if (!text) return;
    const tag = h.tagName.toLowerCase();
    const id = `heading-ref-${index}`;
    h.id = id;

    html += `
      <div class="outline-item ${tag}-level" onclick="scrollToHeading('${id}')" title="${escapeHtml(text)}">
        ${tag.toUpperCase()}: ${escapeHtml(text)}
      </div>
    `;
  });
  outlineList.innerHTML = html;
}

function scrollToHeading(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
    setTimeout(() => {
      el.style.backgroundColor = '';
      el.style.transition = 'background-color 0.5s ease';
    }, 1200);
  }
}

function toggleOutlineSidebar(force = null) {
  const sidebar = document.getElementById('docOutlineSidebar');
  if (!sidebar) return;
  if (force !== null) {
    sidebar.classList.toggle('collapsed', !force);
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

// Formatting Commands
function execCmd(command, value = null) {
  document.getElementById('docEditor').focus();
  document.execCommand(command, false, value);
  scheduleAutoSave();
  updateStats();
}

function applyFormatBlock(tag) {
  document.getElementById('docEditor').focus();
  document.execCommand('formatBlock', false, `<${tag}>`);
  scheduleAutoSave();
  updateOutline();
}

function insertHorizontalRule() {
  document.getElementById('docEditor').focus();
  document.execCommand('insertHorizontalRule', false, null);
  scheduleAutoSave();
}

function insertCurrentDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  execCmd('insertHTML', `<strong>${dateStr}</strong> `);
}

function insertCalloutBox() {
  const callout = `
    <div style="background:#eff6ff; border-left:4px solid #3b82f6; padding:12px 16px; margin:14px 0; border-radius:0 8px 8px 0;">
      <strong style="color:#1d4ed8;">📌 Ghi chú quan trọng:</strong>
      <p style="margin:4px 0 0 0; color:#1e293b;">Nội dung lưu ý hoặc thông tin đặc biệt cần nhấn mạnh ở đây...</p>
    </div><p><br></p>
  `;
  execCmd('insertHTML', callout);
}

function promptInsertTable() {
  const rows = parseInt(prompt('Nhập số hàng của bảng:', '3') || '0', 10);
  const cols = parseInt(prompt('Nhập số cột của bảng:', '3') || '0', 10);

  if (rows > 0 && cols > 0) {
    let tableHtml = '<table border="1" style="width:100%; border-collapse:collapse; margin:16px 0;"><tbody>';
    for (let r = 0; r < rows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        if (r === 0) {
          tableHtml += `<th style="border:1px solid #cbd5e1; padding:8px; background:#f8fafc;">Tiêu đề ${c + 1}</th>`;
        } else {
          tableHtml += `<td style="border:1px solid #cbd5e1; padding:8px;">Ô dữ liệu</td>`;
        }
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p><br></p>';
    
    document.getElementById('docEditor').focus();
    document.execCommand('insertHTML', false, tableHtml);
    scheduleAutoSave();
  }
}

function promptInsertImage() {
  const url = prompt('Nhập đường dẫn hình ảnh (URL):', 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=600&auto=format&fit=crop&q=80');
  if (url) {
    document.getElementById('docEditor').focus();
    const imgHtml = `<p><img src="${url}" style="max-width:100%; border-radius:6px; margin:12px 0;" alt="Hình ảnh"/></p><p><br></p>`;
    document.execCommand('insertHTML', false, imgHtml);
    scheduleAutoSave();
  }
}

function promptInsertLink() {
  const url = prompt('Nhập liên kết (URL):', 'https://');
  if (url) {
    execCmd('createLink', url);
  }
}

// Layout & View settings
function setMargins(type) {
  const editor = document.getElementById('docEditor');
  if (!editor) return;
  if (type === 'narrow') {
    editor.style.padding = '15mm 15mm';
    showToast('Đã đặt lề Hẹp (15mm)');
  } else if (type === 'wide') {
    editor.style.padding = '35mm 30mm';
    showToast('Đã đặt lề Rộng (35mm)');
  } else {
    editor.style.padding = '25mm 20mm';
    showToast('Đã đặt lề Chuẩn (25mm)');
  }
}

function setZoom(scale) {
  const editor = document.getElementById('docEditor');
  if (editor) {
    editor.style.transformOrigin = 'top center';
    editor.style.transform = `scale(${scale})`;
    showToast(`Thu phóng: ${Math.round(scale * 100)}%`);
  }
}

let isRulerVisible = true;
function toggleRuler() {
  const ruler = document.getElementById('docRulerContainer');
  if (!ruler) return;
  isRulerVisible = !isRulerVisible;
  ruler.style.display = isRulerVisible ? 'flex' : 'none';
}

function toggleZenMode(force = null) {
  const isZen = force !== null ? force : !document.body.classList.contains('zen-mode');
  document.body.classList.toggle('zen-mode', isZen);
  if (isZen) {
    showToast('Đã bật chế độ Tập trung (Zen Mode). Nhấn Esc để thoát');
  } else {
    showToast('Đã thoát chế độ Tập trung');
  }
}

// Toggle page width between standard A4 (210mm) and Wide View (100% / max-w-5xl)
let isWideView = false;
function togglePageWidth() {
  const editor = document.getElementById('docEditor');
  const label = document.getElementById('pageWidthLabel');
  isWideView = !isWideView;

  if (isWideView) {
    editor.style.width = '95%';
    editor.style.maxWidth = '1100px';
    if (label) label.innerText = 'Khổ linh hoạt';
    showToast('Đã chuyển sang chế độ Xem rộng (Tối ưu cho bảng biểu lớn)');
  } else {
    editor.style.width = '210mm';
    editor.style.maxWidth = 'none';
    if (label) label.innerText = 'Khổ A4 chuẩn';
    showToast('Đã chuyển về Khổ A4 chuẩn');
  }
}

// ========================================================
// INLINE COPILOT (CTRL + K) & IN-PLACE AUTO EDIT
// ========================================================
function openInlineCopilot() {
  if (typeof openAiDownloadModal === 'function') {
    openAiDownloadModal();
    return;
  }
  const pill = document.getElementById('inlineCopilotPill');
  const editor = document.getElementById('docEditor');
  if (!pill || !editor) return;

  const selection = window.getSelection();
  let rect;

  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    currentSelectionRange = selection.getRangeAt(0).cloneRange();
    rect = currentSelectionRange.getBoundingClientRect();
  } else {
    rect = editor.getBoundingClientRect();
  }

  // Position floating pill near selection
  const topPos = Math.max(70, rect.top - 70 + window.scrollY);
  const leftPos = Math.max(20, Math.min(window.innerWidth - 440, rect.left + window.scrollX));

  pill.style.top = `${topPos}px`;
  pill.style.left = `${leftPos}px`;
  pill.style.display = 'block';

  const input = document.getElementById('inlineCopilotInput');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
}

function closeInlineCopilot() {
  const pill = document.getElementById('inlineCopilotPill');
  if (pill) pill.style.display = 'none';
}

function runInlineAiAction(actionType) {
  const prompts = {
    improve: 'Sửa lỗi chính tả, ngữ pháp và trau chuốt câu từ',
    formal: 'Viết lại bằng văn phong trang trọng, chuẩn mực công sở',
    shorten: 'Rút gọn đoạn văn súc tích, giữ nguyên ý chính',
    expand: 'Mở rộng đoạn văn chi tiết và sinh động hơn'
  };
  const input = document.getElementById('inlineCopilotInput');
  if (input) {
    input.value = prompts[actionType] || actionType;
    handleInlineCopilotSubmit(new Event('submit'));
  }
}

async function handleInlineCopilotSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('inlineCopilotInput');
  const instruction = input ? input.value.trim() : '';
  if (!instruction) return;

  const editor = document.getElementById('docEditor');
  let selectedText = "";
  let rangeToUse = currentSelectionRange;

  if (rangeToUse) {
    selectedText = rangeToUse.toString().trim();
  }
  if (!selectedText) {
    // If no text selected, take full text or active paragraph
    selectedText = editor.innerText.substring(0, 1500);
  }

  const submitBtn = document.getElementById('inlineCopilotSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Đang xử lý...</span>`;
    lucide.createIcons({ root: submitBtn });
  }

  closeInlineCopilot();
  showToast('NOVA AI đang viết lại đoạn văn...', 'info');

  try {
    const res = await fetch('/api/ai/doc-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rewrite_custom',
        text: selectedText,
        user_instruction: instruction
      })
    });

    if (!res.ok) throw new Error('Không thể xử lý yêu cầu AI');
    const data = await res.json();
    const newText = data.result || '';

    // Render in-place Diff with Accept / Reject buttons
    applyInPlaceAiDiff(newText, rangeToUse);
  } catch (err) {
    showToast('Lỗi AI: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Sửa</span><i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>`;
      lucide.createIcons({ root: submitBtn });
    }
  }
}

function applyInPlaceAiDiff(newText, range) {
  const editor = document.getElementById('docEditor');
  lastBackupHtml = editor.innerHTML;

  if (range) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const diffId = 'diff-' + Date.now();
    const diffHtml = `
      <span id="${diffId}" class="ai-diff-container inline-block">
        <span class="text-emerald-700 font-medium">${escapeHtml(newText)}</span>
        <span class="ai-diff-actions no-print flex items-center gap-1.5 text-xs">
          <button onclick="acceptAiDiff('${diffId}')" class="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium flex items-center gap-1">
            ✓ Áp dụng
          </button>
          <button onclick="rejectAiDiff('${diffId}')" class="px-2 py-0.5 bg-slate-300 hover:bg-slate-400 text-slate-800 rounded font-medium flex items-center gap-1">
            ✕ Hủy bỏ
          </button>
        </span>
      </span>
    `;
    document.execCommand('insertHTML', false, diffHtml);
    showToast('Đã tạo bản xem trước thay đổi! Nhấn "Áp dụng" hoặc "Hủy bỏ".');
  } else {
    // Replace whole editor
    editor.innerHTML = `<p>${newText.replace(/\n/g, '<br>')}</p>`;
    showToast('Đã áp dụng nội dung mới vào tài liệu!');
    scheduleAutoSave();
    updateOutline();
    updateStats();
  }
}

window.acceptAiDiff = function(diffId) {
  const el = document.getElementById(diffId);
  if (!el) return;
  const contentSpan = el.querySelector('.text-emerald-700');
  const text = contentSpan ? contentSpan.innerText : '';
  const textNode = document.createTextNode(text);
  el.parentNode.replaceChild(textNode, el);
  showToast('Đã áp dụng thay đổi thành công!');
  scheduleAutoSave();
  updateStats();
  updateOutline();
};

window.rejectAiDiff = function(diffId) {
  const el = document.getElementById(diffId);
  if (!el) return;
  if (lastBackupHtml) {
    document.getElementById('docEditor').innerHTML = lastBackupHtml;
  } else {
    el.remove();
  }
  showToast('Đã hủy bỏ thay đổi AI.');
};

// ========================================================
// ONE-CLICK FULL DOCUMENT FIX
// ========================================================
async function triggerFullDocFix() {
  if (typeof openAiDownloadModal === 'function') {
    openAiDownloadModal();
    return;
  }
  const editor = document.getElementById('docEditor');
  if (!editor || !editor.innerText.trim()) {
    showToast('Tài liệu chưa có nội dung để rà soát!', 'error');
    return;
  }

  const confirmFix = confirm(
    '✨ NOVA AI sẽ tự động đọc toàn bộ tài liệu, rà soát chính tả, sửa lỗi ngữ pháp và chuẩn hóa câu từ công sở.\n\nBạn có muốn tiếp tục?'
  );
  if (!confirmFix) return;

  lastBackupHtml = editor.innerHTML;
  showToast('NOVA AI đang rà soát & sửa toàn bộ tài liệu (Vui lòng đợi vài giây)...', 'info');

  try {
    const res = await fetch('/api/ai/full-doc-fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html_content: editor.innerHTML })
    });

    if (!res.ok) throw new Error('Không thể rà soát tài liệu');
    const data = await res.json();

    if (data.fixed_html) {
      editor.innerHTML = data.fixed_html;
      scheduleAutoSave();
      updateStats();
      updateOutline();

      // Show Undo Banner
      showToastWithUndo('✨ Đã sửa và chuẩn hóa toàn bộ văn bản!', () => {
        editor.innerHTML = lastBackupHtml;
        scheduleAutoSave();
        updateStats();
        updateOutline();
        showToast('Đã hoàn tác văn bản gốc!');
      });
    }
  } catch (err) {
    showToast('Lỗi rà soát tài liệu: ' + err.message, 'error');
  }
}

function showToastWithUndo(message, onUndo) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast flex items-center justify-between gap-3';
  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <i data-lucide="sparkles" class="w-5 h-5 text-purple-400"></i>
      <span>${message}</span>
    </div>
    <button id="undoToastBtn" class="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold">
      Hoàn tác
    </button>
  `;
  container.appendChild(toast);
  lucide.createIcons({ root: toast });

  toast.querySelector('#undoToastBtn').onclick = () => {
    onUndo();
    toast.remove();
  };

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}

// ========================================================
// FIND & REPLACE
// ========================================================
let currentFindIndex = -1;
let findMatches = [];

function openFindReplace() {
  const modal = document.getElementById('findReplaceModal');
  if (!modal) return;
  modal.style.display = 'flex';
  const input = document.getElementById('findInput');
  if (input) {
    setTimeout(() => input.focus(), 50);
  }
}

function closeFindReplace() {
  const modal = document.getElementById('findReplaceModal');
  if (modal) modal.style.display = 'none';
}

function findNext() {
  const query = document.getElementById('findInput').value.trim();
  if (!query) return;

  const found = window.find(query, false, false, true, false, false, false);
  const countLabel = document.getElementById('findCountLabel');
  if (found) {
    if (countLabel) countLabel.innerText = 'Đã tìm thấy';
  } else {
    if (countLabel) countLabel.innerText = 'Không tìm thấy thêm';
  }
}

function replaceCurrent() {
  const replaceText = document.getElementById('replaceInput').value;
  const selection = window.getSelection();
  if (selection && selection.toString()) {
    document.execCommand('insertText', false, replaceText);
    findNext();
    scheduleAutoSave();
  } else {
    findNext();
  }
}

function replaceAll() {
  const query = document.getElementById('findInput').value;
  const replaceText = document.getElementById('replaceInput').value;
  if (!query) return;

  const editor = document.getElementById('docEditor');
  const count = (editor.innerHTML.match(new RegExp(escapeRegExp(query), 'g')) || []).length;
  if (count === 0) {
    showToast('Không tìm thấy từ cần thay thế', 'info');
    return;
  }

  editor.innerHTML = editor.innerHTML.replaceAll(query, replaceText);
  scheduleAutoSave();
  updateStats();
  updateOutline();
  showToast(`Đã thay thế tất cả (${count} vị trí)`);
  document.getElementById('findCountLabel').innerText = `Đã thay thế ${count} vị trí`;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Exporters
async function exportDocx() {
  const title = document.getElementById('docTitleInput').value.trim() || 'Tai_Lieu';
  const html = document.getElementById('docEditor').innerHTML;
  showToast('Đang mở hộp thoại lưu Word (.docx)...', 'info');

  try {
    const res = await fetch('/api/export/save-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'docx',
        title: title,
        html_content: html
      })
    });
    const data = await res.json();
    if (data.status === 'cancelled') {
      showToast('Đã hủy thao tác lưu file Word.', 'info');
      return;
    }
    if (data.status !== 'ok') {
      throw new Error(data.detail || data.message || 'Lưu file thất bại');
    }

    showToast(`Đã lưu tệp Word: ${data.file_name}`, 'success', [
      {
        label: '📁 Mở thư mục',
        onClick: () => fetch('/api/system/show-in-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: data.path })
        })
      },
      {
        label: '📄 Mở tệp',
        onClick: () => fetch('/api/system/open-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: data.path })
        })
      }
    ]);
  } catch (err) {
    showToast('Lỗi khi xuất file Word: ' + err.message, 'error');
  }
}

async function exportPdf() {
  const title = document.getElementById('docTitleInput').value.trim() || 'Tai_Lieu';
  const html = document.getElementById('docEditor').innerHTML;
  showToast('Đang mở hộp thoại lưu PDF...', 'info');

  try {
    const res = await fetch('/api/export/save-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'pdf',
        title: title,
        html_content: html
      })
    });
    const data = await res.json();
    if (data.status === 'cancelled') {
      showToast('Đã hủy thao tác lưu file PDF.', 'info');
      return;
    }
    if (data.status !== 'ok') {
      throw new Error(data.detail || data.message || 'Lưu file thất bại');
    }

    showToast(`Đã lưu tệp PDF: ${data.file_name}`, 'success', [
      {
        label: '📁 Mở thư mục',
        onClick: () => fetch('/api/system/show-in-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: data.path })
        })
      },
      {
        label: '📄 Mở tệp',
        onClick: () => fetch('/api/system/open-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: data.path })
        })
      }
    ]);
  } catch (err) {
    showToast('Lỗi khi xuất PDF: ' + err.message, 'error');
  }
}

function showToast(message, type = 'success', actions = []) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast flex items-center justify-between gap-3 shadow-lg p-3 bg-slate-900 text-white rounded-xl border border-slate-700 min-w-[320px]';
  const icon = type === 'error' ? 'alert-triangle' : (type === 'info' ? 'info' : 'check-circle');
  
  let actionHtml = '';
  if (actions && actions.length > 0) {
    actionHtml = '<div class="flex items-center gap-1.5 ml-2">';
    actions.forEach((act, idx) => {
      actionHtml += `<button data-toast-act="${idx}" class="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-md transition font-medium whitespace-nowrap shadow-sm">${act.label}</button>`;
    });
    actionHtml += '</div>';
  }

  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <i data-lucide="${icon}" class="w-5 h-5 ${type === 'error' ? 'text-rose-400' : 'text-emerald-400'} shrink-0"></i>
      <span class="text-xs font-medium">${message}</span>
    </div>
    ${actionHtml}
  `;

  actions.forEach((act, idx) => {
    const btn = toast.querySelector(`[data-toast-act="${idx}"]`);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        act.onClick();
      });
    }
  });

  container.appendChild(toast);
  lucide.createIcons({ root: toast });
  const duration = actions && actions.length > 0 ? 8000 : 3500;
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ========================================================
// NOVADOC ADVANCED FEATURES
// ========================================================

// 1. Line Spacing
function setLineSpacing(val) {
  const editor = document.getElementById('docEditor');
  if (editor) {
    editor.style.lineHeight = val;
    scheduleAutoSave();
    showToast(`Khoảng cách dòng: ${val}`);
  }
}

// 2. Interactive Checklist
function insertChecklist() {
  const item = document.createElement('div');
  item.className = 'checklist-item';
  item.innerHTML = `<input type="checkbox" onchange="this.parentElement.classList.toggle('checked', this.checked)"> <span contenteditable="true">Mục cần làm...</span>`;
  
  const sel = window.getSelection();
  const editor = document.getElementById('docEditor');
  if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.collapse(false);
    range.insertNode(item);
    const span = item.querySelector('span');
    if (span) {
      const r = document.createRange();
      r.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  } else {
    editor.appendChild(item);
  }
  scheduleAutoSave();
  updateStats();
}

// 3. Multi-page Break
function insertPageBreak() {
  const p = document.createElement('div');
  p.className = 'page-break';
  p.contentEditable = 'false';
  
  const spacer = document.createElement('p');
  spacer.innerHTML = '<br>';
  
  const sel = window.getSelection();
  const editor = document.getElementById('docEditor');
  if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.collapse(false);
    range.insertNode(spacer);
    range.insertNode(p);
    range.setStart(spacer, 0);
    range.setEnd(spacer, 0);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    editor.appendChild(p);
    editor.appendChild(spacer);
  }
  scheduleAutoSave();
  updateStats();
  showToast('Đã ngắt trang mới!');
}

// 4. Header & Footer
function toggleHeaderFooter() {
  const editor = document.getElementById('docEditor');
  let header = editor.querySelector('.doc-header-zone');
  let footer = editor.querySelector('.doc-footer-zone');
  
  if (header || footer) {
    if (header) header.remove();
    if (footer) footer.remove();
    showToast('Đã ẩn Tiêu đề đầu/chân trang');
  } else {
    header = document.createElement('div');
    header.className = 'doc-header-zone';
    header.contentEditable = 'false';
    header.innerHTML = `
      <span contenteditable="true" class="outline-none border-b border-dashed border-transparent hover:border-slate-300">NovaDoc Document</span>
      <span class="text-slate-400">Trang 1</span>
    `;
    
    footer = document.createElement('div');
    footer.className = 'doc-footer-zone';
    footer.contentEditable = 'false';
    footer.innerHTML = `
      <span contenteditable="true" class="outline-none border-b border-dashed border-transparent hover:border-slate-300">Lưu hành nội bộ</span>
      <span class="text-slate-400">Khổ A4 Tiêu Chuẩn</span>
    `;
    
    editor.prepend(header);
    editor.appendChild(footer);
    showToast('Đã thêm Tiêu đề đầu/chân trang (nhấp để sửa chữ)');
  }
  scheduleAutoSave();
}

// 5. Watermark Overlay
function setWatermark(val) {
  let text = val;
  if (val === 'custom') {
    text = prompt('Nhập nội dung Watermark chìm:', 'BẢN CHÍNH THỨC');
    if (!text) {
      const select = document.getElementById('watermarkSelect');
      if (select) select.value = '';
      return;
    }
  }
  const editor = document.getElementById('docEditor');
  let wm = editor.querySelector('#docWatermark');
  
  if (!text) {
    if (wm) wm.remove();
    showToast('Đã gỡ Watermark');
  } else {
    if (!wm) {
      wm = document.createElement('div');
      wm.id = 'docWatermark';
      wm.className = 'a4-watermark-overlay';
      wm.contentEditable = 'false';
      editor.prepend(wm);
    }
    wm.innerText = text;
    showToast(`Đã áp dụng Watermark: ${text}`);
  }
  scheduleAutoSave();
}

// 6. Table Tools
function getSelectedTableCell() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node = sel.anchorNode;
  while (node && node !== document.body) {
    if (node.tagName === 'TD' || node.tagName === 'TH') return node;
    node = node.parentNode;
  }
  return null;
}

function tableAddRow() {
  const cell = getSelectedTableCell();
  if (!cell) {
    showToast('Vui lòng nhấp chuột vào ô trong bảng để thêm hàng', 'info');
    return;
  }
  const tr = cell.closest('tr');
  const colsCount = tr.children.length;
  const newRow = document.createElement('tr');
  for (let i = 0; i < colsCount; i++) {
    const td = document.createElement('td');
    td.className = 'border border-slate-300 p-2';
    td.innerHTML = '<br>';
    newRow.appendChild(td);
  }
  tr.insertAdjacentElement('afterend', newRow);
  scheduleAutoSave();
  showToast('Đã thêm 1 hàng');
}

function tableAddCol() {
  const cell = getSelectedTableCell();
  if (!cell) {
    showToast('Vui lòng nhấp chuột vào ô trong bảng để thêm cột', 'info');
    return;
  }
  const tr = cell.closest('tr');
  const table = tr.closest('table');
  const colIndex = Array.from(tr.children).indexOf(cell);
  
  Array.from(table.rows).forEach(row => {
    const isHeader = row.parentElement?.tagName === 'THEAD' || row.firstElementChild?.tagName === 'TH';
    const newCell = document.createElement(isHeader ? 'th' : 'td');
    newCell.className = isHeader ? 'border border-slate-300 p-2 bg-slate-100 font-semibold' : 'border border-slate-300 p-2';
    newCell.innerHTML = '<br>';
    if (colIndex >= 0 && colIndex < row.children.length) {
      row.children[colIndex].insertAdjacentElement('afterend', newCell);
    } else {
      row.appendChild(newCell);
    }
  });
  scheduleAutoSave();
  showToast('Đã thêm 1 cột');
}

function tableDelRow() {
  const cell = getSelectedTableCell();
  if (!cell) {
    showToast('Vui lòng nhấp chuột vào hàng cần xóa', 'info');
    return;
  }
  const tr = cell.closest('tr');
  const table = tr.closest('table');
  if (table.rows.length <= 1) {
    table.remove();
    showToast('Đã xóa toàn bộ bảng');
  } else {
    tr.remove();
    showToast('Đã xóa 1 hàng');
  }
  scheduleAutoSave();
}

function tableDelCol() {
  const cell = getSelectedTableCell();
  if (!cell) {
    showToast('Vui lòng nhấp chuột vào cột cần xóa', 'info');
    return;
  }
  const tr = cell.closest('tr');
  const table = tr.closest('table');
  const colIndex = Array.from(tr.children).indexOf(cell);
  
  if (tr.children.length <= 1) {
    table.remove();
    showToast('Đã xóa toàn bộ bảng');
  } else {
    Array.from(table.rows).forEach(row => {
      if (row.children[colIndex]) {
        row.children[colIndex].remove();
      }
    });
    showToast('Đã xóa 1 cột');
  }
  scheduleAutoSave();
}

// 7. Version History (Snapshots & Restore)
function toggleVersionHistory(show) {
  const drawer = document.getElementById('versionHistoryDrawer');
  if (!drawer) return;
  const isHidden = drawer.style.display === 'none' || !drawer.style.display;
  const shouldShow = show !== undefined ? show : isHidden;
  drawer.style.display = shouldShow ? 'flex' : 'none';
  if (shouldShow) {
    renderVersionHistory();
  }
}

function getDocVersionHistory() {
  if (!currentDocId) return [];
  try {
    const raw = localStorage.getItem(`nova_doc_versions_${currentDocId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveVersionSnapshot(isManual = false) {
  if (!currentDocId) return;
  const editor = document.getElementById('docEditor');
  if (!editor) return;
  const currentHtml = editor.innerHTML;
  const text = editor.innerText.trim();
  if (!text) return;

  let history = getDocVersionHistory();
  if (history.length > 0 && history[0].html === currentHtml) {
    if (isManual) showToast('Nội dung chưa thay đổi so với bản trước!', 'info');
    return;
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} - ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  
  const snapshot = {
    id: 'snap_' + Date.now(),
    timestamp: Date.now(),
    timeStr: timeStr,
    isManual: isManual,
    wordCount: (text.match(/\S+/g) || []).length,
    charCount: text.length,
    preview: text.substring(0, 60) + (text.length > 60 ? '...' : ''),
    html: currentHtml
  };

  history.unshift(snapshot);
  if (history.length > 20) history = history.slice(0, 20);
  localStorage.setItem(`nova_doc_versions_${currentDocId}`, JSON.stringify(history));

  if (isManual) {
    showToast('Đã lưu mốc phiên bản thành công!');
    renderVersionHistory();
  }
}

function createManualSnapshot() {
  saveVersionSnapshot(true);
}

function renderVersionHistory() {
  const listEl = document.getElementById('versionHistoryList');
  if (!listEl) return;
  const history = getDocVersionHistory();

  if (history.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-8 text-slate-400">
        <i data-lucide="history" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
        <p class="text-xs">Chưa có bản chụp lịch sử nào.</p>
        <p class="text-[10px] text-slate-400 mt-1">Bấm "+ Chụp mốc hiện tại" để bắt đầu.</p>
      </div>
    `;
    lucide.createIcons({ root: listEl });
    return;
  }

  listEl.innerHTML = history.map((snap, idx) => `
    <div class="p-2.5 rounded-lg border ${idx === 0 ? 'bg-blue-50/60 border-blue-200' : 'bg-white border-slate-200'} shadow-xs hover:border-blue-300 transition">
      <div class="flex items-center justify-between mb-1">
        <span class="font-bold text-[11px] ${idx === 0 ? 'text-blue-700' : 'text-slate-700'}">
          ${snap.isManual ? '⭐ ' : ''}${snap.timeStr}
        </span>
        <span class="text-[10px] text-slate-400">${snap.wordCount} từ</span>
      </div>
      <p class="text-[11px] text-slate-500 line-clamp-2 mb-2 italic">"${escapeHtml(snap.preview)}"</p>
      <div class="flex items-center justify-between pt-1 border-t border-slate-100">
        <button onclick="restoreVersionSnapshot('${snap.id}')" class="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <i data-lucide="rotate-ccw" class="w-3 h-3"></i> Khôi phục
        </button>
        <button onclick="deleteVersionSnapshot('${snap.id}')" class="text-[10px] text-rose-400 hover:text-rose-600" title="Xóa mốc này">
          Xóa
        </button>
      </div>
    </div>
  `).join('');

  lucide.createIcons({ root: listEl });
}

function restoreVersionSnapshot(snapId) {
  const history = getDocVersionHistory();
  const snap = history.find(s => s.id === snapId);
  if (!snap) return;

  if (confirm(`Bạn có chắc chắn muốn khôi phục lại phiên bản lúc [${snap.timeStr}]?\nNội dung hiện tại sẽ được thay thế.`)) {
    saveVersionSnapshot(false);
    const editor = document.getElementById('docEditor');
    editor.innerHTML = snap.html;
    scheduleAutoSave();
    updateStats();
    updateOutline();
    toggleVersionHistory(false);
    showToast(`Đã khôi phục về phiên bản lúc ${snap.timeStr}!`);
  }
}

function deleteVersionSnapshot(snapId) {
  let history = getDocVersionHistory();
  history = history.filter(s => s.id !== snapId);
  localStorage.setItem(`nova_doc_versions_${currentDocId}`, JSON.stringify(history));
  renderVersionHistory();
  showToast('Đã xóa mốc phiên bản');
}
