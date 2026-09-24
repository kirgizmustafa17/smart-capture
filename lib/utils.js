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
    return (typeof chrome !== 'undefined' && chrome.i18n?.getMessage?.(key)) || fallback || key;
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
   * Draws a smooth quadratic bezier curve through points on the target 2D context
   */
  function createSmoothPath(ctxTarget, pts, isClosed = false, scale = 1, offsetX = 0, offsetY = 0) {
    if (!pts || pts.length < 2) return;

    ctxTarget.beginPath();
    const startX = (pts[0].x - offsetX) * scale;
    const startY = (pts[0].y - offsetY) * scale;
    ctxTarget.moveTo(startX, startY);

    if (pts.length === 2) {
      ctxTarget.lineTo((pts[1].x - offsetX) * scale, (pts[1].y - offsetY) * scale);
      if (isClosed) ctxTarget.closePath();
      return;
    }

    for (let i = 1; i < pts.length - 1; i++) {
      const curX = (pts[i].x - offsetX) * scale;
      const curY = (pts[i].y - offsetY) * scale;
      const nextX = (pts[i + 1].x - offsetX) * scale;
      const nextY = (pts[i + 1].y - offsetY) * scale;
      ctxTarget.quadraticCurveTo(curX, curY, (curX + nextX) / 2, (curY + nextY) / 2);
    }

    const lastX = (pts[pts.length - 1].x - offsetX) * scale;
    const lastY = (pts[pts.length - 1].y - offsetY) * scale;

    if (isClosed) {
      ctxTarget.quadraticCurveTo(lastX, lastY, startX, startY);
      ctxTarget.closePath();
    } else {
      ctxTarget.lineTo(lastX, lastY);
    }
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
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

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
          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

          tempCtx.imageSmoothingEnabled = true;
          tempCtx.imageSmoothingQuality = 'high';

          createSmoothPath(tempCtx, cropRect.maskPoints, true, dpr, cropRect.x, cropRect.y);
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
   * Convert Data URL to Blob natively
   */
  async function dataURLToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return res.blob();
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
    const iconSvg = type === 'success'
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : type === 'error'
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

    toast.innerHTML = `
      <div class="snapblock-toast-icon">${iconSvg}</div>
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
    createSmoothPath,
    cropImage,
    dataURLToBlob,
    copyBlobToClipboard,
    downloadBlob,
    showToast,
    hideStickyAndFixedElements,
    hideExtensionUI
  };
})();
