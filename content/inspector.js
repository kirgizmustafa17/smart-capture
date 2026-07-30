/**
 * SmartCapture Element Block Inspector Module
 * Allows hovering over DOM elements (charts, tables, cards, headers) and capturing exact blocks.
 */

window.SmartInspector = (function () {
  'use strict';

  let isActive = false;
  let currentTarget = null;
  let overlayEl = null;
  let badgeEl = null;
  let onCaptureCallback = null;

  function initOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'snapblock-inspector-overlay';
    overlayEl.className = 'snapblock-ui-root';

    badgeEl = document.createElement('div');
    badgeEl.id = 'snapblock-inspector-badge';
    overlayEl.appendChild(badgeEl);

    document.body.appendChild(overlayEl);
  }

  function start(callback) {
    if (isActive) stop();
    isActive = true;
    onCaptureCallback = callback;

    initOverlay();
    overlayEl.style.display = 'block';

    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll, true);

    SmartUtils.showToast(SmartUtils.t('activeModeNotice', 'Blok seçim modu aktif! (ESC ile iptal)'), 'info');
  }

  function stop() {
    if (!isActive) return;
    isActive = false;
    currentTarget = null;

    if (overlayEl) {
      overlayEl.style.display = 'none';
    }

    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll, true);
  }

  function onScroll() {
    if (isActive && currentTarget) {
      updateOverlay(currentTarget);
    }
  }

  function isExtensionElement(el) {
    if (!el) return true;
    return el.closest && el.closest('.snapblock-ui-root') !== null;
  }

  function onPointerMove(e) {
    if (!isActive) return;

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || isExtensionElement(target) || target === document.documentElement || target === document.body) {
      return;
    }

    currentTarget = target;
    updateOverlay(target);
  }

  function updateOverlay(target) {
    if (!overlayEl || !target) return;

    const rect = target.getBoundingClientRect();
    
    // Ensure element is visible
    if (rect.width === 0 || rect.height === 0) return;

    overlayEl.style.left = `${rect.left}px`;
    overlayEl.style.top = `${rect.top}px`;
    overlayEl.style.width = `${rect.width}px`;
    overlayEl.style.height = `${rect.height}px`;

    const tagStr = SmartUtils.getElementSelector(target);
    const wStr = Math.round(rect.width);
    const hStr = Math.round(rect.height);

    badgeEl.innerHTML = `
      <span class="snapblock-badge-tag">${tagStr}</span>
      <span class="snapblock-badge-dim">${wStr} × ${hStr} px</span>
    `;

    // Position badge smartly so it doesn't get cut off at top of screen
    if (rect.top < 32) {
      badgeEl.style.top = '6px';
      badgeEl.style.bottom = 'auto';
    } else {
      badgeEl.style.top = '-28px';
      badgeEl.style.bottom = 'auto';
    }
  }

  function onClick(e) {
    if (!isActive || !currentTarget) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const targetEl = currentTarget;
    const rect = targetEl.getBoundingClientRect();
    const cropRect = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };

    stop();

    if (onCaptureCallback) {
      onCaptureCallback(cropRect, targetEl);
    }
  }

  function onKeyDown(e) {
    if (!isActive) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      e.stopPropagation();
      stop();
      SmartUtils.showToast(SmartUtils.t('btnCancel', 'İptal edildi'), 'info');
    }
  }

  return {
    start,
    stop,
    isActive: () => isActive
  };
})();
