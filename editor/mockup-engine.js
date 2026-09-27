/**
 * SmartCapture PRO Mockup Studio Engine
 * Composites screenshots onto beautiful social media / presentation mockup frames:
 * - Gradient wallpaper backgrounds (Sunset, Cosmic Indigo, Emerald Glow, Obsidian, Slate, Clean White)
 * - Window chrome with macOS traffic light dots
 * - Soft/deep drop shadows and configurable corner rounding
 */

window.SmartMockup = (function () {
  'use strict';

  const PRESETS = {
    'cosmic': {
      name: 'Kozmik Gece',
      type: 'gradient',
      colors: ['#0f172a', '#1e1b4b', '#312e81', '#4338ca']
    },
    'sunset': {
      name: 'Kadife Günbatımı',
      type: 'gradient',
      colors: ['#f43f5e', '#8b5cf6', '#3b82f6']
    },
    'emerald': {
      name: 'Zümrüt Derinlik',
      type: 'gradient',
      colors: ['#022c22', '#064e3b', '#047857', '#10b981']
    },
    'obsidian': {
      name: 'Obsidyen Kafes',
      type: 'gradient',
      colors: ['#090d16', '#111827', '#1f2937']
    },
    'slate': {
      name: 'Modern Gri',
      type: 'gradient',
      colors: ['#1e293b', '#334155', '#475569']
    },
    'white': {
      name: 'Açık Stüdyo',
      type: 'solid',
      color: '#f8fafc'
    }
  };

  const defaultOptions = {
    enabled: false,
    preset: 'cosmic',
    padding: 48,
    borderRadius: 14,
    windowHeader: 'mac', // 'mac', 'clean', 'none'
    shadow: 'deep' // 'none', 'soft', 'deep'
  };

  let currentConfig = { ...defaultOptions };

  function getConfig() {
    return { ...currentConfig };
  }

  function setConfig(newConfig) {
    currentConfig = { ...currentConfig, ...newConfig };
  }

  function drawRoundedRect(ctx, x, y, width, height, radius) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
      return;
    }
    // Fallback for older canvas implementations
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /**
   * Render source canvas onto a framed mockup canvas
   * @param {HTMLCanvasElement} sourceCanvas
   * @param {Object} [options]
   * @returns {HTMLCanvasElement}
   */
  function renderMockupCanvas(sourceCanvas, options = {}) {
    const config = { ...currentConfig, ...options };
    if (!config.enabled) return sourceCanvas;

    const padding = Math.max(0, config.padding);
    const radius = Math.max(0, config.borderRadius);
    const headerHeight = config.windowHeader === 'mac' ? 36 : (config.windowHeader === 'clean' ? 12 : 0);

    const innerW = sourceCanvas.width;
    const innerH = sourceCanvas.height;
    const windowW = innerW;
    const windowH = innerH + headerHeight;

    const outW = windowW + padding * 2;
    const outH = windowH + padding * 2;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const ctx = outCanvas.getContext('2d', { willReadFrequently: true });

    // 1. Draw Background
    const preset = PRESETS[config.preset] || PRESETS.cosmic;
    if (preset.type === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, outW, outH);
      const step = 1 / (preset.colors.length - 1);
      preset.colors.forEach((c, idx) => {
        grad.addColorStop(Math.min(1, idx * step), c);
      });
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = preset.color || '#f8fafc';
    }
    ctx.fillRect(0, 0, outW, outH);

    // 2. Draw Window Drop Shadow
    const winX = padding;
    const winY = padding;

    if (config.shadow !== 'none') {
      ctx.save();
      if (config.shadow === 'deep') {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 48;
        ctx.shadowOffsetY = 24;
      } else {
        // Soft
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;
      }
      ctx.fillStyle = '#000000';
      drawRoundedRect(ctx, winX, winY, windowW, windowH, radius);
      ctx.fill();
      ctx.restore();
    }

    // 3. Clip and Draw Window Container
    ctx.save();
    drawRoundedRect(ctx, winX, winY, windowW, windowH, radius);
    ctx.clip();

    // Fill window interior background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(winX, winY, windowW, windowH);

    // 4. Draw macOS Traffic Lights Header if enabled
    if (config.windowHeader === 'mac') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(winX, winY, windowW, headerHeight);

      // Traffic dots: Red (#ff5f56), Yellow (#ffbd2e), Green (#27c93f)
      const dotRadius = 5.5;
      const dotY = winY + headerHeight / 2;
      const startX = winX + 16;
      const spacing = 18;

      const dots = [
        { color: '#ff5f56', border: 'rgba(0,0,0,0.15)' },
        { color: '#ffbd2e', border: 'rgba(0,0,0,0.15)' },
        { color: '#27c93f', border: 'rgba(0,0,0,0.15)' }
      ];

      dots.forEach((dot, i) => {
        const cx = startX + i * spacing;
        ctx.beginPath();
        ctx.arc(cx, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = dot.color;
        ctx.fill();
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = dot.border;
        ctx.stroke();
      });

      // Subtle bottom line for header
      ctx.beginPath();
      ctx.moveTo(winX, winY + headerHeight);
      ctx.lineTo(winX + windowW, winY + headerHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (config.windowHeader === 'clean') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(winX, winY, windowW, headerHeight);
    }

    // 5. Draw Screenshot Image
    const imgY = winY + headerHeight;
    ctx.drawImage(sourceCanvas, winX, imgY, innerW, innerH);

    // 6. Draw 1px Subtle Inner Window Perimeter
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, winX, winY, windowW, windowH, radius);
    ctx.stroke();

    ctx.restore();

    return outCanvas;
  }

  return {
    PRESETS,
    getConfig,
    setConfig,
    renderMockupCanvas
  };
})();
