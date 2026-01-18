/**
 * Interactive Tutorial System
 * Guides new players through first wave with step-by-step instructions
 */

class TutorialSystem {
  constructor() {
    this.storageKey = 'zombie-game-tutorial-completed';
    this.currentStep = 0;
    this.isActive = false;
    this.hasCompleted = this.checkCompletion();

    // Tutorial steps with instructions and highlights
    this.steps = [
      {
        title: 'Bienvenue !',
        text: 'Utilisez WASD ou les flèches pour vous déplacer',
        highlight: null,
        condition: () => this.checkMovement(),
        skipDelay: 5000
      },
      {
        title: 'Viser et Tirer',
        text: 'Utilisez la souris pour viser et clic gauche pour tirer',
        highlight: null,
        condition: () => this.checkShooting(),
        skipDelay: 5000
      },
      {
        title: 'Barre de Vie',
        text: 'Surveillez votre vie en haut à gauche',
        highlight: '#health-container',
        condition: () => true,
        skipDelay: 3000
      },
      {
        title: 'Expérience',
        text: 'Tuez des zombies pour gagner de l\'XP et monter de niveau',
        highlight: '#xp-container',
        condition: () => this.checkLevel(),
        skipDelay: 5000
      },
      {
        title: 'Wave Progress',
        text: 'Éliminez tous les zombies pour passer à la vague suivante',
        highlight: '#wave-progress-container',
        condition: () => this.checkWaveProgress(),
        skipDelay: 5000
      }
    ];

    this.movementDetected = false;
    this.shootingDetected = false;
    this.levelUpDetected = false;
    this.waveProgressDetected = false;

    // MEMORY LEAK FIX: Track active intervals for cleanup
    this.activeIntervals = [];
    this.activeTimeouts = [];

    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupUI());
    } else {
      this.setupUI();
    }
  }

  setupUI() {
    // Create tutorial overlay
    const tutorialHTML = `
      <div id="tutorial-overlay" style="display: none;">
        <div class="tutorial-backdrop"></div>
        <div class="tutorial-tooltip">
          <div class="tutorial-header">
            <h3 id="tutorial-title">Tutorial</h3>
            <button id="tutorial-skip" class="tutorial-skip-btn">Passer le tutoriel</button>
          </div>
          <div class="tutorial-content">
            <p id="tutorial-text">Instruction</p>
            <div class="tutorial-progress">
              <div class="tutorial-progress-bar">
                <div id="tutorial-progress-fill" class="tutorial-progress-fill"></div>
              </div>
              <span id="tutorial-step-count">Étape 1/5</span>
            </div>
          </div>
          <div class="tutorial-footer">
            <button id="tutorial-next" class="tutorial-btn tutorial-btn-next" style="display: none;">Suivant →</button>
          </div>
        </div>
        <div id="tutorial-highlight" class="tutorial-highlight" style="display: none;"></div>
      </div>
    `;

    // Inject into UI
    const uiContainer = document.getElementById('ui');
    if (uiContainer) {
      uiContainer.insertAdjacentHTML('beforeend', tutorialHTML);
    }

    // Add CSS
    this.injectCSS();

    // Setup event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    const skipBtn = document.getElementById('tutorial-skip');
    const nextBtn = document.getElementById('tutorial-next');

    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.skip());
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextStep());
    }

    // Listen for game events
    document.addEventListener('keydown', (e) => {
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.key.toLowerCase())) {
        this.movementDetected = true;
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left click
        this.shootingDetected = true;
      }
    });
  }

  injectCSS() {
    const style = document.createElement('style');
    style.textContent = `
      /* Tutorial Overlay */
      #tutorial-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        pointer-events: none;
      }

      .tutorial-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        pointer-events: auto;
      }

      .tutorial-tooltip {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(500px, 90%);
        background: linear-gradient(135deg, rgba(20, 20, 40, 0.98), rgba(30, 30, 50, 0.98));
        border: 3px solid var(--color-primary);
        border-radius: 15px;
        padding: 20px;
        box-shadow: 0 0 50px rgba(0, 255, 0, 0.5);
        pointer-events: auto;
        animation: tutorial-appear 0.5s ease-out;
      }

      @keyframes tutorial-appear {
        from {
          opacity: 0;
          transform: translate(-50%, -60%);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%);
        }
      }

      .tutorial-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid rgba(0, 255, 0, 0.3);
      }

      #tutorial-title {
        color: var(--color-primary);
        font-size: 24px;
        margin: 0;
        text-shadow: 0 0 10px rgba(0, 255, 0, 0.6);
      }

      .tutorial-skip-btn {
        background: rgba(255, 0, 0, 0.2);
        border: 2px solid rgba(255, 0, 0, 0.5);
        color: #fff;
        padding: 5px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s ease;
      }

      .tutorial-skip-btn:hover {
        background: rgba(255, 0, 0, 0.4);
        border-color: var(--color-danger);
      }

      .tutorial-content {
        margin-bottom: 20px;
      }

      #tutorial-text {
        color: #fff;
        font-size: 18px;
        line-height: 1.6;
        margin: 0 0 15px 0;
        text-align: center;
      }

      .tutorial-progress {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .tutorial-progress-bar {
        flex: 1;
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        overflow: hidden;
      }

      .tutorial-progress-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
        transition: width 0.5s ease;
        box-shadow: 0 0 10px rgba(0, 255, 0, 0.6);
      }

      #tutorial-step-count {
        color: var(--color-accent);
        font-size: 14px;
        font-weight: bold;
        min-width: 70px;
        text-align: right;
      }

      .tutorial-footer {
        display: flex;
        justify-content: flex-end;
      }

      .tutorial-btn {
        padding: 10px 25px;
        font-size: 16px;
        font-weight: bold;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .tutorial-btn-next {
        background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
        color: #000;
        box-shadow: 0 0 15px rgba(0, 255, 0, 0.4);
      }

      .tutorial-btn-next:hover {
        transform: scale(1.05);
        box-shadow: 0 0 25px rgba(0, 255, 0, 0.6);
      }

      /* Tutorial Highlight */
      .tutorial-highlight {
        position: absolute;
        border: 4px solid var(--color-accent);
        border-radius: 10px;
        box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), inset 0 0 30px rgba(255, 215, 0, 0.3);
        pointer-events: none;
        animation: tutorial-highlight-pulse 2s ease-in-out infinite;
        z-index: 9999;
      }

      @keyframes tutorial-highlight-pulse {
        0%, 100% {
          box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), inset 0 0 30px rgba(255, 215, 0, 0.3);
        }
        50% {
          box-shadow: 0 0 50px rgba(255, 215, 0, 1), inset 0 0 50px rgba(255, 215, 0, 0.5);
        }
      }

      /* Mobile Tutorial */
      @media (max-width: 768px) {
        .tutorial-tooltip {
          width: 95%;
        }

        #tutorial-title {
          font-size: 20px;
        }

        #tutorial-text {
          font-size: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  start() {
    if (this.hasCompleted || this.isActive) {
      return;
    }

    this.isActive = true;
    this.currentStep = 0;
    this.showStep(0);
  }

  showStep(stepIndex) {
    if (stepIndex >= this.steps.length) {
      this.complete();
      return;
    }

    const step = this.steps[stepIndex];
    const overlay = document.getElementById('tutorial-overlay');
    const title = document.getElementById('tutorial-title');
    const text = document.getElementById('tutorial-text');
    const progressFill = document.getElementById('tutorial-progress-fill');
    const stepCount = document.getElementById('tutorial-step-count');
    const nextBtn = document.getElementById('tutorial-next');

    if (!overlay) {
      return;
    }

    // Show overlay
    overlay.style.display = 'block';

    // Update content
    if (title) {
      title.textContent = step.title;
    }
    if (text) {
      text.textContent = step.text;
    }

    // Update progress
    const progress = ((stepIndex + 1) / this.steps.length) * 100;
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
    if (stepCount) {
      stepCount.textContent = `Étape ${stepIndex + 1}/${this.steps.length}`;
    }

    // Highlight element if specified
    if (step.highlight) {
      this.highlightElement(step.highlight);
    } else {
      this.hideHighlight();
    }

    // Check condition or auto-advance after delay
    this.checkStepCondition(step, stepIndex);
  }

  checkStepCondition(step, stepIndex) {
    const interval = setInterval(() => {
      if (!this.isActive) {
        clearInterval(interval);
        // MEMORY LEAK FIX: Remove from tracking
        this.activeIntervals = this.activeIntervals.filter(i => i !== interval);
        return;
      }

      if (step.condition()) {
        clearInterval(interval);
        // MEMORY LEAK FIX: Remove from tracking
        this.activeIntervals = this.activeIntervals.filter(i => i !== interval);

        const timeout = setTimeout(() => {
          // MEMORY LEAK FIX: Remove from tracking
          this.activeTimeouts = this.activeTimeouts.filter(t => t !== timeout);
          if (this.isActive) {
            this.nextStep();
          }
        }, 1000);
        // MEMORY LEAK FIX: Track timeout
        this.activeTimeouts.push(timeout);
      }
    }, 100);

    // MEMORY LEAK FIX: Track interval
    this.activeIntervals.push(interval);

    // Auto-skip after delay
    if (step.skipDelay) {
      const skipTimeout = setTimeout(() => {
        // MEMORY LEAK FIX: Remove from tracking
        this.activeTimeouts = this.activeTimeouts.filter(t => t !== skipTimeout);
        if (this.isActive && this.currentStep === stepIndex) {
          clearInterval(interval);
          // MEMORY LEAK FIX: Remove interval from tracking
          this.activeIntervals = this.activeIntervals.filter(i => i !== interval);
          const nextBtn = document.getElementById('tutorial-next');
          if (nextBtn) {
            nextBtn.style.display = 'block';
          }
        }
      }, step.skipDelay);
      // MEMORY LEAK FIX: Track timeout
      this.activeTimeouts.push(skipTimeout);
    }
  }

  highlightElement(selector) {
    const element = document.querySelector(selector);
    const highlight = document.getElementById('tutorial-highlight');

    if (!element || !highlight) {
      return;
    }

    const rect = element.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = `${rect.left - 10}px`;
    highlight.style.top = `${rect.top - 10}px`;
    highlight.style.width = `${rect.width + 20}px`;
    highlight.style.height = `${rect.height + 20}px`;
  }

  hideHighlight() {
    const highlight = document.getElementById('tutorial-highlight');
    if (highlight) {
      highlight.style.display = 'none';
    }
  }

  nextStep() {
    this.currentStep++;
    this.showStep(this.currentStep);
  }

  skip() {
    this.isActive = false;
    this.complete();
  }

  complete() {
    this.isActive = false;
    this.hasCompleted = true;
    this.markCompleted();

    // MEMORY LEAK FIX: Clear all tracked intervals and timeouts
    this.cleanupTimers();

    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }

    this.hideHighlight();
  }

  // MEMORY LEAK FIX: Cleanup all tracked timers
  cleanupTimers() {
    // Clear all active intervals
    this.activeIntervals.forEach(interval => clearInterval(interval));
    this.activeIntervals = [];

    // Clear all active timeouts
    this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
    this.activeTimeouts = [];
  }

  checkCompletion() {
    try {
      return localStorage.getItem(this.storageKey) === 'true';
    } catch (err) {
      return false;
    }
  }

  markCompleted() {
    try {
      localStorage.setItem(this.storageKey, 'true');
    } catch (err) {
      console.warn('Failed to save tutorial completion:', err);
    }
  }

  // Condition checkers
  checkMovement() {
    return this.movementDetected;
  }

  checkShooting() {
    return this.shootingDetected;
  }

  checkLevel() {
    // Check if player has leveled up (would integrate with game state)
    return this.levelUpDetected;
  }

  checkWaveProgress() {
    // Check if player has made wave progress
    return this.waveProgressDetected;
  }

  // Public method to trigger level up detection
  onLevelUp() {
    this.levelUpDetected = true;
  }

  // Public method to trigger wave progress detection
  onWaveProgress() {
    this.waveProgressDetected = true;
  }

  reset() {
    this.hasCompleted = false;
    localStorage.removeItem(this.storageKey);
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.tutorialSystem = new TutorialSystem();
}
