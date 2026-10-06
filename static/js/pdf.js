// NovaPDF Viewer & Interactive Editor Controller v2.0
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.25;
let rotation = 0;
let currentPdfUrl = null;
let currentPdfName = "Tai_Lieu.pdf";

// Two-Layer Canvas & DOM references
const baseCanvas = document.getElementById('the-canvas');
const baseCtx = baseCanvas ? baseCanvas.getContext('2d') : null;
const annotCanvas = document.getElementById('annotation-canvas');
const annotCtx = annotCanvas ? annotCanvas.getContext('2d') : null;
const domLayer = document.getElementById('annotation-dom-layer');

// Tool & Annotation States
let activeTool = 'pan'; // 'pan', 'text', 'draw', 'whiteout', 'highlight', 'stamp'
let annotations = {};   // { [pageNum]: [ { type, ... } ] }
let isDrawing = false;
let currentPath = null;
let dragRectStart = null;

// Configure PDF.js worker
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();

  const urlParams = new URLSearchParams(window.location.search);
  const fileName = urlParams.get('file');

  if (fileName) {
    currentPdfName = fileName;
    document.getElementById('pdfFileName').innerText = fileName;
    loadPdfFile(`/api/uploads/${encodeURIComponent(fileName)}`);
  } else {
    loadDefaultPdf();
  }

  if (window.parent && window.parent !== window && currentPdfName) {
    window.parent.postMessage({ type: 'NOVA_UPDATE_TAB_TITLE', title: currentPdfName }, '*');
  }

  setupEventListeners();
  setupAnnotationEvents();
});

async function loadDefaultPdf() {
  currentPdfName = "Huong_Dan_NovaOffice.pdf";
  document.getElementById('pdfFileName').innerText = currentPdfName;
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'NOVA_UPDATE_TAB_TITLE', title: currentPdfName }, '*');
  }
  try {
    const res = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: "Hướng Dẫn Sử Dụng NovaOffice Suite",
        html_content: `
          <h1>HƯỚNG DẪN SỬ DỤNG NOVAPDF EDITOR</h1>
          <p>Chào mừng bạn đến với NovaPDF - Trình xem và chỉnh sửa tài liệu PDF tích hợp trong bộ NovaOffice.</p>
          <hr>
          <h2>1. Chỉnh Sửa Trực Tiếp Trên Trang</h2>
          <p>- Thêm chữ: Chọn công cụ 'Thêm chữ' và nhấp bất cứ đâu trên trang để gõ nội dung mới.</p>
          <p>- Ký tên / Vẽ tay: Dùng công cụ 'Ký tên / Bút vẽ' để ký hợp đồng hoặc vẽ tự do bằng chuột.</p>
          <p>- Bút che xóa (Whiteout): Kéo khung trắng che đè thông tin cũ hoặc nhạy cảm cần thay thế.</p>
          <p>- Highlight: Đánh dấu dạ quang màu vàng làm nổi bật các dòng văn bản quan trọng.</p>
          <p>- Con dấu văn phòng: Chèn các con dấu 'ĐÃ DUYỆT', 'HOÀN THÀNH', 'BẢN GỐC', 'TUYỆT MẬT'.</p>
          <h2>2. Chuyển Đổi Sang NovaDoc</h2>
          <p>Bấm nút 'Chuyển sang NovaDoc' trên thanh công cụ để bóc tách toàn bộ tài liệu PDF sang Word và soạn thảo tự do như một văn bản bình thường.</p>
        `
      })
    });
    if (!res.ok) throw new Error('Không thể tạo file hướng dẫn');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    loadPdfFile(blobUrl);
  } catch (err) {
    showToast('Lỗi tải PDF: ' + err.message, 'error');
  }
}

function loadPdfFile(url) {
  currentPdfUrl = url;
  pdfjsLib.getDocument(url).promise.then((pdf) => {
    pdfDoc = pdf;
    document.getElementById('pageCount').innerText = pdf.numPages;
    document.getElementById('pageNumInput').max = pdf.numPages;
    renderPage(pageNum);
  }).catch((err) => {
    showToast('Lỗi khi phân tích tệp PDF: ' + err.message, 'error');
  });
}

function renderPage(num) {
  pageRendering = true;
  pdfDoc.getPage(num).then((page) => {
    const viewport = page.getViewport({ scale: scale, rotation: rotation });
    const outputScale = window.devicePixelRatio || 1;

    // 1. Sync Base PDF Canvas
    baseCanvas.width = Math.floor(viewport.width * outputScale);
    baseCanvas.height = Math.floor(viewport.height * outputScale);
    baseCanvas.style.width = Math.floor(viewport.width) + "px";
    baseCanvas.style.height = Math.floor(viewport.height) + "px";

    // 2. Sync Annotation Canvas Size & Style
    annotCanvas.width = Math.floor(viewport.width * outputScale);
    annotCanvas.height = Math.floor(viewport.height * outputScale);
    annotCanvas.style.width = Math.floor(viewport.width) + "px";
    annotCanvas.style.height = Math.floor(viewport.height) + "px";

    // 3. Sync Container
    const container = document.getElementById('pdfCanvasContainer');
    container.style.width = Math.floor(viewport.width) + "px";
    container.style.height = Math.floor(viewport.height) + "px";

    const transform = outputScale !== 1
      ? [outputScale, 0, 0, outputScale, 0, 0]
      : null;

    const renderContext = {
      canvasContext: baseCtx,
      transform: transform,
      viewport: viewport
    };

    const renderTask = page.render(renderContext);
    renderTask.promise.then(() => {
      pageRendering = false;
      redrawAnnotations(num);
      renderDomAnnotations(num);

      if (pageNumPending !== null) {
        renderPage(pageNumPending);
        pageNumPending = null;
      }
    });
  });

  document.getElementById('pageNumInput').value = num;
  updatePaginationButtons();
}

function queueRenderPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    renderPage(num);
  }
}

function prevPage() {
  if (pageNum <= 1) return;
  pageNum--;
  queueRenderPage(pageNum);
}

function nextPage() {
  if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
  pageNum++;
  queueRenderPage(pageNum);
}

function updatePaginationButtons() {
  if (!pdfDoc) return;
  document.getElementById('prevPageBtn').disabled = (pageNum <= 1);
  document.getElementById('nextPageBtn').disabled = (pageNum >= pdfDoc.numPages);
}

function zoomIn() {
  if (scale >= 3.0) return;
  scale += 0.25;
  document.getElementById('zoomLevel').innerText = `${Math.round(scale * 80)}%`;
  queueRenderPage(pageNum);
}

function zoomOut() {
  if (scale <= 0.5) return;
  scale -= 0.25;
  document.getElementById('zoomLevel').innerText = `${Math.round(scale * 80)}%`;
  queueRenderPage(pageNum);
}

function rotatePage() {
  rotation = (rotation + 90) % 360;
  queueRenderPage(pageNum);
  showToast(`Đã xoay trang: ${rotation}°`, 'info');
}

function fitWidth() {
  if (!pdfDoc) return;
  pdfDoc.getPage(pageNum).then((page) => {
    const unscaledViewport = page.getViewport({ scale: 1.0, rotation: rotation });
    const container = document.getElementById('pdfViewport');
    const availableWidth = container.clientWidth - 80;
    if (availableWidth > 150 && unscaledViewport.width > 0) {
      scale = availableWidth / unscaledViewport.width;
      document.getElementById('zoomLevel').innerText = `${Math.round(scale * 80)}%`;
      queueRenderPage(pageNum);
      showToast('Đã căn vừa chiều rộng');
    }
  });
}

function downloadPdf() {
  if (!currentPdfUrl) {
    showToast('Không tìm thấy tệp để tải về', 'error');
    return;
  }
  const a = document.createElement('a');
  a.href = currentPdfUrl;
  a.download = currentPdfName.endsWith('.pdf') ? currentPdfName : `${currentPdfName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Đang tải xuống tệp PDF...', 'info');
}

// ==========================================
// ANNOTATION & INTERACTIVE EDITING ENGINE
// ==========================================

function setToolMode(mode) {
  activeTool = mode;
  document.querySelectorAll('.pdf-tool-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const activeBtn = document.getElementById(`tool-${mode}`);
  if (activeBtn) activeBtn.classList.add('active');

  const stampDropdown = document.getElementById('stampDropdown');
  if (stampDropdown && mode !== 'stamp') {
    stampDropdown.classList.add('hidden');
  }

  // Set canvas cursor according to tool
  if (mode === 'pan') {
    annotCanvas.style.cursor = 'default';
  } else if (mode === 'text') {
    annotCanvas.style.cursor = 'text';
  } else if (mode === 'draw') {
    annotCanvas.style.cursor = 'crosshair';
  } else if (mode === 'whiteout' || mode === 'highlight' || mode === 'replace') {
    annotCanvas.style.cursor = 'crosshair';
  } else {
    annotCanvas.style.cursor = 'default';
  }
}

function toggleStampMenu() {
  const dropdown = document.getElementById('stampDropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function getPageAnnotations(pNum) {
  if (!annotations[pNum]) {
    annotations[pNum] = [];
  }
  return annotations[pNum];
}

function getCanvasCoords(e) {
  const rect = annotCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // Normalize by current CSS display width/height
  const normX = x / rect.width;
  const normY = y / rect.height;
  return { x, y, normX, normY };
}

function setupAnnotationEvents() {
  annotCanvas.addEventListener('mousedown', (e) => {
    if (activeTool === 'pan') return;
    const coords = getCanvasCoords(e);
    const color = document.getElementById('toolColorInput').value;
    const size = parseInt(document.getElementById('toolSizeSelect').value, 10);

    if (activeTool === 'draw') {
      isDrawing = true;
      currentPath = {
        type: 'draw',
        color: color,
        width: size,
        points: [{ x: coords.normX, y: coords.normY }]
      };
    } else if (activeTool === 'highlight') {
      isDrawing = true;
      currentPath = {
        type: 'highlight',
        color: '#facc15',
        width: Math.max(size * 3, 16),
        alpha: 0.38,
        points: [{ x: coords.normX, y: coords.normY }]
      };
    } else if (activeTool === 'whiteout' || activeTool === 'replace') {
      isDrawing = true;
      dragRectStart = coords;
    } else if (activeTool === 'text') {
      addTextBoxAt(coords.x, coords.y, coords.normX, coords.normY);
    }
  });

  annotCanvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);

    if (activeTool === 'draw' || activeTool === 'highlight') {
      currentPath.points.push({ x: coords.normX, y: coords.normY });
      drawLivePath(currentPath);
    } else if ((activeTool === 'whiteout' || activeTool === 'replace') && dragRectStart) {
      drawLiveWhiteout(dragRectStart, coords);
    }
  });

  const finishDrawing = (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const pageItems = getPageAnnotations(pageNum);

    if ((activeTool === 'draw' || activeTool === 'highlight') && currentPath && currentPath.points.length > 1) {
      pageItems.push(currentPath);
      currentPath = null;
      redrawAnnotations(pageNum);
    } else if ((activeTool === 'whiteout' || activeTool === 'replace') && dragRectStart && e) {
      const coords = getCanvasCoords(e);
      const minX = Math.min(dragRectStart.normX, coords.normX);
      const minY = Math.min(dragRectStart.normY, coords.normY);
      const w = Math.abs(coords.normX - dragRectStart.normX);
      const h = Math.abs(coords.normY - dragRectStart.normY);

      if (w > 0.005 && h > 0.005) {
        pageItems.push({
          type: 'whiteout',
          normX: minX,
          normY: minY,
          normW: w,
          normH: h
        });

        // If replace mode, automatically create text box over whiteout
        if (activeTool === 'replace') {
          const rect = annotCanvas.getBoundingClientRect();
          const pixelX = minX * rect.width;
          const pixelY = minY * rect.height;
          const pixelH = h * rect.height;
          const calculatedFontSize = Math.max(12, Math.min(22, Math.round(pixelH * 0.72)));
          addTextBoxAt(pixelX, pixelY, minX, minY, calculatedFontSize);
          showToast('Đã che chữ cũ! Hãy gõ nội dung mới đè lên.', 'info');
        }
      }
      dragRectStart = null;
      redrawAnnotations(pageNum);
    }
  };

  annotCanvas.addEventListener('mouseup', finishDrawing);
  annotCanvas.addEventListener('mouseleave', finishDrawing);
}

function drawLivePath(pathObj) {
  if (!annotCtx || !pathObj.points.length) return;
  const rect = annotCanvas.getBoundingClientRect();
  const scaleRatio = (window.devicePixelRatio || 1);

  annotCtx.save();
  annotCtx.scale(scaleRatio, scaleRatio);
  annotCtx.beginPath();
  annotCtx.strokeStyle = pathObj.color;
  annotCtx.lineWidth = pathObj.width;
  annotCtx.lineCap = 'round';
  annotCtx.lineJoin = 'round';
  annotCtx.globalAlpha = pathObj.alpha || 1.0;

  const pts = pathObj.points;
  annotCtx.moveTo(pts[0].x * rect.width, pts[0].y * rect.height);
  for (let i = 1; i < pts.length; i++) {
    annotCtx.lineTo(pts[i].x * rect.width, pts[i].y * rect.height);
  }
  annotCtx.stroke();
  annotCtx.restore();
}

function drawLiveWhiteout(startCoords, currentCoords) {
  redrawAnnotations(pageNum);
  const rect = annotCanvas.getBoundingClientRect();
  const scaleRatio = (window.devicePixelRatio || 1);

  annotCtx.save();
  annotCtx.scale(scaleRatio, scaleRatio);
  annotCtx.fillStyle = '#ffffff';
  annotCtx.strokeStyle = '#94a3b8';
  annotCtx.lineWidth = 1;
  annotCtx.setLineDash([4, 4]);

  const x = Math.min(startCoords.x, currentCoords.x);
  const y = Math.min(startCoords.y, currentCoords.y);
  const w = Math.abs(currentCoords.x - startCoords.x);
  const h = Math.abs(currentCoords.y - startCoords.y);

  annotCtx.fillRect(x, y, w, h);
  annotCtx.strokeRect(x, y, w, h);
  annotCtx.restore();
}

function redrawAnnotations(pNum) {
  if (!annotCtx) return;
  const outputScale = window.devicePixelRatio || 1;
  annotCtx.clearRect(0, 0, annotCanvas.width, annotCanvas.height);

  const items = getPageAnnotations(pNum);
  const rect = annotCanvas.getBoundingClientRect();

  annotCtx.save();
  annotCtx.scale(outputScale, outputScale);

  items.forEach(item => {
    if (item.type === 'draw' || item.type === 'highlight') {
      if (!item.points || !item.points.length) return;
      annotCtx.beginPath();
      annotCtx.strokeStyle = item.color;
      annotCtx.lineWidth = item.width;
      annotCtx.lineCap = 'round';
      annotCtx.lineJoin = 'round';
      annotCtx.globalAlpha = item.alpha || 1.0;

      annotCtx.moveTo(item.points[0].x * rect.width, item.points[0].y * rect.height);
      for (let i = 1; i < item.points.length; i++) {
        annotCtx.lineTo(item.points[i].x * rect.width, item.points[i].y * rect.height);
      }
      annotCtx.stroke();
    } else if (item.type === 'whiteout') {
      annotCtx.fillStyle = '#ffffff';
      annotCtx.globalAlpha = 1.0;
      annotCtx.fillRect(
        item.normX * rect.width,
        item.normY * rect.height,
        item.normW * rect.width,
        item.normH * rect.height
      );
    }
  });

  annotCtx.restore();
}

// ------------------------------------------
// DOM Overlays (Textboxes & Stamps)
// ------------------------------------------

function renderDomAnnotations(pNum) {
  if (!domLayer) return;
  domLayer.innerHTML = '';
  const items = getPageAnnotations(pNum);
  const rect = annotCanvas.getBoundingClientRect();

  items.forEach(item => {
    if (item.type === 'text') {
      createTextElement(item, rect.width, rect.height);
    } else if (item.type === 'stamp') {
      createStampElement(item, rect.width, rect.height);
    }
  });
}

function addTextBoxAt(clickX, clickY, normX, normY, customFontSize) {
  const color = document.getElementById('toolColorInput').value;
  const size = customFontSize || Math.max(parseInt(document.getElementById('toolSizeSelect').value, 10), 14);

  const textItem = {
    id: 'txt_' + Date.now(),
    type: 'text',
    normX: normX,
    normY: normY,
    text: '',
    color: color,
    fontSize: size,
    bold: false
  };

  getPageAnnotations(pageNum).push(textItem);
  const rect = annotCanvas.getBoundingClientRect();
  const el = createTextElement(textItem, rect.width, rect.height);
  setTimeout(() => el.focus(), 50);
}

function createTextElement(textItem, w, h) {
  const div = document.createElement('div');
  div.className = 'pdf-textbox-overlay';
  div.id = textItem.id;
  div.contentEditable = 'true';
  div.spellcheck = false;
  div.style.left = (textItem.normX * w) + 'px';
  div.style.top = (textItem.normY * w * (h / w)) + 'px';
  div.style.color = textItem.color;
  div.style.fontSize = textItem.fontSize + 'px';
  if (textItem.bold) div.style.fontWeight = 'bold';
  div.innerText = textItem.text;

  // Placeholder
  if (!textItem.text) {
    div.dataset.placeholder = "Nhập chữ...";
  }

  // Update text on input
  div.addEventListener('input', () => {
    textItem.text = div.innerText;
  });

  // Simple drag support
  let isDraggingText = false;
  let startX = 0, startY = 0;

  div.addEventListener('mousedown', (e) => {
    if (activeTool === 'pan' || e.target === div) {
      isDraggingText = true;
      startX = e.clientX - div.offsetLeft;
      startY = e.clientY - div.offsetTop;
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isDraggingText) {
      const newX = e.clientX - startX;
      const newY = e.clientY - startY;
      div.style.left = newX + 'px';
      div.style.top = newY + 'px';
      textItem.normX = newX / w;
      textItem.normY = newY / h;
    }
  });

  document.addEventListener('mouseup', () => {
    isDraggingText = false;
  });

  domLayer.appendChild(div);
  return div;
}

function applyStamp(label, color) {
  const stampItem = {
    id: 'stamp_' + Date.now(),
    type: 'stamp',
    normX: 0.38,
    normY: 0.25,
    label: label,
    color: color
  };

  getPageAnnotations(pageNum).push(stampItem);
  const rect = annotCanvas.getBoundingClientRect();
  createStampElement(stampItem, rect.width, rect.height);
  const dropdown = document.getElementById('stampDropdown');
  if (dropdown) dropdown.classList.add('hidden');
  showToast(`Đã chèn con dấu: ${label}`);
}

function createStampElement(stampItem, w, h) {
  const div = document.createElement('div');
  div.className = 'pdf-stamp-overlay';
  div.id = stampItem.id;
  div.style.left = (stampItem.normX * w) + 'px';
  div.style.top = (stampItem.normY * h) + 'px';
  div.style.color = stampItem.color;
  div.style.borderColor = stampItem.color;
  div.innerText = stampItem.label;

  let isDragging = false;
  let startX = 0, startY = 0;

  div.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - div.offsetLeft;
    startY = e.clientY - div.offsetTop;
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const newX = e.clientX - startX;
      const newY = e.clientY - startY;
      div.style.left = newX + 'px';
      div.style.top = newY + 'px';
      stampItem.normX = newX / w;
      stampItem.normY = newY / h;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  domLayer.appendChild(div);
}

function undoLastAnnotation() {
  const items = getPageAnnotations(pageNum);
  if (!items.length) {
    showToast('Không có thao tác nào để hoàn tác trên trang này', 'info');
    return;
  }
  const removed = items.pop();
  redrawAnnotations(pageNum);
  renderDomAnnotations(pageNum);
  showToast('Đã hoàn tác thao tác gần nhất', 'info');
}

function clearCurrentPageAnnotations() {
  if (!confirm('Bạn có chắc chắn muốn xóa tất cả nét vẽ và chú thích trên trang này?')) return;
  annotations[pageNum] = [];
  redrawAnnotations(pageNum);
  renderDomAnnotations(pageNum);
  showToast('Đã xóa toàn bộ chú thích trên trang ' + pageNum);
}

// ==========================================
// ACTION: CONVERT PDF TO NOVADOC (WORD)
// ==========================================

async function convertToNovaDoc() {
  showToast('Đang bóc tách văn bản PDF sang trình soạn thảo Word...', 'info');
  try {
    const res = await fetch('/api/pdf/convert-to-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: currentPdfName
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Không thể chuyển đổi PDF sang NovaDoc');
    }

    const data = await res.json();
    showToast('Chuyển đổi thành công! Đang mở tài liệu...', 'success');
    setTimeout(() => {
      window.location.href = data.redirect;
    }, 600);
  } catch (err) {
    showToast('Lỗi chuyển đổi: ' + err.message, 'error');
  }
}

// ==========================================
// ACTION: GENERATE FLATTENED PAGES & SAVE
// ==========================================

async function generateFlattenedPages() {
  const pageImages = [];
  const totalPages = pdfDoc.numPages;

  for (let p = 1; p <= totalPages; p++) {
    const page = await pdfDoc.getPage(p);
    const viewport = page.getViewport({ scale: 1.5, rotation: rotation }); // High-res 1.5x

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = viewport.width;
    exportCanvas.height = viewport.height;
    const exportCtx = exportCanvas.getContext('2d');

    // 1. Render Base PDF
    await page.render({
      canvasContext: exportCtx,
      viewport: viewport
    }).promise;

    // 2. Render Annotations for this page
    const pageItems = annotations[p] || [];
    const w = viewport.width;
    const h = viewport.height;

    pageItems.forEach(item => {
      if (item.type === 'draw' || item.type === 'highlight') {
        if (!item.points || !item.points.length) return;
        exportCtx.save();
        exportCtx.beginPath();
        exportCtx.strokeStyle = item.color;
        exportCtx.lineWidth = item.width * 1.5;
        exportCtx.lineCap = 'round';
        exportCtx.lineJoin = 'round';
        exportCtx.globalAlpha = item.alpha || 1.0;

        exportCtx.moveTo(item.points[0].x * w, item.points[0].y * h);
        for (let i = 1; i < item.points.length; i++) {
          exportCtx.lineTo(item.points[i].x * w, item.points[i].y * h);
        }
        exportCtx.stroke();
        exportCtx.restore();
      } else if (item.type === 'whiteout') {
        exportCtx.save();
        exportCtx.fillStyle = '#ffffff';
        exportCtx.fillRect(item.normX * w, item.normY * h, item.normW * w, item.normH * h);
        exportCtx.restore();
      } else if (item.type === 'text') {
        if (!item.text) return;
        exportCtx.save();
        exportCtx.fillStyle = item.color || '#0f172a';
        exportCtx.font = `${item.bold ? 'bold ' : ''}${Math.round(item.fontSize * 1.5)}px sans-serif`;
        exportCtx.textBaseline = 'top';
        const lines = item.text.split('\n');
        lines.forEach((line, lineIdx) => {
          const lineY = (item.normY * h) + (lineIdx * (item.fontSize * 1.8));
          exportCtx.fillText(line, item.normX * w, lineY);
        });
        exportCtx.restore();
      } else if (item.type === 'stamp') {
        exportCtx.save();
        const stampX = item.normX * w;
        const stampY = item.normY * h;
        exportCtx.translate(stampX, stampY);
        exportCtx.rotate(-10 * Math.PI / 180);

        exportCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        exportCtx.strokeStyle = item.color;
        exportCtx.lineWidth = 4;
        exportCtx.fillRect(0, 0, 160, 48);
        exportCtx.strokeRect(0, 0, 160, 48);

        exportCtx.fillStyle = item.color;
        exportCtx.font = 'bold 20px sans-serif';
        exportCtx.textAlign = 'center';
        exportCtx.textBaseline = 'middle';
        exportCtx.fillText(item.label, 80, 24);
        exportCtx.restore();
      }
    });

    pageImages.push(exportCanvas.toDataURL('image/jpeg', 0.92));
  }
  return pageImages;
}

async function saveAnnotatedPdf() {
  if (!pdfDoc) {
    showToast('Chưa có tài liệu PDF nào được mở', 'error');
    return;
  }

  showToast('Đang chuẩn bị trang PDF và mở hộp thoại Lưu...', 'info');

  try {
    const pageImages = await generateFlattenedPages();

    // Call export/save-as endpoint to prompt native Windows Save As dialog
    const saveRes = await fetch('/api/export/save-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'annotated_pdf',
        title: currentPdfName.replace(/\.pdf$/i, '') + '_ban_sao',
        images: pageImages
      })
    });

    const result = await saveRes.json();
    if (result.status === 'cancelled') {
      showToast('Đã hủy thao tác lưu bản sao.', 'info');
      return;
    }
    if (result.status !== 'ok') {
      throw new Error(result.detail || result.message || 'Không thể lưu bản sao PDF');
    }

    showToast(`Đã lưu bản sao: ${result.file_name}`, 'success', [
      {
        label: '📁 Mở thư mục',
        onClick: () => fetch('/api/system/show-in-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: result.path })
        })
      },
      {
        label: '📄 Mở tệp',
        onClick: () => fetch('/api/system/open-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: result.path })
        })
      }
    ]);

  } catch (err) {
    showToast('Lỗi lưu PDF: ' + err.message, 'error');
  }
}

async function saveOverwritePdf() {
  if (!pdfDoc) {
    showToast('Chưa có tài liệu PDF nào được mở', 'error');
    return;
  }

  showToast(`Đang lưu đè trực tiếp vào "${currentPdfName}"...`, 'info');

  try {
    const pageImages = await generateFlattenedPages();

    const saveRes = await fetch('/api/pdf/save-overwrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: currentPdfName,
        images: pageImages
      })
    });

    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({}));
      throw new Error(err.detail || 'Không thể lưu đè tệp PDF');
    }

    const result = await saveRes.json();
    showToast(`Đã lưu đè thành công "${result.file_name}"!`, 'success', [
      {
        label: '📁 Mở thư mục',
        onClick: () => fetch('/api/system/show-in-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: result.path })
        })
      },
      {
        label: '📄 Mở tệp',
        onClick: () => fetch('/api/system/open-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: result.path })
        })
      }
    ]);
  } catch (err) {
    showToast('Lỗi lưu đè: ' + err.message, 'error');
  }
}

async function openFolderLocation(customPath) {
  try {
    const res = await fetch('/api/system/show-in-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: customPath || '',
        file_name: currentPdfName
      })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      showToast(data.message || 'Đã mở thư mục lưu trên máy', 'info');
    } else {
      showToast('Không thể mở thư mục: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

// ------------------------------------------
// Utilities & Toast
// ------------------------------------------

function setupEventListeners() {
  const backBtn = document.querySelector('a[href="/"]');
  if (backBtn && window.parent && window.parent !== window) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.parent.postMessage({ type: 'NOVA_SWITCH_TAB', tabId: 'tab-hub' }, '*');
    });
  }

  const pageInput = document.getElementById('pageNumInput');
  pageInput.addEventListener('change', () => {
    let target = parseInt(pageInput.value, 10);
    if (pdfDoc && target >= 1 && target <= pdfDoc.numPages) {
      pageNum = target;
      queueRenderPage(pageNum);
    } else {
      pageInput.value = pageNum;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.isContentEditable)) {
      return; // Ignore if typing inside input or textbox overlay
    }
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      nextPage();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      prevPage();
    } else if (e.ctrlKey && e.key === 'z') {
      undoLastAnnotation();
    }
  });
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
