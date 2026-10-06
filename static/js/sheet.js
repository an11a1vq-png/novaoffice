// NovaSheet Spreadsheet Controller v2.0
const NUM_COLS = 26; // A to Z
const NUM_ROWS = 60; // 1 to 60

let currentDocId = null;
let currentSheetName = "Trang tính 1";
let sheetData = {
  activeSheet: "Trang tính 1",
  sheets: {
    "Trang tính 1": { data: {} }
  }
};

let activeCell = "A1";
let saveTimer = null;
let isSaving = false;
let chartInstance = null;

// Multi-cell range selection state
let isSelectingRange = false;
let selectionStartCoord = null;
let selectedRangeCoords = [];

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  lucide.createIcons();
  buildGrid();

  const urlParams = new URLSearchParams(window.location.search);
  currentDocId = urlParams.get('id');

  if (currentDocId) {
    await loadDocument(currentDocId);
  } else {
    await createDefaultSheet();
  }

  setupEventListeners();
  renderSheetTabs();
  selectCell("A1");
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
function switchSheetTab(tabId) {
  document.querySelectorAll('.ribbon-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.ribbon-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });
}

function getColLetter(index) {
  return String.fromCharCode(65 + index);
}

function getColIndex(letter) {
  return letter.charCodeAt(0) - 65;
}

function buildGrid() {
  const table = document.getElementById('sheetTable');
  table.innerHTML = '';

  // Header Row (Corner + A, B, C...)
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  const corner = document.createElement('th');
  corner.className = 'sheet-corner-header';
  headRow.appendChild(corner);

  for (let c = 0; c < NUM_COLS; c++) {
    const colTh = document.createElement('th');
    colTh.className = 'sheet-col-header';
    colTh.innerText = getColLetter(c);
    colTh.onclick = () => selectColumn(getColLetter(c));
    headRow.appendChild(colTh);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  // Body Rows (1, 2, 3...)
  const tbody = document.createElement('tbody');
  for (let r = 1; r <= NUM_ROWS; r++) {
    const rowTr = document.createElement('tr');

    const rowTh = document.createElement('th');
    rowTh.className = 'sheet-row-header';
    rowTh.innerText = r;
    rowTr.appendChild(rowTh);

    for (let c = 0; c < NUM_COLS; c++) {
      const coord = `${getColLetter(c)}${r}`;
      const cellTd = document.createElement('td');
      cellTd.className = 'sheet-cell';
      cellTd.id = `cell-${coord}`;
      cellTd.dataset.coord = coord;
      cellTd.contentEditable = 'true';
      cellTd.spellcheck = false;

      // Click and drag to select range
      cellTd.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isSelectingRange = true;
        selectionStartCoord = coord;
        clearRangeSelection();
        selectCell(coord);
      });

      cellTd.addEventListener('mouseenter', () => {
        if (isSelectingRange && selectionStartCoord) {
          updateRangeSelection(selectionStartCoord, coord);
        }
      });

      // Input event
      cellTd.addEventListener('input', () => {
        handleCellInput(coord, cellTd.innerText);
      });

      // Blur to evaluate formula
      cellTd.addEventListener('blur', () => {
        refreshAllFormulas();
      });

      rowTr.appendChild(cellTd);
    }
    tbody.appendChild(rowTr);
  }
  table.appendChild(tbody);
}

// Multi-Sheet Tabs Management
function renderSheetTabs() {
  const container = document.getElementById('sheetTabsContainer');
  if (!container) return;
  container.innerHTML = '';

  const sheetNames = Object.keys(sheetData.sheets);
  sheetNames.forEach(name => {
    const isActive = name === currentSheetName;
    const tabDiv = document.createElement('div');
    tabDiv.className = `flex items-center space-x-1 px-3 py-1 text-xs font-medium rounded-t cursor-pointer transition select-none ${
      isActive
        ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-sm'
        : 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-800'
    }`;

    // Sheet label with double click to rename
    const labelSpan = document.createElement('span');
    labelSpan.innerText = name;
    labelSpan.title = 'Nhấp đúp để đổi tên trang tính';
    labelSpan.ondblclick = (e) => {
      e.stopPropagation();
      renameSheetTab(name);
    };
    labelSpan.onclick = () => switchSheetTabAction(name);
    tabDiv.appendChild(labelSpan);

    // Delete tab button (only if > 1 sheet)
    if (sheetNames.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.className = 'p-0.5 text-slate-400 hover:text-rose-500 rounded ml-1 transition';
      delBtn.title = 'Xóa trang tính này';
      delBtn.innerHTML = '✕';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        deleteSheetTab(name);
      };
      tabDiv.appendChild(delBtn);
    }

    container.appendChild(tabDiv);
  });
}

function switchSheetTabAction(name) {
  if (name === currentSheetName) return;
  currentSheetName = name;
  sheetData.activeSheet = name;
  renderSheetTabs();
  renderGridData();
  selectCell("A1");
  showToast(`Đã chuyển sang: ${name}`);
}

function addNewSheetTab() {
  const sheetNames = Object.keys(sheetData.sheets);
  let nextIdx = sheetNames.length + 1;
  let newName = `Trang tính ${nextIdx}`;
  while (sheetData.sheets[newName]) {
    nextIdx++;
    newName = `Trang tính ${nextIdx}`;
  }

  sheetData.sheets[newName] = { data: {} };
  currentSheetName = newName;
  sheetData.activeSheet = newName;

  renderSheetTabs();
  renderGridData();
  selectCell("A1");
  scheduleAutoSave();
  showToast(`Đã thêm ${newName}`);
}

function renameSheetTab(oldName) {
  const newName = prompt(`Nhập tên mới cho "${oldName}":`, oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;

  const trimmed = newName.trim();
  if (sheetData.sheets[trimmed]) {
    showToast('Tên trang tính đã tồn tại!', 'error');
    return;
  }

  sheetData.sheets[trimmed] = sheetData.sheets[oldName];
  delete sheetData.sheets[oldName];

  if (currentSheetName === oldName) {
    currentSheetName = trimmed;
    sheetData.activeSheet = trimmed;
  }

  renderSheetTabs();
  scheduleAutoSave();
  showToast(`Đã đổi tên thành: ${trimmed}`);
}

function deleteSheetTab(name) {
  const sheetNames = Object.keys(sheetData.sheets);
  if (sheetNames.length <= 1) {
    showToast('Không thể xóa trang tính duy nhất còn lại!', 'error');
    return;
  }

  const confirmDel = confirm(`Bạn có chắc muốn xóa "${name}" cùng toàn bộ dữ liệu bên trong?`);
  if (!confirmDel) return;

  delete sheetData.sheets[name];
  if (currentSheetName === name) {
    currentSheetName = Object.keys(sheetData.sheets)[0];
    sheetData.activeSheet = currentSheetName;
  }

  renderSheetTabs();
  renderGridData();
  selectCell("A1");
  scheduleAutoSave();
  showToast(`Đã xóa ${name}`);
}

// Data persistence
async function createDefaultSheet() {
  try {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Bảng tính không tên',
        type: 'sheet',
        tags: ['bảng tính']
      })
    });
    if (!res.ok) throw new Error('Không thể tạo bảng tính');
    const doc = await res.json();
    currentDocId = doc.id;
    window.history.replaceState(null, '', `/sheet?id=${doc.id}`);
    document.getElementById('sheetTitleInput').value = doc.title;
    if (doc.content?.sheets) {
      sheetData = doc.content;
      currentSheetName = doc.content.activeSheet || Object.keys(doc.content.sheets)[0] || "Trang tính 1";
    }
    renderSheetTabs();
    renderGridData();
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
}

async function loadDocument(id) {
  try {
    setSaveStatus('loading');
    const res = await fetch(`/api/documents/${id}?type=sheet`);
    if (!res.ok) throw new Error('Không tìm thấy bảng tính');
    const doc = await res.json();

    document.getElementById('sheetTitleInput').value = doc.title || 'Bảng tính không tên';
    if (doc.content?.sheets) {
      sheetData = doc.content;
      currentSheetName = doc.content.activeSheet || Object.keys(doc.content.sheets)[0] || "Trang tính 1";
    }
    renderSheetTabs();
    renderGridData();
    setSaveStatus('saved');

    if (window.parent && window.parent !== window && doc.title) {
      window.parent.postMessage({ type: 'NOVA_UPDATE_TAB_TITLE', title: doc.title }, '*');
    }
  } catch (err) {
    showToast('Lỗi khi mở bảng tính: ' + err.message, 'error');
  }
}

function getActiveSheetData() {
  if (!sheetData.sheets[currentSheetName]) {
    sheetData.sheets[currentSheetName] = { data: {} };
  }
  return sheetData.sheets[currentSheetName].data;
}

function renderGridData() {
  const data = getActiveSheetData();

  // Clear cell displays
  document.querySelectorAll('.sheet-cell').forEach(td => {
    td.innerText = '';
    td.style.fontWeight = 'normal';
    td.style.fontStyle = 'normal';
    td.style.color = '';
    td.style.backgroundColor = '';
    td.style.textAlign = '';
  });

  // Apply cell data
  for (const [coord, cell] of Object.entries(data)) {
    const td = document.getElementById(`cell-${coord}`);
    if (!td) continue;

    applyCellStyle(td, cell);
    td.innerText = evaluateDisplayValue(coord, cell);
  }

  updateFormulaBar();
}

function applyCellStyle(td, cell) {
  if (cell.bold) td.style.fontWeight = 'bold';
  if (cell.italic) td.style.fontStyle = 'italic';
  if (cell.color) td.style.color = cell.color;
  if (cell.bg) td.style.backgroundColor = cell.bg;
  if (cell.align) td.style.textAlign = cell.align;
}

function selectCell(coord) {
  if (activeCell) {
    const prev = document.getElementById(`cell-${activeCell}`);
    if (prev) prev.classList.remove('selected');
  }

  activeCell = coord;
  const current = document.getElementById(`cell-${activeCell}`);
  if (current) {
    current.classList.add('selected');
  }

  document.getElementById('activeCellAddress').innerText = coord;
  updateFormulaBar();
  updateToolbarState();
}

function selectColumn(colLetter) {
  selectCell(`${colLetter}1`);
}

function updateFormulaBar() {
  const data = getActiveSheetData();
  const cell = data[activeCell];
  const bar = document.getElementById('formulaBarInput');

  if (cell) {
    bar.value = cell.formula || cell.value || '';
  } else {
    bar.value = '';
  }
}

function handleCellInput(coord, text) {
  const data = getActiveSheetData();
  if (!data[coord]) data[coord] = {};

  if (text.startsWith('=')) {
    data[coord].formula = text;
    delete data[coord].value;
  } else {
    data[coord].value = isNaN(text) || text.trim() === '' ? text : Number(text);
    delete data[coord].formula;
  }

  updateFormulaBar();
  scheduleAutoSave();
}

function refreshAllFormulas() {
  const data = getActiveSheetData();
  for (const [coord, cell] of Object.entries(data)) {
    const td = document.getElementById(`cell-${coord}`);
    if (td) {
      td.innerText = evaluateDisplayValue(coord, cell);
    }
  }
}

// Formula Evaluation Engine
function evaluateDisplayValue(coord, cell) {
  if (!cell) return '';
  let rawVal = '';
  if (cell.formula) {
    try {
      rawVal = computeFormula(cell.formula, coord);
    } catch (err) {
      return '#ERROR!';
    }
  } else {
    rawVal = cell.value !== undefined ? cell.value : '';
  }

  if (cell.format && rawVal !== '' && rawVal !== '#ERROR!' && rawVal !== '#N/A') {
    return formatCellValue(rawVal, cell.format);
  }
  return rawVal;
}

function formatCellValue(val, format) {
  const num = Number(val);
  const isNum = !isNaN(num) && val !== '' && val !== null;

  if (format === 'currency') {
    if (isNum) return num.toLocaleString('vi-VN') + ' ₫';
    return val;
  }
  if (format === 'percent') {
    if (isNum) {
      return (num <= 1 && num >= -1 ? (num * 100).toFixed(1) : num.toFixed(1)) + '%';
    }
    return val;
  }
  if (format === 'number') {
    if (isNum) return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return val;
  }
  if (format === 'date') {
    if (typeof val === 'string' && val.includes('-')) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
    }
    return val;
  }
  return val;
}

function computeFormula(formulaStr, targetCoord) {
  const raw = formulaStr.substring(1).trim();
  const rawUpper = raw.toUpperCase();
  const data = getActiveSheetData();

  function getNum(coord) {
    const c = data[coord];
    if (!c) return 0;
    if (c.value !== undefined) return Number(c.value) || 0;
    if (c.formula) return Number(computeFormula(c.formula, coord)) || 0;
    return 0;
  }

  function getRangeCells(rangeStr) {
    const [start, end] = rangeStr.split(':');
    const startCol = start.charCodeAt(0) - 65;
    const startRow = parseInt(start.substring(1), 10);
    const endCol = end.charCodeAt(0) - 65;
    const endRow = parseInt(end.substring(1), 10);

    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);

    const cells = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        cells.push(`${String.fromCharCode(65 + c)}${r}`);
      }
    }
    return cells;
  }

  // 1. IF(condition, true_val, false_val)
  const ifMatch = raw.match(/^IF\s*\((.*)\)$/i);
  if (ifMatch) {
    const args = parseFormulaArgs(ifMatch[1]);
    if (args.length >= 2) {
      const cond = args[0].trim();
      const trueVal = evaluateArg(args[1], targetCoord);
      const falseVal = args.length >= 3 ? evaluateArg(args[2], targetCoord) : '';
      return evaluateCondition(cond) ? trueVal : falseVal;
    }
  }

  // 2. VLOOKUP(lookup_value, table_array, col_index, [range_lookup])
  const vMatch = raw.match(/^VLOOKUP\s*\((.*)\)$/i);
  if (vMatch) {
    const args = parseFormulaArgs(vMatch[1]);
    if (args.length >= 3) {
      const lookupVal = evaluateArg(args[0], targetCoord);
      const rangeStr = args[1].trim().toUpperCase();
      const colIndex = parseInt(args[2].trim(), 10);

      const [start, end] = rangeStr.split(':');
      if (start && end) {
        const startCol = start.charCodeAt(0) - 65;
        const startRow = parseInt(start.substring(1), 10);
        const endCol = end.charCodeAt(0) - 65;
        const endRow = parseInt(end.substring(1), 10);

        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);

        for (let r = minRow; r <= maxRow; r++) {
          const firstColCoord = `${String.fromCharCode(65 + minCol)}${r}`;
          const cellVal = data[firstColCoord]?.value !== undefined 
            ? data[firstColCoord].value 
            : (data[firstColCoord]?.formula ? computeFormula(data[firstColCoord].formula, firstColCoord) : '');
          
          if (String(cellVal).trim().toLowerCase() === String(lookupVal).trim().toLowerCase()) {
            const targetCol = minCol + (colIndex - 1);
            if (targetCol <= maxCol) {
              const resCoord = `${String.fromCharCode(65 + targetCol)}${r}`;
              return data[resCoord]?.value !== undefined 
                ? data[resCoord].value 
                : (data[resCoord]?.formula ? computeFormula(data[resCoord].formula, resCoord) : '');
            }
          }
        }
        return '#N/A';
      }
    }
  }

  // 3. CONCATENATE(...) / CONCAT(...)
  const concatMatch = raw.match(/^(?:CONCATENATE|CONCAT)\s*\((.*)\)$/i);
  if (concatMatch) {
    const args = parseFormulaArgs(concatMatch[1]);
    return args.map(arg => evaluateArg(arg, targetCoord)).join('');
  }

  // 4. SUM(A1:A5)
  let m = rawUpper.match(/^SUM\(([A-Z0-9:]+)\)$/);
  if (m) {
    const cells = getRangeCells(m[1]);
    return cells.reduce((sum, c) => sum + getNum(c), 0);
  }

  // 5. AVERAGE(A1:A5)
  m = rawUpper.match(/^AVERAGE\(([A-Z0-9:]+)\)$/);
  if (m) {
    const cells = getRangeCells(m[1]);
    const sum = cells.reduce((s, c) => s + getNum(c), 0);
    return cells.length > 0 ? Number((sum / cells.length).toFixed(2)) : 0;
  }

  // 6. COUNT(A1:A5)
  m = rawUpper.match(/^COUNT\(([A-Z0-9:]+)\)$/);
  if (m) {
    const cells = getRangeCells(m[1]);
    return cells.filter(c => data[c] && (data[c].value !== undefined || data[c].formula)).length;
  }

  // 7. MAX(A1:A5)
  m = rawUpper.match(/^MAX\(([A-Z0-9:]+)\)$/);
  if (m) {
    const cells = getRangeCells(m[1]);
    const nums = cells.map(c => getNum(c));
    return nums.length ? Math.max(...nums) : 0;
  }

  // 8. MIN(A1:A5)
  m = rawUpper.match(/^MIN\(([A-Z0-9:]+)\)$/);
  if (m) {
    const cells = getRangeCells(m[1]);
    const nums = cells.map(c => getNum(c));
    return nums.length ? Math.min(...nums) : 0;
  }

  // 9. Basic math expressions: =A1+B1, =A1*2, etc.
  let expr = rawUpper.replace(/([A-Z][0-9]+)/g, (match) => {
    return getNum(match);
  });

  if (/^[\d+\-*/().\s]+$/.test(expr)) {
    return Function(`"use strict"; return (${expr})`)();
  }

  return raw;
}

// Formula Parsing Utilities
function parseFormulaArgs(str) {
  const args = [];
  let current = '';
  let inQuotes = false;
  let parenDepth = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '(' && !inQuotes) {
      parenDepth++;
      current += ch;
    } else if (ch === ')' && !inQuotes) {
      parenDepth--;
      current += ch;
    } else if (ch === ',' && !inQuotes && parenDepth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) args.push(current.trim());
  return args;
}

function evaluateArg(arg, targetCoord) {
  arg = (arg || '').trim();
  if (arg.startsWith('"') && arg.endsWith('"')) {
    return arg.slice(1, -1);
  }
  const data = getActiveSheetData();
  if (/^[A-Z][0-9]+$/i.test(arg)) {
    const coord = arg.toUpperCase();
    const c = data[coord];
    if (!c) return '';
    if (c.value !== undefined) return c.value;
    if (c.formula) return computeFormula(c.formula, coord);
    return '';
  }
  if (!isNaN(arg) && arg !== '') return Number(arg);
  if (arg.toUpperCase() === 'TRUE') return true;
  if (arg.toUpperCase() === 'FALSE') return false;
  return arg;
}

function evaluateCondition(cond) {
  cond = (cond || '').trim();
  const operators = ['>=', '<=', '!=', '<>', '==', '=', '>', '<'];
  for (const op of operators) {
    const idx = cond.indexOf(op);
    if (idx !== -1) {
      const leftPart = cond.substring(0, idx).trim();
      const rightPart = cond.substring(idx + op.length).trim();
      const leftVal = evaluateArg(leftPart);
      const rightVal = evaluateArg(rightPart);

      const nLeft = Number(leftVal);
      const nRight = Number(rightVal);
      const bothNum = !isNaN(nLeft) && !isNaN(nRight) && leftVal !== '' && rightVal !== '';

      const a = bothNum ? nLeft : String(leftVal).toLowerCase();
      const b = bothNum ? nRight : String(rightVal).toLowerCase();

      if (op === '=' || op === '==') return a == b;
      if (op === '!=' || op === '<>') return a != b;
      if (op === '>') return a > b;
      if (op === '<') return a < b;
      if (op === '>=') return a >= b;
      if (op === '<=') return a <= b;
    }
  }
  const val = evaluateArg(cond);
  return Boolean(val);
}

// Column Sorting (A -> Z, Z -> A)
function sortActiveColumn(asc = true) {
  const colLetter = activeCell.replace(/[0-9]/g, '');
  const data = getActiveSheetData();

  // Find all used rows (rows 2 to 60)
  const rowsWithData = [];
  for (let r = 2; r <= NUM_ROWS; r++) {
    let hasData = false;
    for (let c = 0; c < NUM_COLS; c++) {
      const coord = `${getColLetter(c)}${r}`;
      if (data[coord] && (data[coord].value !== undefined || data[coord].formula)) {
        hasData = true;
        break;
      }
    }
    if (hasData) rowsWithData.push(r);
  }

  if (rowsWithData.length < 2) {
    showToast('Cần ít nhất 2 hàng dữ liệu bên dưới tiêu đề để sắp xếp!', 'info');
    return;
  }

  // Extract row snapshots
  const rowSnapshots = rowsWithData.map(r => {
    const rowObj = { rowIndex: r, sortVal: null, cells: {} };
    for (let c = 0; c < NUM_COLS; c++) {
      const letter = getColLetter(c);
      const coord = `${letter}${r}`;
      if (data[coord]) rowObj.cells[letter] = { ...data[coord] };
      if (letter === colLetter) {
        rowObj.sortVal = data[coord]?.value !== undefined ? data[coord].value : (data[coord]?.formula || '');
      }
    }
    return rowObj;
  });

  // Sort snapshots
  rowSnapshots.sort((a, b) => {
    let va = a.sortVal, vb = b.sortVal;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;

    const na = Number(va), nb = Number(vb);
    if (!isNaN(na) && !isNaN(nb)) {
      return asc ? na - nb : nb - na;
    }
    return asc ? String(va).localeCompare(String(vb), 'vi') : String(vb).localeCompare(String(va), 'vi');
  });

  // Re-assign into data
  rowSnapshots.forEach((snap, idx) => {
    const targetRow = rowsWithData[idx];
    for (let c = 0; c < NUM_COLS; c++) {
      const letter = getColLetter(c);
      const coord = `${letter}${targetRow}`;
      if (snap.cells[letter]) {
        data[coord] = snap.cells[letter];
      } else {
        delete data[coord];
      }
    }
  });

  renderGridData();
  refreshAllFormulas();
  scheduleAutoSave();
  showToast(`Đã sắp xếp cột ${colLetter} theo thứ tự ${asc ? 'A → Z' : 'Z → A'}`);
}

// Insert / Delete Rows
function insertRowAbove() {
  const rowNum = parseInt(activeCell.replace(/\D/g, ''), 10);
  const data = getActiveSheetData();

  // Shift all rows from rowNum down
  for (let r = NUM_ROWS - 1; r >= rowNum; r--) {
    for (let c = 0; c < NUM_COLS; c++) {
      const srcCoord = `${getColLetter(c)}${r}`;
      const destCoord = `${getColLetter(c)}${r + 1}`;
      if (data[srcCoord]) {
        data[destCoord] = { ...data[srcCoord] };
        delete data[srcCoord];
      } else {
        delete data[destCoord];
      }
    }
  }

  renderGridData();
  scheduleAutoSave();
  showToast(`Đã chèn 1 dòng mới tại hàng ${rowNum}`);
}

function deleteCurrentRow() {
  const rowNum = parseInt(activeCell.replace(/\D/g, ''), 10);
  const data = getActiveSheetData();

  // Clear current row
  for (let c = 0; c < NUM_COLS; c++) {
    delete data[`${getColLetter(c)}${rowNum}`];
  }

  // Shift up
  for (let r = rowNum; r < NUM_ROWS; r++) {
    for (let c = 0; c < NUM_COLS; c++) {
      const srcCoord = `${getColLetter(c)}${r + 1}`;
      const destCoord = `${getColLetter(c)}${r}`;
      if (data[srcCoord]) {
        data[destCoord] = { ...data[srcCoord] };
        delete data[srcCoord];
      } else {
        delete data[destCoord];
      }
    }
  }

  renderGridData();
  scheduleAutoSave();
  showToast(`Đã xóa hàng ${rowNum}`);
}

function findInSheetPrompt() {
  const query = prompt('Nhập từ khóa hoặc số cần tìm trong bảng:');
  if (!query) return;

  const data = getActiveSheetData();
  const lowerQuery = query.toLowerCase();

  for (const [coord, cell] of Object.entries(data)) {
    const val = String(cell.value !== undefined ? cell.value : (cell.formula || '')).toLowerCase();
    if (val.includes(lowerQuery)) {
      selectCell(coord);
      const td = document.getElementById(`cell-${coord}`);
      if (td) {
        td.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      showToast(`Đã tìm thấy tại ô ${coord}`);
      return;
    }
  }
  showToast('Không tìm thấy dữ liệu phù hợp!', 'info');
}

// AI Clean & Analysis
async function triggerAiSheetClean() {
  const data = getActiveSheetData();
  const coords = Object.keys(data).slice(0, 15);
  const summary = coords.map(c => `${c}:${data[c].value || data[c].formula}`).join(', ');

  showToast('NOVA AI đang phân tích dữ liệu bảng tính...', 'info');
  try {
    const res = await fetch('/api/ai/sheet-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'clean',
        query: 'Nhận xét xu hướng và gợi ý công thức tổng kết phù hợp cho bảng tính này',
        active_cell: activeCell,
        context: summary || 'Bảng tính doanh thu và số lượng'
      })
    });
    if (!res.ok) throw new Error('Không thể phân tích');
    const result = await res.json();
    alert(`💡 Nhận xét từ NOVA AI:\n\n${result.reply}`);
  } catch (err) {
    showToast('Lỗi AI: ' + err.message, 'error');
  }
}

// Toolbar Formatting
function toggleFormat(type) {
  const data = getActiveSheetData();
  if (!data[activeCell]) data[activeCell] = {};
  data[activeCell][type] = !data[activeCell][type];

  const td = document.getElementById(`cell-${activeCell}`);
  if (td) applyCellStyle(td, data[activeCell]);
  updateToolbarState();
  scheduleAutoSave();
}

function applyColor(type, val) {
  const data = getActiveSheetData();
  if (!data[activeCell]) data[activeCell] = {};
  data[activeCell][type] = val;

  const td = document.getElementById(`cell-${activeCell}`);
  if (td) applyCellStyle(td, data[activeCell]);
  scheduleAutoSave();
}

function setAlignment(align) {
  const data = getActiveSheetData();
  if (!data[activeCell]) data[activeCell] = {};
  data[activeCell].align = align;

  const td = document.getElementById(`cell-${activeCell}`);
  if (td) applyCellStyle(td, data[activeCell]);
  scheduleAutoSave();
}

function clearCurrentCell() {
  const data = getActiveSheetData();
  delete data[activeCell];
  const td = document.getElementById(`cell-${activeCell}`);
  if (td) {
    td.innerText = '';
    td.style.fontWeight = 'normal';
    td.style.fontStyle = 'normal';
    td.style.color = '';
    td.style.backgroundColor = '';
  }
  updateFormulaBar();
  scheduleAutoSave();
}

function insertFormula(fnName) {
  const bar = document.getElementById('formulaBarInput');
  let defaultFormula = `=${fnName}(A1:A5)`;
  if (fnName === 'IF') defaultFormula = `=IF(A1>10, "Đạt", "Chưa đạt")`;
  else if (fnName === 'VLOOKUP') defaultFormula = `=VLOOKUP(A1, B1:D10, 2, 0)`;
  else if (fnName === 'CONCATENATE') defaultFormula = `=CONCATENATE(A1, " ", B1)`;

  bar.value = defaultFormula;
  handleCellInput(activeCell, defaultFormula);
  refreshAllFormulas();
}

// Number Formatting (Currency, Percentage, Date, Number)
function applyNumberFormat(formatType) {
  const data = getActiveSheetData();
  const targetCoords = selectedRangeCoords.length > 1 ? selectedRangeCoords : [activeCell];

  targetCoords.forEach(coord => {
    if (!data[coord]) data[coord] = {};
    if (formatType === 'general') {
      delete data[coord].format;
    } else {
      data[coord].format = formatType;
    }
    const td = document.getElementById(`cell-${coord}`);
    if (td) {
      td.innerText = evaluateDisplayValue(coord, data[coord]);
    }
  });

  scheduleAutoSave();
  showToast(`Đã áp dụng định dạng: ${formatType}`);
}

// Range Drag Selection & Stats Calculation
function clearRangeSelection() {
  selectedRangeCoords.forEach(c => {
    const el = document.getElementById(`cell-${c}`);
    if (el) el.classList.remove('range-selected');
  });
  selectedRangeCoords = [];
  const statsBar = document.getElementById('rangeStatsBar');
  const hint = document.getElementById('sheetFooterHint');
  if (statsBar) statsBar.classList.add('hidden');
  if (hint) hint.classList.remove('hidden');
}

function updateRangeSelection(start, end) {
  clearRangeSelection();

  const startCol = start.charCodeAt(0) - 65;
  const startRow = parseInt(start.substring(1), 10);
  const endCol = end.charCodeAt(0) - 65;
  const endRow = parseInt(end.substring(1), 10);

  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);

  const coords = [];
  const nums = [];
  const data = getActiveSheetData();

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const coord = `${String.fromCharCode(65 + c)}${r}`;
      coords.push(coord);
      const el = document.getElementById(`cell-${coord}`);
      if (el && coord !== activeCell) {
        el.classList.add('range-selected');
      }

      const cell = data[coord];
      if (cell) {
        const val = cell.value !== undefined ? cell.value : (cell.formula ? computeFormula(cell.formula, coord) : null);
        const num = Number(val);
        if (!isNaN(num) && val !== '' && val !== null) {
          nums.push(num);
        }
      }
    }
  }

  selectedRangeCoords = coords;

  if (coords.length > 1) {
    const statsBar = document.getElementById('rangeStatsBar');
    const hint = document.getElementById('sheetFooterHint');
    if (statsBar) statsBar.classList.remove('hidden');
    if (hint) hint.classList.add('hidden');

    const count = coords.length;
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = nums.length ? (sum / nums.length).toFixed(2) : 0;
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 0;

    const countEl = document.getElementById('statCount');
    const sumEl = document.getElementById('statSum');
    const avgEl = document.getElementById('statAvg');
    const minEl = document.getElementById('statMin');
    const maxEl = document.getElementById('statMax');

    if (countEl) countEl.innerText = `COUNT: ${count}`;
    if (sumEl) sumEl.innerText = `SUM: ${sum.toLocaleString('vi-VN')}`;
    if (avgEl) avgEl.innerText = `AVG: ${avg}`;
    if (minEl) minEl.innerText = `MIN: ${min.toLocaleString('vi-VN')}`;
    if (maxEl) maxEl.innerText = `MAX: ${max.toLocaleString('vi-VN')}`;
  }
}

// Freeze First Column Toggle
function toggleFreezeFirstCol() {
  const table = document.getElementById('sheetTable');
  const btn = document.getElementById('btnFreezeCol');
  if (!table) return;

  const isFrozen = table.classList.toggle('freeze-first-col');
  if (btn) {
    btn.classList.toggle('active', isFrozen);
  }
  localStorage.setItem('sheet_freeze_col', isFrozen ? '1' : '0');
  showToast(isFrozen ? 'Đã cố định Cột A khi cuộn ngang' : 'Đã bỏ cố định Cột A');
}

function updateToolbarState() {
  const data = getActiveSheetData();
  const cell = data[activeCell] || {};

  const btnB = document.getElementById('btnBold');
  const btnI = document.getElementById('btnItalic');
  if (btnB) btnB.classList.toggle('active', !!cell.bold);
  if (btnI) btnI.classList.toggle('active', !!cell.italic);

  const numSelect = document.getElementById('numFormatSelect');
  if (numSelect) {
    numSelect.value = cell.format || 'general';
  }
}

function setupEventListeners() {
  const bar = document.getElementById('formulaBarInput');
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleCellInput(activeCell, bar.value);
      refreshAllFormulas();
      const td = document.getElementById(`cell-${activeCell}`);
      if (td) td.focus();
    }
  });

  const titleInput = document.getElementById('sheetTitleInput');
  titleInput.addEventListener('input', () => {
    scheduleAutoSave();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'NOVA_UPDATE_TAB_TITLE', title: titleInput.value.trim() || 'Bảng tính không tên' }, '*');
    }
  });

  const backBtn = document.querySelector('a[href="/"]');
  if (backBtn && window.parent && window.parent !== window) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.parent.postMessage({ type: 'NOVA_SWITCH_TAB', tabId: 'tab-hub' }, '*');
    });
  }

  // End range dragging on mouse up
  document.addEventListener('mouseup', () => {
    isSelectingRange = false;
  });

  // Restore freeze col state if saved
  if (localStorage.getItem('sheet_freeze_col') === '1') {
    const table = document.getElementById('sheetTable');
    const btn = document.getElementById('btnFreezeCol');
    if (table) table.classList.add('freeze-first-col');
    if (btn) btn.classList.add('active');
  }
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

  const title = document.getElementById('sheetTitleInput').value.trim() || 'Bảng tính không tên';

  try {
    const res = await fetch(`/api/documents/${currentDocId}?type=sheet`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        content: sheetData
      })
    });
    if (!res.ok) throw new Error('Lỗi khi lưu');
    setSaveStatus('saved');
  } catch (err) {
    setSaveStatus('error');
    showToast('Lưu thất bại: ' + err.message, 'error');
  } finally {
    isSaving = false;
  }
}

function setSaveStatus(status) {
  const container = document.getElementById('saveStatus');
  if (!container) return;

  if (status === 'saving' || status === 'loading') {
    container.innerHTML = `
      <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-emerald-500"></i>
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

// Chart Modal
function openChartModal() {
  document.getElementById('chartModal').classList.remove('hidden');
  renderChart();
}

function closeChartModal() {
  document.getElementById('chartModal').classList.add('hidden');
}

function renderChart() {
  const rangeStr = document.getElementById('chartRangeInput').value.trim().toUpperCase() || 'A1:B3';
  const chartType = document.getElementById('chartTypeSelect').value;

  const data = getActiveSheetData();
  const [start, end] = rangeStr.split(':');
  if (!start || !end) return;

  const startCol = start.charCodeAt(0) - 65;
  const startRow = parseInt(start.substring(1), 10);
  const endCol = end.charCodeAt(0) - 65;
  const endRow = parseInt(end.substring(1), 10);

  const cols = {};
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const letter = getColLetter(c);
      if (!cols[letter]) cols[letter] = [];
      const coord = `${letter}${r}`;
      const cell = data[coord];
      const val = cell ? (cell.value !== undefined ? cell.value : evaluateDisplayValue(coord, cell)) : '';
      cols[letter].push(val);
    }
  }

  const colKeys = Object.keys(cols);
  if (colKeys.length < 2) {
    showToast('Cần ít nhất 2 cột để vẽ biểu đồ (Cột 1: Nhãn, Cột 2+: Dữ liệu)', 'error');
    return;
  }

  const labels = cols[colKeys[0]];
  const values = cols[colKeys[1]].map(v => isNaN(v) ? 0 : Number(v));

  const ctx = document.getElementById('chartCanvas').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

  chartInstance = new Chart(ctx, {
    type: chartType,
    data: {
      labels: labels,
      datasets: [{
        label: `Dữ liệu cột ${colKeys[1]}`,
        data: values,
        backgroundColor: chartType === 'pie' ? colors : 'rgba(16, 185, 129, 0.7)',
        borderColor: '#059669',
        borderWidth: 1.5,
        borderRadius: chartType === 'bar' ? 6 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: chartType === 'pie' }
      }
    }
  });
}

// Exporting
async function exportXlsx() {
  const title = document.getElementById('sheetTitleInput').value.trim() || 'Bang_Tinh';
  showToast('Đang tạo file Excel (.xlsx)...', 'info');

  try {
    const res = await fetch('/api/export/sheet-raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        sheets: sheetData.sheets
      })
    });
    if (!res.ok) throw new Error('Xuất file thất bại');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Đã tải file Excel (.xlsx) thành công!');
  } catch (err) {
    showToast('Lỗi khi xuất file: ' + err.message, 'error');
  }
}

function exportCsv() {
  const title = document.getElementById('sheetTitleInput').value.trim() || 'Bang_Tinh';
  const data = getActiveSheetData();

  let csvContent = "data:text/csv;charset=utf-8,";
  for (let r = 1; r <= 30; r++) {
    const row = [];
    for (let c = 0; c < 15; c++) {
      const coord = `${getColLetter(c)}${r}`;
      const cell = data[coord];
      const val = cell ? (cell.value !== undefined ? cell.value : evaluateDisplayValue(coord, cell)) : '';
      row.push(`"${String(val).replace(/"/g, '""')}"`);
    }
    csvContent += row.join(",") + "\r\n";
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${title}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('Đã xuất file CSV thành công!');
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
