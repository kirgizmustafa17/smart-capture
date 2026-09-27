/**
 * SmartCapture Freemium & License Architecture
 * Manages Free vs PRO tier status, license validation, and storage sync.
 * Privacy-first: Operates locally with sync storage.
 */

window.SmartLicense = (function () {
  'use strict';

  const STORAGE_KEY_TIER = 'user_tier';
  const STORAGE_KEY_LICENSE = 'pro_license_key';

  // Valid trial / demo license patterns for review and evaluation
  const VALID_PREFIXES = ['PRO-', 'SMART-', 'LIFETIME-'];

  /**
   * Check if a license key string is structurally valid
   */
  function isValidKey(key) {
    if (!key || typeof key !== 'string') return false;
    const cleanKey = key.trim().toUpperCase();
    if (cleanKey.length < 8) return false;
    return VALID_PREFIXES.some(prefix => cleanKey.startsWith(prefix));
  }

  /**
   * Get current license tier ('free' or 'pro')
   * @returns {Promise<{ tier: 'free' | 'pro', isPro: boolean, licenseKey: string | null }>}
   */
  function getLicenseStatus() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
        resolve({ tier: 'free', isPro: false, licenseKey: null });
        return;
      }

      chrome.storage.sync.get([STORAGE_KEY_TIER, STORAGE_KEY_LICENSE], (items) => {
        const storedTier = items[STORAGE_KEY_TIER];
        const storedKey = items[STORAGE_KEY_LICENSE];

        if (storedTier === 'pro' || isValidKey(storedKey)) {
          resolve({ tier: 'pro', isPro: true, licenseKey: storedKey || 'PRO-ACTIVE' });
        } else {
          resolve({ tier: 'free', isPro: false, licenseKey: null });
        }
      });
    });
  }

  /**
   * Activate PRO license with a key
   */
  function activateLicense(key) {
    return new Promise((resolve, reject) => {
      if (!isValidKey(key)) {
        reject(new Error(SmartUtils.t('licenseInvalidError', 'Geçersiz lisans anahtarı. Lütfen "PRO-" ile başlayan anahtarınızı kontrol edin.')));
        return;
      }

      const cleanKey = key.trim().toUpperCase();
      chrome.storage.sync.set({
        [STORAGE_KEY_TIER]: 'pro',
        [STORAGE_KEY_LICENSE]: cleanKey
      }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({ success: true, tier: 'pro', key: cleanKey });
        }
      });
    });
  }

  /**
   * Reset / Deactivate to free tier (useful for testing)
   */
  function deactivateLicense() {
    return new Promise((resolve) => {
      chrome.storage.sync.remove([STORAGE_KEY_TIER, STORAGE_KEY_LICENSE], () => {
        resolve({ success: true, tier: 'free' });
      });
    });
  }

  /**
   * Quick 3-day preview / dev trial activation
   */
  function activateDemoTrial() {
    return activateLicense('PRO-TRIAL-EVALUATION-2026');
  }

  return {
    getLicenseStatus,
    activateLicense,
    deactivateLicense,
    activateDemoTrial,
    isValidKey
  };
})();
