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
  if (!url) return true;
  const u = url.toLowerCase();
  return (
    u.startsWith('chrome://') ||
    u.startsWith('edge://') ||
    u.startsWith('brave://') ||
    u.startsWith('opera://') ||
    u.startsWith('chrome-extension://') ||
    u.startsWith('chrome-search://') ||
    u.startsWith('chrome-untrusted://') ||
    u.startsWith('devtools://') ||
    u.startsWith('view-source:') ||
    u.startsWith('about:') ||
    u.includes('chromewebstore.google.com') ||
    u.includes('chrome.google.com/webstore')
  );
}

async function canCaptureUrl(url) {
  if (isRestrictedUrl(url)) {
    return {
      allowed: false,
      reason: "Chrome güvenlik kısıtlaması nedeniyle bu sistem sayfasında (ör. Chrome Web Mağazası, Yeni Sekme veya chrome://) ekran görüntüsü alınamaz."
    };
  }

  if (url && url.toLowerCase().startsWith('file://')) {
    const isAllowed = await new Promise((resolve) => {
      if (chrome.extension && chrome.extension.isAllowedFileSchemeAccess) {
        chrome.extension.isAllowedFileSchemeAccess(resolve);
      } else {
        resolve(false);
      }
    });

    if (!isAllowed) {
      return {
        allowed: false,
        reason: "Yerel dosyalarda (file://) ekran görüntüsü alabilmek için chrome://extensions sayfasında SmartCapture ayrıntılarına giderek 'Dosya URL\\'lerine erişime izin ver' seçeneğini etkinleştirmelisiniz."
      };
    }
  }

  return { allowed: true };
}

async function triggerModeOnTab(tabId, tabUrl, mode) {
  const check = await canCaptureUrl(tabUrl);
  if (!check.allowed) {
    throw new Error(check.reason);
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
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id || !info.menuItemId.startsWith('mode_')) return;
  const mode = info.menuItemId.replace('mode_', '');
  try {
    if (typeof tab.windowId === 'number') {
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
    }
    await triggerModeOnTab(tab.id, tab.url, mode);
  } catch (err) {
    console.warn("Context menu trigger:", err.message);
  }
});

// Handle screenshot capture and mode messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_MODE') {
    (async () => {
      try {
        let tabId = message.tabId;
        let tabUrl = message.tabUrl;
        let windowId = message.windowId;

        if (!tabId) {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (!tab || !tab.id) {
            sendResponse({ success: false, error: 'Aktif sekme bulunamadı.' });
            return;
          }
          tabId = tab.id;
          tabUrl = tab.url;
          windowId = tab.windowId;
        }

        if (typeof windowId === 'number') {
          await chrome.windows.update(windowId, { focused: true }).catch(() => {});
        }

        await triggerModeOnTab(tabId, tabUrl, message.mode);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
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
        const rawError = chrome.runtime.lastError.message || '';
        console.warn("captureVisibleTab warning:", rawError);
        let friendlyError = rawError;
        if (rawError.includes("Cannot access contents") || rawError.includes("permission to access the respective host")) {
          friendlyError = "Chrome güvenlik politikası nedeniyle bu sayfanın görseli yakalanamıyor (Sistem sayfası, korumalı açılır pencere veya yerel dosya izni kapalı).";
        }
        sendResponse({ success: false, error: friendlyError });
      } else if (!dataUrl) {
        sendResponse({ success: false, error: "Tarayıcıdan boş ekran görüntüsü döndü." });
      } else {
        sendResponse({ success: true, dataUrl });
      }
    };

    (async () => {
      try {
        let winId = (sender.tab && typeof sender.tab.windowId === 'number') ? sender.tab.windowId : null;
        if (winId !== null) {
          await chrome.windows.update(winId, { focused: true }).catch(() => {});
          chrome.tabs.captureVisibleTab(winId, options, handleResult);
        } else {
          const win = await chrome.windows.getLastFocused().catch(() => null);
          if (win && typeof win.id === 'number') {
            await chrome.windows.update(win.id, { focused: true }).catch(() => {});
            chrome.tabs.captureVisibleTab(win.id, options, handleResult);
          } else {
            chrome.tabs.captureVisibleTab(options, handleResult);
          }
        }
      } catch (err) {
        console.warn("captureVisibleTab exception:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true; // Keep message channel open for async response
  }
});
