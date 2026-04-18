/**
 * WeatherRenderer - Lightweight canvas 2D weather effects
 * Rain, Snow, Fog drawn directly on main ctx (screen-space).
 */
class WeatherRenderer {
  constructor() {
    this.enabled = false;
    this.type = 'clear'; // 'clear' | 'rain' | 'snow' | 'fog'
    this.rain = this._initRain();
    this.snow = this._initSnow();
    this._tick = 0;

    // Listen for room changes (random weather) and wave changes (even=rain, odd=fog)
    document.addEventListener('room_changed', () => this._onRoomChanged());
    document.addEventListener('wave_changed', (e) => this._onWaveChanged(e.detail?.wave));
  }

  _initRain() {
    const drops = [];
    for (let i = 0; i < 100; i++) {
      drops.push(this._newDrop(Math.random()));
    }
    return drops;
  }

  _newDrop(yFraction = 0) {
    return {
      x: Math.random(),      // fraction of canvas width
      y: yFraction,          // fraction of canvas height
      speed: 0.012 + Math.random() * 0.006, // fraction/frame (~8px at 600px)
      len: 0.015 + Math.random() * 0.01,
      alpha: 0.3 + Math.random() * 0.35
    };
  }

  _initSnow() {
    const flakes = [];
    for (let i = 0; i < 60; i++) {
      flakes.push(this._newFlake(Math.random()));
    }
    return flakes;
  }

  _newFlake(yFraction = 0) {
    return {
      x: Math.random(),
      y: yFraction,
      radius: 1.5 + Math.random() * 2.5,
      speed: 0.002 + Math.random() * 0.002,
      phase: Math.random() * Math.PI * 2,
      freq: 0.02 + Math.random() * 0.02,
      alpha: 0.5 + Math.random() * 0.5
    };
  }

  _onRoomChanged() {
    if (!this.enabled) return;
    const types = ['clear', 'clear', 'rain', 'fog', 'snow'];
    this.type = types[Math.floor(Math.random() * types.length)];
  }

  _onWaveChanged(wave) {
    if (!this.enabled) return;
    if (wave == null) return;
    this.type = wave % 2 === 0 ? 'rain' : 'fog';
  }

  /**
   * Call once per frame from the render loop.
   * ctx should be in screen-space (no camera transform).
   */
  render(ctx, w, h) {
    if (!this.enabled || this.type === 'clear') return;
    this._tick++;

    if (this.type === 'rain') this._drawRain(ctx, w, h);
    else if (this.type === 'snow') this._drawSnow(ctx, w, h);
    else if (this.type === 'fog') this._drawFog(ctx, w, h);
  }

  _drawRain(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(174, 214, 241, 0.55)';
    ctx.lineWidth = 1;
    for (const d of this.rain) {
      d.y += d.speed;
      if (d.y > 1) { Object.assign(d, this._newDrop(0)); }
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      ctx.moveTo(d.x * w, d.y * h);
      ctx.lineTo(d.x * w + 2, (d.y + d.len) * h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawSnow(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = '#fff';
    for (const f of this.snow) {
      f.y += f.speed;
      f.x += Math.sin(this._tick * f.freq + f.phase) * 0.0008;
      if (f.y > 1) { Object.assign(f, this._newFlake(0)); }
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x * w, f.y * h, f.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawFog(ctx, w, h) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, h * 0.55, 0, h);
    grad.addColorStop(0, 'rgba(220,220,220,0)');
    grad.addColorStop(1, 'rgba(220,220,220,0.42)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.restore();
  }

  setEnabled(flag) {
    this.enabled = flag;
    if (!flag) this.type = 'clear';
  }
}

if (typeof window !== 'undefined') {
  window.WeatherRenderer = WeatherRenderer;
  window.weatherRenderer = new WeatherRenderer();
}
