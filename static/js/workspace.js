// NovaOffice Multi-Tab Workspace Controller
let tabs = [];
let activeTabId = null;

const APP_META = {
  hub: { label: 'Tổng Quan', icon: 'home', color: 'text-indigo-600' },
  doc: { label: 'Văn Bản', icon: 'file-text', color: 'text-blue-600' },
  sheet: { label: 'Bảng Tính', icon: 'table', color: 'text-emerald-600' },
  slide: { label: 'Thuyết Trình', icon: 'presentation', color: 'text-amber-600' },
  pdf: { label: 'Tài Liệu PDF', icon: 'file-check-2', color: 'text-rose-600' }
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  lucide.createIcons();
  initWorkspace();
  setupGlobalShortcuts();
  setupMessageListener();
});

// Initialize workspace tabs
function initWorkspace() {
  // Always create Hub tab first
  const hubTab = {
    id: 'tab-hub',
    title: 'Trung Tâm Quản Lý',
    type: 'hub',
    url: '/hub',
    closable: false
  };

  tabs = [hubTab];
  renderTabElement(hubTab);
  renderIframeElement(hubTab);

  // Restore any previous tabs from sessionStorage
  try {
    const saved = sessionStorage.getItem('nova_open_tabs');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach(t => {
          if (t.id !== 'tab-hub' && t.url) {
            tabs.push(t);
            renderTabElement(t);
            renderIframeElement(t);
          }
        });
      }
    }
  } catch (e) {
    console.warn('Could not restore tabs:', e);
  }

  // Activate last active tab or Hub
  const lastActive = sessionStorage.getItem('nova_active_tab_id');
  const targetId = (lastActive && tabs.some(t => t.id === lastActive)) ? lastActive : 'tab-hub';
  activateTab(targetId);
}

// Render Tab in Tab Strip
function renderTabElement(tab) {
  const tabStrip = document.getElementById('tabStrip');
  if (!tabStrip) return;

  const meta = APP_META[tab.type] || APP_META.doc;

  const tabEl = document.createElement('div');
  tabEl.id = `tab-el-${tab.id}`;
  tabEl.className = 'app-tab';
  tabEl.onclick = () => activateTab(tab.id);
  tabEl.onauxclick = (e) => {
    if (e.button === 1 && tab.closable) { // Middle click to close
      e.preventDefault();
      closeTab(tab.id, e);
    }
  };

  tabEl.innerHTML = `
    <i data-lucide="${meta.icon}" class="app-tab-icon ${meta.color}"></i>
    <span class="app-tab-title" id="tab-title-${tab.id}" title="${tab.title}">${tab.title}</span>
    ${tab.closable ? `
      <button class="app-tab-close" onclick="closeTab('${tab.id}', event)" title="Đóng tab (Ctrl+W)">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>
    ` : ''}
  `;

  tabStrip.appendChild(tabEl);
  lucide.createIcons({ root: tabEl });
}

// Render Iframe for Tab
function renderIframeElement(tab) {
  const container = document.getElementById('workspaceFrames');
  if (!container) return;

  const iframe = document.createElement('iframe');
  iframe.id = `iframe-${tab.id}`;
  iframe.className = 'tab-iframe';
  iframe.src = tab.url;
  iframe.style.display = 'none';

  // Inject key listener forwarding into child iframe after it loads
  iframe.onload = () => {
    try {
      iframe.contentWindow.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && ['t', 'w', 'tab', 'n'].includes(e.key.toLowerCase())) {
          handleShortcutEvent(e);
        }
      });
    } catch (err) {
      // Cross-origin fallback (not needed for local, but safe)
    }
  };

  container.appendChild(iframe);
}

// Activate Tab
function activateTab(tabId) {
  const target = tabs.find(t => t.id === tabId);
  if (!target) return;

  activeTabId = tabId;
  sessionStorage.setItem('nova_active_tab_id', tabId);

  // Update tabs UI
  tabs.forEach(t => {
    const el = document.getElementById(`tab-el-${t.id}`);
    const iframe = document.getElementById(`iframe-${t.id}`);
    if (el) el.classList.toggle('active', t.id === tabId);
    if (iframe) iframe.style.display = (t.id === tabId) ? 'block' : 'none';
  });

  // Scroll tab into view if needed
  const activeEl = document.getElementById(`tab-el-${tabId}`);
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  // Update shell title
  document.title = `${target.title} - NovaOffice Suite`;
}

// Open or switch to a Tab
function openTab({ id, title, type, url, closable = true, activate = true }) {
  // Check if tab already exists by ID or URL
  const existing = tabs.find(t => t.id === id || t.url === url);
  if (existing) {
    if (title && existing.title !== title) {
      updateTabTitle(existing.id, title);
    }
    if (activate) activateTab(existing.id);
    return existing.id;
  }

  const tabId = id || `tab-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newTab = { id: tabId, title: title || 'Tài liệu mới', type: type || 'doc', url, closable };

  tabs.push(newTab);
  renderTabElement(newTab);
  renderIframeElement(newTab);
  saveTabsState();

  if (activate) {
    activateTab(tabId);
  }

  return tabId;
}

// Close a Tab
function closeTab(tabId, event) {
  if (event) event.stopPropagation();

  const tabIndex = tabs.findIndex(t => t.id === tabId);
  if (tabIndex === -1) return;

  const tabToClose = tabs[tabIndex];
  if (!tabToClose.closable) return;

  // Remove DOM elements
  const el = document.getElementById(`tab-el-${tabId}`);
  const iframe = document.getElementById(`iframe-${tabId}`);
  if (el) el.remove();
  if (iframe) iframe.remove();

  // If closing active tab, activate next or previous tab
  if (activeTabId === tabId) {
    const nextTab = tabs[tabIndex - 1] || tabs[tabIndex + 1] || tabs[0];
    if (nextTab) {
      activateTab(nextTab.id);
    }
  }

  tabs.splice(tabIndex, 1);
  saveTabsState();
}

// Update title of tab
function updateTabTitle(tabId, newTitle) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  tab.title = newTitle;
  const titleEl = document.getElementById(`tab-title-${tabId}`);
  if (titleEl) {
    titleEl.textContent = newTitle;
    titleEl.title = newTitle;
  }
  if (activeTabId === tabId) {
    document.title = `${newTitle} - NovaOffice Suite`;
  }
  saveTabsState();
}

// Save tabs list to sessionStorage
function saveTabsState() {
  try {
    const toSave = tabs.filter(t => t.closable).map(t => ({
      id: t.id,
      title: t.title,
      type: t.type,
      url: t.url,
      closable: t.closable
    }));
    sessionStorage.setItem('nova_open_tabs', JSON.stringify(toSave));
  } catch (e) {
    console.warn(e);
  }
}

// Dropdown / Quick Create Menu
function toggleNewTabMenu(show) {
  const menu = document.getElementById('newTabMenu');
  if (!menu) return;
  if (show !== undefined) {
    menu.classList.toggle('hidden', !show);
  } else {
    menu.classList.toggle('hidden');
  }
}

document.addEventListener('click', (e) => {
  const btn = document.getElementById('btnNewTab');
  const menu = document.getElementById('newTabMenu');
  if (menu && !menu.classList.contains('hidden') && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

async function quickCreate(type) {
  toggleNewTabMenu(false);
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
    openTab({
      id: `tab-${type}-${newDoc.id}`,
      title: newDoc.title,
      type: type,
      url: `/${type}?id=${newDoc.id}`,
      closable: true,
      activate: true
    });
  } catch (err) {
    alert('Lỗi khi tạo tài liệu: ' + err.message);
  }
}

function quickOpenHub() {
  toggleNewTabMenu(false);
  activateTab('tab-hub');
}

function quickUploadPdf() {
  toggleNewTabMenu(false);
  const fileInput = document.getElementById('workspacePdfUpload');
  if (fileInput) fileInput.click();
}

async function handleWorkspacePdfUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Tải tệp PDF thất bại');
    const data = await res.json();
    const pdfUrl = `/pdf?file=${encodeURIComponent(data.id || file.name)}`;
    openTab({
      id: `tab-pdf-${Date.now()}`,
      title: file.name,
      type: 'pdf',
      url: pdfUrl,
      closable: true,
      activate: true
    });
  } catch (err) {
    alert('Lỗi tải PDF: ' + err.message);
  } finally {
    e.target.value = '';
  }
}

// Open new OS window
async function openNewWindow() {
  try {
    await fetch('/api/system/open-window', { method: 'POST' });
  } catch (e) {
    // If backend endpoint is busy, fallback to browser window
    window.open('/', '_blank');
  }
}

// Global Keyboard Shortcuts
function setupGlobalShortcuts() {
  window.addEventListener('keydown', handleShortcutEvent);
}

function handleShortcutEvent(e) {
  // Ctrl + T: New Tab Menu
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
    e.preventDefault();
    toggleNewTabMenu();
  }
  // Ctrl + W: Close Active Tab
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
    e.preventDefault();
    if (activeTabId && activeTabId !== 'tab-hub') {
      closeTab(activeTabId);
    }
  }
  // Ctrl + N: Open New Window
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    openNewWindow();
  }
  // Ctrl + Tab: Switch Next Tab
  if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    switchRelativeTab(1);
  }
  // Ctrl + Shift + Tab: Switch Prev Tab
  if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    switchRelativeTab(-1);
  }
}

function switchRelativeTab(direction) {
  if (tabs.length <= 1) return;
  const currentIndex = tabs.findIndex(t => t.id === activeTabId);
  if (currentIndex === -1) return;
  let nextIndex = (currentIndex + direction) % tabs.length;
  if (nextIndex < 0) nextIndex = tabs.length - 1;
  activateTab(tabs[nextIndex].id);
}

// PostMessage Bridge for Communication with Child Iframes
function setupMessageListener() {
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'NOVA_OPEN_TAB':
        openTab({
          id: data.id || `tab-${data.appType || 'doc'}-${Date.now()}`,
          title: data.title || 'Tài liệu',
          type: data.appType || 'doc',
          url: data.url,
          closable: true,
          activate: true
        });
        break;

      case 'NOVA_UPDATE_TAB_TITLE':
        if (activeTabId) {
          updateTabTitle(activeTabId, data.title);
        }
        break;

      case 'NOVA_SWITCH_TAB':
        if (data.tabId && tabs.some(t => t.id === data.tabId)) {
          activateTab(data.tabId);
        } else if (data.tabId === 'tab-hub') {
          activateTab('tab-hub');
        }
        break;

      case 'NOVA_CLOSE_TAB':
        if (data.tabId) closeTab(data.tabId);
        else if (activeTabId) closeTab(activeTabId);
        break;

      case 'NOVA_OPEN_NEW_WINDOW':
        openNewWindow();
        break;
    }
  });
}

// Theme handling
function initTheme() {
  const saved = localStorage.getItem('nova_theme');
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
    updateThemeIcon(true);
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('nova_theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
  // Broadcast theme change to all child iframes
  tabs.forEach(t => {
    const iframe = document.getElementById(`iframe-${t.id}`);
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'NOVA_THEME_CHANGE', isDark }, '*');
    }
  });
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('darkModeIcon');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons({ root: document.getElementById('btnDarkMode') });
  }
}
