/**
 * SmartCapture Background Service Worker
 * Handles tab screenshot capture requests, context menus, and extension communication.
 */

// Initialize Right-Click Context Menus on extension install or update
chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // Main parent menu
    chrome.contextMenus.create({
      id: 'smartcapture_parent',
      title: 'SmartCapture - Ekran Görüntüsü',
      contexts: ['all']
    });

    // Submenu options
    chrome.contextMenus.create({
      parentId: 'smartcapture_parent',
      id: 'mode_BLOCK',
      title: '🎯 Blok / Öğe Seçimi',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      parentId: 'smartcapture_parent',
      id: 'mode_AREA',
      title: '📐 Dörtgen Alan Seçimi',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      parentId: 'smartcapture_parent',
      id: 'mode_FREEHAND',
      title: '✏️ Serbest Çizim (Lasso)',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      parentId: 'smartcapture_parent',
      id: 'mode_VISIBLE',
      title: '👁️ Görünen Bölgeyi Yakala',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      parentId: 'smartcapture_parent',
      id: 'mode_FULLPAGE',
      title: '📜 Tüm Sayfayı Yakala',
      contexts: ['all']
    });
  });
}

// Listen for Right-Click Context Menu item clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id || !tab.url) return;

  // Prevent running on restricted system pages
  if (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.includes('chrome.google.com/webstore')
  ) {
    console.warn("SmartCapture cannot run on restricted system pages.");
    return;
  }

  if (info.menuItemId.startsWith('mode_')) {
    const mode = info.menuItemId.replace('mode_', '');

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
          'content/content.js'
        ]
      }).then(() => {
        chrome.tabs.sendMessage(tab.id, { action: 'START_MODE', mode });
      }).catch(err => console.error("Script injection failed:", err));
    };

    // Try sending message to tab content script first
    chrome.tabs.sendMessage(tab.id, { action: 'START_MODE', mode }, (response) => {
      if (chrome.runtime.lastError) {
        injectAndRun();
      }
    });
  }
});

// Handle screenshot capture messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'CAPTURE_VISIBLE_TAB') {
    const options = { format: 'png', quality: 100 };

    const handleResult = (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error("captureVisibleTab error:", chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else if (!dataUrl) {
        sendResponse({ success: false, error: "Empty screenshot returned by browser" });
      } else {
        sendResponse({ success: true, dataUrl });
      }
    };

    try {
      if (sender.tab && typeof sender.tab.windowId === 'number') {
        chrome.tabs.captureVisibleTab(sender.tab.windowId, options, handleResult);
      } else {
        chrome.tabs.captureVisibleTab(options, handleResult);
      }
    } catch (err) {
      console.error("captureVisibleTab exception:", err);
      sendResponse({ success: false, error: err.message });
    }

    return true; // Keep message channel open for async response
  }
});
