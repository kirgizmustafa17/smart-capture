/**
 * SmartCapture PRO Full-Screen Editor Studio Controller
 * Loads pending screenshot from storage and provides full-screen studio annotation tools.
 */

document.addEventListener('DOMContentLoaded', () => {
  initStudio();
});

function initStudio() {
  const canvasEl = document.getElementById('studio-canvas');
  const dimInfo = document.getElementById('image-dimensions-info');

  // Load screenshot data from chrome.storage.local
  chrome.storage.local.get(['pendingScreenshot'], (result) => {
    const dataUrl = result.pendingScreenshot;
    if (!dataUrl) {
      dimInfo.textContent = "Görsel bulunamadı veya yüklenemedi.";
      return;
    }

    // Initialize SmartEditor Canvas
    if (window.SmartEditor) {
      SmartEditor.initEditor(canvasEl, dataUrl);
    }

    // Calculate dimensions
    const imgTemp = new Image();
    imgTemp.onload = () => {
      dimInfo.textContent = `Boyut: ${imgTemp.width} × ${imgTemp.height} px`;
    };
    imgTemp.src = dataUrl;

    setupToolInteractions(dataUrl);
    setupKeyboardShortcuts(dataUrl);
  });
}

function setupToolInteractions(originalDataUrl) {
  // Tool selection buttons
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (window.SmartEditor) SmartEditor.setTool(btn.dataset.tool);
    });
  });

  // Undo button
  document.getElementById('btn-undo').addEventListener('click', () => {
    if (window.SmartEditor) SmartEditor.undo();
  });

  // Color dots
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      if (window.SmartEditor) SmartEditor.setColor(dot.dataset.color);
    });
  });

  // Copy to clipboard button
  const formatSelect = document.getElementById('export-format');
  document.getElementById('btn-copy').addEventListener('click', async () => {
    const format = formatSelect.value;
    const editedUrl = window.SmartEditor ? SmartEditor.getEditedDataURL(format) : originalDataUrl;
    const blob = SmartUtils.dataURLToBlob(editedUrl);

    const success = await SmartUtils.copyBlobToClipboard(blob);
    if (success) {
      SmartUtils.showToast(SmartUtils.t('copiedSuccess', 'Panoya kopyalandı!'), 'success');
    } else {
      SmartUtils.showToast("Copy failed", "error");
    }
  });

  // Download image button
  document.getElementById('btn-download').addEventListener('click', () => {
    const format = formatSelect.value;
    const editedUrl = window.SmartEditor ? SmartEditor.getEditedDataURL(format) : originalDataUrl;
    const blob = SmartUtils.dataURLToBlob(editedUrl);

    const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
    const filename = `smartcapture_studio_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.${ext}`;
    SmartUtils.downloadBlob(blob, filename);
    SmartUtils.showToast(SmartUtils.t('downloadSuccess', 'İndiriliyor...'), 'success');
  });
}

function setupKeyboardShortcuts(originalDataUrl) {
  document.addEventListener('keydown', (e) => {
    // Undo: Ctrl+Z
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (window.SmartEditor) SmartEditor.undo();
    }
    // Copy: Ctrl+C
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const formatSelect = document.getElementById('export-format');
      if (!formatSelect) return;
      e.preventDefault();
      const format = formatSelect.value;
      const editedUrl = window.SmartEditor ? SmartEditor.getEditedDataURL(format) : originalDataUrl;
      const blob = SmartUtils.dataURLToBlob(editedUrl);
      SmartUtils.copyBlobToClipboard(blob).then(success => {
        if (success) SmartUtils.showToast("Panoya kopyalandı! (Ctrl+C)", "success");
      });
    }
    // Save: Ctrl+S
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      const formatSelect = document.getElementById('export-format');
      if (!formatSelect) return;
      e.preventDefault();
      const format = formatSelect.value;
      const editedUrl = window.SmartEditor ? SmartEditor.getEditedDataURL(format) : originalDataUrl;
      const blob = SmartUtils.dataURLToBlob(editedUrl);
      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/webp' ? 'webp' : 'png';
      const filename = `smartcapture_studio_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.${ext}`;
      SmartUtils.downloadBlob(blob, filename);
      SmartUtils.showToast("İndiriliyor... (Ctrl+S)", "success");
    }
  });
}
