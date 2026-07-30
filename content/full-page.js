/**
 * SmartCapture Full Page Auto-Scroll Capture Module
 * Seamlessly scrolls, captures viewports, and stitches them into a full page screenshot.
 */

window.SmartFullPage = (function () {
  'use strict';

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function capture(onCompleteCallback) {
    SmartUtils.showToast(SmartUtils.t('modeFullPageDesc', 'Sayfa otomatik kaydırılarak yakalanıyor...'), 'info', 5000);

    const originalScrollY = window.scrollY;
    const originalScrollX = window.scrollX;

    // Measure total document dimensions
    const body = document.body;
    const html = document.documentElement;
    const totalWidth = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
    const totalHeight = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const dpr = SmartUtils.getDPR();
    const stitchedCanvas = document.createElement('canvas');
    stitchedCanvas.width = Math.round(totalWidth * dpr);
    stitchedCanvas.height = Math.round(totalHeight * dpr);
    const ctx = stitchedCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    let currentY = 0;
    let restoreFixed = null;
    let restoreUI = null;

    try {
      restoreFixed = SmartUtils.hideStickyAndFixedElements();
      restoreUI = SmartUtils.hideExtensionUI();

      while (currentY < totalHeight) {
        window.scrollTo(0, currentY);
        await delay(300); // Allow render/lazy images to settle

        // Request background visible tab capture
        const dataUrl = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, response => {
            if (chrome.runtime.lastError || !response || !response.dataUrl) {
              reject(new Error(chrome.runtime.lastError?.message || "Capture failed"));
            } else {
              resolve(response.dataUrl);
            }
          });
        });

        // Load image and draw onto stitched canvas
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const destY = Math.round(currentY * dpr);
            const drawH = Math.min(img.height, Math.round((totalHeight - currentY) * dpr));
            ctx.drawImage(
              img,
              0, 0, img.width, drawH,
              0, destY, img.width, drawH
            );
            resolve();
          };
          img.src = dataUrl;
        });

        currentY += viewportHeight;
      }

      // Restore fixed elements, extension UI and scroll position
      if (restoreFixed) restoreFixed();
      if (restoreUI) restoreUI();
      window.scrollTo(originalScrollX, originalScrollY);

      const finalDataUrl = stitchedCanvas.toDataURL('image/png');
      if (onCompleteCallback) {
        onCompleteCallback(finalDataUrl);
      }
    } catch (err) {
      console.error("Full page capture error:", err);
      if (restoreFixed) restoreFixed();
      if (restoreUI) restoreUI();
      window.scrollTo(originalScrollX, originalScrollY);
      SmartUtils.showToast("Full page capture error: " + err.message, "error");
    }
  }

  return {
    capture
  };
})();
