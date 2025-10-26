// Enhanced toast, confirm modal, and prompt utilities
(function () {
  const TOAST_DURATION_MS = 3500;
  const MAX_TOASTS = 5;

  function ensureContainers() {
    let toast = document.getElementById('toastContainer');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastContainer';
      toast.className = 'fixed z-50 top-4 right-4 flex flex-col gap-2 max-w-sm';
      toast.setAttribute('aria-live', 'polite');
      toast.setAttribute('aria-atomic', 'true');
      document.body.appendChild(toast);
    }
    
    let modal = document.getElementById('confirmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'confirmModal';
      modal.className = 'hidden fixed inset-0 z-50 flex items-center justify-center p-4';
      modal.innerHTML = `
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" id="modalBackdrop"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md outline-none animate-in" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
          <div class="flex items-start gap-3 mb-4">
            <div id="confirmIcon" class="text-2xl flex-shrink-0"></div>
            <div class="flex-1 min-w-0">
              <h2 id="confirmTitle" class="font-semibold text-lg mb-1"></h2>
              <div id="confirmMessage" class="text-sm text-gray-600 dark:text-gray-400"></div>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button id="confirmCancel" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition">Cancel</button>
            <button id="confirmOk" class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition">OK</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    
    let promptModal = document.getElementById('promptModal');
    if (!promptModal) {
      promptModal = document.createElement('div');
      promptModal.id = 'promptModal';
      promptModal.className = 'hidden fixed inset-0 z-50 flex items-center justify-center p-4';
      promptModal.innerHTML = `
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" id="promptBackdrop"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md outline-none" role="dialog" aria-modal="true">
          <h2 id="promptTitle" class="font-semibold text-lg mb-3"></h2>
          <input type="text" id="promptInput" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
          <div class="flex justify-end gap-2">
            <button id="promptCancel" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500">Cancel</button>
            <button id="promptOk" class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">OK</button>
          </div>
        </div>`;
      document.body.appendChild(promptModal);
    }
  }

  function toast(message, type = 'info', duration = TOAST_DURATION_MS) {
    ensureContainers();
    const container = document.getElementById('toastContainer');
    
    // Limit number of toasts
    while (container.children.length >= MAX_TOASTS) {
      container.firstChild?.remove();
    }
    
    const el = document.createElement('div');
    const base = 'px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-3 max-w-xs animate-in slide-in-from-right';
    
    let icon = '';
    let colorClass = '';
    
    switch (type) {
      case 'error':
        icon = '❌';
        colorClass = 'bg-red-600 text-white';
        break;
      case 'success':
        icon = '✅';
        colorClass = 'bg-green-600 text-white';
        break;
      case 'warning':
        icon = '⚠️';
        colorClass = 'bg-orange-600 text-white';
        break;
      case 'info':
      default:
        icon = 'ℹ️';
        colorClass = 'bg-blue-600 text-white';
        break;
    }
    
    el.className = `${base} ${colorClass}`;
    el.innerHTML = `
      <span class="text-lg flex-shrink-0">${icon}</span>
      <span class="flex-1 min-w-0">${escapeHtml(message)}</span>
      <button class="text-lg hover:opacity-75 flex-shrink-0" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(el);
    
    const timeoutId = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, duration);
    
    // Clear timeout if manually closed
    el.querySelector('button').addEventListener('click', () => clearTimeout(timeoutId));
  }

  function confirmModal(message, options = {}) {
    ensureContainers();
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const backdrop = document.getElementById('modalBackdrop');
      const icon = document.getElementById('confirmIcon');
      const title = document.getElementById('confirmTitle');
      const msg = document.getElementById('confirmMessage');
      const ok = document.getElementById('confirmOk');
      const cancel = document.getElementById('confirmCancel');
      
      const {
        title: titleText = 'Confirm',
        okText = 'OK',
        cancelText = 'Cancel',
        type = 'warning',
        dangerous = false
      } = options;
      
      // Set icon based on type
      const icons = {
        warning: '⚠️',
        danger: '🚨',
        question: '❓',
        info: 'ℹ️'
      };
      icon.textContent = icons[type] || icons.warning;
      
      title.textContent = titleText;
      msg.textContent = message;
      ok.textContent = okText;
      cancel.textContent = cancelText;
      
      // Style OK button based on danger level
      if (dangerous) {
        ok.className = 'px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition';
      } else {
        ok.className = 'px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
      }
      
      modal.classList.remove('hidden');
      setTimeout(() => ok.focus(), 100);
      
      const onKey = (e) => {
        if (e.key === 'Escape') cleanup(false);
        if (e.key === 'Enter' && document.activeElement !== cancel) cleanup(true);
      };
      
      const cleanup = (result) => {
        modal.classList.add('hidden');
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        backdrop.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      };
      
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBackdrop = (e) => {
        if (e.target === backdrop) cleanup(false);
      };
      
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      backdrop.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKey);
    });
  }

  function promptModal(message, defaultValue = '', title = 'Input') {
    ensureContainers();
    return new Promise((resolve) => {
      const modal = document.getElementById('promptModal');
      const backdrop = document.getElementById('promptBackdrop');
      const titleEl = document.getElementById('promptTitle');
      const input = document.getElementById('promptInput');
      const ok = document.getElementById('promptOk');
      const cancel = document.getElementById('promptCancel');
      
      titleEl.textContent = title;
      input.value = defaultValue;
      input.placeholder = message;
      
      modal.classList.remove('hidden');
      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);
      
      const onKey = (e) => {
        if (e.key === 'Escape') cleanup(null);
        if (e.key === 'Enter') cleanup(input.value.trim());
      };
      
      const cleanup = (result) => {
        modal.classList.add('hidden');
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        backdrop.removeEventListener('click', onBackdrop);
        input.removeEventListener('keydown', onKey);
        resolve(result);
      };
      
      const onOk = () => cleanup(input.value.trim());
      const onCancel = () => cleanup(null);
      const onBackdrop = (e) => {
        if (e.target === backdrop) cleanup(null);
      };
      
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      backdrop.addEventListener('click', onBackdrop);
      input.addEventListener('keydown', onKey);
    });
  }

  function loading(message = 'Loading...') {
    ensureContainers();
    const existing = document.getElementById('loadingOverlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
    overlay.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 flex items-center gap-4">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="text-gray-900 dark:text-gray-100">${escapeHtml(message)}</span>
      </div>
    `;
    document.body.appendChild(overlay);
    return () => overlay.remove();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Export utilities
  window.UI = {
    toast,
    confirm: confirmModal,
    prompt: promptModal,
    loading,
    success: (msg) => toast(msg, 'success'),
    error: (msg) => toast(msg, 'error'),
    warning: (msg) => toast(msg, 'warning'),
    info: (msg) => toast(msg, 'info')
  };
})();