/**
 * SmartCapture Popup Logic
 * Localizes interface, manages storage settings, and sends capture commands to active tab.
 * Includes hotkey triggers (1-5) and accessible keyboard navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initSettings();
  initModeSelection();
  initShortcuts();
  initStudioLauncher();
});

/**
 * Localize all DOM elements with data-i18n attribute
 */
function initI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = SmartUtils.t(key);
    if (message) {
      el.textContent = message;
    }
  });
}

/**
 * Initialize storage toggles (autoCopy, autoDownload)
 */
function initSettings() {
  const toggleCopy = document.getElementById('toggle-autocopy');
  const toggleDownload = document.getElementById('toggle-autodownload');

  chrome.storage.sync.get(['autoCopy', 'autoDownload'], (items) => {
    if (toggleCopy) toggleCopy.checked = !!items.autoCopy;
    if (toggleDownload) toggleDownload.checked = !!items.autoDownload;
  });

  if (toggleCopy) {
    toggleCopy.addEventListener('change', () => {
      chrome.storage.sync.set({ autoCopy: toggleCopy.checked });
    });
  }

  if (toggleDownload) {
    toggleDownload.addEventListener('change', () => {
      chrome.storage.sync.set({ autoDownload: toggleDownload.checked });
    });
  }
}

/**
 * Handle mode card click & send message to active tab content script
 */
function initModeSelection() {
  document.querySelectorAll('.mode-card').forEach(card => {
    const triggerCard = () => {
      const mode = card.dataset.mode;
      if (mode) launchMode(mode);
    };

    card.addEventListener('click', triggerCard);

    // Keyboard Enter / Space support
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerCard();
      }
    });
  });
}

/**
 * Direct numerical shortcuts: 1=Block, 2=Area, 3=Freehand, 4=Visible, 5=Fullpage
 */
function initShortcuts() {
  const keyMap = {
    '1': 'BLOCK',
    '2': 'AREA',
    '3': 'FREEHAND',
    '4': 'VISIBLE',
    '5': 'FULLPAGE'
  };

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (keyMap[e.key]) {
      e.preventDefault();
      launchMode(keyMap[e.key]);
    }
  });
}

/**
 * Quick studio launcher
 */
function initStudioLauncher() {
  const btn = document.getElementById('btn-open-studio');
  if (btn) {
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'OPEN_EDITOR' }, () => {
        window.close();
      });
    });
  }
}

/**
 * Orchestrate tab script injection and start requested mode
 */
async function launchMode(mode) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url) {
      alert(SmartUtils.t('restrictedPageNotice', 'Bu sayfada ekran görüntüsü alınamaz.'));
      return;
    }

    // Prevent execution on Chrome/Edge internal system pages
    if (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.includes('chrome.google.com/webstore')
    ) {
      alert(SmartUtils.t('restrictedPageNotice', 'Chrome güvenlik kısıtlaması nedeniyle bu sistem sayfasında ekran görüntüsü alınamaz.'));
      return;
    }

    const injectAndRun = () => {
      chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/content.css']
      }).catch(err => console.warn("CSS insertion notice:", err));

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [
          'lib/utils.js',
          'content/inspector.js',
          'content/area-select.js',
          'content/freehand-select.js',
          'content/full-page.js',
          'content/editor.js',
          'content/content.js'
        ]
      }).then(() => {
        chrome.tabs.sendMessage(tab.id, { action: 'START_MODE', mode });
        window.close();
      }).catch(err => {
        console.error("Script injection failed:", err);
        alert("Lütfen sayfayı yenileyip (F5) tekrar deneyin.");
        window.close();
      });
    };

    chrome.tabs.sendMessage(tab.id, { action: 'START_MODE', mode }, () => {
      if (chrome.runtime.lastError) {
        injectAndRun();
      } else {
        window.close();
      }
    });
  } catch (err) {
    console.error("Popup trigger error:", err);
    window.close();
  }
}
