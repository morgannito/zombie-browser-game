/**
 * Emote Wheel — local visual only
 * Keys B/N/M/, open the wheel; select an emote to display it above the local player.
 */

class EmoteWheel {
  constructor() {
    this.isOpen = false;
    this.emotes = [
      { id: 'hello',  icon: '👋', label: 'Hello'   },
      { id: 'laugh',  icon: '😂', label: 'Laugh'   },
      { id: 'thumbs', icon: '👍', label: 'Thumbs'  },
      { id: 'angry',  icon: '😡', label: 'Angry'   },
      { id: 'skull',  icon: '☠️', label: 'Skull'   },
      { id: 'target', icon: '🎯', label: 'Target'  },
    ];
    this._el = null;
    this._onKeydown = this._onKeydown.bind(this);
    this._init();
  }

  _init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._setup());
    } else {
      this._setup();
    }
  }

  _setup() {
    this._buildDOM();
    document.addEventListener('keydown', this._onKeydown);
  }

  _buildDOM() {
    const overlay = document.createElement('div');
    overlay.id = 'emote-wheel-overlay';

    const wheel = document.createElement('div');
    wheel.id = 'emote-wheel';

    const title = document.createElement('div');
    title.className = 'emote-wheel-title';
    title.textContent = 'Emote';

    const slots = document.createElement('div');
    slots.className = 'emote-wheel-slots';

    this.emotes.forEach((emote, i) => {
      const btn = document.createElement('button');
      btn.className = 'emote-slot';
      btn.dataset.id = emote.id;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'emote-icon';
      iconSpan.textContent = emote.icon;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'emote-label';
      labelSpan.textContent = emote.label;

      btn.appendChild(iconSpan);
      btn.appendChild(labelSpan);
      btn.addEventListener('click', () => this._select(i));
      slots.appendChild(btn);
    });

    wheel.appendChild(title);
    wheel.appendChild(slots);
    overlay.appendChild(wheel);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    document.body.appendChild(overlay);
    this._el = overlay;
  }

  _onKeydown(e) {
    if (e.repeat) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;

    const key = e.key.toLowerCase();

    if (key === 'escape' && this.isOpen) { this.close(); return; }

    if (['b', 'n', 'm', ','].includes(key)) {
      if (this.isOpen) { this.close(); return; }
      this.open();
    }
  }

  open() {
    if (this._el) this._el.style.display = 'flex';
    this.isOpen = true;
  }

  close() {
    if (this._el) this._el.style.display = 'none';
    this.isOpen = false;
  }

  _select(index) {
    const emote = this.emotes[index];
    if (!emote) return;
    this.close();
    this._showEmoteOnPlayer(emote);

    // Optional server broadcast (no-op if socket not available)
    try {
      const socket = window.networkManager && window.networkManager.socket;
      if (socket) socket.emit('emote', { id: emote.id });
    } catch (_) { /* silent */ }
  }

  _showEmoteOnPlayer(emote) {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;

    const player = window.gameState && window.gameState.getPlayer && window.gameState.getPlayer();
    if (!player) return;

    const camera = window.gameEngine && window.gameEngine.camera;
    const camX = camera ? (camera.x + ((camera.shakeOffset && camera.shakeOffset.x) || 0)) : 0;
    const camY = camera ? (camera.y + ((camera.shakeOffset && camera.shakeOffset.y) || 0)) : 0;

    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width  / (canvas.width  || rect.width);
    const scaleY = rect.height / (canvas.height || rect.height);

    const screenX = (player.x - camX) * scaleX + rect.left;
    const screenY = (player.y - camY) * scaleY + rect.top;

    const el = document.createElement('div');
    el.className = 'emote-bubble';
    el.textContent = emote.icon;
    el.style.position = 'fixed';
    el.style.left = screenX + 'px';
    el.style.top  = (screenY - 40) + 'px';
    el.style.fontSize = '48px';
    el.style.lineHeight = '1';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9999';
    el.style.userSelect = 'none';
    el.style.animation = 'emote-float 1.5s ease-out forwards';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// CSS injection
(function injectEmoteStyles() {
  const style = document.createElement('style');
  style.textContent = [
    '#emote-wheel-overlay {',
    '  display: none; position: fixed; inset: 0;',
    '  background: rgba(0,0,0,0.55); z-index: 9000;',
    '  align-items: center; justify-content: center;',
    '}',
    '#emote-wheel {',
    '  background: rgba(20,20,30,0.95);',
    '  border: 2px solid rgba(255,255,255,0.15);',
    '  border-radius: 16px; padding: 16px 20px 20px;',
    '  display: flex; flex-direction: column; align-items: center; gap: 12px;',
    '  box-shadow: 0 8px 32px rgba(0,0,0,0.6);',
    '}',
    '.emote-wheel-title {',
    '  color: rgba(255,255,255,0.6); font-size: 13px;',
    '  text-transform: uppercase; letter-spacing: 2px; font-family: sans-serif;',
    '}',
    '.emote-wheel-slots { display: grid; grid-template-columns: repeat(3, 80px); gap: 10px; }',
    '.emote-slot {',
    '  background: rgba(255,255,255,0.07);',
    '  border: 1px solid rgba(255,255,255,0.12);',
    '  border-radius: 10px; padding: 10px 6px 8px; cursor: pointer;',
    '  display: flex; flex-direction: column; align-items: center; gap: 4px;',
    '  transition: background 0.15s, transform 0.1s;',
    '}',
    '.emote-slot:hover { background: rgba(255,255,255,0.18); transform: scale(1.08); }',
    '.emote-icon { font-size: 28px; line-height: 1; }',
    '.emote-label { color: rgba(255,255,255,0.75); font-size: 11px; font-family: sans-serif; }',
    '@keyframes emote-float {',
    '  0%   { opacity: 1; transform: translateY(0)     scale(1);    }',
    '  20%  { opacity: 1; transform: translateY(-6px)  scale(1.15); }',
    '  100% { opacity: 0; transform: translateY(-30px) scale(0.9);  }',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}());

window.emoteWheel = new EmoteWheel();
