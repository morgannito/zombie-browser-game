/**
 * SCREENSHOT MANAGER
 * F2 → capture gameCanvas → watermark → toast with thumbnail + share
 * @module ScreenshotManager
 * @version 1.0.0
 */

class ScreenshotManager {
  constructor() {
    this._handler = e => this._onKeyDown(e);
    window.addEventListener('keydown', this._handler, { capture: true });
  }

  _onKeyDown(e) {
    if (e.key === 'F2') {
      e.preventDefault();
      this.capture();
    }
  }

  /** Returns { wave, score } from global game state, gracefully */
  _getGameInfo() {
    const state = window.gameState?.state;
    const wave = state?.wave ?? null;
    const playerId = window.gameState?.playerId;
    const player = playerId ? state?.players?.[playerId] : null;
    const score = player?.totalScore ?? null;
    return { wave, score };
  }

  /** Draw watermark on a canvas 2d context */
  _drawWatermark(ctx, width, height) {
    const { wave, score } = this._getGameInfo();
    const parts = ['Zombie Survival'];
    if (wave !== null) parts.push(`Wave ${wave}`);
    if (score !== null) parts.push(`Score ${score.toLocaleString()}`);
    const text = parts.join('  •  ');

    const padding = 8;
    const fontSize = Math.max(12, Math.round(height * 0.022));
    ctx.save();
    ctx.font = `bold ${fontSize}px sans-serif`;
    const metrics = ctx.measureText(text);
    const boxW = metrics.width + padding * 2;
    const boxH = fontSize + padding * 2;
    const x = width - boxW - 8;
    const y = height - boxH - 8;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect?.(x, y, boxW, boxH, 4) ?? ctx.rect(x, y, boxW, boxH);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(text, x + padding, y + padding + fontSize * 0.85);
    ctx.restore();
  }

  capture() {
    const source = document.getElementById('gameCanvas');
    if (!source) return;

    // Create offscreen copy with watermark
    const offscreen = document.createElement('canvas');
    offscreen.width = source.width;
    offscreen.height = source.height;
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(source, 0, 0);
    this._drawWatermark(ctx, offscreen.width, offscreen.height);

    offscreen.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      this._showToast(url, blob);
    }, 'image/png');
  }

  _showToast(objectUrl, blob) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast success screenshot-toast';
    toast.style.cssText = 'cursor:default; gap:10px;';

    // Thumbnail
    const thumb = document.createElement('img');
    thumb.src = objectUrl;
    thumb.title = 'Ouvrir dans un nouvel onglet';
    thumb.style.cssText =
      'width:72px;height:48px;object-fit:cover;border-radius:4px;cursor:pointer;flex-shrink:0;';
    thumb.addEventListener('click', () => {
      window.open(objectUrl, '_blank');
    });

    // Text block
    const content = document.createElement('div');
    content.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;';

    const title = document.createElement('div');
    title.className = 'toast-title';
    title.textContent = 'Screenshot saved!';

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.textContent = '📤 Share';
    shareBtn.style.cssText =
      'margin-top:2px;padding:2px 8px;font-size:12px;border:1px solid rgba(255,255,255,0.4);' +
      'border-radius:4px;background:rgba(255,255,255,0.15);color:inherit;cursor:pointer;width:fit-content;';
    shareBtn.addEventListener('click', async e => {
      e.stopPropagation();
      await this._share(objectUrl, blob, shareBtn);
    });

    content.appendChild(title);
    content.appendChild(shareBtn);
    toast.appendChild(thumb);
    toast.appendChild(content);
    container.appendChild(toast);

    // Auto-dismiss after 6 s
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => {
        toast.remove();
        URL.revokeObjectURL(objectUrl);
      }, 300);
    }, 6000);
  }

  async _share(objectUrl, blob, btn) {
    // Web Share API (mobile / supported browsers)
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'screenshot.png', { type: 'image/png' })] })) {
      try {
        await navigator.share({
          title: 'Zombie Survival',
          files: [new File([blob], 'screenshot.png', { type: 'image/png' })],
        });
        return;
      } catch (_) {
        // Fallback to copy
      }
    }

    // Fallback: copy dataURL to clipboard or trigger download
    try {
      const dataUrl = await this._blobToDataUrl(blob);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(dataUrl);
        btn.textContent = '✅ Copied!';
      } else {
        this._download(objectUrl);
        btn.textContent = '✅ Downloaded!';
      }
    } catch (_) {
      this._download(objectUrl);
      btn.textContent = '✅ Downloaded!';
    }
    setTimeout(() => { btn.textContent = '📤 Share'; }, 2000);
  }

  _blobToDataUrl(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }

  _download(objectUrl) {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `zombie-survival-${Date.now()}.png`;
    a.click();
  }

  cleanup() {
    window.removeEventListener('keydown', this._handler, { capture: true });
  }
}

window.ScreenshotManager = ScreenshotManager;
