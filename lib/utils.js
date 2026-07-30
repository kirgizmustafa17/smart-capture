/**
 * SmartCapture Utility Library
 * Clean modular helpers for canvas operations, DPR scaling, i18n, and clipboard.
 */

window.SmartUtils = (function () {
  'use strict';

  /**
   * Safe i18n wrapper
   */
  function t(key, fallback = '') {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
        const msg = chrome.i18n.getMessage(key);
        if (msg) return msg;
      }
    } catch (e) {
      // Fallback if i18n context unavailable
    }
    return fallback || key;
  }

  /**
   * Device Pixel Ratio helper
   */
  function getDPR() {
    return window.devicePixelRatio || 1;
  }

  /**
   * Formats selector display string for DOM inspector badge
   * e.g., "div.chart-box#main-chart"
   */
  function getElementSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
    let name = el.tagName.toLowerCase();
    if (el.id) {
      name += `#${el.id}`;
    } else if (el.className && typeof el.className === 'string') {
      const classes = el.className
        .trim()
        .split(/\s+/)
        .filter(c => c && !c.startsWith('snapblock-'))
        .slice(0, 2)
        .join('.');
      if (classes) name += `.${classes}`;
    }
    return name;
  }

  /**
   * Crop base64 image data URL according to cropRect { x, y, width, height }
   * Accounts for devicePixelRatio (High DPI / Retina displays)
   */
  function cropImage(dataUrl, cropRect) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const dpr = getDPR();
        
        // Calculate target dimensions in physical image pixels
        const sourceX = Math.round(cropRect.x * dpr);
        const sourceY = Math.round(cropRect.y * dpr);
        const sourceW = Math.round(cropRect.width * dpr);
        const sourceH = Math.round(cropRect.height * dpr);

        if (sourceW <= 0 || sourceH <= 0) {
          reject(new Error("Invalid crop rectangle size"));
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = sourceW;
        canvas.height = sourceH;
        const ctx = canvas.getContext('2d');

        // Draw cropped section with high image smoothing quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceW, sourceH,
          0, 0, sourceW, sourceH
        );

        // Apply smooth curved path mask if maskPoints is provided (for Freehand Lasso)
        if (cropRect.maskPoints && cropRect.maskPoints.length > 2) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = sourceW;
          tempCanvas.height = sourceH;
          const tempCtx = tempCanvas.getContext('2d');

          tempCtx.imageSmoothingEnabled = true;
          tempCtx.imageSmoothingQuality = 'high';

          const pts = cropRect.maskPoints;
          tempCtx.beginPath();
          const startX = (pts[0].x - cropRect.x) * dpr;
          const startY = (pts[0].y - cropRect.y) * dpr;
          tempCtx.moveTo(startX, startY);

          for (let i = 1; i < pts.length - 1; i++) {
            const curX = (pts[i].x - cropRect.x) * dpr;
            const curY = (pts[i].y - cropRect.y) * dpr;
            const nextX = (pts[i + 1].x - cropRect.x) * dpr;
            const nextY = (pts[i + 1].y - cropRect.y) * dpr;
            const midX = (curX + nextX) / 2;
            const midY = (curY + nextY) / 2;
            tempCtx.quadraticCurveTo(curX, curY, midX, midY);
          }

          const lastX = (pts[pts.length - 1].x - cropRect.x) * dpr;
          const lastY = (pts[pts.length - 1].y - cropRect.y) * dpr;
          tempCtx.quadraticCurveTo(lastX, lastY, startX, startY);
          tempCtx.closePath();

          tempCtx.clip();
          tempCtx.drawImage(canvas, 0, 0);
          resolve(tempCanvas.toDataURL('image/png'));
          return;
        }

        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = (err) => reject(err);
      img.src = dataUrl;
    });
  }

  /**
   * Convert Data URL to Blob
   */
  function dataURLToBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Copy Blob image to system clipboard
   */
  async function copyBlobToClipboard(blob) {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) {
        throw new Error("Clipboard API not supported");
      }
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      return true;
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      return false;
    }
  }

  /**
   * Trigger direct file download
   */
  function downloadBlob(blob, filename = 'smartcapture.png') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /**
   * Displays floating toast alert on bottom right
   */
  function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('snapblock-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'snapblock-toast-container';
      container.className = 'snapblock-ui-root';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `snapblock-toast snapblock-toast-${type}`;
    toast.innerHTML = `
      <div class="snapblock-toast-icon">
        ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
      </div>
      <div class="snapblock-toast-msg">${message}</div>
    `;

    container.appendChild(toast);

    // Trigger animate-in
    requestAnimationFrame(() => {
      toast.classList.add('snapblock-toast-show');
    });

    setTimeout(() => {
      toast.classList.remove('snapblock-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Temporarily moves position:fixed and position:sticky elements off-screen during scroll capture
   */
  function hideStickyAndFixedElements(exceptElement = null) {
    const hiddenElements = [];
    const allEls = document.querySelectorAll('*');

    allEls.forEach(el => {
      // Ignore extension UI elements
      if (el.closest && el.closest('.snapblock-ui-root')) return;
      // Do not hide target element or its ancestors/descendants
      if (exceptElement) {
        if (el === exceptElement || exceptElement.contains(el) || el.contains(exceptElement)) return;
      }

      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky') {
        hiddenElements.push({
          element: el,
          originalTransform: el.style.getPropertyValue('transform'),
          originalTransformPriority: el.style.getPropertyPriority('transform'),
          originalOpacity: el.style.getPropertyValue('opacity'),
          originalOpacityPriority: el.style.getPropertyPriority('opacity')
        });

        el.style.setProperty('transform', 'translateY(-10000px)', 'important');
        el.style.setProperty('opacity', '0', 'important');
      }
    });

    return function restore() {
      hiddenElements.forEach(({ element, originalTransform, originalTransformPriority, originalOpacity, originalOpacityPriority }) => {
        if (originalTransform) {
          element.style.setProperty('transform', originalTransform, originalTransformPriority);
        } else {
          element.style.removeProperty('transform');
        }
        if (originalOpacity) {
          element.style.setProperty('opacity', originalOpacity, originalOpacityPriority);
        } else {
          element.style.removeProperty('opacity');
        }
      });
    };
  }

  /**
   * Temporarily hides all extension UI elements (.snapblock-ui-root) during screenshot captures
   */
  function hideExtensionUI() {
    const hiddenElements = [];
    const uiEls = document.querySelectorAll('.snapblock-ui-root');

    uiEls.forEach(el => {
      if (el.id === 'snapblock-preview-modal') return;

      hiddenElements.push({
        element: el,
        originalDisplay: el.style.display
      });
      el.style.display = 'none';
    });

    return function restore() {
      hiddenElements.forEach(({ element, originalDisplay }) => {
        element.style.display = originalDisplay;
      });
    };
  }

  return {
    t,
    getDPR,
    getElementSelector,
    cropImage,
    dataURLToBlob,
    copyBlobToClipboard,
    downloadBlob,
    showToast,
    hideStickyAndFixedElements,
    hideExtensionUI
  };
})();
