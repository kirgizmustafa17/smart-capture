/**
 * SmartCapture Main Content Script & Preview Controller
 * Coordinates mode handlers, handles extension messaging, and renders preview modal.
 */

window.SmartContentController = (function () {
  'use strict';

  let previewModalEl = null;

  function init() {
    // Listen for extension popup / context menu / background commands
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'START_MODE') {
        activateMode(request.mode);
        sendResponse({ success: true });
      }
      return true;
    });
  }

  function stopAllModes() {
    SmartInspector.stop();
    SmartAreaSelect.stop();
    SmartFreehandSelect.stop();
  }

  function activateMode(mode) {
    stopAllModes();

    switch (mode) {
      case 'BLOCK':
        SmartInspector.start((cropRect, targetEl) => captureElementBlock(targetEl, cropRect));
        break;
      case 'AREA':
        SmartAreaSelect.start((cropRect) => handleCropCapture(cropRect));
        break;
      case 'FREEHAND':
        SmartFreehandSelect.start((cropRect) => handleCropCapture(cropRect));
        break;
      case 'VISIBLE':
        captureVisiblePart();
        break;
      case 'FULLPAGE':
        SmartFullPage.capture((finalDataUrl) => showPreviewModal(finalDataUrl));
        break;
      default:
        console.warn("Unknown capture mode:", mode);
    }
  }

  /**
   * Captures element block. If element extends beyond viewport, auto-scrolls to stitch full tall block.
   */
  async function captureElementBlock(targetEl, fallbackCropRect) {
    if (!targetEl) {
      return handleCropCapture(fallbackCropRect);
    }

    const rect = targetEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Check if element is completely inside current visible viewport
    const isFullyVisible = (
      rect.top >= 0 &&
      rect.bottom <= viewportHeight &&
      rect.left >= 0 &&
      rect.right <= viewportWidth
    );

    if (isFullyVisible) {
      return handleCropCapture({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      });
    }

    // Element is taller or extends beyond viewport -> Auto-scroll stitch for tall element
    SmartUtils.showToast(SmartUtils.t('modeFullPageDesc', 'Uzun blok otomatik kaydırılarak yakalanıyor...'), 'info', 4000);

    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;

    // Document-level top & left
    const elementPageTop = rect.top + window.scrollY;
    const elementPageLeft = rect.left + window.scrollX;
    const elementWidth = rect.width;
    const elementHeight = rect.height;

    const dpr = SmartUtils.getDPR();
    const stitchedCanvas = document.createElement('canvas');
    stitchedCanvas.width = Math.round(elementWidth * dpr);
    stitchedCanvas.height = Math.round(elementHeight * dpr);
    const ctx = stitchedCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    let currentY = elementPageTop;
    let restoreFixed = null;
    let restoreUI = null;

    try {
      restoreFixed = SmartUtils.hideStickyAndFixedElements(targetEl);
      restoreUI = SmartUtils.hideExtensionUI();

      while (currentY < elementPageTop + elementHeight) {
        window.scrollTo(elementPageLeft, currentY);
        await new Promise(r => setTimeout(r, 250)); // Render delay

        const dataUrl = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, response => {
            if (chrome.runtime.lastError || !response || !response.dataUrl) {
              reject(new Error(chrome.runtime.lastError?.message || "Capture failed"));
            } else {
              resolve(response.dataUrl);
            }
          });
        });

        const curRect = targetEl.getBoundingClientRect();
        const visibleTopInViewport = Math.max(0, curRect.top);
        const visibleBottomInViewport = Math.min(viewportHeight, curRect.bottom);
        const visibleHeight = visibleBottomInViewport - visibleTopInViewport;

        if (visibleHeight > 0) {
          await new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
              const srcX = Math.round(curRect.left * dpr);
              const srcY = Math.round(visibleTopInViewport * dpr);
              const srcW = Math.round(curRect.width * dpr);
              const srcH = Math.round(visibleHeight * dpr);

              const sliceDocY = window.scrollY + visibleTopInViewport;
              const destY = Math.round((sliceDocY - elementPageTop) * dpr);

              if (srcW > 0 && srcH > 0 && destY >= 0) {
                ctx.drawImage(
                  img,
                  srcX, srcY, srcW, srcH,
                  0, destY, srcW, srcH
                );
              }
              resolve();
            };
            img.src = dataUrl;
          });
        }

        currentY += Math.max(100, Math.floor(viewportHeight * 0.8));
      }

      // Restore fixed elements, extension UI and scroll position
      if (restoreFixed) restoreFixed();
      if (restoreUI) restoreUI();
      window.scrollTo(originalScrollX, originalScrollY);

      const finalDataUrl = stitchedCanvas.toDataURL('image/png');
      processCapturedImage(finalDataUrl);
    } catch (err) {
      console.error("Tall element capture error:", err);
      if (restoreFixed) restoreFixed();
      if (restoreUI) restoreUI();
      window.scrollTo(originalScrollX, originalScrollY);
      SmartUtils.showToast("Element capture error: " + err.message, "error");
    }
  }

  /**
   * Captures current visible viewport and crops it to cropRect
   */
  async function handleCropCapture(cropRect) {
    try {
      const restoreUI = SmartUtils.hideExtensionUI();
      await new Promise(r => setTimeout(r, 60));

      chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, async (response) => {
        restoreUI();

        if (chrome.runtime.lastError) {
          SmartUtils.showToast("Capture failed: " + chrome.runtime.lastError.message, "error");
          return;
        }
        if (!response || !response.success || !response.dataUrl) {
          SmartUtils.showToast("Capture failed: " + (response?.error || "No response from extension background"), "error");
          return;
        }

        try {
          const croppedDataUrl = await SmartUtils.cropImage(response.dataUrl, cropRect);
          processCapturedImage(croppedDataUrl);
        } catch (cropErr) {
          console.error("Crop processing error:", cropErr);
          SmartUtils.showToast("Crop error: " + cropErr.message, "error");
        }
      });
    } catch (err) {
      console.error("Handle crop capture failed:", err);
    }
  }

  /**
   * Captures entire visible viewport without cropping
   */
  async function captureVisiblePart() {
    try {
      const restoreUI = SmartUtils.hideExtensionUI();
      await new Promise(r => setTimeout(r, 60));

      chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, (response) => {
        restoreUI();

        if (chrome.runtime.lastError) {
          SmartUtils.showToast("Capture failed: " + chrome.runtime.lastError.message, "error");
          return;
        }
        if (!response || !response.success || !response.dataUrl) {
          SmartUtils.showToast("Capture failed: " + (response?.error || "No response from extension background"), "error");
          return;
        }
        processCapturedImage(response.dataUrl);
      });
    } catch (err) {
      console.error("Capture visible part failed:", err);
    }
  }

  /**
   * Check auto settings (copy/download) and present preview modal
   */
  function processCapturedImage(dataUrl) {
    chrome.storage.sync.get(['autoCopy', 'autoDownload'], (settings) => {
      const blob = SmartUtils.dataURLToBlob(dataUrl);

      if (settings.autoCopy) {
        SmartUtils.copyBlobToClipboard(blob).then(success => {
          if (success) SmartUtils.showToast(SmartUtils.t('copiedSuccess', 'Panoya kopyalandı!'), 'success');
        });
      }

      if (settings.autoDownload) {
        SmartUtils.downloadBlob(blob, `smartcapture_${Date.now()}.png`);
        SmartUtils.showToast(SmartUtils.t('downloadSuccess', 'İndiriliyor...'), 'success');
      }

      showPreviewModal(dataUrl);
    });
  }

  /**
   * Render Preview Modal with image, specs, and actions
   */
  function showPreviewModal(dataUrl) {
    if (previewModalEl) previewModalEl.remove();

    const blob = SmartUtils.dataURLToBlob(dataUrl);

    previewModalEl = document.createElement('div');
    previewModalEl.id = 'snapblock-preview-modal';
    previewModalEl.className = 'snapblock-ui-root';

    previewModalEl.innerHTML = `
      <div class="snapblock-modal-backdrop"></div>
      <div class="snapblock-modal-card">
        <div class="snapblock-modal-header">
          <div class="snapblock-modal-title">
            <span class="snapblock-modal-icon">📷</span>
            <span>${SmartUtils.t('previewTitle', 'Ekran Görüntüsü Önizleme')}</span>
          </div>
          <button id="snapblock-modal-close" class="snapblock-icon-btn">✕</button>
        </div>

        <div class="snapblock-modal-body">
          <div class="snapblock-img-wrapper">
            <img src="${dataUrl}" alt="Captured Screenshot" id="snapblock-preview-img" />
          </div>
        </div>

        <div class="snapblock-modal-footer">
          <div class="snapblock-modal-info">
            <span id="snapblock-img-dims">${SmartUtils.t('dimensionsLabel', 'Boyut')}: Yükleniyor...</span>
          </div>

          <div class="snapblock-modal-actions">
            <button id="snapblock-btn-copy" class="snapblock-btn snapblock-btn-primary">
              <span>📋</span> ${SmartUtils.t('btnCopy', 'Panoya Kopyala')}
            </button>
            <button id="snapblock-btn-download" class="snapblock-btn snapblock-btn-secondary">
              <span>💾</span> ${SmartUtils.t('btnDownload', 'İndir')}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(previewModalEl);

    // Calculate dimensions
    const imgEl = previewModalEl.querySelector('#snapblock-preview-img');
    imgEl.onload = () => {
      const dimInfo = previewModalEl.querySelector('#snapblock-img-dims');
      dimInfo.textContent = `${SmartUtils.t('dimensionsLabel', 'Boyut')}: ${imgEl.naturalWidth} × ${imgEl.naturalHeight} px`;
    };

    // Close handlers
    const closeBtn = previewModalEl.querySelector('#snapblock-modal-close');
    const backdrop = previewModalEl.querySelector('.snapblock-modal-backdrop');
    closeBtn.addEventListener('click', () => previewModalEl.remove());
    backdrop.addEventListener('click', () => previewModalEl.remove());

    // Action handlers
    const copyBtn = previewModalEl.querySelector('#snapblock-btn-copy');
    copyBtn.addEventListener('click', async () => {
      const success = await SmartUtils.copyBlobToClipboard(blob);
      if (success) {
        SmartUtils.showToast(SmartUtils.t('copiedSuccess', 'Panoya kopyalandı!'), 'success');
      } else {
        SmartUtils.showToast("Copy failed", "error");
      }
    });

    const downloadBtn = previewModalEl.querySelector('#snapblock-btn-download');
    downloadBtn.addEventListener('click', () => {
      const filename = `smartcapture_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.png`;
      SmartUtils.downloadBlob(blob, filename);
      SmartUtils.showToast(SmartUtils.t('downloadSuccess', 'İndiriliyor...'), 'success');
    });

    // Escape listener
    const onKey = (e) => {
      if (e.key === 'Escape') {
        previewModalEl.remove();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
  }

  // Auto-init
  init();

  return {
    activateMode
  };
})();
