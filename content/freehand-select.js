/**
 * SmartCapture Freehand Lasso Selection Module
 * Draw arbitrary shapes with glowing stroke to capture custom clipped regions.
 */

window.SmartFreehandSelect = (function () {
  'use strict';

  let isActive = false;
  let isDrawing = false;
  let points = [];

  let overlayEl = null;
  let canvasEl = null;
  let ctx = null;
  let hintBadgeEl = null;
  let onCaptureCallback = null;

  function initCanvas() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'snapblock-freehand-overlay';
    overlayEl.className = 'snapblock-ui-root';

    canvasEl = document.createElement('canvas');
    canvasEl.id = 'snapblock-freehand-canvas';
    overlayEl.appendChild(canvasEl);

    hintBadgeEl = document.createElement('div');
    hintBadgeEl.id = 'snapblock-freehand-badge';
    hintBadgeEl.textContent = SmartUtils.t('modeFreehandDesc', 'Serbest çizim yaparak bölge seçin.');
    overlayEl.appendChild(hintBadgeEl);

    document.body.appendChild(overlayEl);
  }

  function resizeCanvas() {
    if (!canvasEl) return;
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = window.innerWidth * dpr;
    canvasEl.height = window.innerHeight * dpr;
    canvasEl.style.width = `${window.innerWidth}px`;
    canvasEl.style.height = `${window.innerHeight}px`;

    ctx = canvasEl.getContext('2d');
    ctx.scale(dpr, dpr);
  }

  function start(callback) {
    if (isActive) stop();
    isActive = true;
    onCaptureCallback = callback;

    initCanvas();
    resizeCanvas();

    points = [];
    overlayEl.style.display = 'block';

    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('keydown', onKeyDown, true);

    SmartUtils.showToast(SmartUtils.t('activeModeNotice', 'Serbest çizim modu aktif!'), 'info');
  }

  function stop() {
    if (!isActive) return;
    isActive = false;
    isDrawing = false;

    if (overlayEl) {
      overlayEl.style.display = 'none';
    }

    window.removeEventListener('resize', resizeCanvas);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function redraw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (points.length < 2) return;

    // Semi-transparent backdrop outside path
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // Cut out smooth path from backdrop
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    SmartUtils.createSmoothPath(ctx, points, true, 1, 0, 0);
    ctx.fill();
    ctx.restore();

    // Draw glowing cyan smooth border line ONLY along drawn stroke (isClosed = false)
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 10;

    SmartUtils.createSmoothPath(ctx, points, false, 1, 0, 0);
    ctx.stroke();
  }

  function onPointerDown(e) {
    if (!isActive) return;

    isDrawing = true;
    points = [{ x: e.clientX, y: e.clientY }];
    hintBadgeEl.style.display = 'none';

    e.preventDefault();
    e.stopPropagation();
  }

  function onPointerMove(e) {
    if (!isActive || !isDrawing) return;

    points.push({ x: e.clientX, y: e.clientY });
    redraw();
  }

  function onPointerUp(e) {
    if (!isActive || !isDrawing) return;
    isDrawing = false;

    if (points.length < 5) {
      points = [];
      redraw();
      hintBadgeEl.style.display = 'block';
      return;
    }

    // Calculate bounding box of points
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    points.forEach(pt => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });

    const cropRect = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      maskPoints: points
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
    }
  }

  return {
    start,
    stop,
    isActive: () => isActive
  };
})();
