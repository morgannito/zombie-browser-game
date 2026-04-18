/**
 * ReplayRecorder — captures 30s of gameState @ 20Hz into a ring buffer.
 * On player death, shows a "Watch replay" button that plays back 30s in ~3s (10x).
 */
class ReplayRecorder {
  static BUFFER_SIZE = 600;   // 30s × 20Hz
  static CAPTURE_HZ  = 20;    // captures per second
  static REPLAY_SPEED = 10;   // playback multiplier

  constructor() {
    this._buf   = new Array(ReplayRecorder.BUFFER_SIZE);
    this._head  = 0;
    this._count = 0;

    this._captureInterval = null;
    this._replayCanvas    = null;
    this._replayCtx       = null;
    this._replayOverlay   = null;
    this._replayBtn       = null;
    this._animId          = null;

    this._buildOverlay();
    this._startCapture();
    this._listenDeath();
  }

  /* ── ring buffer helpers ──────────────────────────── */

  _push(snapshot) {
    this._buf[this._head] = snapshot;
    this._head = (this._head + 1) % ReplayRecorder.BUFFER_SIZE;
    if (this._count < ReplayRecorder.BUFFER_SIZE) {
this._count++;
}
  }

  _getOrdered() {
    const out = [];
    if (this._count < ReplayRecorder.BUFFER_SIZE) {
      for (let i = 0; i < this._count; i++) {
out.push(this._buf[i]);
}
    } else {
      for (let i = 0; i < ReplayRecorder.BUFFER_SIZE; i++) {
        out.push(this._buf[(this._head + i) % ReplayRecorder.BUFFER_SIZE]);
      }
    }
    return out;
  }

  /* ── capture ─────────────────────────────────────── */

  _startCapture() {
    this._captureInterval = setInterval(() => {
      if (!window.gameState?.state?.players) {
return;
}
      const pid = window.gameState.playerId;
      const ps  = window.gameState.state.players;
      const snap = { t: Date.now(), players: {} };
      for (const id in ps) {
        const p = ps[id];
        snap.players[id] = { x: p.x, y: p.y, angle: p.angle, health: p.health, alive: p.alive };
      }
      if (pid) {
snap.localId = pid;
}
      this._push(snap);
    }, 1000 / ReplayRecorder.CAPTURE_HZ);
  }

  /* ── death hook ──────────────────────────────────── */

  _listenDeath() {
    this._deathHandler = () => this._onDeath();
    document.addEventListener('session_death', this._deathHandler);
  }

  _onDeath() {
    if (this._replayBtn) {
this._replayBtn.style.display = 'block';
}
  }

  /* ── UI ──────────────────────────────────────────── */

  _buildOverlay() {
    // Replay button (shown on death, hidden otherwise)
    this._replayBtn = document.createElement('button');
    this._replayBtn.id = 'replay-btn';
    Object.assign(this._replayBtn.style, {
      display:       'none',
      position:      'fixed',
      bottom:        '160px',
      left:          '50%',
      transform:     'translateX(-50%)',
      zIndex:        '9000',
      padding:       '10px 22px',
      fontSize:      '15px',
      fontFamily:    'monospace',
      background:    '#111',
      color:         '#0f0',
      border:        '2px solid #0f0',
      borderRadius:  '6px',
      cursor:        'pointer',
      letterSpacing: '0.05em'
    });
    this._replayBtn.textContent = '▶ Watch replay';
    this._replayBtn.addEventListener('click', () => this._startReplay());
    document.body.appendChild(this._replayBtn);

    // Full-screen replay overlay (hidden by default)
    this._replayOverlay = document.createElement('div');
    this._replayOverlay.id = 'replay-overlay';
    Object.assign(this._replayOverlay.style, {
      display:         'none',
      position:        'fixed',
      inset:           '0',
      zIndex:          '9999',
      background:      'rgba(0,0,0,0.88)',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center'
    });

    this._replayCanvas = document.createElement('canvas');
    this._replayCanvas.width  = 700;
    this._replayCanvas.height = 500;
    Object.assign(this._replayCanvas.style, {
      border:       '2px solid #0f0',
      borderRadius: '4px',
      maxWidth:     '90vw',
      maxHeight:    '70vh'
    });
    this._replayCtx = this._replayCanvas.getContext('2d');

    const controls = document.createElement('div');
    Object.assign(controls.style, {
      marginTop: '14px',
      display:   'flex',
      gap:       '12px'
    });

    const btnStyle = {
      padding:      '8px 20px',
      fontSize:     '14px',
      fontFamily:   'monospace',
      background:   '#111',
      color:        '#fff',
      border:       '1px solid #555',
      borderRadius: '4px',
      cursor:       'pointer'
    };

    const skipBtn = document.createElement('button');
    Object.assign(skipBtn.style, btnStyle);
    skipBtn.textContent = '⏩ Skip';
    skipBtn.addEventListener('click', () => this._stopReplay());

    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, btnStyle);
    closeBtn.textContent = '✕ Close';
    closeBtn.addEventListener('click', () => this._stopReplay());

    const label = document.createElement('span');
    Object.assign(label.style, {
      color:      '#aaa',
      fontSize:   '13px',
      fontFamily: 'monospace',
      alignSelf:  'center'
    });
    label.textContent = 'Last 30s — 10× speed';

    controls.appendChild(label);
    controls.appendChild(skipBtn);
    controls.appendChild(closeBtn);

    this._replayOverlay.appendChild(this._replayCanvas);
    this._replayOverlay.appendChild(controls);
    document.body.appendChild(this._replayOverlay);
  }

  /* ── playback ────────────────────────────────────── */

  _startReplay() {
    const frames = this._getOrdered();
    if (frames.length < 2) {
return;
}

    this._replayBtn.style.display     = 'none';
    this._replayOverlay.style.display = 'flex';

    const startT  = frames[0].t;
    const endT    = frames[frames.length - 1].t;
    const duration = endT - startT;          // wall-clock ms recorded

    // playback wall-clock duration = duration / REPLAY_SPEED
    const pbStart = performance.now();
    const speed   = ReplayRecorder.REPLAY_SPEED;

    const step = (now) => {
      const elapsed   = now - pbStart;            // playback elapsed ms
      const gameElapsed = elapsed * speed;          // equivalent game ms
      if (gameElapsed > duration) {
 this._stopReplay(); return;
}

      const targetT = startT + gameElapsed;
      // find two frames to interpolate
      let lo = frames[0], hi = frames[1];
      for (let i = 1; i < frames.length; i++) {
        if (frames[i].t >= targetT) {
 lo = frames[i - 1]; hi = frames[i]; break;
}
        lo = hi = frames[i];
      }
      const alpha = (hi.t > lo.t) ? (targetT - lo.t) / (hi.t - lo.t) : 0;
      this._drawFrame(lo, hi, alpha, gameElapsed, duration);
      this._animId = requestAnimationFrame(step);
    };

    this._animId = requestAnimationFrame(step);
  }

  _stopReplay() {
    if (this._animId) {
 cancelAnimationFrame(this._animId); this._animId = null;
}
    this._replayOverlay.style.display = 'none';
  }

  /* ── rendering ───────────────────────────────────── */

  _drawFrame(lo, hi, alpha, elapsed, total) {
    const ctx = this._replayCtx;
    const W = this._replayCanvas.width;
    const H = this._replayCanvas.height;

    ctx.clearRect(0, 0, W, H);

    // background grid
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
 ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
}
    for (let y = 0; y < H; y += 40) {
 ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
}

    // compute bounds from all players to auto-zoom
    const allPts = [];
    for (const id in lo.players) {
      const lp = lo.players[id], hp = hi.players[id];
      if (!hp) {
continue;
}
      allPts.push({ x: lp.x + (hp.x - lp.x) * alpha, y: lp.y + (hp.y - lp.y) * alpha });
    }
    if (allPts.length === 0) {
return;
}

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pt of allPts) {
      if (pt.x < minX) {
minX = pt.x;
} if (pt.x > maxX) {
maxX = pt.x;
}
      if (pt.y < minY) {
minY = pt.y;
} if (pt.y > maxY) {
maxY = pt.y;
}
    }
    const margin = 80;
    const rangeX = Math.max(maxX - minX, 200);
    const rangeY = Math.max(maxY - minY, 200);
    const scale  = Math.min((W - margin * 2) / rangeX, (H - margin * 2) / rangeY);
    const offX   = W / 2 - (minX + rangeX / 2) * scale;
    const offY   = H / 2 - (minY + rangeY / 2) * scale;

    const toScreen = (wx, wy) => ({ sx: wx * scale + offX, sy: wy * scale + offY });

    // draw players
    const localId = lo.localId;
    for (const id in lo.players) {
      const lp = lo.players[id], hp = hi.players[id];
      if (!hp) {
continue;
}
      const ix = lp.x + (hp.x - lp.x) * alpha;
      const iy = lp.y + (hp.y - lp.y) * alpha;
      const { sx, sy } = toScreen(ix, iy);
      const isLocal = id === localId;

      ctx.beginPath();
      ctx.arc(sx, sy, isLocal ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle   = isLocal ? '#0f0' : '#4af';
      ctx.strokeStyle = isLocal ? '#fff' : '#08f';
      ctx.lineWidth   = 2;
      ctx.fill();
      ctx.stroke();

      // direction indicator
      const angle = lp.angle + (hp.angle - lp.angle) * alpha;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * 14, sy + Math.sin(angle) * 14);
      ctx.strokeStyle = isLocal ? '#0f0' : '#4af';
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // progress bar
    const prog = elapsed / total;
    ctx.fillStyle = '#333';
    ctx.fillRect(10, H - 14, W - 20, 8);
    ctx.fillStyle = '#0f0';
    ctx.fillRect(10, H - 14, (W - 20) * prog, 8);

    // time label
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText(`${(elapsed / 1000).toFixed(1)}s / ${(total / 1000).toFixed(1)}s`, 12, H - 20);
  }

  destroy() {
    clearInterval(this._captureInterval);
    if (this._animId) {
cancelAnimationFrame(this._animId);
}
    if (this._deathHandler) {
      document.removeEventListener('session_death', this._deathHandler);
      this._deathHandler = null;
    }
    this._replayBtn?.remove();
    this._replayOverlay?.remove();
  }
}

window.ReplayRecorder = ReplayRecorder;
