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
  initLicenseStatus();
  checkCurrentTab();
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
 * Proactively check active tab and warn user if page is restricted
 */
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && SmartUtils.isRestrictedUrl(tab.url)) {
      showRestrictedBanner(tab.url);
    }
  } catch (err) {
    console.warn("Active tab check notice:", err);
  }
}

/**
 * Request background service worker to launch capture mode on active tab
 */
async function launchMode(mode) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showRestrictedBanner(null, 'Aktif sekme bulunamadı.');
      return;
    }

    if (SmartUtils.isRestrictedUrl(tab.url)) {
      showRestrictedBanner(tab.url);
      return;
    }

    chrome.runtime.sendMessage({
      action: 'START_MODE',
      mode,
      tabId: tab.id,
      windowId: tab.windowId,
      tabUrl: tab.url
    }, (response) => {
      if (chrome.runtime.lastError || response?.error) {
        const errorMsg = chrome.runtime.lastError?.message || response?.error;
        showRestrictedBanner(tab.url, errorMsg);
      } else {
        window.close();
      }
    });
  } catch (err) {
    showRestrictedBanner(null, err.message);
  }
}

/**
 * Displays visual notice explaining why screenshots are not permitted on this tab
 */
function showRestrictedBanner(url, customMessage) {
  const banner = document.getElementById('popup-restricted-banner');
  const bannerText = document.getElementById('restricted-banner-text');
  if (!banner || !bannerText) return;

  const msg = customMessage || SmartUtils.getRestrictedNotice(url);
  bannerText.textContent = msg;
  banner.style.display = 'flex';
}

/**
 * Check and reflect license status on popup chip
 */
function initLicenseStatus() {
  const proChip = document.getElementById('popup-pro-chip');
  if (!proChip || !window.SmartLicense) return;

  SmartLicense.getLicenseStatus().then(status => {
    if (status.isPro) {
      proChip.classList.add('is-pro');
      proChip.textContent = 'PRO ✓';
    } else {
      proChip.classList.remove('is-pro');
      proChip.textContent = 'PRO';
    }
  });

  proChip.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'OPEN_EDITOR' }, () => {
      window.close();
    });
  });
}

