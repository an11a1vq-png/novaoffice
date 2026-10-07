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
        <div class="aspect-video w-full rounded bg-slate-900 p-2 flex flex-col justify-center text-center overflow-hidden" style="${slide.bg_color ? `background-color: ${slide.bg_color};` : ''}">
          <div class="text-[11px] font-bold text-white truncate">${escapeHtml(slide.title || 'Không tiêu đề')}</div>
          ${(slide.subtitle || slide.content) ? `<div class="text-[8px] text-amber-400 truncate mt-0.5">${escapeHtml((slide.subtitle || slide.content).substring(0, 45))}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function getLayoutName(layout) {
  switch (layout) {
    case 'shapes': return 'Khung gốc';
    case 'title-slide': return 'Tiêu đề';
    case 'bullet-list': return 'Danh sách';
    case 'two-column': return '2 Cột';
    case 'quote': return 'Trích dẫn';
    case 'process-3step': return '3 Bước';
    case 'standard':
    default: return 'Tiêu chuẩn';
  }
}

function updateShapeText(slideIdx, shapeIdx, newText) {
  const slide = slideDeck.slides[slideIdx];
  if (!slide || !slide.shapes || !slide.shapes[shapeIdx]) return;
  slide.shapes[shapeIdx].text = newText;
  if (slide.shapes[shapeIdx].paragraphs && slide.shapes[shapeIdx].paragraphs.length > 0) {
    slide.shapes[shapeIdx].paragraphs[0].text = newText;
  }
  scheduleAutoSave();
}

function updateShapeTableCell(slideIdx, shapeIdx, rowIdx, colIdx, newText) {
  const slide = slideDeck.slides[slideIdx];
  if (!slide || !slide.shapes || !slide.shapes[shapeIdx]) return;
  const tbl = slide.shapes[shapeIdx].table_data;
  if (tbl && tbl[rowIdx] && tbl[rowIdx][colIdx] !== undefined) {
    tbl[rowIdx][colIdx] = newText;
    scheduleAutoSave();
  }
}

function renderShapesHtml(slide, slideIdx, isEditable = false, isPres = false) {
  if (!slide.shapes || slide.shapes.length === 0) {
    return `<div class="p-8 text-slate-400 italic">Slide không có khung khối</div>`;
  }

  const fontMultiplier = isPres ? 1.4 : 1.0;

  return (slide.shapes || []).map((sh, sIdx) => {
    // 1. Line divider
    if (sh.type === 'line') {
      const lineColor = sh.fill || sh.border || '#38BDF8';
      return `
        <div style="
          position: absolute;
          left: ${sh.left}%;
          top: ${sh.top}%;
          width: ${sh.width}%;
          height: ${Math.max(sh.height, 0.35)}%;
          min-height: 2px;
          background-color: ${lineColor};
          border-radius: 1px;
          pointer-events: none;
        "></div>
      `;
    }

    // 2. Table
    if (sh.type === 'table' && sh.table_data) {
      const tableRows = sh.table_data || [];
      const tblBg = sh.fill || 'rgba(15, 23, 42, 0.9)';
      const tblBorder = sh.border ? `1.5px solid ${sh.border}` : '1px solid rgba(255,255,255,0.12)';
      return `
        <div style="
          position: absolute;
          left: ${sh.left}%;
          top: ${sh.top}%;
          width: ${sh.width}%;
          height: ${sh.height}%;
          background: ${tblBg};
          border: ${tblBorder};
          border-radius: 8px;
          overflow: auto;
          box-sizing: border-box;
          padding: 4px;
        ">
          <table class="w-full text-xs border-collapse font-sans text-left">
            <thead>
              <tr class="bg-slate-800/90 border-b border-slate-700">
                ${(tableRows[0] || []).map((h, colIdx) => `
                  <th 
                    class="p-2 font-bold text-sky-400 outline-none"
                    ${isEditable ? `contenteditable="true" spellcheck="false" oninput="updateShapeTableCell(${slideIdx}, ${sIdx}, 0, ${colIdx}, this.innerText)"` : ''}
                  >${escapeHtml(h)}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${tableRows.slice(1).map((row, rIdx) => `
                <tr class="border-b border-slate-800/60 hover:bg-slate-800/40">
                  ${row.map((cell, colIdx) => `
                    <td 
                      class="p-2 text-slate-200 outline-none"
                      ${isEditable ? `contenteditable="true" spellcheck="false" oninput="updateShapeTableCell(${slideIdx}, ${sIdx}, ${rIdx + 1}, ${colIdx}, this.innerText)"` : ''}
                    >${escapeHtml(cell)}</td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // 3. Code Block
    if (sh.type === 'code' || sh.is_code) {
      const codeBg = sh.fill || '#0B132B';
      const codeBorder = sh.border ? `1.5px solid ${sh.border}` : '1px solid rgba(56, 189, 248, 0.25)';
      const codeColor = sh.font_color || '#38BDF8';
      const fontSize = Math.round(11 * fontMultiplier);
      return `
        <div style="
          position: absolute;
          left: ${sh.left}%;
          top: ${sh.top}%;
          width: ${sh.width}%;
          height: ${sh.height}%;
          background-color: ${codeBg};
          border: ${codeBorder};
          border-radius: 8px;
          padding: 10px 14px;
          box-sizing: border-box;
          overflow-y: auto;
          box-shadow: 0 4px 14px rgba(0,0,0,0.3);
        ">
          <div 
            ${isEditable ? `contenteditable="true" spellcheck="false" oninput="updateShapeText(${slideIdx}, ${sIdx}, this.innerText)"` : ''}
            class="font-mono leading-relaxed outline-none"
            style="color: ${codeColor}; font-size: ${fontSize}px; white-space: pre-wrap;"
          >${escapeHtml(sh.text || '')}</div>
        </div>
      `;
    }

    // 4. Image Shape
    if (sh.type === 'image' && sh.image_data) {
      const imgBorder = sh.border ? `border: 2px solid ${sh.border};` : '';
      const imgRadius = (sh.rounded || sh.border) ? 'border-radius: 12px;' : '';
      return `
        <div style="
          position: absolute;
          left: ${sh.left}%;
          top: ${sh.top}%;
          width: ${sh.width}%;
          height: ${sh.height}%;
          ${imgBorder}
          ${imgRadius}
          box-sizing: border-box;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <img 
            src="${sh.image_data}" 
            alt="slide visual" 
            style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit; pointer-events: none;"
          />
        </div>
      `;
    }

    // 5. Card or Text Box
    const hasBox = !!sh.fill || !!sh.border;
    const boxBg = sh.fill ? `background-color: ${sh.fill};` : (hasBox ? 'background-color: rgba(30, 41, 59, 0.7);' : '');
    const boxBorder = sh.border ? `border: 2px solid ${sh.border};` : (sh.fill ? 'border: 1px solid rgba(255,255,255,0.08);' : '');
    const boxRadius = (sh.rounded || sh.border) ? 'border-radius: 14px;' : (hasBox ? 'border-radius: 8px;' : '');
    const boxPadding = hasBox ? 'padding: 14px 18px;' : 'padding: 2px 4px;';
    const boxShadow = hasBox ? 'box-shadow: 0 4px 20px rgba(0,0,0,0.3);' : '';

    const paras = sh.paragraphs || [];
    let innerContent = '';

    if (paras.length > 0) {
      innerContent = paras.map((p, pIdx) => {
        const isHeader = p.bold && (pIdx === 0 || (p.size && p.size >= 16));
        const pSize = p.size ? Math.round(p.size * 0.85 * fontMultiplier) : (isHeader ? Math.round(16 * fontMultiplier) : Math.round(13 * fontMultiplier));
        const pWeight = p.bold ? 'font-bold' : 'font-normal';
        let pColor = p.color;
        if (!pColor) {
          if (pIdx === 0 && sh.border) {
            pColor = sh.border;
          } else {
            pColor = hasBox ? '#F8FAFC' : 'inherit';
          }
        }
        const pFont = p.font ? `font-family: '${p.font}', sans-serif;` : '';
        const pMarginTop = (pIdx > 0 && isHeader) ? 'margin-top: 10px;' : '';
        const pMarginBottom = isHeader ? 'margin-bottom: 8px;' : 'margin-bottom: 4px;';

        let runTextHtml = '';
        if (p.runs && p.runs.length > 1) {
          runTextHtml = p.runs.map(r => {
            const rCol = r.color || pColor;
            const rBold = r.bold ? 'font-weight: 700;' : '';
            return `<span style="color: ${rCol}; ${rBold}">${escapeHtml(r.text)}</span>`;
          }).join('');
        } else {
          runTextHtml = escapeHtml(p.text);
        }

        return `
          <div 
            style="color: ${pColor}; font-size: ${pSize}px; ${pFont} ${pMarginTop} ${pMarginBottom} line-height: 1.5; white-space: pre-wrap;"
            class="${pWeight}"
          >${runTextHtml}</div>
        `;
      }).join('');
    } else {
      const pSize = sh.font_size ? Math.round(sh.font_size * 0.85 * fontMultiplier) : Math.round(13 * fontMultiplier);
      const pWeight = sh.bold ? 'font-bold' : 'font-normal';
      const pColor = sh.font_color || (hasBox ? '#F8FAFC' : 'inherit');
      innerContent = `
        <div 
          style="color: ${pColor}; font-size: ${pSize}px; line-height: 1.5; white-space: pre-wrap;"
          class="${pWeight}"
        >${escapeHtml(sh.text || '')}</div>
      `;
    }

    return `
      <div style="
        position: absolute;
        left: ${sh.left}%;
        top: ${sh.top}%;
        width: ${sh.width}%;
        height: ${sh.height}%;
        ${boxBg}
        ${boxBorder}
        ${boxRadius}
        ${boxPadding}
        ${boxShadow}
        box-sizing: border-box;
        overflow-y: auto;
      ">
        <div 
          ${isEditable ? `contenteditable="true" spellcheck="false" oninput="updateShapeText(${slideIdx}, ${sIdx}, this.innerText)"` : ''}
          class="outline-none h-full"
        >
          ${innerContent}
        </div>
      </div>
    `;
  }).join('');
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

  if (slide.layout === 'shapes') {
    canvas.style.position = 'relative';
    canvas.style.padding = '0';
    canvas.style.overflow = 'hidden';
    if (slide.bg_color) {
      canvas.style.backgroundColor = slide.bg_color;
    }
  } else {
    canvas.style.position = '';
    canvas.style.padding = '';
    canvas.style.overflow = '';
    canvas.style.backgroundColor = '';
  }

  document.getElementById('layoutSelect').value = slide.layout || 'title-slide';

  const notesEl = document.getElementById('slideSpeakerNotes');
  if (notesEl) {
    notesEl.value = slide.notes || '';
  }

  switch (slide.layout) {
    case 'shapes':
      canvas.innerHTML = renderShapesHtml(slide, activeSlideIndex, true, false);
      break;

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

    case 'process-3step':
      canvas.innerHTML = `
        <div class="h-full flex flex-col justify-start">
          <div 
            contenteditable="true" 
            spellcheck="false"
            oninput="updateSlideData('title', this.innerText)"
            class="text-3xl font-extrabold pb-3 mb-6 border-b border-slate-700/40 outline-none"
          >${escapeHtml(slide.title || 'Quy Trình Triển Khai (3 Bước)')}</div>

          <div class="grid grid-cols-3 gap-6 flex-1 items-stretch">
            <div class="bg-black/10 p-5 rounded-xl flex flex-col space-y-2 border-t-4 border-blue-500">
              <span class="text-xs font-bold text-blue-500">BƯỚC 1</span>
              <div contenteditable="true" spellcheck="false" oninput="updateSlideData('col1Title', this.innerText)" class="font-bold text-base outline-none">${escapeHtml(slide.col1Title || 'Khởi Tạo')}</div>
              <div contenteditable="true" spellcheck="false" oninput="updateSlideData('col1Content', this.innerText)" class="text-xs opacity-90 outline-none flex-1 leading-relaxed">${escapeHtml(slide.col1Content || 'Thu thập yêu cầu & chuẩn bị tài nguyên')}</div>
            </div>
            <div class="bg-black/10 p-5 rounded-xl flex flex-col space-y-2 border-t-4 border-amber-500">
              <span class="text-xs font-bold text-amber-500">BƯỚC 2</span>
              <div contenteditable="true" spellcheck="false" oninput="updateSlideData('col2Title', this.innerText)" class="font-bold text-base outline-none">${escapeHtml(slide.col2Title || 'Thực Thi')}</div>
              <div contenteditable="true" spellcheck="false" oninput="updateSlideData('col2Content', this.innerText)" class="text-xs opacity-90 outline-none flex-1 leading-relaxed">${escapeHtml(slide.col2Content || 'Phát triển, tối ưu & kiểm thử giải pháp')}</div>
            </div>
            <div class="bg-black/10 p-5 rounded-xl flex flex-col space-y-2 border-t-4 border-emerald-500">
              <span class="text-xs font-bold text-emerald-500">BƯỚC 3</span>
              <div contenteditable="true" spellcheck="false" oninput="updateSlideData('col3Title', this.innerText)" class="font-bold text-base outline-none">${escapeHtml(slide.col3Title || 'Vận Hành')}</div>
              <div contenteditable="true" spellcheck="false" oninput="updateSlideData('col3Content', this.innerText)" class="text-xs opacity-90 outline-none flex-1 leading-relaxed">${escapeHtml(slide.col3Content || 'Bàn giao, triển khai & giám sát hệ thống')}</div>
            </div>
          </div>
        </div>
      `;
      break;

    case 'standard':
    default:
      canvas.innerHTML = `
        <div class="h-full flex flex-col justify-start">
          <div 
            contenteditable="true" 
            spellcheck="false"
            oninput="updateSlideData('title', this.innerText)"
            class="text-3xl font-extrabold pb-3 mb-6 border-b border-slate-700/40 outline-none"
          >${escapeHtml(slide.title || 'Tiêu Đề Slide')}</div>

          <div 
            contenteditable="true" 
            spellcheck="false"
            oninput="updateSlideData('content', this.innerText)"
            class="text-lg opacity-90 outline-none flex-1 leading-relaxed whitespace-pre-wrap overflow-y-auto pr-2"
          >${escapeHtml(slide.content !== undefined ? slide.content : (slide.subtitle || ''))}</div>
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

  if (slide.layout === 'shapes') {
    box.style.position = 'relative';
    box.style.padding = '0';
    box.style.overflow = 'hidden';
    if (slide.bg_color) {
      box.style.backgroundColor = slide.bg_color;
    }
    box.innerHTML = renderShapesHtml(slide, activeSlideIndex, false, true);
    return;
  }

  box.style.position = '';
  box.style.padding = '';
  box.style.overflow = '';
  box.style.backgroundColor = '';

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
  } else if (slide.layout === 'process-3step') {
    box.innerHTML = `
      <div class="h-full flex flex-col justify-start">
        <h2 class="text-5xl font-extrabold pb-4 mb-8 border-b border-slate-700/50">${escapeHtml(slide.title || '')}</h2>
        <div class="grid grid-cols-3 gap-8 flex-1 text-xl items-stretch">
          <div class="bg-black/20 p-8 rounded-2xl border-t-8 border-blue-500 flex flex-col space-y-3">
            <span class="text-lg font-bold text-blue-400">BƯỚC 1</span>
            <h3 class="font-bold text-3xl slide-accent">${escapeHtml(slide.col1Title || '')}</h3>
            <p class="text-xl opacity-90 leading-relaxed flex-1">${escapeHtml(slide.col1Content || '')}</p>
          </div>
          <div class="bg-black/20 p-8 rounded-2xl border-t-8 border-amber-500 flex flex-col space-y-3">
            <span class="text-lg font-bold text-amber-400">BƯỚC 2</span>
            <h3 class="font-bold text-3xl slide-accent">${escapeHtml(slide.col2Title || '')}</h3>
            <p class="text-xl opacity-90 leading-relaxed flex-1">${escapeHtml(slide.col2Content || '')}</p>
          </div>
          <div class="bg-black/20 p-8 rounded-2xl border-t-8 border-emerald-500 flex flex-col space-y-3">
            <span class="text-lg font-bold text-emerald-400">BƯỚC 3</span>
            <h3 class="font-bold text-3xl slide-accent">${escapeHtml(slide.col3Title || '')}</h3>
            <p class="text-xl opacity-90 leading-relaxed flex-1">${escapeHtml(slide.col3Content || '')}</p>
          </div>
        </div>
      </div>
    `;
  } else if (slide.layout === 'two-column') {
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
  } else {
    box.innerHTML = `
      <div class="h-full flex flex-col justify-start">
        <h2 class="text-5xl font-extrabold pb-4 mb-8 border-b border-slate-700/50">${escapeHtml(slide.title || '')}</h2>
        <div class="text-2xl opacity-90 leading-relaxed whitespace-pre-wrap flex-1 overflow-y-auto pr-4">
          ${escapeHtml(slide.content || slide.subtitle || '')}
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
  showToast('Đang mở hộp thoại lưu PowerPoint (.pptx)...', 'info');

  try {
    const res = await fetch('/api/export/save-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'pptx',
        title: title,
        slides: slideDeck.slides,
        theme: currentTheme
      })
    });
    const data = await res.json();
    if (data.status === 'cancelled') {
      showToast('Đã hủy thao tác lưu file PowerPoint.', 'info');
      return;
    }
    if (data.status !== 'ok') {
      throw new Error(data.detail || data.message || 'Xuất file thất bại');
    }

    showToast(`Đã lưu tệp PowerPoint: ${data.file_name}`, 'success', [
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
    showToast('Lỗi khi xuất file: ' + err.message, 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  if (slide.layout === 'shapes') {
    const bg = slide.bg_color ? `background-color: ${slide.bg_color};` : 'background-color: #0F172A;';
    return `
      <div style="position: relative; width: 100%; height: 100%; overflow: hidden; padding: 0; ${bg}">
        ${renderShapesHtml(slide, 0, false, false)}
      </div>
    `;
  } else if (slide.layout === 'title-slide') {
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
  } else if (slide.layout === 'process-3step') {
    return `
      <div class="h-full flex flex-col justify-start">
        <h2 class="text-2xl font-extrabold pb-2 mb-4 border-b border-slate-700/50">${escapeHtml(slide.title || '')}</h2>
        <div class="grid grid-cols-3 gap-3 flex-1 items-stretch text-xs">
          <div class="bg-black/10 p-3 rounded-lg border-t-2 border-blue-500">
            <span class="text-[10px] font-bold text-blue-400">BƯỚC 1</span>
            <div class="font-bold text-sm slide-accent mt-0.5">${escapeHtml(slide.col1Title || '')}</div>
            <p class="text-[11px] mt-1 opacity-90">${escapeHtml(slide.col1Content || '')}</p>
          </div>
          <div class="bg-black/10 p-3 rounded-lg border-t-2 border-amber-500">
            <span class="text-[10px] font-bold text-amber-400">BƯỚC 2</span>
            <div class="font-bold text-sm slide-accent mt-0.5">${escapeHtml(slide.col2Title || '')}</div>
            <p class="text-[11px] mt-1 opacity-90">${escapeHtml(slide.col2Content || '')}</p>
          </div>
          <div class="bg-black/10 p-3 rounded-lg border-t-2 border-emerald-500">
            <span class="text-[10px] font-bold text-emerald-400">BƯỚC 3</span>
            <div class="font-bold text-sm slide-accent mt-0.5">${escapeHtml(slide.col3Title || '')}</div>
            <p class="text-[11px] mt-1 opacity-90">${escapeHtml(slide.col3Content || '')}</p>
          </div>
        </div>
      </div>
    `;
  } else if (slide.layout === 'two-column') {
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
  } else {
    return `
      <div class="h-full flex flex-col justify-start">
        <h2 class="text-2xl font-extrabold pb-2 mb-4 border-b border-slate-700/50">${escapeHtml(slide.title || '')}</h2>
        <div class="text-base opacity-90 leading-relaxed whitespace-pre-wrap flex-1 overflow-y-auto">
          ${escapeHtml(slide.content || slide.subtitle || '')}
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
          ${s.layout === 'shapes' ? `
            <div style="position: relative; width: 100%; aspect-ratio: 16/9; border-radius: 8px; overflow: hidden; background-color: ${s.bg_color || '#0F172A'}; min-height: 480px;">
              ${renderShapesHtml(s, idx, false, false)}
            </div>
          ` : `
            <h2 style="font-size: 22px; color: #0f172a; margin-bottom: 12px;">${escapeHtml(s.title || 'Slide ' + (idx + 1))}</h2>
            ${s.subtitle ? `<h3 style="font-size: 15px; color: #64748b; margin-bottom: 16px;">${escapeHtml(s.subtitle)}</h3>` : ''}
            ${s.bullets ? `<ul style="font-size: 14px; line-height: 1.8; color: #334155; margin-left: 20px;">${s.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
            ${s.content ? `<div style="font-size: 14px; line-height: 1.8; color: #334155; margin-top: 16px; white-space: pre-wrap;">${escapeHtml(s.content)}</div>` : ''}
            ${s.quote ? `<blockquote style="font-size: 16px; font-style: italic; color: #475569; margin: 20px 0;">“${escapeHtml(s.quote)}” — <strong>${escapeHtml(s.author || '')}</strong></blockquote>` : ''}
            ${s.layout === 'process-3step' ? `
              <div style="display: flex; gap: 14px; margin-top: 16px;">
                <div style="flex: 1; background: #f8fafc; border-top: 3px solid #3b82f6; padding: 12px; border-radius: 6px;">
                  <div style="font-size: 11px; font-weight: bold; color: #3b82f6;">BƯỚC 1</div>
                  <div style="font-weight: bold; margin-top: 4px; font-size: 14px;">${escapeHtml(s.col1Title || '')}</div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 6px;">${escapeHtml(s.col1Content || '')}</div>
                </div>
                <div style="flex: 1; background: #f8fafc; border-top: 3px solid #f59e0b; padding: 12px; border-radius: 6px;">
                  <div style="font-size: 11px; font-weight: bold; color: #f59e0b;">BƯỚC 2</div>
                  <div style="font-weight: bold; margin-top: 4px; font-size: 14px;">${escapeHtml(s.col2Title || '')}</div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 6px;">${escapeHtml(s.col2Content || '')}</div>
                </div>
                <div style="flex: 1; background: #f8fafc; border-top: 3px solid #10b981; padding: 12px; border-radius: 6px;">
                  <div style="font-size: 11px; font-weight: bold; color: #10b981;">BƯỚC 3</div>
                  <div style="font-weight: bold; margin-top: 4px; font-size: 14px;">${escapeHtml(s.col3Title || '')}</div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 6px;">${escapeHtml(s.col3Content || '')}</div>
                </div>
              </div>
            ` : (s.col1Content || s.col2Content ? `
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
            ` : '')}
          `}
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
    const res = await fetch('/api/export/save-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'pdf',
        title: title,
        html_content: slidesHtml
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

// Global presentation shortcut: F5 (from slide 1) or Shift+F5 (from current slide)
document.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.isContentEditable)) return;
  if (e.key === 'F5') {
    e.preventDefault();
    if (e.shiftKey) {
      startPresentation(activeSlideIndex);
    } else {
      startPresentation(0);
    }
  }
});
