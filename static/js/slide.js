// NovaSlide Presentation Controller v2.0
let currentDocId = null;
let currentTheme = 'modern-dark';
let currentTransition = 'fade';
let activeSlideIndex = 0;
let isPresenting = false;
let saveTimer = null;
let isSaving = false;

let slideDeck = {
  theme: "modern-dark",
  slides: [
    {
      id: "slide-1",
      title: "Tiêu Đề Bài Thuyết Trình",
      subtitle: "Phụ đề thuyết trình hoặc tên tác giả",
      layout: "title-slide"
    }
  ]
};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  lucide.createIcons();

  const urlParams = new URLSearchParams(window.location.search);
  currentDocId = urlParams.get('id');

  if (currentDocId) {
    await loadDocument(currentDocId);
  } else {
    await createDefaultSlideDeck();
  }

  setupEventListeners();
  renderThumbnails();
  renderActiveSlide();
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

function changeTransition(t) {
  currentTransition = t;
  renderActiveSlide();
  showToast(`Đã áp dụng hiệu ứng chuyển cảnh: ${t}`);
}

async function createDefaultSlideDeck() {
  try {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Bài thuyết trình mới',
        type: 'slide',
        tags: ['thuyết trình']
      })
    });
    if (!res.ok) throw new Error('Không thể khởi tạo bài thuyết trình');
    const doc = await res.json();
    currentDocId = doc.id;
    window.history.replaceState(null, '', `/slide?id=${doc.id}`);
    document.getElementById('slideTitleInput').value = doc.title;
    if (doc.content?.slides) {
      slideDeck = doc.content;
      currentTheme = doc.content.theme || 'modern-dark';
    }
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

async function loadDocument(id) {
  try {
    setSaveStatus('loading');
    const res = await fetch(`/api/documents/${id}?type=slide`);
    if (!res.ok) throw new Error('Không tìm thấy bài thuyết trình');
    const doc = await res.json();

    document.getElementById('slideTitleInput').value = doc.title || 'Bài thuyết trình không tên';
    if (doc.content?.slides) {
      slideDeck = doc.content;
      currentTheme = doc.content.theme || 'modern-dark';
    }
    document.getElementById('themeSelect').value = currentTheme;
    setSaveStatus('saved');

    if (window.parent && window.parent !== window && doc.title) {
      window.parent.postMessage({ type: 'NOVA_UPDATE_TAB_TITLE', title: doc.title }, '*');
    }
  } catch (err) {
    showToast('Lỗi khi mở slide: ' + err.message, 'error');
  }
}

function renderThumbnails() {
  const container = document.getElementById('thumbnailList');
  container.innerHTML = slideDeck.slides.map((slide, idx) => {
    const isActive = idx === activeSlideIndex;
    return `
      <div 
        onclick="setActiveSlide(${idx})"
        class="cursor-pointer rounded-lg p-2.5 border transition-all ${
          isActive 
            ? 'bg-amber-50 border-amber-500 shadow-sm' 
            : 'bg-white border-slate-200 hover:border-slate-300'
        }"
      >
        <div class="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
          <span>#${idx + 1}</span>
          <span class="text-[10px] uppercase tracking-wider">${getLayoutName(slide.layout)}</span>
        </div>
        <div class="aspect-video w-full rounded bg-slate-900 p-2 flex flex-col justify-center text-center overflow-hidden">
          <div class="text-[11px] font-bold text-white truncate">${escapeHtml(slide.title || 'Không tiêu đề')}</div>
          ${slide.subtitle ? `<div class="text-[8px] text-amber-400 truncate mt-0.5">${escapeHtml(slide.subtitle)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function getLayoutName(layout) {
  switch (layout) {
    case 'title-slide': return 'Tiêu đề';
    case 'bullet-list': return 'Danh sách';
    case 'two-column': return '2 Cột';
    case 'quote': return 'Trích dẫn';
    default: return 'Tiêu chuẩn';
  }
}

function setActiveSlide(idx) {
  activeSlideIndex = idx;
  renderThumbnails();
  renderActiveSlide();
}

function renderActiveSlide() {
  const slide = slideDeck.slides[activeSlideIndex];
  if (!slide) return;

  const canvas = document.getElementById('slideCanvas');
  const transClass = currentTransition !== 'none' ? `slide-transition-${currentTransition}` : '';
  canvas.className = `slide-canvas theme-${currentTheme} ${transClass}`;
  document.getElementById('layoutSelect').value = slide.layout || 'title-slide';

  const notesEl = document.getElementById('slideSpeakerNotes');
  if (notesEl) {
    notesEl.value = slide.notes || '';
  }

  switch (slide.layout) {
    case 'title-slide':
      canvas.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <div 
            contenteditable="true" 
            spellcheck="false"
            oninput="updateSlideData('title', this.innerText)"
            class="text-4xl md:text-5xl font-black outline-none w-full px-4 py-2 border-b border-transparent hover:border-slate-400 focus:border-amber-500 transition rounded"
          >${escapeHtml(slide.title || 'Tiêu Đề Thuyết Trình')}</div>

          <div 
            contenteditable="true" 
            spellcheck="false"
            oninput="updateSlideData('subtitle', this.innerText)"
            class="text-xl md:text-2xl font-medium slide-accent outline-none w-full px-4 py-1 border-b border-transparent hover:border-slate-400 focus:border-amber-500 transition rounded"
          >${escapeHtml(slide.subtitle || 'Phụ đề hoặc người trình bày')}</div>
        </div>
      `;
      break;

    case 'bullet-list':
      const bullets = slide.bullets || [
        "Ý tưởng chính thứ nhất",
        "Luận điểm và số liệu bổ trợ",
        "Kế hoạch triển khai hành động"
      ];
      slide.bullets = bullets;

      canvas.innerHTML = `
        <div class="h-full flex flex-col justify-start">
          <div 
            contenteditable="true" 
            spellcheck="false"
            oninput="updateSlideData('title', this.innerText)"
            class="text-3xl font-extrabold pb-3 mb-6 border-b border-slate-700/40 outline-none"
          >${escapeHtml(slide.title || 'Tiêu Đề Danh Sách')}</div>

          <ul class="space-y-4 text-xl flex-1" id="bulletListContainer">
            ${bullets.map((b, i) => `
              <li class="flex items-start space-x-3">
                <span class="slide-accent font-bold">•</span>
                <span 
                  contenteditable="true" 
                  spellcheck="false"
                  oninput="updateBulletItem(${i}, this.innerText)"
                  class="flex-1 outline-none border-b border-transparent hover:border-slate-500"
                >${escapeHtml(b)}</span>
              </li>
            `).join('')}
          </ul>

          <div class="pt-4 flex items-center justify-between no-print">
            <button onclick="addBullet()" class="text-xs text-amber-500 hover:underline flex items-center gap-1">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i> Thêm mục
            </button>
            <span class="text-xs opacity-50 font-mono">NovaSlide Widescreen</span>
          </div>
        </div>
      `;
      break;

    case 'two-column':
      canvas.innerHTML = `
        <div class="h-full flex flex-col justify-start">
          <div 
            contenteditable="true" 
            spellcheck="false"
            oninput="updateSlideData('title', this.innerText)"
            class="text-3xl font-extrabold pb-3 mb-6 border-b border-slate-700/40 outline-none"
          >${escapeHtml(slide.title || 'So Sánh & Đánh Giá')}</div>

          <div class="grid grid-cols-2 gap-8 flex-1">
            <div class="bg-black/10 p-5 rounded-xl flex flex-col space-y-3">
              <div 
                contenteditable="true" 
                spellcheck="false"
                oninput="updateSlideData('col1Title', this.innerText)"
                class="font-bold text-lg slide-accent outline-none"
              >${escapeHtml(slide.col1Title || 'Cột 1: Ưu điểm')}</div>
              <div 
                contenteditable="true" 
                spellcheck="false"
                oninput="updateSlideData('col1Content', this.innerText)"
                class="text-base opacity-90 outline-none flex-1 leading-relaxed"
              >${escapeHtml(slide.col1Content || 'Chi tiết các nội dung cột thứ nhất...')}</div>
            </div>

            <div class="bg-black/10 p-5 rounded-xl flex flex-col space-y-3">
              <div 
                contenteditable="true" 
                spellcheck="false"
                oninput="updateSlideData('col2Title', this.innerText)"
                class="font-bold text-lg slide-accent outline-none"
              >${escapeHtml(slide.col2Title || 'Cột 2: Triển vọng')}</div>
              <div 
                contenteditable="true" 
                spellcheck="false"
                oninput="updateSlideData('col2Content', this.innerText)"
                class="text-base opacity-90 outline-none flex-1 leading-relaxed"
              >${escapeHtml(slide.col2Content || 'Chi tiết các nội dung cột thứ hai...')}</div>
            </div>
          </div>
        </div>
      `;
      break;

    case 'quote':
      canvas.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center px-8 space-y-6">
          <div class="text-5xl slide-accent font-serif opacity-60">“</div>
          <div 
            contenteditable="true" 
            spellcheck="false"
            oninput="updateSlideData('quote', this.innerText)"
            class="text-2xl md:text-3xl font-medium italic outline-none leading-relaxed"
          >${escapeHtml(slide.quote || 'Đơn giản là đỉnh cao của sự tinh tế.')}</div>
          <div 
            contenteditable="true" 
            spellcheck="false"
            oninput="updateSlideData('author', this.innerText)"
            class="text-base slide-accent font-semibold outline-none"
          >— ${escapeHtml(slide.author || 'Steve Jobs')}</div>
        </div>
      `;
      break;
  }

  lucide.createIcons();
}

function updateSlideData(field, val) {
  const slide = slideDeck.slides[activeSlideIndex];
  if (!slide) return;
  slide[field] = val;
  renderThumbnails();
  scheduleAutoSave();
}

function updateBulletItem(idx, val) {
  const slide = slideDeck.slides[activeSlideIndex];
  if (!slide || !slide.bullets) return;
  slide.bullets[idx] = val;
  scheduleAutoSave();
}

function addBullet() {
  const slide = slideDeck.slides[activeSlideIndex];
  if (!slide) return;
  if (!slide.bullets) slide.bullets = [];
  slide.bullets.push("Ý mới cần trình bày...");
  renderActiveSlide();
  scheduleAutoSave();
}

function addNewSlide() {
  const newSlide = {
    id: `slide-${Date.now()}`,
    title: 'Slide mới',
    subtitle: 'Nội dung thuyết trình',
    layout: 'bullet-list',
    bullets: ['Mục 1', 'Mục 2', 'Mục 3']
  };
  slideDeck.slides.push(newSlide);
  activeSlideIndex = slideDeck.slides.length - 1;
  renderThumbnails();
  renderActiveSlide();
  scheduleAutoSave();
  showToast('Đã thêm slide mới!');
}

function duplicateActiveSlide() {
  const current = slideDeck.slides[activeSlideIndex];
  if (!current) return;
  const clone = JSON.parse(JSON.stringify(current));
  clone.id = `slide-${Date.now()}`;
  clone.title = `${current.title} (Bản sao)`;
  slideDeck.slides.splice(activeSlideIndex + 1, 0, clone);
  activeSlideIndex++;
  renderThumbnails();
  renderActiveSlide();
  scheduleAutoSave();
}

function moveSlide(direction) {
  const newIdx = activeSlideIndex + direction;
  if (newIdx < 0 || newIdx >= slideDeck.slides.length) return;
  const temp = slideDeck.slides[activeSlideIndex];
  slideDeck.slides[activeSlideIndex] = slideDeck.slides[newIdx];
  slideDeck.slides[newIdx] = temp;
  activeSlideIndex = newIdx;
  renderThumbnails();
  renderActiveSlide();
  scheduleAutoSave();
}

function deleteActiveSlide() {
  if (slideDeck.slides.length <= 1) {
    showToast('Không thể xóa hết slide!', 'error');
    return;
  }
  slideDeck.slides.splice(activeSlideIndex, 1);
  activeSlideIndex = Math.max(0, activeSlideIndex - 1);
  renderThumbnails();
  renderActiveSlide();
  scheduleAutoSave();
  showToast('Đã xóa slide');
}

function changeSlideLayout(layout) {
  const slide = slideDeck.slides[activeSlideIndex];
  if (!slide) return;
  slide.layout = layout;
  renderThumbnails();
  renderActiveSlide();
  scheduleAutoSave();
}

function changeTheme(theme) {
  currentTheme = theme;
  slideDeck.theme = theme;
  renderActiveSlide();
  scheduleAutoSave();
}

// Fullscreen Presentation Mode
function startPresentation() {
  isPresenting = true;
  document.getElementById('presentationOverlay').classList.remove('hidden');
  renderPresentationSlide();

  // Request native fullscreen if available
  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  }
}

function exitPresentation() {
  isPresenting = false;
  document.getElementById('presentationOverlay').classList.add('hidden');
  if (document.exitFullscreen && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

function renderPresentationSlide() {
  const slide = slideDeck.slides[activeSlideIndex];
  if (!slide) return;

  const box = document.getElementById('presentationSlide');
  const transClass = currentTransition !== 'none' ? `slide-transition-${currentTransition}` : '';
  box.className = `presentation-slide-box theme-${currentTheme} ${transClass}`;
  document.getElementById('presCounter').innerText = `${activeSlideIndex + 1} / ${slideDeck.slides.length}`;

  if (slide.layout === 'title-slide') {
    box.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center text-center space-y-8">
        <h1 class="text-6xl md:text-7xl font-black">${escapeHtml(slide.title || '')}</h1>
        <p class="text-3xl slide-accent font-medium">${escapeHtml(slide.subtitle || '')}</p>
      </div>
    `;
  } else if (slide.layout === 'bullet-list' || slide.bullets) {
    box.innerHTML = `
      <div class="h-full flex flex-col justify-start">
        <h2 class="text-5xl font-extrabold pb-4 mb-8 border-b border-slate-700/50">${escapeHtml(slide.title || '')}</h2>
        <ul class="space-y-6 text-3xl flex-1">
          ${(slide.bullets || []).map(b => `
            <li class="flex items-start space-x-4">
              <span class="slide-accent font-bold">•</span>
              <span>${escapeHtml(b)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  } else if (slide.layout === 'quote') {
    box.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center px-12 space-y-8">
        <div class="text-7xl slide-accent font-serif opacity-70">“</div>
        <p class="text-4xl font-medium italic leading-relaxed">${escapeHtml(slide.quote || '')}</p>
        <p class="text-2xl slide-accent font-semibold">— ${escapeHtml(slide.author || '')}</p>
      </div>
    `;
  } else {
    box.innerHTML = `
      <div class="h-full flex flex-col justify-start">
        <h2 class="text-5xl font-extrabold pb-4 mb-8">${escapeHtml(slide.title || '')}</h2>
        <div class="grid grid-cols-2 gap-10 flex-1 text-2xl">
          <div class="bg-black/20 p-8 rounded-2xl">
            <h3 class="font-bold text-3xl slide-accent mb-4">${escapeHtml(slide.col1Title || '')}</h3>
            <p>${escapeHtml(slide.col1Content || '')}</p>
          </div>
          <div class="bg-black/20 p-8 rounded-2xl">
            <h3 class="font-bold text-3xl slide-accent mb-4">${escapeHtml(slide.col2Title || '')}</h3>
            <p>${escapeHtml(slide.col2Content || '')}</p>
          </div>
        </div>
      </div>
    `;
  }
}

function nextSlide() {
  if (activeSlideIndex < slideDeck.slides.length - 1) {
    activeSlideIndex++;
    if (isPresenting) {
      renderPresentationSlide();
    } else {
      setActiveSlide(activeSlideIndex);
    }
  }
}

function prevSlide() {
  if (activeSlideIndex > 0) {
    activeSlideIndex--;
    if (isPresenting) {
      renderPresentationSlide();
    } else {
      setActiveSlide(activeSlideIndex);
    }
  }
}

function setupEventListeners() {
  const titleInput = document.getElementById('slideTitleInput');
  titleInput.addEventListener('input', () => {
    scheduleAutoSave();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'NOVA_UPDATE_TAB_TITLE', title: titleInput.value.trim() || 'Bài thuyết trình mới' }, '*');
    }
  });

  const backBtn = document.querySelector('a[href="/"]');
  if (backBtn && window.parent && window.parent !== window) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.parent.postMessage({ type: 'NOVA_SWITCH_TAB', tabId: 'tab-hub' }, '*');
    });
  }

  // Global key navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
      e.preventDefault();
      startPresentation();
      return;
    }

    if (isPresenterMode) {
      if (['ArrowRight', 'Space'].includes(e.code) || e.key === 'PageDown') {
        e.preventDefault();
        presenterNextSlide();
      } else if (['ArrowLeft'].includes(e.code) || e.key === 'PageUp') {
        e.preventDefault();
        presenterPrevSlide();
      } else if (e.key === 'Escape') {
        exitPresenterMode();
      }
      return;
    }

    if (isPresenting) {
      if (['ArrowRight', 'Space'].includes(e.code) || e.key === 'PageDown') {
        e.preventDefault();
        nextSlide();
      } else if (['ArrowLeft'].includes(e.code) || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape') {
        exitPresentation();
      }
    }
  });
}

// Auto-Save System
function scheduleAutoSave() {
  setSaveStatus('typing');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSlideDeck(), 1200);
}

async function saveSlideDeck() {
  if (!currentDocId || isSaving) return;
  isSaving = true;
  setSaveStatus('saving');

  const title = document.getElementById('slideTitleInput').value.trim() || 'Bài thuyết trình mới';

  try {
    const res = await fetch(`/api/documents/${currentDocId}?type=slide`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        content: slideDeck
      })
    });
    if (!res.ok) throw new Error('Lỗi khi lưu');
    setSaveStatus('saved');
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
    container.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-amber-500"></i><span>Đang lưu...</span>`;
  } else if (status === 'typing') {
    container.innerHTML = `<i data-lucide="pencil" class="w-3.5 h-3.5 text-amber-500"></i><span>Đang nhập...</span>`;
  } else if (status === 'saved') {
    container.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-500"></i><span>Đã lưu</span>`;
  } else if (status === 'error') {
    container.innerHTML = `<i data-lucide="alert-circle" class="w-3.5 h-3.5 text-rose-500"></i><span>Lỗi lưu</span>`;
  }
  lucide.createIcons({ root: container });
}

// Exporting
async function exportPptx() {
  const title = document.getElementById('slideTitleInput').value.trim() || 'Bai_Thuyet_Trinh';
  showToast('Đang tạo file PowerPoint (.pptx)...', 'info');

  try {
    const res = await fetch('/api/export/slide-raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        slides: slideDeck.slides,
        theme: currentTheme
      })
    });
    if (!res.ok) throw new Error('Xuất file thất bại');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.pptx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Đã tải file PowerPoint (.pptx) thành công!');
  } catch (err) {
    showToast('Lỗi khi xuất file: ' + err.message, 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

// ========================================================
// SPEAKER NOTES & PRESENTER MODE & PDF EXPORT
// ========================================================

// 1. Speaker Notes
function handleNotesInput(val) {
  const slide = slideDeck.slides[activeSlideIndex];
  if (!slide) return;
  slide.notes = val;
  scheduleAutoSave();
}

function toggleSpeakerNotes() {
  const body = document.getElementById('speakerNotesBody');
  const txt = document.getElementById('notesToggleText');
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  if (txt) txt.innerText = isHidden ? 'Thu gọn' : 'Mở rộng';
}

// 2. Presenter Mode
let isPresenterMode = false;
let presenterTimerSeconds = 0;
let presenterTimerInterval = null;
let presenterClockInterval = null;

function startPresenterMode() {
  isPresenterMode = true;
  document.getElementById('presenterModeOverlay').classList.remove('hidden');
  renderPresenterMode();

  presenterTimerSeconds = 0;
  clearInterval(presenterTimerInterval);
  presenterTimerInterval = setInterval(() => {
    presenterTimerSeconds++;
    const mins = String(Math.floor(presenterTimerSeconds / 60)).padStart(2, '0');
    const secs = String(presenterTimerSeconds % 60).padStart(2, '0');
    const timerEl = document.getElementById('presenterTimer');
    if (timerEl) timerEl.innerText = `${mins}:${secs}`;
  }, 1000);

  clearInterval(presenterClockInterval);
  const updateClock = () => {
    const now = new Date();
    const clockEl = document.getElementById('presenterClock');
    if (clockEl) {
      clockEl.innerText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }
  };
  updateClock();
  presenterClockInterval = setInterval(updateClock, 1000);
}

function exitPresenterMode() {
  isPresenterMode = false;
  document.getElementById('presenterModeOverlay').classList.add('hidden');
  clearInterval(presenterTimerInterval);
  clearInterval(presenterClockInterval);
}

function resetPresenterTimer() {
  presenterTimerSeconds = 0;
  const timerEl = document.getElementById('presenterTimer');
  if (timerEl) timerEl.innerText = '00:00';
}

function renderPresenterMode() {
  const slide = slideDeck.slides[activeSlideIndex];
  if (!slide) return;

  const counterEl = document.getElementById('presenterCounter');
  if (counterEl) {
    counterEl.innerText = `Slide ${activeSlideIndex + 1} / ${slideDeck.slides.length}`;
  }

  const currentBox = document.getElementById('presenterCurrentSlide');
  if (currentBox) {
    currentBox.className = `presentation-slide-box w-full max-w-[850px] aspect-video rounded-xl shadow-2xl p-6 text-sm theme-${currentTheme}`;
    currentBox.innerHTML = renderSlideHtml(slide);
  }

  const nextBox = document.getElementById('presenterNextSlide');
  if (nextBox) {
    if (activeSlideIndex + 1 < slideDeck.slides.length) {
      const nextSlide = slideDeck.slides[activeSlideIndex + 1];
      nextBox.innerHTML = `
        <div class="text-xs font-bold text-white truncate">${escapeHtml(nextSlide.title || 'Không tiêu đề')}</div>
        <div class="text-[10px] text-amber-400 truncate mt-1">${escapeHtml(nextSlide.subtitle || nextSlide.layout || '')}</div>
      `;
    } else {
      nextBox.innerHTML = `<span class="text-slate-500 text-xs italic">(Hết bài thuyết trình)</span>`;
    }
  }

  const notesText = document.getElementById('presenterNotesText');
  if (notesText) {
    notesText.innerText = slide.notes && slide.notes.trim() ? slide.notes : 'Chưa có ghi chú nào cho slide này.';
  }
}

function presenterNextSlide() {
  if (activeSlideIndex < slideDeck.slides.length - 1) {
    activeSlideIndex++;
    setActiveSlide(activeSlideIndex);
    renderPresenterMode();
  }
}

function presenterPrevSlide() {
  if (activeSlideIndex > 0) {
    activeSlideIndex--;
    setActiveSlide(activeSlideIndex);
    renderPresenterMode();
  }
}

function renderSlideHtml(slide) {
  if (slide.layout === 'title-slide') {
    return `
      <div class="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        <h1 class="text-3xl md:text-4xl font-black">${escapeHtml(slide.title || '')}</h1>
        <p class="text-lg slide-accent font-medium">${escapeHtml(slide.subtitle || '')}</p>
      </div>
    `;
  } else if (slide.layout === 'bullet-list' || slide.bullets) {
    return `
      <div class="h-full flex flex-col justify-start">
        <h2 class="text-2xl font-extrabold pb-2 mb-4 border-b border-slate-700/50">${escapeHtml(slide.title || '')}</h2>
        <ul class="space-y-3 text-lg flex-1">
          ${(slide.bullets || []).map(b => `
            <li class="flex items-start space-x-2">
              <span class="slide-accent font-bold">•</span>
              <span>${escapeHtml(b)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  } else if (slide.layout === 'quote') {
    return `
      <div class="h-full flex flex-col items-center justify-center text-center px-6 space-y-4">
        <div class="text-4xl slide-accent font-serif opacity-70">“</div>
        <p class="text-xl font-medium italic leading-relaxed">${escapeHtml(slide.quote || '')}</p>
        <p class="text-sm slide-accent font-semibold">— ${escapeHtml(slide.author || '')}</p>
      </div>
    `;
  } else {
    return `
      <div class="h-full flex flex-col justify-start">
        <h2 class="text-2xl font-extrabold pb-2 mb-4 border-b border-slate-700/50">${escapeHtml(slide.title || '')}</h2>
        <div class="grid grid-cols-2 gap-4 flex-1">
          <div class="bg-black/10 p-3 rounded-lg">
            <div class="font-bold text-sm slide-accent">${escapeHtml(slide.col1Title || 'Cột 1')}</div>
            <p class="text-xs mt-1">${escapeHtml(slide.col1Content || '')}</p>
          </div>
          <div class="bg-black/10 p-3 rounded-lg">
            <div class="font-bold text-sm slide-accent">${escapeHtml(slide.col2Title || 'Cột 2')}</div>
            <p class="text-xs mt-1">${escapeHtml(slide.col2Content || '')}</p>
          </div>
        </div>
      </div>
    `;
  }
}

// 3. Export Slide Deck to PDF
async function exportSlidePdf() {
  const title = document.getElementById('slideTitleInput').value.trim() || 'Bai_Thuyet_Trinh';
  showToast('Đang chuẩn bị file PDF bài thuyết trình...', 'info');

  const slidesHtml = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h1 style="text-align: center; color: #1e293b; margin-bottom: 30px;">${escapeHtml(title)}</h1>
      ${slideDeck.slides.map((s, idx) => `
        <div style="page-break-after: always; padding: 30px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">Trang ${idx + 1} / ${slideDeck.slides.length}</div>
          <h2 style="font-size: 22px; color: #0f172a; margin-bottom: 12px;">${escapeHtml(s.title || 'Slide ' + (idx + 1))}</h2>
          ${s.subtitle ? `<h3 style="font-size: 15px; color: #64748b; margin-bottom: 16px;">${escapeHtml(s.subtitle)}</h3>` : ''}
          ${s.bullets ? `<ul style="font-size: 14px; line-height: 1.8; color: #334155; margin-left: 20px;">${s.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
          ${s.quote ? `<blockquote style="font-size: 16px; font-style: italic; color: #475569; margin: 20px 0;">“${escapeHtml(s.quote)}” — <strong>${escapeHtml(s.author || '')}</strong></blockquote>` : ''}
          ${s.col1Content || s.col2Content ? `
            <div style="display: flex; gap: 20px; margin-top: 16px;">
              <div style="flex: 1; padding: 12px; background: #f8fafc; border-radius: 6px;">
                <strong>${escapeHtml(s.col1Title || 'Cột 1')}</strong>
                <p style="font-size: 13px; margin-top: 6px;">${escapeHtml(s.col1Content || '')}</p>
              </div>
              <div style="flex: 1; padding: 12px; background: #f8fafc; border-radius: 6px;">
                <strong>${escapeHtml(s.col2Title || 'Cột 2')}</strong>
                <p style="font-size: 13px; margin-top: 6px;">${escapeHtml(s.col2Content || '')}</p>
              </div>
            </div>
          ` : ''}
          ${s.notes ? `
            <div style="margin-top: 24px; padding: 10px 14px; background: #fef3c7; border-left: 4px solid #f59e0b; font-size: 12px; color: #92400e;">
              <strong>Ghi chú diễn giả:</strong> ${escapeHtml(s.notes)}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;

  try {
    const res = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title, html_content: slidesHtml })
    });
    if (!res.ok) {
      window.print();
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Tải file PDF bài thuyết trình thành công!');
  } catch (err) {
    window.print();
  }
}
