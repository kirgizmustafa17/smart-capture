/**
 * SmartCapture PRO Canvas Annotation & Blur Editor
 * Interactive drawing tools: Arrow, Highlight Rectangle, Blur/Mosaic, Text, and Color Picker.
 */

window.SmartEditor = (function () {
  'use strict';

  let currentTool = 'select'; // select, arrow, rect, blur, text
  let currentColor = '#ef4444'; // default red
  let activeCanvas = null;
  let activeCtx = null;
  let isDrawing = false;
  let startX = 0, startY = 0;
  let snapshotImgData = null; // Original image state

  const annotationsHistory = [];

  function initEditor(canvasElement, imageSrc, onUpdatedCallback) {
    activeCanvas = canvasElement;
    activeCtx = activeCanvas.getContext('2d', { willReadFrequently: true });
    annotationsHistory.length = 0;

    const img = new Image();
    img.onload = () => {
      activeCanvas.width = img.width;
      activeCanvas.height = img.height;
      activeCtx.drawImage(img, 0, 0);

      // Save base image state
      snapshotImgData = activeCtx.getImageData(0, 0, img.width, img.height);
      saveState();
    };
    img.src = imageSrc;

    attachEvents();
  }

  function setTool(toolName) {
    currentTool = toolName;
  }

  function setColor(colorHex) {
    currentColor = colorHex;
  }

  function saveState() {
    if (!activeCtx || !activeCanvas) return;
    annotationsHistory.push(activeCtx.getImageData(0, 0, activeCanvas.width, activeCanvas.height));
  }

  function undo() {
    if (!activeCtx || annotationsHistory.length <= 1) return;
    annotationsHistory.pop(); // Remove current state
    const previousState = annotationsHistory[annotationsHistory.length - 1];
    activeCtx.putImageData(previousState, 0, 0);
  }

  function attachEvents() {
    if (!activeCanvas) return;

    activeCanvas.addEventListener('pointerdown', onPointerDown);
    activeCanvas.addEventListener('pointermove', onPointerMove);
    activeCanvas.addEventListener('pointerup', onPointerUp);
  }

  function onPointerDown(e) {
    if (currentTool === 'select') return;

    const rect = activeCanvas.getBoundingClientRect();
    const scaleX = activeCanvas.width / rect.width;
    const scaleY = activeCanvas.height / rect.height;

    startX = (e.clientX - rect.left) * scaleX;
    startY = (e.clientY - rect.top) * scaleY;

    if (currentTool === 'text') {
      const text = prompt(SmartUtils.t('enterTextPrompt', 'Ekran görüntüsüne eklenecek metni yazın:'));
      if (text) {
        activeCtx.font = 'bold 24px -apple-system, sans-serif';
        activeCtx.fillStyle = currentColor;
        activeCtx.shadowColor = 'rgba(0,0,0,0.8)';
        activeCtx.shadowBlur = 4;
        activeCtx.fillText(text, startX, startY);
        saveState();
      }
      return;
    }

    isDrawing = true;
  }

  function onPointerMove(e) {
    if (!isDrawing || currentTool === 'select') return;

    const rect = activeCanvas.getBoundingClientRect();
    const scaleX = activeCanvas.width / rect.width;
    const scaleY = activeCanvas.height / rect.height;

    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    // Restore last saved state before previewing live shape
    if (annotationsHistory.length > 0) {
      activeCtx.putImageData(annotationsHistory[annotationsHistory.length - 1], 0, 0);
    }

    drawShape(startX, startY, currentX, currentY, false);
  }

  function onPointerUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    const rect = activeCanvas.getBoundingClientRect();
    const scaleX = activeCanvas.width / rect.width;
    const scaleY = activeCanvas.height / rect.height;

    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    drawShape(startX, startY, currentX, currentY, true);
    saveState();
  }

  function drawShape(x1, y1, x2, y2, isFinal) {
    activeCtx.save();

    if (currentTool === 'arrow') {
      drawArrow(activeCtx, x1, y1, x2, y2, currentColor);
    } else if (currentTool === 'rect') {
      activeCtx.strokeStyle = currentColor;
      activeCtx.lineWidth = 4;
      activeCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (currentTool === 'mosaic') {
      applyMosaic(x1, y1, x2 - x1, y2 - y1);
    } else if (currentTool === 'blur') {
      applyBlur(x1, y1, x2 - x1, y2 - y1);
    }

    activeCtx.restore();
  }

  function drawArrow(ctx, fromx, fromy, tox, toy, color) {
    const headlen = 16;
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Pixelate / Block Mosaic Filter
   */
  function applyMosaic(x, y, w, h) {
    const bx = Math.min(x, x + w);
    const by = Math.min(y, y + h);
    const bw = Math.abs(w);
    const bh = Math.abs(h);

    if (bw <= 0 || bh <= 0) return;

    const sampleSize = 12;
    const imgData = activeCtx.getImageData(bx, by, bw, bh);

    for (let py = 0; py < bh; py += sampleSize) {
      for (let px = 0; px < bw; px += sampleSize) {
        const i = (py * bw + px) * 4;
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];

        activeCtx.fillStyle = `rgb(${r},${g},${b})`;
        activeCtx.fillRect(bx + px, by + py, sampleSize, sampleSize);
      }
    }
  }

  /**
   * Soft Gaussian Blur Filter
   */
  function applyBlur(x, y, w, h) {
    const bx = Math.min(x, x + w);
    const by = Math.min(y, y + h);
    const bw = Math.abs(w);
    const bh = Math.abs(h);

    if (bw <= 0 || bh <= 0) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bw;
    tempCanvas.height = bh;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    // Draw target region to temp canvas
    tempCtx.drawImage(activeCanvas, bx, by, bw, bh, 0, 0, bw, bh);

    // Apply soft blur effect
    activeCtx.save();
    activeCtx.filter = 'blur(8px)';
    activeCtx.drawImage(tempCanvas, bx, by, bw, bh);
    activeCtx.restore();
  }

  function getEditedDataURL(format = 'image/png', quality = 0.92) {
    if (!activeCanvas) return '';
    return activeCanvas.toDataURL(format, quality);
  }

  return {
    initEditor,
    setTool,
    setColor,
    undo,
    getEditedDataURL
  };
})();
