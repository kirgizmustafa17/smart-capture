# SmartCapture PRO 📸

> Powerful, privacy-first Chrome & Chromium screenshot extension with DOM element inspection, freehand cropping, full-page stitching, and an integrated Canvas Editor Studio.

[English](README.md) | [Türkçe](README.tr.md)

---

## 🌟 Key Features

### 🎯 5 Flexible Capture Modes
1. **Element / DOM Block Selector**: Hover over any HTML element, chart, header, or card to automatically detect its bounding box and capture it with a single click.
2. **Rectangle Selection**: Drag to define any custom rectangular capture area with live dimensions and snap coordinates.
3. **Freehand Lasso Tool**: Draw any custom contour or polygonal area for organic crops.
4. **Visible Viewport**: Instantly capture the currently visible tab in full device pixel resolution.
5. **Full Page Stitching**: Automated scroll-and-stitch capture for long documents and endless web feeds.

### 🎨 Integrated Editor Studio
- **Annotation Tools**: Brushes, arrows, shapes (rectangles, ellipses), and text labels.
- **Eyedropper Color Picker (I)**:
  - Precision live magnifier loupe HUD to sample any pixel color directly from the image canvas.
  - Automatically copies hex code to clipboard and registers into the active palette swatch.
- **Privacy Obfuscation**:
  - **Pixelate (Mosaic)**: Obfuscate sensitive credentials, emails, and account numbers.
  - **Gaussian Blur**: Soft blur for subtle background or privacy redaction.
- **Color & Size Customization**: Rich palette selection with adjustable stroke thickness.
- **History & Canvas Performance**: Full Undo/Redo stack with optimized `willReadFrequently` Canvas2D rendering.

### ⚡ Seamless Workflow, Right Export Dock & Multi-Format
- **Right Export Sidebar / Dock**:
  - One-click format switcher pills (`PNG`, `JPG`, `WebP`).
  - Tactile **Copy to Clipboard** (`Ctrl+C`) and **Download** (`Ctrl+S`) action buttons.
  - Live image overview card with resolution dimensions, aspect ratio, and active sampled color.
  - Collapsible dock layout with dedicated toggle controls.
- **Keyboard Shortcuts**: V (Select), P (Pen), A (Arrow), R (Rect), O (Circle), H (Highlight), M (Mosaic), B (Blur), T (Text), N (Step), C (Crop), I (Eyedropper).
- **i18n Ready**: Native multi-language support (English and Turkish).

---

## 🚀 Installation (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/kirgizmustafa17/smart-capture.git
   ```
2. Open Chrome (or any Chromium browser like Brave, Edge, Opera) and navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** (*Paketlenmemiş öğe yükle*).
5. Select the cloned `smart-capture` folder.
6. The SmartCapture PRO icon will appear in your browser extensions bar!

---

## 📁 Architecture & File Structure

```text
smart-capture/
├── manifest.json            # Chrome Manifest V3 configuration
├── _locales/                # Internationalization strings (en, tr)
│   ├── en/messages.json
│   └── tr/messages.json
├── background/              # Background service worker (capture orchestration)
│   └── background.js
├── content/                 # Content scripts injected into web pages
│   ├── area-select.js       # Rectangular area selector
│   ├── freehand-select.js   # Freehand lasso selector
│   ├── inspector.js         # DOM element hover & snap inspector
│   ├── full-page.js         # Scrolling full-page stitcher
│   ├── editor.js            # In-page overlay editor helpers
│   ├── content.js           # Content coordinator
│   └── content.css          # Injected styles
├── editor/                  # Full-screen Editor Studio (standalone tab)
│   ├── editor.html
│   ├── editor.js
│   ├── editor.css
│   └── canvas-engine.js     # Vector annotation, filter & selection engine
├── popup/                   # Browser action extension popup UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── lib/                     # Common utilities
│   └── utils.js
├── icons/                   # Extension icons (16, 48, 128px)
├── GEMINI.md                # Project rules & SemVer policy
└── generate_icons.js        # Canvas script to generate app icons
```

---

## 🔒 Permissions & Privacy

- **Permissions**: `activeTab`, `scripting`, `downloads`, `storage`, `contextMenus`.
- **Zero External Tracking**: All image processing, canvas operations, blurring, and stitching happen **100% locally on your machine**. No captured data or browsing habits are ever uploaded to any third-party server.

---

## 📌 Versioning

This project adheres strictly to [Semantic Versioning (SemVer 2.0.0)](https://semver.org/).
- **MAJOR**: Breaking architectural changes or incompatible extension updates.
- **MINOR**: New backward-compatible features and tools.
- **PATCH**: Backward-compatible bug fixes and performance improvements.

The canonical version is maintained in `manifest.json`.

---

## 📄 License

MIT License © 2026 Mustafa Kırgız
