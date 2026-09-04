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
   * Check auto settings (copy/download) and open full-screen Editor Studio in a new tab
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

      // Open in full-screen Editor Studio tab
      chrome.runtime.sendMessage({ action: 'OPEN_EDITOR', dataUrl }, () => {
        SmartUtils.showToast("Görsel Düzenleyici yeni sekmede açılıyor...", "info");
      });
    });
  }

  /**
   * Render Preview Modal with SmartEditor PRO Canvas Annotation tools
   */
  function showPreviewModal(dataUrl) {
    if (previewModalEl) previewModalEl.remove();

    previewModalEl = document.createElement('div');
    previewModalEl.id = 'snapblock-preview-modal';
    previewModalEl.className = 'snapblock-ui-root';

    previewModalEl.innerHTML = `
      <div class="snapblock-modal-backdrop"></div>
      <div class="snapblock-modal-card">
        <div class="snapblock-modal-header">
          <div class="snapblock-modal-title">
            <span class="snapblock-modal-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </span>
            <span>${SmartUtils.t('previewTitle', 'Ekran Görüntüsü Önizleme')}</span>
            <span class="badge-pro" style="margin-left:8px; font-size:9px; background:rgba(6,182,212,0.15); color:#67e8f9; border:1px solid rgba(6,182,212,0.3); padding:1px 5px; border-radius:4px; font-weight:700;">PRO</span>
          </div>

          <!-- PRO Annotation Toolbar -->
          <div class="snapblock-editor-toolbar">
            <button class="snapblock-tool-btn active" data-tool="select" title="Seç (V)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7 18 3-7 7-3L3 3z"/></svg>
            </button>
            <button class="snapblock-tool-btn" data-tool="pen" title="Kalem (P)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
            </button>
            <button class="snapblock-tool-btn" data-tool="arrow" title="Ok (A)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg>
            </button>
            <button class="snapblock-tool-btn" data-tool="rect" title="Kutu (R)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
            </button>
            <button class="snapblock-tool-btn" data-tool="circle" title="Daire (O)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>
            </button>
            <button class="snapblock-tool-btn" data-tool="blur" title="Blur (B)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            </button>
            <button class="snapblock-tool-btn" data-tool="text" title="Yazı (T)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
            </button>
            <button class="snapblock-tool-btn" data-tool="step" title="Adım (N)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8"/></svg>
            </button>
            <button class="snapblock-tool-btn" id="snapblock-tool-undo" title="Geri Al (Ctrl+Z)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
            </button>

            <div class="snapblock-color-picker">
              <div class="snapblock-color-dot active" data-color="#ef4444" style="background:#ef4444;"></div>
              <div class="snapblock-color-dot" data-color="#f59e0b" style="background:#f59e0b;"></div>
              <div class="snapblock-color-dot" data-color="#10b981" style="background:#10b981;"></div>
              <div class="snapblock-color-dot" data-color="#0ea5e9" style="background:#0ea5e9;"></div>
              <div class="snapblock-color-dot" data-color="#ffffff" style="background:#ffffff;"></div>
            </div>
          </div>

          <button id="snapblock-modal-close" class="snapblock-icon-btn" title="Kapat (Esc)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="snapblock-modal-body">
          <div class="snapblock-img-wrapper">
            <canvas id="snapblock-editor-canvas"></canvas>
          </div>
        </div>

        <div class="snapblock-modal-footer">
          <div class="snapblock-modal-info">
            <span id="snapblock-img-dims">${SmartUtils.t('dimensionsLabel', 'Boyut')}: Yükleniyor...</span>
          </div>

          <div class="snapblock-modal-actions">
            <select id="snapblock-export-format" class="snapblock-format-select">
              <option value="image/png">PNG Formatı</option>
              <option value="image/jpeg">JPEG Formatı</option>
              <option value="image/webp">WebP Formatı</option>
            </select>

            <button id="snapblock-btn-copy" class="snapblock-btn snapblock-btn-primary" title="Panoya Kopyala (Ctrl+C)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>${SmartUtils.t('btnCopy', 'Panoya Kopyala')}</span>
            </button>
            <button id="snapblock-btn-download" class="snapblock-btn snapblock-btn-secondary" title="İndir (Ctrl+S)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>${SmartUtils.t('btnDownload', 'İndir')}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(previewModalEl);

    // Initialize PRO Editor Canvas
    const canvasEl = previewModalEl.querySelector('#snapblock-editor-canvas');
    if (window.SmartEditor) {
      SmartEditor.initEditor(canvasEl, dataUrl);
    }

    // Update Dimensions info
    const imgTemp = new Image();
    imgTemp.onload = () => {
      const dimInfo = previewModalEl.querySelector('#snapblock-img-dims');
      dimInfo.textContent = `${SmartUtils.t('dimensionsLabel', 'Boyut')}: ${imgTemp.width} × ${imgTemp.height} px`;
    };
    imgTemp.src = dataUrl;

    // Attach Editor Toolbar Events
    previewModalEl.querySelectorAll('.snapblock-tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        previewModalEl.querySelectorAll('.snapblock-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.SmartEditor) SmartEditor.setTool(btn.dataset.tool);
      });
    });

    previewModalEl.querySelector('#snapblock-tool-undo')?.addEventListener('click', () => {
      if (window.SmartEditor) SmartEditor.undo();
    });

    previewModalEl.querySelectorAll('.snapblock-color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        previewModalEl.querySelectorAll('.snapblock-color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        if (window.SmartEditor) SmartEditor.setColor(dot.dataset.color);
      });
    });

    // Close handlers
    const closeBtn = previewModalEl.querySelector('#snapblock-modal-close');
    const backdrop = previewModalEl.querySelector('.snapblock-modal-backdrop');
    closeBtn.addEventListener('click', () => previewModalEl.remove());
    backdrop.addEventListener('click', () => previewModalEl.remove());

    // Action handlers (Copy & Download with format options)
    const formatSelect = previewModalEl.querySelector('#snapblock-export-format');

    const copyBtn = previewModalEl.querySelector('#snapblock-btn-copy');
    copyBtn.addEventListener('click', async () => {
      const format = formatSelect.value;
      const editedUrl = window.SmartEditor ? SmartEditor.getEditedDataURL(format) : dataUrl;
      const blob = SmartUtils.dataURLToBlob(editedUrl);

      const success = await SmartUtils.copyBlobToClipboard(blob);
      if (success) {
        SmartUtils.showToast(SmartUtils.t('copiedSuccess', 'Panoya kopyalandı!'), 'success');
      } else {
        SmartUtils.showToast("Copy failed", "error");
      }
    });

    const downloadBtn = previewModalEl.querySelector('#snapblock-btn-download');
    downloadBtn.addEventListener('click', () => {
      const format = formatSelect.value;
      const editedUrl = window.SmartEditor ? SmartEditor.getEditedDataURL(format) : dataUrl;
      const blob = SmartUtils.dataURLToBlob(editedUrl);

      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
      const filename = `smartcapture_pro_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.${ext}`;
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
