/**
 * SmartCapture Popup Logic
 * Localizes interface, manages storage settings, and sends capture commands to active tab.
 */

document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initSettings();
  initModeSelection();
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
    toggleCopy.checked = !!items.autoCopy;
    toggleDownload.checked = !!items.autoDownload;
  });

  toggleCopy.addEventListener('change', () => {
    chrome.storage.sync.set({ autoCopy: toggleCopy.checked });
  });

  toggleDownload.addEventListener('change', () => {
    chrome.storage.sync.set({ autoDownload: toggleDownload.checked });
  });
}

/**
 * Handle mode card click & send message to active tab content script
 */
function initModeSelection() {
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', async () => {
      const mode = card.dataset.mode;
      if (!mode) return;

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id || !tab.url) {
          alert(SmartUtils.t('restrictedPageNotice', 'Bu sayfada ekran görüntüsü alınamaz.'));
          return;
        }

        // Prevent execution on Chrome/Edge internal pages
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
          // Insert CSS first
          chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content/content.css']
          }).catch(err => console.warn("CSS insertion notice:", err));

          // Inject JS content scripts
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

        // Send mode trigger command
        chrome.tabs.sendMessage(tab.id, { action: 'START_MODE', mode }, (response) => {
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
    });
  });
}
