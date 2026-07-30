/**
 * SmartCapture Rectangle Area Selection Module
 * Drag & select rectangular regions with live dimensions, resize handles, and action buttons.
 */

window.SmartAreaSelect = (function () {
  'use strict';

  let isActive = false;
  let isDragging = false;
  let isResizing = false;
  let activeHandle = null;

  let startX = 0, startY = 0;
  let rectX = 0, rectY = 0, rectW = 0, rectH = 0;

  let backdropEl = null;
  let boxEl = null;
  let toolbarEl = null;
  let dimBadgeEl = null;
  let onCaptureCallback = null;

  function initUI() {
    if (backdropEl) return;

    backdropEl = document.createElement('div');
    backdropEl.id = 'snapblock-area-backdrop';
    backdropEl.className = 'snapblock-ui-root';

    boxEl = document.createElement('div');
    boxEl.id = 'snapblock-area-box';

    // Resize Handles
    const handles = ['tl', 'tc', 'tr', 'cl', 'cr', 'bl', 'bc', 'br'];
    handles.forEach(h => {
      const handleEl = document.createElement('div');
      handleEl.className = `snapblock-area-handle snapblock-handle-${h}`;
      handleEl.dataset.handle = h;
      boxEl.appendChild(handleEl);
    });

    dimBadgeEl = document.createElement('div');
    dimBadgeEl.id = 'snapblock-area-badge';
    boxEl.appendChild(dimBadgeEl);

    // Floating action bar
    toolbarEl = document.createElement('div');
    toolbarEl.id = 'snapblock-area-toolbar';
    toolbarEl.innerHTML = `
      <button id="snapblock-area-confirm-btn" class="snapblock-btn snapblock-btn-primary">
        <span>✓</span> ${SmartUtils.t('btnConfirm', 'Yakala')}
      </button>
      <button id="snapblock-area-cancel-btn" class="snapblock-btn snapblock-btn-secondary">
        <span>✕</span> ${SmartUtils.t('btnCancel', 'İptal')}
      </button>
    `;
    boxEl.appendChild(toolbarEl);

    backdropEl.appendChild(boxEl);
    document.body.appendChild(backdropEl);

    // Event handlers for action buttons
    toolbarEl.querySelector('#snapblock-area-confirm-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmSelection();
    });

    toolbarEl.querySelector('#snapblock-area-cancel-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      stop();
    });
  }

  function start(callback) {
    if (isActive) stop();
    isActive = true;
    onCaptureCallback = callback;

    initUI();
    resetState();

    backdropEl.style.display = 'block';
    boxEl.style.display = 'none';

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('keydown', onKeyDown, true);

    SmartUtils.showToast(SmartUtils.t('activeModeNotice', 'Dörtgen seçim modu! Sürükleyerek alan seçin.'), 'info');
  }

  function stop() {
    if (!isActive) return;
    isActive = false;
    isDragging = false;
    isResizing = false;

    if (backdropEl) {
      backdropEl.style.display = 'none';
    }

    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function resetState() {
    rectX = 0; rectY = 0; rectW = 0; rectH = 0;
    toolbarEl.style.display = 'none';
  }

  function updateBoxDOM() {
    boxEl.style.display = 'block';
    boxEl.style.left = `${rectX}px`;
    boxEl.style.top = `${rectY}px`;
    boxEl.style.width = `${rectW}px`;
    boxEl.style.height = `${rectH}px`;

    dimBadgeEl.textContent = `${Math.round(rectW)} × ${Math.round(rectH)} px`;

    // Smart Action Toolbar positioning based on screen viewport boundaries
    const spaceBelow = window.innerHeight - (rectY + rectH);
    const spaceRight = window.innerWidth - (rectX + rectW);

    if (spaceBelow < 50) {
      if (rectH >= 55) {
        // Place toolbar inside bottom-right corner of selection box
        toolbarEl.style.top = 'auto';
        toolbarEl.style.bottom = '10px';
      } else {
        // Selection box is thin -> place above selection box
        toolbarEl.style.top = '-44px';
        toolbarEl.style.bottom = 'auto';
      }
    } else {
      // Default: place below selection box
      toolbarEl.style.top = 'auto';
      toolbarEl.style.bottom = '-44px';
    }

    if (spaceRight < 10) {
      toolbarEl.style.right = '10px';
    } else {
      toolbarEl.style.right = '0px';
    }
  }

  function onPointerDown(e) {
    if (!isActive) return;

    // Check if clicking resize handle
    if (e.target.classList.contains('snapblock-area-handle')) {
      isResizing = true;
      activeHandle = e.target.dataset.handle;
      startX = e.clientX;
      startY = e.clientY;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Check if clicking confirm/cancel button
    if (e.target.closest('#snapblock-area-toolbar')) {
      return;
    }

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    rectX = startX;
    rectY = startY;
    rectW = 0;
    rectH = 0;

    toolbarEl.style.display = 'none';
    updateBoxDOM();

    e.preventDefault();
    e.stopPropagation();
  }

  function onPointerMove(e) {
    if (!isActive) return;

    if (isDragging) {
      const curX = e.clientX;
      const curY = e.clientY;

      rectX = Math.min(startX, curX);
      rectY = Math.min(startY, curY);
      rectW = Math.abs(curX - startX);
      rectH = Math.abs(curY - startY);

      updateBoxDOM();
    } else if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (activeHandle.includes('r')) rectW = Math.max(20, rectW + dx);
      if (activeHandle.includes('b')) rectH = Math.max(20, rectH + dy);
      if (activeHandle.includes('l')) {
        const nw = Math.max(20, rectW - dx);
        rectX += (rectW - nw);
        rectW = nw;
      }
      if (activeHandle.includes('t')) {
        const nh = Math.max(20, rectH - dy);
        rectY += (rectH - nh);
        rectH = nh;
      }

      startX = e.clientX;
      startY = e.clientY;

      updateBoxDOM();
    }
  }

  function onPointerUp(e) {
    if (!isActive) return;

    if (isDragging || isResizing) {
      isDragging = false;
      isResizing = false;

      if (rectW > 10 && rectH > 10) {
        toolbarEl.style.display = 'flex';
      }
    }
  }

  function confirmSelection() {
    if (rectW <= 0 || rectH <= 0) return;

    const cropRect = {
      x: rectX,
      y: rectY,
      width: rectW,
      height: rectH
    };

    stop();

    if (onCaptureCallback) {
      onCaptureCallback(cropRect);
    }
  }

  function onKeyDown(e) {
    if (!isActive) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      stop();
      SmartUtils.showToast(SmartUtils.t('btnCancel', 'İptal edildi'), 'info');
    } else if (e.key === 'Enter' && rectW > 0 && rectH > 0) {
      e.preventDefault();
      confirmSelection();
    }
  }

  return {
    start,
    stop,
    isActive: () => isActive
  };
})();
