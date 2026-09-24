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
  const deleteBtn = document.getElementById('btn-delete');

  // Load screenshot data from chrome.storage.local
  chrome.storage.local.get(['pendingScreenshot'], (result) => {
    const dataUrl = result.pendingScreenshot;
    if (!dataUrl) {
      dimInfo.textContent = "Görsel yüklenemedi.";
      SmartUtils.showToast("Görsel bulunamadı veya aktarılamadı.", "error");
      return;
    }

    currentImageSrc = dataUrl;

    // Initialize SmartEditor Canvas with history & selection callbacks
    if (window.SmartEditor) {
      SmartEditor.initEditor(
        canvasEl,
        dataUrl,
        ({ canUndo, canRedo }) => {
          if (undoBtn) undoBtn.disabled = !canUndo;
          if (redoBtn) redoBtn.disabled = !canRedo;
          updateDimensions();
        },
        (selectedEl) => {
          if (deleteBtn) deleteBtn.disabled = !selectedEl;
          if (selectedEl) {
            if (selectedEl.color) {
              updateActiveColorUI(selectedEl.color);
            }
            if (selectedEl.strokeWidth) {
              document.querySelectorAll('.stroke-btn').forEach(b => {
                b.classList.toggle('active', parseInt(b.dataset.stroke, 10) === selectedEl.strokeWidth);
              });
            }
          }
        }
      );
    }

    updateDimensions();
    setupToolInteractions();
    setupStrokeWidthControls();
    setupColorPalette();
    setupHistoryControls();
    setupZoomControls();
    setupExportActions();
    setupExportDock();
    setupKeyboardShortcuts();
    setupCropInteraction();
    setupCursorTracking();
    setupEyedropperLoupe();
    initI18n();
  });
}

function initI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = SmartUtils.t(key);
    if (message) {
      el.textContent = message;
    }
  });
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function updateDimensions() {
  const canvasEl = document.getElementById('studio-canvas');
  const dimInfo = document.getElementById('image-dimensions-info');
  const dockDim = document.getElementById('dock-dimensions');
  const dockAspect = document.getElementById('dock-aspect-ratio');

  if (canvasEl) {
    const w = canvasEl.width;
    const h = canvasEl.height;
    if (dimInfo) dimInfo.textContent = `${w} × ${h} px`;
    if (dockDim) dockDim.textContent = `${w} × ${h} px`;

    if (dockAspect && w > 0 && h > 0) {
      const d = gcd(w, h);
      const rw = w / d;
      const rh = h / d;
      if (rw <= 32 && rh <= 32) {
        dockAspect.textContent = `${rw}:${rh}`;
      } else {
        dockAspect.textContent = `${(w / h).toFixed(2)}:1`;
      }
    }
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
    crop: 'Görseli Kırp (C)',
    eyedropper: 'Renk Seçici Damlalık (I)'
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

    // Hide eyedropper loupe when leaving eyedropper
    const loupe = document.getElementById('eyedropper-loupe');
    if (loupe && tool !== 'eyedropper') {
      loupe.classList.add('hidden');
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
 * Color swatches & active color management
 */
function updateActiveColorUI(hex) {
  if (!hex) return;
  const lowerHex = hex.toLowerCase();
  const colorDots = document.querySelectorAll('.color-dot');
  let matched = false;

  colorDots.forEach(d => {
    const isMatch = d.dataset.color && d.dataset.color.toLowerCase() === lowerHex;
    d.classList.toggle('active', isMatch);
    if (isMatch) matched = true;
  });

  const pickedDot = document.getElementById('picked-color-dot');
  if (pickedDot) {
    pickedDot.dataset.color = hex;
    pickedDot.style.setProperty('--swatch-color', hex);
    pickedDot.title = `Damlalık ile Seçilen Renk (${hex.toUpperCase()})`;
    pickedDot.classList.remove('hidden');
    if (!matched) {
      pickedDot.classList.add('active');
    }
  }

  const dockSwatch = document.getElementById('dock-color-swatch');
  const dockHex = document.getElementById('dock-color-hex');
  if (dockSwatch) dockSwatch.style.backgroundColor = hex;
  if (dockHex) dockHex.textContent = hex.toUpperCase();
}

function setupColorPalette() {
  const colorDots = document.querySelectorAll('.color-dot');
  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const color = dot.dataset.color;
      updateActiveColorUI(color);
      if (window.SmartEditor) SmartEditor.setColor(color);
    });
  });

  if (window.SmartEditor) {
    SmartEditor.setOnColorPicked((hex) => {
      updateActiveColorUI(hex);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(hex).catch(() => {});
      }
      SmartUtils.showToast(`Renk seçildi: ${hex.toUpperCase()} (Kopyalandı)`, 'success');
    });
  }
}

/**
 * History (Undo, Redo, Reset)
 */
function setupHistoryControls() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  const deleteBtn = document.getElementById('btn-delete');
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

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (window.SmartEditor) SmartEditor.deleteSelected();
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
      const blob = await SmartUtils.dataURLToBlob(editedUrl);

      const success = await SmartUtils.copyBlobToClipboard(blob);
      if (success) {
        SmartUtils.showToast("Panoya kopyalandı! (Ctrl+C)", "success");
      } else {
        SmartUtils.showToast("Kopyalama başarısız", "error");
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      const format = formatSelect ? formatSelect.value : 'image/png';
      const editedUrl = window.SmartEditor ? SmartEditor.getEditedDataURL(format) : currentImageSrc;
      const blob = await SmartUtils.dataURLToBlob(editedUrl);

      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
      const filename = `smartcapture_studio_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.${ext}`;
      SmartUtils.downloadBlob(blob, filename);
      SmartUtils.showToast("Görsel indiriliyor... (Ctrl+S)", "success");
    });
  }
}

/**
 * Right sidebar / export dock controller
 */
function setupExportDock() {
  const formatPills = document.querySelectorAll('.format-pill');
  const formatSelect = document.getElementById('export-format');
  const badgeActive = document.getElementById('format-badge-active');
  const hint = document.getElementById('format-hint');
  const toggleBtn = document.getElementById('btn-toggle-dock');
  const closeBtn = document.getElementById('btn-close-dock');
  const dock = document.getElementById('export-dock');

  const formatHints = {
    'image/png': 'Kayıpsız piksel kalitesi ve şeffaflık desteği.',
    'image/jpeg': 'Daha küçük dosya boyutu, fotoğraflar için ideal.',
    'image/webp': 'Yeni nesil yüksek sıkıştırma ve modern web formatı.'
  };

  const formatBadges = {
    'image/png': 'PNG',
    'image/jpeg': 'JPG',
    'image/webp': 'WebP'
  };

  formatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const format = pill.dataset.format;
      formatPills.forEach(p => p.classList.toggle('active', p === pill));
      if (formatSelect) formatSelect.value = format;
      if (badgeActive && formatBadges[format]) badgeActive.textContent = formatBadges[format];
      if (hint && formatHints[format]) hint.textContent = formatHints[format];
    });
  });

  function toggleDock() {
    if (!dock) return;
    const isCollapsed = dock.classList.toggle('collapsed');
    if (toggleBtn) toggleBtn.classList.toggle('active', !isCollapsed);
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleDock);
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', toggleDock);
  }
}

/**
 * Eyedropper Live Magnifier & Loupe HUD
 */
function setupEyedropperLoupe() {
  const canvas = document.getElementById('studio-canvas');
  const loupe = document.getElementById('eyedropper-loupe');
  const loupeSwatch = document.getElementById('loupe-swatch');
  const loupeHex = document.getElementById('loupe-hex');
  if (!canvas || !loupe) return;

  canvas.addEventListener('pointermove', (e) => {
    if (!window.SmartEditor || SmartEditor.getTool() !== 'eyedropper') {
      loupe.classList.add('hidden');
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    const colorData = SmartEditor.getColorAtCoords(x, y);
    if (colorData) {
      if (loupeSwatch) loupeSwatch.style.backgroundColor = colorData.hex;
      if (loupeHex) loupeHex.textContent = colorData.hex.toUpperCase();
      loupe.style.left = `${e.clientX - rect.left}px`;
      loupe.style.top = `${e.clientY - rect.top}px`;
      loupe.classList.remove('hidden');
    } else {
      loupe.classList.add('hidden');
    }
  });

  canvas.addEventListener('pointerleave', () => {
    loupe.classList.add('hidden');
  });
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
    'c': 'crop',
    'i': 'eyedropper'
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

    // Delete selected element: Delete or Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (window.SmartEditor && SmartEditor.deleteSelected()) {
        e.preventDefault();
        return;
      }
    }

    // Escape: Return to select tool
    if (e.key === 'Escape') {
      const cropBox = document.getElementById('crop-overlay-box');
      if (cropBox) cropBox.classList.add('hidden');
      window.selectTool('select');
    }
  });
}
