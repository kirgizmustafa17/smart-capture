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
      title: 'SmartCapture PRO',
      contexts: ['all']
    });

    // Submenu options
    chrome.contextMenus.create({
      parentId: 'smartcapture_parent',
      id: 'mode_BLOCK',
      title: 'Blok / Öğe Seçimi (Element)',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      parentId: 'smartcapture_parent',
      id: 'mode_AREA',
      title: 'Dörtgen Alan Seçimi (Rectangle)',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      parentId: 'smartcapture_parent',
      id: 'mode_FREEHAND',
      title: 'Serbest Çizim (Freehand Lasso)',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      parentId: 'smartcapture_parent',
      id: 'mode_VISIBLE',
      title: 'Görünen Bölgeyi Yakala (Visible)',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      parentId: 'smartcapture_parent',
      id: 'mode_FULLPAGE',
      title: 'Tüm Sayfayı Yakala (Full Page)',
      contexts: ['all']
    });
  });
}

function isRestrictedUrl(url) {
  return !url ||
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('chrome-extension://') ||
    url.includes('chrome.google.com/webstore');
}

async function triggerModeOnTab(tabId, tabUrl, mode) {
  if (isRestrictedUrl(tabUrl)) {
    throw new Error("Restricted system page");
  }

  try {
    await chrome.tabs.sendMessage(tabId, { action: 'START_MODE', mode });
  } catch (e) {
    // Inject scripts on demand and trigger mode
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/content.css']
    }).catch(err => console.warn("CSS insertion notice:", err));

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'lib/utils.js',
        'content/inspector.js',
        'content/area-select.js',
        'content/freehand-select.js',
        'content/full-page.js',
        'content/content.js'
      ]
    });

    await chrome.tabs.sendMessage(tabId, { action: 'START_MODE', mode });
  }
}

// Listen for Right-Click Context Menu item clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id || !info.menuItemId.startsWith('mode_')) return;
  const mode = info.menuItemId.replace('mode_', '');
  triggerModeOnTab(tab.id, tab.url, mode).catch(err => console.warn("Context menu trigger:", err));
});

// Handle screenshot capture and mode messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_MODE') {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (!tab || !tab.id) {
        sendResponse({ success: false, error: 'No active tab' });
        return;
      }
      try {
        await triggerModeOnTab(tab.id, tab.url, message.mode);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  if (message.action === 'OPEN_EDITOR') {
    if (message.dataUrl) {
      chrome.storage.local.set({ pendingScreenshot: message.dataUrl }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('editor/editor.html') });
        sendResponse({ success: true });
      });
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('editor/editor.html') });
      sendResponse({ success: true });
    }
    return true;
  }

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
