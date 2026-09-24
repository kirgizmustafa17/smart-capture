/**
 * SmartCapture PRO Canvas Annotation, Filter & Vector Layer Engine
 * Professional editing suite: Pen, Arrow, Rectangle, Circle, Highlighter, Mosaic, Blur, Text, Numbered Step Badges, and Crop.
 * Full Select & Move, Resize, Recolor, Delete, Undo/Redo history, stroke width adjustments, and zoom support.
 */

window.SmartEditor = (function () {
  'use strict';

  let currentTool = 'select'; // select, pen, arrow, rect, circle, highlighter, mosaic, blur, text, step, crop
  let currentColor = '#ef4444';
  let currentStrokeWidth = 4;
  let activeCanvas = null;
  let activeCtx = null;

  // Offscreen canvas storing the clean base screenshot image
  let baseCanvas = null;
  let baseCtx = null;
  let originalImageSrc = null;

  // Vector annotation elements
  let elements = [];
  let selectedElementIndex = -1;

  // Interaction state
  let isInteracting = false;
  let dragMode = null; // 'create', 'move', 'tl', 'tr', 'bl', 'br'
  let dragStartX = 0, dragStartY = 0;
  let currentPreviewElement = null;

  // History stacks
  const undoStack = [];
  const redoStack = [];
  let onHistoryChangeCallback = null;
  let onSelectionChangeCallback = null;
  let onColorPickedCallback = null;
  let activeTextCommit = null;

  function commitActiveText() {
    if (typeof activeTextCommit === 'function') {
      activeTextCommit();
      activeTextCommit = null;
    }
  }

  function notifySelectionChange() {
    if (typeof onSelectionChangeCallback === 'function') {
      const el = (selectedElementIndex >= 0 && selectedElementIndex < elements.length)
        ? elements[selectedElementIndex]
        : null;
      onSelectionChangeCallback(el);
    }
  }

  function initEditor(canvasElement, imageSrc, onHistoryChange, onSelectionChange) {
    activeCanvas = canvasElement;
    activeCtx = activeCanvas.getContext('2d', { willReadFrequently: true });
    originalImageSrc = imageSrc;

    elements = [];
    selectedElementIndex = -1;
    undoStack.length = 0;
    redoStack.length = 0;
    activeTextCommit = null;
    onHistoryChangeCallback = onHistoryChange || null;
    onSelectionChangeCallback = onSelectionChange || null;
    notifySelectionChange();

    const img = new Image();
    img.onload = () => {
      activeCanvas.width = img.width;
      activeCanvas.height = img.height;

      baseCanvas = document.createElement('canvas');
      baseCanvas.width = img.width;
      baseCanvas.height = img.height;
      baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
      baseCtx.drawImage(img, 0, 0);

      // Initial clean state
      saveState();
      render(true);
      notifyHistoryChange();
    };
    img.src = imageSrc;

    attachEvents();
  }

  function setTool(toolName) {
    if (currentTool === 'text' && toolName !== 'text') {
      commitActiveText();
    }
    if (toolName !== 'select') {
      selectedElementIndex = -1;
      notifySelectionChange();
      render(false);
    }
    currentTool = toolName;
  }

  function rgbToHex(r, g, b) {
    const toHex = (c) => {
      const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  function getColorAtCoords(x, y) {
    if (!activeCanvas || !activeCtx) return null;
    const clampX = Math.max(0, Math.min(activeCanvas.width - 1, Math.round(x)));
    const clampY = Math.max(0, Math.min(activeCanvas.height - 1, Math.round(y)));
    try {
      const pixel = activeCtx.getImageData(clampX, clampY, 1, 1).data;
      return {
        hex: rgbToHex(pixel[0], pixel[1], pixel[2]),
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
        a: pixel[3]
      };
    } catch (e) {
      return null;
    }
  }

  function setColor(colorHex) {
    currentColor = colorHex;
    if (selectedElementIndex >= 0 && selectedElementIndex < elements.length) {
      const el = elements[selectedElementIndex];
      if (el.color !== undefined) {
        el.color = colorHex;
        saveState();
        render(true);
      }
    }
  }

  function setStrokeWidth(width) {
    currentStrokeWidth = Math.max(1, parseInt(width, 10) || 4);
    if (selectedElementIndex >= 0 && selectedElementIndex < elements.length) {
      const el = elements[selectedElementIndex];
      if (el.strokeWidth !== undefined) {
        el.strokeWidth = currentStrokeWidth;
        if (el.type === 'step') {
          delete el.radius; // Re-align to calibrated radius
        }
        saveState();
        render(true);
      }
    }
  }

  function deleteSelected() {
    if (selectedElementIndex >= 0 && selectedElementIndex < elements.length) {
      elements.splice(selectedElementIndex, 1);
      selectedElementIndex = -1;
      notifySelectionChange();
      saveState();
      render(true);
      return true;
    }
    return false;
  }

  function saveState() {
    undoStack.push(JSON.parse(JSON.stringify(elements)));
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    notifyHistoryChange();
  }

  function undo() {
    commitActiveText();
    if (undoStack.length <= 1) return;
    const currentState = undoStack.pop();
    redoStack.push(currentState);
    const prevState = undoStack[undoStack.length - 1];
    elements = JSON.parse(JSON.stringify(prevState));
    selectedElementIndex = -1;
    notifySelectionChange();
    render(true);
    notifyHistoryChange();
  }

  function redo() {
    commitActiveText();
    if (redoStack.length === 0) return;
    const nextState = redoStack.pop();
    undoStack.push(nextState);
    elements = JSON.parse(JSON.stringify(nextState));
    selectedElementIndex = -1;
    notifySelectionChange();
    render(true);
    notifyHistoryChange();
  }

  function resetToOriginal() {
    commitActiveText();
    if (!originalImageSrc) return;
    elements = [];
    selectedElementIndex = -1;
    notifySelectionChange();
    initEditor(activeCanvas, originalImageSrc, onHistoryChangeCallback, onSelectionChangeCallback);
  }

  function notifyHistoryChange() {
    if (typeof onHistoryChangeCallback === 'function') {
      onHistoryChangeCallback({
        canUndo: undoStack.length > 1,
        canRedo: redoStack.length > 0
      });
    }
  }

  function getNextStepNumber() {
    const numbers = elements.filter(e => e.type === 'step').map(e => e.number);
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  }

  // --------------------------------------------------------------------------
  // RENDERING ENGINE
  // --------------------------------------------------------------------------

  function render(withSelection = true) {
    if (!activeCtx || !baseCanvas) return;

    activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
    activeCtx.drawImage(baseCanvas, 0, 0);

    // Draw all permanent elements
    for (let i = 0; i < elements.length; i++) {
      drawElement(activeCtx, elements[i]);
    }

    // Draw live preview shape during creation
    if (currentPreviewElement) {
      drawElement(activeCtx, currentPreviewElement);
    }

    // Draw selection marquee & handles
    if (withSelection && currentTool === 'select' && selectedElementIndex >= 0 && selectedElementIndex < elements.length) {
      const bounds = getElementBounds(elements[selectedElementIndex]);
      drawSelectionOverlay(activeCtx, bounds);
    }
  }

  function drawElement(ctx, el) {
    switch (el.type) {
      case 'rect':
        drawRect(ctx, el);
        break;
      case 'circle':
        drawCircle(ctx, el);
        break;
      case 'arrow':
        drawArrow(ctx, el);
        break;
      case 'pen':
        drawPen(ctx, el);
        break;
      case 'highlighter':
        drawHighlighter(ctx, el);
        break;
      case 'step':
        drawStep(ctx, el);
        break;
      case 'text':
        drawText(ctx, el);
        break;
      case 'mosaic':
        drawMosaic(ctx, el);
        break;
      case 'blur':
        drawBlur(ctx, el);
        break;
    }
  }

  function drawRect(ctx, el) {
    ctx.save();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeRect(el.x, el.y, el.width, el.height);
    ctx.restore();
  }

  function drawCircle(ctx, el) {
    ctx.save();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.strokeWidth;
    ctx.beginPath();
    ctx.ellipse(el.cx, el.cy, Math.max(1, el.rx), Math.max(1, el.ry), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawArrow(ctx, el) {
    const headlen = Math.max(14, el.strokeWidth * 3.5);
    const dx = el.x2 - el.x1;
    const dy = el.y2 - el.y1;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(el.x2, el.y2);
    ctx.lineTo(el.x2 - headlen * Math.cos(angle - Math.PI / 6), el.y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(el.x2 - headlen * Math.cos(angle + Math.PI / 6), el.y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPen(ctx, el) {
    if (!el.points || el.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);

    for (let i = 1; i < el.points.length - 1; i++) {
      const midX = (el.points[i].x + el.points[i + 1].x) / 2;
      const midY = (el.points[i].y + el.points[i + 1].y) / 2;
      ctx.quadraticCurveTo(el.points[i].x, el.points[i].y, midX, midY);
    }
    ctx.lineTo(el.points[el.points.length - 1].x, el.points[el.points.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  function drawHighlighter(ctx, el) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = el.color;
    ctx.lineWidth = Math.max(16, el.strokeWidth * 4);
    ctx.lineCap = 'square';

    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawStep(ctx, el) {
    const sizeMap = { 2: 14, 4: 20, 8: 28 };
    const radius = el.radius || sizeMap[el.strokeWidth] || Math.max(12, Math.round(10 + el.strokeWidth * 2.25));
    ctx.save();

    ctx.fillStyle = el.color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.arc(el.x, el.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, Math.round(radius * 0.1));
    ctx.shadowBlur = 0;
    ctx.stroke();

    const strNum = String(el.number);
    const fontRatio = strNum.length > 1 ? 0.9 : 1.15;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(radius * fontRatio)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(strNum, el.x, el.y + 1);
    ctx.restore();
  }

  function drawText(ctx, el) {
    ctx.save();
    const fontSize = el.fontSize || 18;
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = el.color;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillText(el.text, el.x, el.y);
    ctx.restore();
  }

  function drawMosaic(ctx, el) {
    const bx = Math.min(el.x, el.x + el.width);
    const by = Math.min(el.y, el.y + el.height);
    const bw = Math.abs(el.width);
    const bh = Math.abs(el.height);
    if (bw <= 2 || bh <= 2) return;

    const sampleSize = 12;
    const imgData = ctx.getImageData(bx, by, bw, bh);

    for (let py = 0; py < bh; py += sampleSize) {
      for (let px = 0; px < bw; px += sampleSize) {
        const i = (py * bw + px) * 4;
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(bx + px, by + py, sampleSize, sampleSize);
      }
    }
  }

  function drawBlur(ctx, el) {
    const bx = Math.min(el.x, el.x + el.width);
    const by = Math.min(el.y, el.y + el.height);
    const bw = Math.abs(el.width);
    const bh = Math.abs(el.height);
    if (bw <= 2 || bh <= 2) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bw;
    tempCanvas.height = bh;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempCtx.drawImage(activeCanvas, bx, by, bw, bh, 0, 0, bw, bh);

    ctx.save();
    ctx.filter = 'blur(10px)';
    ctx.drawImage(tempCanvas, bx, by, bw, bh);
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // BOUNDS & SELECTION OVERLAY
  // --------------------------------------------------------------------------

  function getElementBounds(el) {
    switch (el.type) {
      case 'rect':
      case 'mosaic':
      case 'blur': {
        const x = Math.min(el.x, el.x + el.width);
        const y = Math.min(el.y, el.y + el.height);
        const w = Math.abs(el.width);
        const h = Math.abs(el.height);
        return { minX: x, minY: y, maxX: x + w, maxY: y + h, w, h, x, y };
      }
      case 'circle': {
        return {
          minX: el.cx - el.rx,
          minY: el.cy - el.ry,
          maxX: el.cx + el.rx,
          maxY: el.cy + el.ry,
          w: el.rx * 2,
          h: el.ry * 2,
          x: el.cx - el.rx,
          y: el.cy - el.ry
        };
      }
      case 'arrow':
      case 'highlighter': {
        const minX = Math.min(el.x1, el.x2);
        const minY = Math.min(el.y1, el.y2);
        const maxX = Math.max(el.x1, el.x2);
        const maxY = Math.max(el.y1, el.y2);
        return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, x: minX, y: minY };
      }
      case 'step': {
        const sizeMap = { 2: 14, 4: 20, 8: 28 };
        const radius = el.radius || sizeMap[el.strokeWidth] || 20;
        return {
          minX: el.x - radius,
          minY: el.y - radius,
          maxX: el.x + radius,
          maxY: el.y + radius,
          w: radius * 2,
          h: radius * 2,
          x: el.x - radius,
          y: el.y - radius
        };
      }
      case 'text': {
        activeCtx.save();
        activeCtx.font = `bold ${el.fontSize || 18}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const textWidth = Math.max(20, activeCtx.measureText(el.text).width);
        activeCtx.restore();
        const height = (el.fontSize || 18) * 1.25;
        return {
          minX: el.x,
          minY: el.y,
          maxX: el.x + textWidth,
          maxY: el.y + height,
          w: textWidth,
          h: height,
          x: el.x,
          y: el.y
        };
      }
      case 'pen': {
        if (!el.points || el.points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0, x: 0, y: 0 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        el.points.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        });
        return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, x: minX, y: minY };
      }
      default:
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0, x: 0, y: 0 };
    }
  }

  function isPointInsideBounds(px, py, bounds, tolerance = 8) {
    return (
      px >= bounds.minX - tolerance &&
      px <= bounds.maxX + tolerance &&
      py >= bounds.minY - tolerance &&
      py <= bounds.maxY + tolerance
    );
  }

  function getHandleAtPoint(px, py, bounds) {
    const handleRadius = 9;
    const handles = [
      { name: 'tl', x: bounds.minX - 4, y: bounds.minY - 4 },
      { name: 'tr', x: bounds.maxX + 4, y: bounds.minY - 4 },
      { name: 'bl', x: bounds.minX - 4, y: bounds.maxY + 4 },
      { name: 'br', x: bounds.maxX + 4, y: bounds.maxY + 4 }
    ];

    for (const h of handles) {
      if (Math.hypot(px - h.x, py - h.y) <= handleRadius) return h.name;
    }
    return null;
  }

  function drawSelectionOverlay(ctx, bounds) {
    ctx.save();

    // Dashed Cyan Bounding Box
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(bounds.minX - 4, bounds.minY - 4, bounds.w + 8, bounds.h + 8);

    // 4 Corner Handles
    const handleSize = 8;
    const half = handleSize / 2;
    const handles = [
      { x: bounds.minX - 4, y: bounds.minY - 4 },
      { x: bounds.maxX + 4, y: bounds.minY - 4 },
      { x: bounds.minX - 4, y: bounds.maxY + 4 },
      { x: bounds.maxX + 4, y: bounds.maxY + 4 }
    ];

    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;

    handles.forEach(h => {
      ctx.fillRect(h.x - half, h.y - half, handleSize, handleSize);
      ctx.strokeRect(h.x - half, h.y - half, handleSize, handleSize);
    });

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // POINTER INTERACTIONS (CREATE, SELECT, MOVE, RESIZE)
  // --------------------------------------------------------------------------

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
    if (currentTool === 'crop') return;

    const coords = getCanvasCoords(e);
    dragStartX = coords.x;
    dragStartY = coords.y;

    // SELECT TOOL INTERACTION
    if (currentTool === 'select') {
      // 1. Check if clicking a handle of currently selected element
      if (selectedElementIndex >= 0 && selectedElementIndex < elements.length) {
        const bounds = getElementBounds(elements[selectedElementIndex]);
        const handle = getHandleAtPoint(coords.x, coords.y, bounds);
        if (handle) {
          isInteracting = true;
          dragMode = handle;
          return;
        }
      }

      // 2. Hit-test elements from top to bottom
      let hitIndex = -1;
      for (let i = elements.length - 1; i >= 0; i--) {
        const bounds = getElementBounds(elements[i]);
        if (isPointInsideBounds(coords.x, coords.y, bounds)) {
          hitIndex = i;
          break;
        }
      }

      if (hitIndex !== -1) {
        selectedElementIndex = hitIndex;
        isInteracting = true;
        dragMode = 'move';
        notifySelectionChange();
        render(true);
      } else {
        selectedElementIndex = -1;
        isInteracting = false;
        dragMode = null;
        notifySelectionChange();
        render(false);
      }
      return;
    }

    // EYEDROPPER COLOR PICKER INTERACTION
    if (currentTool === 'eyedropper') {
      e.preventDefault();
      e.stopPropagation();
      const colorData = getColorAtCoords(coords.x, coords.y);
      if (colorData) {
        setColor(colorData.hex);
        if (typeof onColorPickedCallback === 'function') {
          onColorPickedCallback(colorData.hex, colorData);
        }
      }
      return;
    }

    // TEXT TOOL INTERACTION
    if (currentTool === 'text') {
      e.preventDefault();
      e.stopPropagation();
      promptInlineText(coords.x, coords.y);
      return;
    }

    // STEP BADGE CREATION
    if (currentTool === 'step') {
      const stepNumber = getNextStepNumber();
      const newStep = {
        type: 'step',
        x: coords.x,
        y: coords.y,
        number: stepNumber,
        color: currentColor,
        strokeWidth: currentStrokeWidth
      };
      elements.push(newStep);
      selectedElementIndex = elements.length - 1;
      notifySelectionChange();
      saveState();
      render(true);
      return;
    }

    // SHAPE / PEN CREATION
    isInteracting = true;
    dragMode = 'create';

    if (currentTool === 'pen') {
      currentPreviewElement = {
        type: 'pen',
        points: [{ x: coords.x, y: coords.y }],
        color: currentColor,
        strokeWidth: currentStrokeWidth
      };
    }
  }

  function onPointerMove(e) {
    if (currentTool === 'crop') return;
    const coords = getCanvasCoords(e);

    // Update cursor in select tool
    if (currentTool === 'select' && !isInteracting) {
      updateSelectCursor(coords);
      return;
    }

    if (!isInteracting) return;

    // MOVING ELEMENT
    if (dragMode === 'move' && selectedElementIndex >= 0 && selectedElementIndex < elements.length) {
      const dx = coords.x - dragStartX;
      const dy = coords.y - dragStartY;
      moveElement(elements[selectedElementIndex], dx, dy);
      dragStartX = coords.x;
      dragStartY = coords.y;
      render(true);
      return;
    }

    // RESIZING ELEMENT VIA CORNER HANDLES
    if (['tl', 'tr', 'bl', 'br'].includes(dragMode) && selectedElementIndex >= 0 && selectedElementIndex < elements.length) {
      const dx = coords.x - dragStartX;
      const dy = coords.y - dragStartY;
      resizeElement(elements[selectedElementIndex], dragMode, dx, dy);
      dragStartX = coords.x;
      dragStartY = coords.y;
      render(true);
      return;
    }

    // CREATING SHAPE
    if (dragMode === 'create') {
      if (currentTool === 'pen' && currentPreviewElement) {
        currentPreviewElement.points.push({ x: coords.x, y: coords.y });
        render(false);
        return;
      }

      currentPreviewElement = createLiveShape(dragStartX, dragStartY, coords.x, coords.y);
      render(false);
    }
  }

  function onPointerUp(e) {
    if (currentTool === 'crop') return;

    if (!isInteracting) return;
    isInteracting = false;

    // Finished moving or resizing selected element
    if (dragMode === 'move' || ['tl', 'tr', 'bl', 'br'].includes(dragMode)) {
      if (selectedElementIndex >= 0 && selectedElementIndex < elements.length) {
        const sel = elements[selectedElementIndex];
        if (sel && (sel.type === 'rect' || sel.type === 'mosaic' || sel.type === 'blur')) {
          if (sel.width < 0) {
            sel.x += sel.width;
            sel.width = Math.abs(sel.width);
          }
          if (sel.height < 0) {
            sel.y += sel.height;
            sel.height = Math.abs(sel.height);
          }
        }
      }
      dragMode = null;
      saveState();
      render(true);
      return;
    }

    // Finished creating new element
    if (dragMode === 'create') {
      dragMode = null;
      if (currentPreviewElement) {
        // Validate minimum size
        if (isValidElement(currentPreviewElement)) {
          if (['rect', 'mosaic', 'blur'].includes(currentPreviewElement.type)) {
            if (currentPreviewElement.width < 0) {
              currentPreviewElement.x += currentPreviewElement.width;
              currentPreviewElement.width = Math.abs(currentPreviewElement.width);
            }
            if (currentPreviewElement.height < 0) {
              currentPreviewElement.y += currentPreviewElement.height;
              currentPreviewElement.height = Math.abs(currentPreviewElement.height);
            }
          }
          elements.push(currentPreviewElement);
          selectedElementIndex = elements.length - 1;
          notifySelectionChange();
          saveState();
        }
        currentPreviewElement = null;
        render(true);
      }
    }
  }

  function updateSelectCursor(coords) {
    if (selectedElementIndex >= 0 && selectedElementIndex < elements.length) {
      const bounds = getElementBounds(elements[selectedElementIndex]);
      const handle = getHandleAtPoint(coords.x, coords.y, bounds);
      if (handle === 'tl' || handle === 'br') {
        activeCanvas.style.cursor = 'nwse-resize';
        return;
      }
      if (handle === 'tr' || handle === 'bl') {
        activeCanvas.style.cursor = 'nesw-resize';
        return;
      }
      if (isPointInsideBounds(coords.x, coords.y, bounds)) {
        activeCanvas.style.cursor = 'move';
        return;
      }
    }

    // Check if hovering over any element
    for (let i = elements.length - 1; i >= 0; i--) {
      const bounds = getElementBounds(elements[i]);
      if (isPointInsideBounds(coords.x, coords.y, bounds)) {
        activeCanvas.style.cursor = 'pointer';
        return;
      }
    }
    activeCanvas.style.cursor = 'default';
  }

  function moveElement(el, dx, dy) {
    switch (el.type) {
      case 'rect':
      case 'mosaic':
      case 'blur':
      case 'step':
      case 'text':
        el.x += dx;
        el.y += dy;
        break;
      case 'circle':
        el.cx += dx;
        el.cy += dy;
        break;
      case 'arrow':
      case 'highlighter':
        el.x1 += dx;
        el.y1 += dy;
        el.x2 += dx;
        el.y2 += dy;
        break;
      case 'pen':
        if (el.points) {
          el.points.forEach(p => {
            p.x += dx;
            p.y += dy;
          });
        }
        break;
    }
  }

  function resizeElement(el, handle, dx, dy) {
    switch (el.type) {
      case 'rect':
      case 'mosaic':
      case 'blur': {
        if (handle === 'br') {
          el.width += dx;
          el.height += dy;
        } else if (handle === 'tl') {
          el.x += dx;
          el.y += dy;
          el.width -= dx;
          el.height -= dy;
        } else if (handle === 'tr') {
          el.y += dy;
          el.width += dx;
          el.height -= dy;
        } else if (handle === 'bl') {
          el.x += dx;
          el.width -= dx;
          el.height += dy;
        }
        break;
      }
      case 'circle': {
        const signX = (handle === 'tr' || handle === 'br') ? 1 : -1;
        const signY = (handle === 'bl' || handle === 'br') ? 1 : -1;
        el.rx = Math.max(6, el.rx + signX * (dx / 2));
        el.ry = Math.max(6, el.ry + signY * (dy / 2));
        break;
      }
      case 'arrow':
      case 'highlighter': {
        if (handle === 'br' || handle === 'tr') {
          el.x2 += dx;
          el.y2 += dy;
        } else {
          el.x1 += dx;
          el.y1 += dy;
        }
        break;
      }
      case 'step': {
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        const sign = (handle === 'br' || handle === 'tr') ? 1 : -1;
        el.radius = Math.max(10, Math.min(80, (el.radius || 20) + sign * delta * 0.5));
        break;
      }
      case 'text': {
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        const sign = (handle === 'br' || handle === 'tr') ? 1 : -1;
        el.fontSize = Math.max(12, Math.min(96, Math.round((el.fontSize || 18) + sign * delta * 0.5)));
        break;
      }
    }
  }

  function createLiveShape(x1, y1, x2, y2) {
    switch (currentTool) {
      case 'rect':
        return {
          type: 'rect',
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
          color: currentColor,
          strokeWidth: currentStrokeWidth
        };
      case 'circle': {
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;
        return {
          type: 'circle',
          cx: Math.min(x1, x2) + rx,
          cy: Math.min(y1, y2) + ry,
          rx,
          ry,
          color: currentColor,
          strokeWidth: currentStrokeWidth
        };
      }
      case 'arrow':
        return {
          type: 'arrow',
          x1,
          y1,
          x2,
          y2,
          color: currentColor,
          strokeWidth: currentStrokeWidth
        };
      case 'highlighter':
        return {
          type: 'highlighter',
          x1,
          y1,
          x2,
          y2,
          color: currentColor,
          strokeWidth: currentStrokeWidth
        };
      case 'mosaic':
        return {
          type: 'mosaic',
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1
        };
      case 'blur':
        return {
          type: 'blur',
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1
        };
      default:
        return null;
    }
  }

  function isValidElement(el) {
    if (!el) return false;
    if (el.type === 'pen') return el.points && el.points.length > 1;
    if (el.type === 'rect' || el.type === 'mosaic' || el.type === 'blur') return Math.abs(el.width) > 3 || Math.abs(el.height) > 3;
    if (el.type === 'circle') return el.rx > 3 || el.ry > 3;
    if (el.type === 'arrow' || el.type === 'highlighter') return Math.hypot(el.x2 - el.x1, el.y2 - el.y1) > 4;
    return true;
  }

  // --------------------------------------------------------------------------
  // INLINE TEXT TOOL
  // --------------------------------------------------------------------------

  function promptInlineText(canvasX, canvasY) {
    commitActiveText();

    const inputEl = document.getElementById('canvas-inline-text-input');
    if (!inputEl) {
      const text = prompt("Metin girin:");
      if (text) {
        elements.push({
          type: 'text',
          x: canvasX,
          y: canvasY,
          text,
          fontSize: Math.max(16, Math.round(currentStrokeWidth * 5.5)),
          color: currentColor
        });
        selectedElementIndex = elements.length - 1;
        notifySelectionChange();
        saveState();
        render(true);
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
        elements.push({
          type: 'text',
          x: canvasX,
          y: canvasY,
          text,
          fontSize,
          color: currentColor
        });
        selectedElementIndex = elements.length - 1;
        notifySelectionChange();
        saveState();
        render(true);
      }
    };

    activeTextCommit = () => finish(true);

    const onBlur = () => {
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

  // --------------------------------------------------------------------------
  // CROP & EXPORT
  // --------------------------------------------------------------------------

  function cropToRect(cropX, cropY, cropW, cropH) {
    commitActiveText();
    if (!activeCanvas || !baseCanvas || cropW <= 10 || cropH <= 10) return;

    // Crop base canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempCtx.drawImage(baseCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    baseCanvas.width = cropW;
    baseCanvas.height = cropH;
    baseCtx.drawImage(tempCanvas, 0, 0);

    activeCanvas.width = cropW;
    activeCanvas.height = cropH;

    // Offset all elements by (-cropX, -cropY)
    elements.forEach(el => moveElement(el, -cropX, -cropY));
    selectedElementIndex = -1;
    notifySelectionChange();

    saveState();
    render(true);
  }

  function getSelectedElement() {
    return (selectedElementIndex >= 0 && selectedElementIndex < elements.length)
      ? elements[selectedElementIndex]
      : null;
  }

  function getEditedDataURL(format = 'image/png', quality = 0.94) {
    commitActiveText();
    if (!activeCanvas) return '';
    render(false);
    const url = activeCanvas.toDataURL(format, quality);
    render(true);
    return url;
  }

  return {
    initEditor,
    setTool,
    getTool: () => currentTool,
    setColor,
    getColor: () => currentColor,
    getColorAtCoords,
    setOnColorPicked: (cb) => { onColorPickedCallback = cb; },
    setStrokeWidth,
    deleteSelected,
    getSelectedElement,
    undo,
    redo,
    resetToOriginal,
    cropToRect,
    getEditedDataURL
  };
})();
