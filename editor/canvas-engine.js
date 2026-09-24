/**
 * SmartCapture PRO Canvas Annotation, Filter & Drawing Engine
 * Professional editing suite: Pen, Arrow, Rectangle, Circle, Highlighter, Mosaic, Blur, Text, Numbered Step Badges, and Crop.
 * Full Undo/Redo history, stroke width adjustments, and zoom support.
 */

window.SmartEditor = (function () {
  'use strict';

  let currentTool = 'select'; // select, pen, arrow, rect, circle, highlighter, mosaic, blur, text, step, crop
  let currentColor = '#ef4444';
  let currentStrokeWidth = 4;
  let activeCanvas = null;
  let activeCtx = null;
  let isDrawing = false;
  let startX = 0, startY = 0;
  let currentPoints = []; // For freehand pen
  let stepCounter = 1;

  const undoStack = [];
  const redoStack = [];
  let onHistoryChangeCallback = null;
  let activeTextCommit = null;

  function commitActiveText() {
    if (typeof activeTextCommit === 'function') {
      activeTextCommit();
      activeTextCommit = null;
    }
  }

  function initEditor(canvasElement, imageSrc, onHistoryChange) {
    activeCanvas = canvasElement;
    activeCtx = activeCanvas.getContext('2d', { willReadFrequently: true });
    undoStack.length = 0;
    redoStack.length = 0;
    stepCounter = 1;
    activeTextCommit = null;
    onHistoryChangeCallback = onHistoryChange || null;

    const img = new Image();
    img.onload = () => {
      activeCanvas.width = img.width;
      activeCanvas.height = img.height;
      activeCtx.drawImage(img, 0, 0);
      saveState();
      notifyHistoryChange();
    };
    img.src = imageSrc;

    attachEvents();
  }

  function setTool(toolName) {
    if (currentTool === 'text' && toolName !== 'text') {
      commitActiveText();
    }
    currentTool = toolName;
  }

  function setColor(colorHex) {
    currentColor = colorHex;
  }

  function setStrokeWidth(width) {
    currentStrokeWidth = Math.max(1, parseInt(width, 10) || 4);
  }

  function saveState() {
    if (!activeCtx || !activeCanvas) return;
    undoStack.push(activeCtx.getImageData(0, 0, activeCanvas.width, activeCanvas.height));
    // Clear redo on new user action
    redoStack.length = 0;
    notifyHistoryChange();
  }

  function undo() {
    commitActiveText();
    if (!activeCtx || undoStack.length <= 1) return;
    const currentState = undoStack.pop();
    redoStack.push(currentState);
    const previousState = undoStack[undoStack.length - 1];
    
    // Resize canvas if canvas was cropped
    if (activeCanvas.width !== previousState.width || activeCanvas.height !== previousState.height) {
      activeCanvas.width = previousState.width;
      activeCanvas.height = previousState.height;
    }
    activeCtx.putImageData(previousState, 0, 0);

    if (stepCounter > 1) stepCounter--;
    notifyHistoryChange();
  }

  function redo() {
    commitActiveText();
    if (!activeCtx || redoStack.length === 0) return;
    const nextState = redoStack.pop();
    undoStack.push(nextState);

    if (activeCanvas.width !== nextState.width || activeCanvas.height !== nextState.height) {
      activeCanvas.width = nextState.width;
      activeCanvas.height = nextState.height;
    }
    activeCtx.putImageData(nextState, 0, 0);
    notifyHistoryChange();
  }

  function resetToOriginal() {
    commitActiveText();
    if (!activeCtx || undoStack.length === 0) return;
    const originalState = undoStack[0];
    undoStack.length = 0;
    redoStack.length = 0;
    undoStack.push(originalState);
    stepCounter = 1;

    activeCanvas.width = originalState.width;
    activeCanvas.height = originalState.height;
    activeCtx.putImageData(originalState, 0, 0);
    notifyHistoryChange();
  }

  function notifyHistoryChange() {
    if (typeof onHistoryChangeCallback === 'function') {
      onHistoryChangeCallback({
        canUndo: undoStack.length > 1,
        canRedo: redoStack.length > 0
      });
    }
  }

  function attachEvents() {
    if (!activeCanvas) return;

    activeCanvas.removeEventListener('pointerdown', onPointerDown);
    activeCanvas.removeEventListener('pointermove', onPointerMove);
    activeCanvas.removeEventListener('pointerup', onPointerUp);

    activeCanvas.addEventListener('pointerdown', onPointerDown);
    activeCanvas.addEventListener('pointermove', onPointerMove);
    activeCanvas.addEventListener('pointerup', onPointerUp);
  }

  function getCanvasCoords(e) {
    const rect = activeCanvas.getBoundingClientRect();
    const scaleX = activeCanvas.width / rect.width;
    const scaleY = activeCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function onPointerDown(e) {
    if (currentTool === 'select' || currentTool === 'crop') return;

    const coords = getCanvasCoords(e);
    startX = coords.x;
    startY = coords.y;

    if (currentTool === 'step') {
      drawStepBadge(startX, startY, stepCounter++);
      saveState();
      return;
    }

    if (currentTool === 'text') {
      e.preventDefault();
      e.stopPropagation();
      promptInlineText(startX, startY);
      return;
    }

    if (currentTool === 'pen') {
      currentPoints = [{ x: startX, y: startY }];
    }

    isDrawing = true;
  }

  function onPointerMove(e) {
    if (!isDrawing || currentTool === 'select' || currentTool === 'crop') return;

    const coords = getCanvasCoords(e);

    if (currentTool === 'pen') {
      currentPoints.push({ x: coords.x, y: coords.y });
      // Restore last state before redrawing live stroke
      if (undoStack.length > 0) {
        activeCtx.putImageData(undoStack[undoStack.length - 1], 0, 0);
      }
      drawPenStroke(currentPoints, currentColor, currentStrokeWidth);
      return;
    }

    // Restore last state before previewing geometric shapes
    if (undoStack.length > 0) {
      activeCtx.putImageData(undoStack[undoStack.length - 1], 0, 0);
    }

    drawShape(startX, startY, coords.x, coords.y, false);
  }

  function onPointerUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    const coords = getCanvasCoords(e);

    if (currentTool === 'pen') {
      if (currentPoints.length > 1) {
        saveState();
      }
      currentPoints = [];
      return;
    }

    drawShape(startX, startY, coords.x, coords.y, true);
    saveState();
  }

  function drawShape(x1, y1, x2, y2, isFinal) {
    activeCtx.save();

    switch (currentTool) {
      case 'arrow':
        drawArrow(activeCtx, x1, y1, x2, y2, currentColor, currentStrokeWidth);
        break;
      case 'rect':
        activeCtx.strokeStyle = currentColor;
        activeCtx.lineWidth = currentStrokeWidth;
        activeCtx.lineJoin = 'round';
        activeCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        break;
      case 'circle':
        drawEllipse(activeCtx, x1, y1, x2, y2, currentColor, currentStrokeWidth);
        break;
      case 'highlighter':
        drawHighlighter(activeCtx, x1, y1, x2, y2, currentColor, Math.max(16, currentStrokeWidth * 4));
        break;
      case 'mosaic':
        applyMosaic(x1, y1, x2 - x1, y2 - y1);
        break;
      case 'blur':
        applyBlur(x1, y1, x2 - x1, y2 - y1);
        break;
    }

    activeCtx.restore();
  }

  function drawPenStroke(points, color, width) {
    if (points.length < 2) return;
    activeCtx.save();
    activeCtx.strokeStyle = color;
    activeCtx.lineWidth = width;
    activeCtx.lineCap = 'round';
    activeCtx.lineJoin = 'round';

    activeCtx.beginPath();
    activeCtx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      activeCtx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    activeCtx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    activeCtx.stroke();
    activeCtx.restore();
  }

  function drawArrow(ctx, fromx, fromy, tox, toy, color, strokeWidth) {
    const headlen = Math.max(14, strokeWidth * 3.5);
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function drawEllipse(ctx, x1, y1, x2, y2, color, strokeWidth) {
    const radiusX = Math.abs(x2 - x1) / 2;
    const radiusY = Math.abs(y2 - y1) / 2;
    const centerX = Math.min(x1, x2) + radiusX;
    const centerY = Math.min(y1, y2) + radiusY;

    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.stroke();
  }

  function drawHighlighter(ctx, x1, y1, x2, y2, color, width) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'square';

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawStepBadge(x, y, number) {
    const sizeMap = { 2: 14, 4: 20, 8: 28 };
    const radius = sizeMap[currentStrokeWidth] || Math.max(12, Math.round(10 + currentStrokeWidth * 2.25));
    activeCtx.save();

    // Badge circle
    activeCtx.fillStyle = currentColor;
    activeCtx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    activeCtx.shadowBlur = 6;
    activeCtx.shadowOffsetY = 2;

    activeCtx.beginPath();
    activeCtx.arc(x, y, radius, 0, Math.PI * 2);
    activeCtx.fill();

    // White rim
    activeCtx.strokeStyle = '#ffffff';
    activeCtx.lineWidth = Math.max(1.5, Math.round(radius * 0.1));
    activeCtx.shadowBlur = 0;
    activeCtx.stroke();

    // Number text
    const strNum = String(number);
    const fontRatio = strNum.length > 1 ? 0.9 : 1.15;
    activeCtx.fillStyle = '#ffffff';
    activeCtx.font = `bold ${Math.round(radius * fontRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    activeCtx.textAlign = 'center';
    activeCtx.textBaseline = 'middle';
    activeCtx.fillText(strNum, x, y + 1);

    activeCtx.restore();
  }

  function promptInlineText(canvasX, canvasY) {
    // Commit any currently open text box before opening a new one
    commitActiveText();

    const inputEl = document.getElementById('canvas-inline-text-input');
    if (!inputEl) {
      const text = prompt("Metin girin:");
      if (text) {
        renderTextOnCanvas(text, canvasX, canvasY);
        saveState();
      }
      return;
    }

    const fontSize = Math.max(16, Math.round(currentStrokeWidth * 5.5));

    inputEl.style.left = `${Math.round(canvasX)}px`;
    inputEl.style.top = `${Math.round(canvasY)}px`;
    inputEl.style.fontSize = `${fontSize}px`;
    inputEl.style.color = currentColor;
    inputEl.style.borderColor = currentColor;
    inputEl.value = '';
    inputEl.classList.remove('hidden');

    let isCommitted = false;
    const openingTime = Date.now();

    const finish = (shouldRender) => {
      if (isCommitted) return;
      isCommitted = true;
      activeTextCommit = null;

      const text = inputEl.value.trim();
      inputEl.classList.add('hidden');
      inputEl.removeEventListener('blur', onBlur);
      inputEl.removeEventListener('keydown', onKey);

      if (shouldRender && text) {
        renderTextOnCanvas(text, canvasX, canvasY, fontSize);
        saveState();
      }
    };

    activeTextCommit = () => finish(true);

    const onBlur = () => {
      // Ignore blur within 250ms of opening so click event resolution doesn't hide it prematurely
      if (Date.now() - openingTime < 250) {
        inputEl.focus();
        return;
      }
      finish(true);
    };

    const onKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    };

    inputEl.addEventListener('blur', onBlur);
    inputEl.addEventListener('keydown', onKey);

    setTimeout(() => {
      inputEl.focus();
    }, 20);
  }

  function renderTextOnCanvas(text, x, y, size) {
    activeCtx.save();
    const fontSize = size || Math.max(16, Math.round(currentStrokeWidth * 5.5));
    activeCtx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    activeCtx.fillStyle = currentColor;
    activeCtx.textBaseline = 'top';
    activeCtx.textAlign = 'left';
    activeCtx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    activeCtx.shadowBlur = 4;
    activeCtx.shadowOffsetY = 1;
    activeCtx.fillText(text, x, y);
    activeCtx.restore();
  }

  function applyMosaic(x, y, w, h) {
    const bx = Math.min(x, x + w);
    const by = Math.min(y, y + h);
    const bw = Math.abs(w);
    const bh = Math.abs(h);

    if (bw <= 2 || bh <= 2) return;

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

  function applyBlur(x, y, w, h) {
    const bx = Math.min(x, x + w);
    const by = Math.min(y, y + h);
    const bw = Math.abs(w);
    const bh = Math.abs(h);

    if (bw <= 2 || bh <= 2) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bw;
    tempCanvas.height = bh;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    tempCtx.drawImage(activeCanvas, bx, by, bw, bh, 0, 0, bw, bh);

    activeCtx.save();
    activeCtx.filter = 'blur(10px)';
    activeCtx.drawImage(tempCanvas, bx, by, bw, bh);
    activeCtx.restore();
  }

  function cropToRect(x, y, width, height) {
    commitActiveText();
    if (!activeCanvas || !activeCtx || width <= 10 || height <= 10) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    tempCtx.drawImage(activeCanvas, x, y, width, height, 0, 0, width, height);

    activeCanvas.width = width;
    activeCanvas.height = height;
    activeCtx.drawImage(tempCanvas, 0, 0);

    saveState();
  }

  function getEditedDataURL(format = 'image/png', quality = 0.94) {
    commitActiveText();
    if (!activeCanvas) return '';
    return activeCanvas.toDataURL(format, quality);
  }

  return {
    initEditor,
    setTool,
    setColor,
    setStrokeWidth,
    undo,
    redo,
    resetToOriginal,
    cropToRect,
    getEditedDataURL
  };
})();
