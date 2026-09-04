/**
 * SmartCapture PRO Full-Screen Editor Studio Controller
 * Coordinates canvas tools, crop interaction, zoom/pan navigation, export actions, and shortcuts.
 */

document.addEventListener('DOMContentLoaded', () => {
  initStudio();
});

let currentZoom = 1;
let currentImageSrc = null;

function initStudio() {
  const canvasEl = document.getElementById('studio-canvas');
  const dimInfo = document.getElementById('image-dimensions-info');
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');

  // Load screenshot data from chrome.storage.local
  chrome.storage.local.get(['pendingScreenshot'], (result) => {
    const dataUrl = result.pendingScreenshot;
    if (!dataUrl) {
      dimInfo.textContent = "Görsel yüklenemedi.";
      SmartUtils.showToast("Görsel bulunamadı veya aktarılamadı.", "error");
      return;
    }

    currentImageSrc = dataUrl;

    // Initialize SmartEditor Canvas with history callback
    if (window.SmartEditor) {
      SmartEditor.initEditor(canvasEl, dataUrl, ({ canUndo, canRedo }) => {
        if (undoBtn) undoBtn.disabled = !canUndo;
        if (redoBtn) redoBtn.disabled = !canRedo;
        updateDimensions();
      });
    }

    updateDimensions();
    setupToolInteractions();
    setupStrokeWidthControls();
    setupColorPalette();
    setupHistoryControls();
    setupZoomControls();
    setupExportActions();
    setupKeyboardShortcuts();
    setupCropInteraction();
    setupCursorTracking();
  });
}

function updateDimensions() {
  const canvasEl = document.getElementById('studio-canvas');
  const dimInfo = document.getElementById('image-dimensions-info');
  if (canvasEl && dimInfo) {
    dimInfo.textContent = `${canvasEl.width} × ${canvasEl.height} px`;
  }
}

/**
 * Tool selection buttons
 */
function setupToolInteractions() {
  const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
  const wrapper = document.getElementById('canvas-wrapper');
  const toolIndicator = document.getElementById('active-tool-indicator');

  const toolLabels = {
    select: 'Seç & Taşı (V)',
    pen: 'Serbest Çizim (P)',
    arrow: 'Ok Çiz (A)',
    rect: 'Dikdörtgen Kutu (R)',
    circle: 'Daire / Elips (O)',
    highlighter: 'Vurgulayıcı Fosfor (H)',
    mosaic: 'Pikselli Mozaik (M)',
    blur: 'Yumuşak Blur (B)',
    text: 'Metin Ekle (T)',
    step: 'Adım İşareti (N)',
    crop: 'Görseli Kırp (C)'
  };

  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      selectTool(tool);
    });
  });

  window.selectTool = function (tool) {
    toolButtons.forEach(b => b.classList.toggle('active', b.dataset.tool === tool));

    if (wrapper) {
      wrapper.className = `canvas-wrapper tool-${tool}`;
    }

    if (toolIndicator && toolLabels[tool]) {
      toolIndicator.textContent = `Araç: ${toolLabels[tool]}`;
    }

    if (window.SmartEditor) {
      SmartEditor.setTool(tool);
    }

    // Toggle crop overlay visibility if entering/exiting crop
    const cropBox = document.getElementById('crop-overlay-box');
    if (cropBox && tool !== 'crop') {
      cropBox.classList.add('hidden');
    }
  };
}

/**
 * Stroke width selector
 */
function setupStrokeWidthControls() {
  const strokeButtons = document.querySelectorAll('.stroke-btn[data-stroke]');
  strokeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      strokeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const width = parseInt(btn.dataset.stroke, 10);
      if (window.SmartEditor) SmartEditor.setStrokeWidth(width);
    });
  });
}

/**
 * Color swatches
 */
function setupColorPalette() {
  const colorDots = document.querySelectorAll('.color-dot');
  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      colorDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      const color = dot.dataset.color;
      if (window.SmartEditor) SmartEditor.setColor(color);
    });
  });
}

/**
 * History (Undo, Redo, Reset)
 */
function setupHistoryControls() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  const resetBtn = document.getElementById('btn-reset');

  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (window.SmartEditor) SmartEditor.undo();
    });
  }

  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      if (window.SmartEditor) SmartEditor.redo();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm("Tüm çizimleri sıfırlamak istediğinize emin misiniz?")) {
        if (window.SmartEditor) SmartEditor.resetToOriginal();
        SmartUtils.showToast("Tuval sıfırlandı", "info");
      }
    });
  }
}

/**
 * Zoom and Viewport Navigation
 */
function setupZoomControls() {
  const zoomInBtn = document.getElementById('btn-zoom-in');
  const zoomOutBtn = document.getElementById('btn-zoom-out');
  const zoomFitBtn = document.getElementById('btn-zoom-fit');
  const zoomText = document.getElementById('zoom-badge-text');
  const zoomInfo = document.getElementById('canvas-zoom-info');
  const wrapper = document.getElementById('canvas-wrapper');
  const viewport = document.getElementById('canvas-viewport');

  function applyZoom(newZoom) {
    currentZoom = Math.min(3, Math.max(0.2, newZoom));
    const zoomPct = `${Math.round(currentZoom * 100)}%`;
    if (zoomText) zoomText.textContent = zoomPct;
    if (zoomInfo) zoomInfo.textContent = zoomPct;

    if (wrapper) {
      wrapper.style.transform = `scale(${currentZoom})`;
      wrapper.style.transformOrigin = 'center center';
    }
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => applyZoom(currentZoom + 0.15));
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => applyZoom(currentZoom - 0.15));
  }

  if (zoomFitBtn) {
    zoomFitBtn.addEventListener('click', () => {
      if (currentZoom !== 1) {
        applyZoom(1);
      } else {
        // Calculate fit to viewport
        const canvas = document.getElementById('studio-canvas');
        if (canvas && viewport) {
          const vWidth = viewport.clientWidth - 80;
          const vHeight = viewport.clientHeight - 80;
          const scale = Math.min(vWidth / canvas.width, vHeight / canvas.height, 1);
          applyZoom(scale);
        }
      }
    });
  }

  // Ctrl + Wheel Zoom
  if (viewport) {
    viewport.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        applyZoom(currentZoom + delta);
      }
    }, { passive: false });
  }
}

/**
 * Interactive Crop Mode
 */
function setupCropInteraction() {
  const canvas = document.getElementById('studio-canvas');
  const cropBox = document.getElementById('crop-overlay-box');
  const cropDims = document.getElementById('crop-dimensions');
  const applyBtn = document.getElementById('btn-apply-crop');
  const cancelBtn = document.getElementById('btn-cancel-crop');

  let isCropping = false;
  let startCropX = 0, startCropY = 0;
  let cropRect = { x: 0, y: 0, w: 0, h: 0 };

  if (!canvas || !cropBox) return;

  canvas.addEventListener('pointerdown', (e) => {
    const activeBtn = document.querySelector('.tool-btn.active');
    if (!activeBtn || activeBtn.dataset.tool !== 'crop') return;

    const rect = canvas.getBoundingClientRect();
    startCropX = e.clientX - rect.left;
    startCropY = e.clientY - rect.top;

    cropBox.classList.remove('hidden');
    cropBox.style.left = `${startCropX}px`;
    cropBox.style.top = `${startCropY}px`;
    cropBox.style.width = '0px';
    cropBox.style.height = '0px';

    isCropping = true;
  });

  window.addEventListener('pointermove', (e) => {
    if (!isCropping) return;

    const rect = canvas.getBoundingClientRect();
    const curX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const curY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const left = Math.min(startCropX, curX);
    const top = Math.min(startCropY, curY);
    const width = Math.abs(curX - startCropX);
    const height = Math.abs(curY - startCropY);

    cropBox.style.left = `${left}px`;
    cropBox.style.top = `${top}px`;
    cropBox.style.width = `${width}px`;
    cropBox.style.height = `${height}px`;

    // Scale to physical canvas pixels
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    cropRect = {
      x: Math.round(left * scaleX),
      y: Math.round(top * scaleY),
      w: Math.round(width * scaleX),
      h: Math.round(height * scaleY)
    };

    if (cropDims) {
      cropDims.textContent = `${cropRect.w} × ${cropRect.h} px`;
    }
  });

  window.addEventListener('pointerup', () => {
    if (isCropping) {
      isCropping = false;
    }
  });

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      if (cropRect.w > 20 && cropRect.h > 20) {
        if (window.SmartEditor) {
          SmartEditor.cropToRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
          updateDimensions();
        }
      }
      cropBox.classList.add('hidden');
      window.selectTool('select');
      SmartUtils.showToast("Görsel kırpıldı", "success");
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      cropBox.classList.add('hidden');
      window.selectTool('select');
    });
  }
}

/**
 * Footer live cursor coordinates
 */
function setupCursorTracking() {
  const canvas = document.getElementById('studio-canvas');
  const posInfo = document.getElementById('cursor-pos-info');
  if (!canvas || !posInfo) return;

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.max(0, Math.round((e.clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.round((e.clientY - rect.top) * scaleY));
    posInfo.textContent = `X: ${x}  Y: ${y}`;
  });
}

/**
 * Export actions (Copy, Download)
 */
function setupExportActions() {
  const formatSelect = document.getElementById('export-format');
  const copyBtn = document.getElementById('btn-copy');
  const downloadBtn = document.getElementById('btn-download');

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const format = formatSelect ? formatSelect.value : 'image/png';
      const editedUrl = window.SmartEditor ? SmartEditor.getEditedDataURL(format) : currentImageSrc;
      const blob = SmartUtils.dataURLToBlob(editedUrl);

      const success = await SmartUtils.copyBlobToClipboard(blob);
      if (success) {
        SmartUtils.showToast("Panoya kopyalandı! (Ctrl+C)", "success");
      } else {
        SmartUtils.showToast("Kopyalama başarısız", "error");
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const format = formatSelect ? formatSelect.value : 'image/png';
      const editedUrl = window.SmartEditor ? SmartEditor.getEditedDataURL(format) : currentImageSrc;
      const blob = SmartUtils.dataURLToBlob(editedUrl);

      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
      const filename = `smartcapture_studio_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.${ext}`;
      SmartUtils.downloadBlob(blob, filename);
      SmartUtils.showToast("Görsel indiriliyor... (Ctrl+S)", "success");
    });
  }
}

/**
 * Keyboard shortcuts controller
 */
function setupKeyboardShortcuts() {
  const toolKeyMap = {
    'v': 'select',
    'p': 'pen',
    'a': 'arrow',
    'r': 'rect',
    'o': 'circle',
    'h': 'highlighter',
    'm': 'mosaic',
    'b': 'blur',
    't': 'text',
    'n': 'step',
    'c': 'crop'
  };

  document.addEventListener('keydown', (e) => {
    const isEditingText = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    if (isEditingText) return;

    const key = e.key.toLowerCase();

    // Tool hotkeys
    if (!e.ctrlKey && !e.metaKey && toolKeyMap[key]) {
      e.preventDefault();
      window.selectTool(toolKeyMap[key]);
      return;
    }

    // Undo: Ctrl+Z
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'z') {
      e.preventDefault();
      if (window.SmartEditor) SmartEditor.undo();
      return;
    }

    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if ((e.ctrlKey || e.metaKey) && (key === 'y' || (e.shiftKey && key === 'z'))) {
      e.preventDefault();
      if (window.SmartEditor) SmartEditor.redo();
      return;
    }

    // Copy: Ctrl+C
    if ((e.ctrlKey || e.metaKey) && key === 'c') {
      const copyBtn = document.getElementById('btn-copy');
      if (copyBtn) copyBtn.click();
      return;
    }

    // Save: Ctrl+S
    if ((e.ctrlKey || e.metaKey) && key === 's') {
      e.preventDefault();
      const downloadBtn = document.getElementById('btn-download');
      if (downloadBtn) downloadBtn.click();
      return;
    }

    // Zoom In: + or =
    if (key === '+' || key === '=') {
      const zoomInBtn = document.getElementById('btn-zoom-in');
      if (zoomInBtn) zoomInBtn.click();
      return;
    }

    // Zoom Out: -
    if (key === '-') {
      const zoomOutBtn = document.getElementById('btn-zoom-out');
      if (zoomOutBtn) zoomOutBtn.click();
      return;
    }

    // Escape: Return to select tool
    if (e.key === 'Escape') {
      const cropBox = document.getElementById('crop-overlay-box');
      if (cropBox) cropBox.classList.add('hidden');
      window.selectTool('select');
    }
  });
}
