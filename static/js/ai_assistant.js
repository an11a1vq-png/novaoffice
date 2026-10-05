// Nova AI Assistant Frontend Module (Universal Sidecar Drawer)
let aiHistory = [];
let isAiThinking = false;
let currentAppContext = 'general'; // 'doc', 'sheet', 'slide', 'general'

document.addEventListener('DOMContentLoaded', () => {
  detectAppContext();
  injectAiDrawer();
  checkAiStatus();
});

function detectAppContext() {
  const path = window.location.pathname;
  if (path.includes('doc')) currentAppContext = 'doc';
  else if (path.includes('sheet')) currentAppContext = 'sheet';
  else if (path.includes('slide')) currentAppContext = 'slide';
  else currentAppContext = 'general';
}

function injectAiDrawer() {
  if (document.getElementById('novaAiDrawer')) return;

  const drawerHtml = `
    <!-- Nova AI Backdrop -->
    <div id="novaAiBackdrop" onclick="toggleNovaAi(false)" class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 hidden transition-opacity"></div>

    <!-- Nova AI Sidecar Drawer -->
    <aside id="novaAiDrawer" class="fixed top-0 right-0 h-full w-96 max-w-[92vw] bg-slate-900 text-slate-100 z-50 shadow-2xl flex flex-col transform translate-x-full transition-transform duration-300 ease-in-out border-l border-indigo-500/30">
      <!-- Drawer Header -->
      <div class="px-4 py-3 bg-slate-950/80 border-b border-indigo-500/20 flex items-center justify-between shrink-0">
        <div class="flex items-center space-x-2.5">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 animate-pulse">
            <i data-lucide="sparkles" class="w-4 h-4"></i>
          </div>
          <div>
            <div class="font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400">NOVA AI</div>
            <div class="text-[10px] text-emerald-400 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 100% Cục Bộ (qwen2.5:3b)
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-1">
          <button onclick="clearAiChat()" class="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition" title="Xóa cuộc trò chuyện">
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
          </button>
          <button onclick="toggleNovaAi(false)" class="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition" title="Đóng">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <!-- Quick Action Chips -->
      <div class="px-3 py-2 bg-slate-900 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0" id="aiQuickChips">
        <!-- Rendered based on app context -->
      </div>

      <!-- Chat Messages Container -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" id="aiMessagesContainer">
        <!-- Welcome Message -->
        <div class="flex items-start space-x-2.5">
          <div class="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 text-xs font-bold shadow">
            N
          </div>
          <div class="bg-slate-800/90 border border-slate-700/60 rounded-2xl rounded-tl-none p-3 text-xs leading-relaxed text-slate-200 space-y-2">
            <p>Chào bạn! Tôi là <strong>NOVA AI</strong>, trợ lý trí tuệ nhân tạo cục bộ của bạn.</p>
            <p class="text-slate-400 text-[11px]">Tôi hoạt động 100% offline, có thể giúp bạn soạn thảo, tóm tắt, tạo công thức Excel hoặc sinh dàn ý thuyết trình.</p>
          </div>
        </div>
      </div>

      <!-- Chat Input Footer -->
      <div class="p-3 bg-slate-950/90 border-t border-indigo-500/20 shrink-0">
        <form id="aiChatForm" onsubmit="handleAiChatSubmit(event)" class="relative flex items-center">
          <input 
            type="text" 
            id="aiInputText" 
            placeholder="Hỏi NOVA AI hoặc yêu cầu..." 
            class="w-full pl-3.5 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            autocomplete="off"
          >
          <button 
            type="submit" 
            id="aiSendBtn"
            class="absolute right-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-40"
          >
            <i data-lucide="send" class="w-3.5 h-3.5"></i>
          </button>
        </form>
        <div class="text-[10px] text-slate-500 text-center mt-2 flex items-center justify-center gap-1">
          <i data-lucide="shield-check" class="w-3 h-3 text-emerald-500"></i> Dữ liệu bảo mật tuyệt đối trên máy tính
        </div>
      </div>
    </aside>
  `;

  document.body.insertAdjacentHTML('beforeend', drawerHtml);
  injectAiDownloadModal();
  lucide.createIcons();
  renderQuickChips();
}

function injectAiDownloadModal() {
  if (document.getElementById('aiDownloadModal')) return;

  const modalHtml = `
    <!-- AI Download / Addon Modal -->
    <div id="aiDownloadModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] hidden flex items-center justify-center p-4 select-none">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-fadeIn text-slate-800 dark:text-slate-100">
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <i data-lucide="sparkles" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="font-bold text-base text-slate-900 dark:text-white">Tính Năng Nova AI Copilot</h3>
              <p class="text-xs text-purple-600 dark:text-purple-400 font-medium">Gói mở rộng trí tuệ nhân tạo (Tùy chọn tải riêng)</p>
            </div>
          </div>
          <button onclick="closeAiDownloadModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Description Body -->
        <div class="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            Để giữ file cài đặt <strong>NovaOffice siêu nhẹ (~35MB)</strong> và khởi chạy tức thì, các mô hình trí tuệ nhân tạo nặng (LLM 100% Cục bộ) không được nhúng sẵn bên trong file exe.
          </p>
          <div class="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 p-3.5 rounded-xl space-y-1.5">
            <div class="font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
              <i data-lucide="info" class="w-4 h-4 text-purple-600"></i>
              <span>Trạng thái: Đang hoàn thiện gói cài đặt AI</span>
            </div>
            <p class="text-slate-600 dark:text-slate-400 text-[11px]">
              Tác giả đang cấu hình và hoàn thiện bộ cài đặt mô hình AI ngoại tuyến. Khi hoàn tất, bạn chỉ cần bấm nút tải xuống để tích hợp trực tiếp vào NovaOffice.
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
          <button onclick="openRawAiChat()" class="text-[11px] text-slate-400 hover:text-indigo-400 underline cursor-pointer">
            Máy bạn đã có sẵn Ollama? Mở thử nghiệm
          </button>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <button onclick="closeAiDownloadModal()" class="flex-1 sm:flex-none px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
              Đóng
            </button>
            <button onclick="handleAiDownloadClick()" class="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg shadow transition">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Tải Gói AI (Sắp Ra Mắt)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  lucide.createIcons();
}

function openAiDownloadModal() {
  const modal = document.getElementById('aiDownloadModal');
  if (modal) modal.classList.remove('hidden');
}

function closeAiDownloadModal() {
  const modal = document.getElementById('aiDownloadModal');
  if (modal) modal.classList.add('hidden');
}

function handleAiDownloadClick() {
  showToast('Gói cài đặt Nova AI đang được hoàn thiện và sẽ sớm phát hành!', 'info');
}

function openRawAiChat() {
  closeAiDownloadModal();
  const drawer = document.getElementById('novaAiDrawer');
  const backdrop = document.getElementById('novaAiBackdrop');
  if (!drawer) return;
  drawer.classList.remove('translate-x-full');
  backdrop?.classList.remove('hidden');
}

function toggleNovaAi(open = null) {
  openAiDownloadModal();
}

async function checkAiStatus() {
  try {
    const res = await fetch('/api/ai/status');
    const data = await res.json();
    console.log('[Nova AI Status]:', data);
  } catch (e) {
    console.warn('[Nova AI Status]: Offline');
  }
}

async function handleAiChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('aiInputText');
  const text = input.value.trim();
  if (!text || isAiThinking) return;

  input.value = '';
  await sendAiQuery(text);
}

async function sendAiQuery(query) {
  if (isAiThinking) return;
  toggleNovaAi(true);

  // Append user message
  appendMessage('user', query);
  isAiThinking = true;
  setAiThinkingState(true);

  // Show thinking indicator bubble
  const thinkingId = appendThinkingBubble();

  // Collect current context if in doc/sheet/slide
  let context = "";
  if (currentAppContext === 'doc') {
    const editor = document.getElementById('docEditor');
    if (editor) context = editor.innerText.substring(0, 1000);
  }

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: query,
        history: aiHistory,
        context: context
      })
    });
    
    removeThinkingBubble(thinkingId);

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = `Mã phản hồi ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.detail) errMsg = parsed.detail;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    appendMessage('assistant', data.reply);
  } catch (err) {
    removeThinkingBubble(thinkingId);
    appendMessage('assistant', `⚠️ Lỗi: ${err.message}. Hãy đảm bảo Ollama đang hoạt động trên máy tính.`);
  } finally {
    isAiThinking = false;
    setAiThinkingState(false);
  }
}

function appendThinkingBubble() {
  const container = document.getElementById('aiMessagesContainer');
  if (!container) return null;

  const id = 'thinking-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'flex items-start space-x-2.5 animate-fadeIn';
  div.innerHTML = `
    <div class="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 text-xs font-bold shadow animate-pulse">
      N
    </div>
    <div class="bg-slate-800/90 border border-indigo-500/30 rounded-2xl rounded-tl-none p-3 text-xs text-indigo-300 flex items-center gap-2 shadow">
      <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-indigo-400"></i>
      <span>NOVA AI đang suy nghĩ (mô hình cục bộ)...</span>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons({ root: div });
  return id;
}

function removeThinkingBubble(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function appendMessage(role, text) {
  aiHistory.push({ role, content: text });
  if (aiHistory.length > 16) aiHistory.shift();

  const container = document.getElementById('aiMessagesContainer');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = 'flex items-start space-x-2.5 animate-fadeIn';

  if (role === 'user') {
    msgDiv.innerHTML = `
      <div class="flex-1 flex justify-end">
        <div class="bg-indigo-600 text-white rounded-2xl rounded-tr-none px-3.5 py-2.5 text-xs leading-relaxed max-w-[85%] shadow">
          ${escapeHtml(text)}
        </div>
      </div>
    `;
  } else {
    const escaped = escapeHtml(text).replace(/\n/g, '<br>');
    msgDiv.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 text-xs font-bold shadow">
        N
      </div>
      <div class="bg-slate-800/90 border border-slate-700/60 rounded-2xl rounded-tl-none p-3.5 text-xs leading-relaxed text-slate-200 max-w-[88%] space-y-2.5 shadow">
        <div>${escaped}</div>
        <div class="pt-2 border-t border-slate-700/60 flex items-center gap-2">
          <button onclick="insertAiContentToActiveApp('${encodeURIComponent(text)}')" class="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600/60 hover:bg-indigo-600 text-white text-[10px] font-medium rounded transition">
            <i data-lucide="plus" class="w-3 h-3"></i> Chèn vào tài liệu
          </button>
          <button onclick="copyToClipboard('${encodeURIComponent(text)}')" class="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-medium rounded transition">
            <i data-lucide="copy" class="w-3 h-3"></i> Sao chép
          </button>
        </div>
      </div>
    `;
  }

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons({ root: msgDiv });
}

function setAiThinkingState(thinking) {
  const btn = document.getElementById('aiSendBtn');
  if (!btn) return;
  if (thinking) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i>`;
  }
  lucide.createIcons({ root: btn });
}

function clearAiChat() {
  aiHistory = [];
  const container = document.getElementById('aiMessagesContainer');
  if (container) {
    container.innerHTML = `
      <div class="text-center py-6 text-slate-500 text-xs">
        <i data-lucide="sparkles" class="w-5 h-5 mx-auto mb-1 text-indigo-400/50"></i>
        <span>Đã làm mới cuộc trò chuyện. Hãy hỏi bất cứ điều gì!</span>
      </div>
    `;
    lucide.createIcons({ root: container });
  }
}

// Quick Actions Integration
async function triggerDocAssist(action) {
  openAiDownloadModal();
}

async function triggerSheetFormulaPrompt() {
  openAiDownloadModal();
}

async function triggerSlideGen() {
  openAiDownloadModal();
}

// Insert into active app
function insertAiContentToActiveApp(encodedText) {
  const text = decodeURIComponent(encodedText);
  if (currentAppContext === 'doc') {
    const editor = document.getElementById('docEditor');
    if (editor) {
      editor.focus();
      const p = document.createElement('p');
      p.innerText = text;
      document.execCommand('insertHTML', false, `<p>${text.replace(/\n/g, '<br>')}</p>`);
      showToast('Đã chèn nội dung vào văn bản!');
    }
  } else if (currentAppContext === 'sheet') {
    const bar = document.getElementById('formulaBarInput');
    if (bar) {
      bar.value = text;
      if (typeof handleCellInput === 'function' && window.activeCell) {
        handleCellInput(window.activeCell, text);
        if (typeof refreshAllFormulas === 'function') refreshAllFormulas();
      }
      showToast('Đã chèn vào ô đang chọn!');
    }
  } else if (currentAppContext === 'slide') {
    const slide = window.slideDeck?.slides[window.activeSlideIndex];
    if (slide) {
      slide.content = text;
      if (typeof renderActiveSlide === 'function') renderActiveSlide();
      showToast('Đã chèn vào slide hiện tại!');
    }
  } else {
    copyToClipboard(encodedText);
  }
}

function copyToClipboard(encodedText) {
  const text = decodeURIComponent(encodedText);
  navigator.clipboard.writeText(text).then(() => {
    showToast('Đã sao chép vào bộ nhớ tạm!');
  }).catch(() => {
    showToast('Không thể sao chép!', 'error');
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
