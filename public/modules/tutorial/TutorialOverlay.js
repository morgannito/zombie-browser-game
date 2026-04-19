/**
 * TutorialOverlay — Minimal 3-step first-time overlay
 * Trigger: localStorage key 'zbg:tutorial:completed' absent
 */
class TutorialOverlay {
  static STORAGE_KEY = 'zbg:tutorial:completed';

  static STEPS = [
    { text: 'Bouge avec WASD / ZQSD', hint: 'Déplace-toi pour continuer', waitEvent: 'zbg:moved' },
    { text: 'Clique pour tirer sur les zombies', hint: 'Tue un zombie pour continuer', waitEvent: 'zbg:kill' },
    { text: 'E pour changer d\'arme · P pour ouvrir le shop', hint: null, waitEvent: null }
  ];

  constructor() {
    this.current = 0;
    this._stepUnlocked = false;
    if (this._isCompleted()) {
return;
}
    // Wait for game start (nickname dismissed) before showing tutorial.
    // Otherwise the overlay blocks the #start-game-btn click.
    this._waitForGameStart(() => {
      this._inject();
      this._bindGameEvents();
      this._show();
    });
  }

  _waitForGameStart(cb) {
    const check = () => {
      const ns = document.getElementById('nickname-screen');
      if (!ns || ns.style.display === 'none' || !ns.offsetParent) {
        cb();
        return;
      }
      setTimeout(check, 250);
    };
    check();
  }

  _isCompleted() {
    try {
 return !!localStorage.getItem(TutorialOverlay.STORAGE_KEY);
} catch {
 return true;
}
  }

  _inject() {
    this.el = document.createElement('div');
    this.el.id = 'zbg-tutorial';

    const box = document.createElement('div');
    box.className = 'zbg-tut-box';

    this.stepEl = document.createElement('p');
    this.stepEl.className = 'zbg-tut-step';

    this.textEl = document.createElement('p');
    this.textEl.className = 'zbg-tut-text';

    const footer = document.createElement('div');
    footer.className = 'zbg-tut-footer';

    this.skipBtn = document.createElement('button');
    this.skipBtn.id = 'zbg-tut-skip';
    this.skipBtn.textContent = 'Skip';
    this.skipBtn.onclick = () => this._complete();

    this.nextBtn = document.createElement('button');
    this.nextBtn.id = 'zbg-tut-next';
    this.nextBtn.textContent = 'Suivant →';
    this.nextBtn.onclick = () => this._advance();

    footer.appendChild(this.skipBtn);
    footer.appendChild(this.nextBtn);
    box.appendChild(this.stepEl);
    box.appendChild(this.textEl);
    box.appendChild(footer);
    this.el.appendChild(box);

    this._injectCSS();
    document.body.appendChild(this.el);
  }

  _injectCSS() {
    const s = document.createElement('style');
    s.textContent = [
      '#zbg-tutorial{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);}',
      '.zbg-tut-box{background:linear-gradient(135deg,rgba(15,15,30,.97),rgba(25,25,45,.97));border:2px solid #00ff00;border-radius:12px;padding:32px 36px;min-width:320px;max-width:480px;text-align:center;box-shadow:0 0 40px rgba(0,255,0,.4);color:#fff;font-family:inherit;}',
      '.zbg-tut-step{color:#00ff00;font-size:13px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.08em;}',
      '.zbg-tut-text{font-size:22px;font-weight:bold;margin:0 0 24px;}',
      '.zbg-tut-footer{display:flex;justify-content:space-between;gap:12px;}',
      '#zbg-tut-skip{background:rgba(255,50,50,.15);border:1px solid rgba(255,50,50,.5);color:#fff;padding:8px 18px;border-radius:6px;cursor:pointer;font-size:14px;}',
      '#zbg-tut-skip:hover{background:rgba(255,50,50,.35);}',
      '#zbg-tut-next{background:linear-gradient(135deg,#00cc00,#009900);border:none;color:#000;padding:8px 22px;border-radius:6px;cursor:pointer;font-size:15px;font-weight:bold;}',
      '#zbg-tut-next:hover{filter:brightness(1.2);}'
    ].join('');
    document.head.appendChild(s);
  }

  _bindGameEvents() {
    // Movement detection (WASD / ZQSD / arrows)
    const moveKeys = new Set(['w','a','s','d','z','q','arrowup','arrowdown','arrowleft','arrowright']);
    this._onKey = e => {
      if (moveKeys.has(e.key.toLowerCase())) {
        document.dispatchEvent(new CustomEvent('zbg:moved'));
      }
    };
    document.addEventListener('keydown', this._onKey);

    // Kill detection via custom game event (dispatched by game engine)
    this._onKill = () => document.dispatchEvent(new CustomEvent('zbg:kill'));
    document.addEventListener('zbg:zombie:killed', this._onKill);
  }

  _show() {
    const total = TutorialOverlay.STEPS.length;
    const step = TutorialOverlay.STEPS[this.current];
    this.stepEl.textContent = `Étape ${this.current + 1} / ${total}`;
    this.textEl.textContent = step.text;
    this._stepUnlocked = !step.waitEvent; // étapes sans condition sont débloquées d'emblée

    const isLast = this.current === total - 1;
    this.nextBtn.textContent = isLast ? 'Commencer !' : 'Suivant →';
    this.nextBtn.disabled = !this._stepUnlocked;
    this.nextBtn.style.opacity = this._stepUnlocked ? '1' : '0.4';
    this.nextBtn.style.cursor = this._stepUnlocked ? 'pointer' : 'not-allowed';

    if (step.hint) {
      this.stepEl.textContent += ` — ${step.hint}`;
    }

    // Listen for the step's unlock event
    if (step.waitEvent) {
      const unlock = () => {
        this._stepUnlocked = true;
        this.nextBtn.disabled = false;
        this.nextBtn.style.opacity = '1';
        this.nextBtn.style.cursor = 'pointer';
        if (step.hint) {
          this.stepEl.textContent = `Étape ${this.current + 1} / ${total} — Bien joué !`;
        }
        document.removeEventListener(step.waitEvent, unlock);
      };
      document.addEventListener(step.waitEvent, unlock);
    }
  }

  _advance() {
    if (this.current < TutorialOverlay.STEPS.length - 1) {
      this.current++;
      this._show();
    } else {
      this._complete();
    }
  }

  _complete() {
    try {
 localStorage.setItem(TutorialOverlay.STORAGE_KEY, '1');
} catch { /* ignore */ }
    if (this._onKey) {
document.removeEventListener('keydown', this._onKey);
}
    if (this._onKill) {
document.removeEventListener('zbg:zombie:killed', this._onKill);
}
    this.el.remove();
  }

  /** Public: reset depuis SettingsMenu */
  static reset() {
    try {
 localStorage.removeItem(TutorialOverlay.STORAGE_KEY);
} catch { /* ignore */ }
  }
}

if (typeof window !== 'undefined') {
  const init = () => {
 window.tutorialOverlay = new TutorialOverlay();
};
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
