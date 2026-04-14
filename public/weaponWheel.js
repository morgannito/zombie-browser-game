/**
 * Weapon Wheel UI System
 * Radial menu for quick weapon selection
 */

class WeaponWheel {
  constructor() {
    this.isOpen = false;
    this.currentWeaponIndex = 0;
    this.hoveredWeaponIndex = null;

    // Default weapons configuration
    this.weapons = [
      { id: 1, name: 'Pistolet', icon: '🔫', unlocked: true, ammo: '∞' },
      { id: 2, name: 'Fusil', icon: '🎯', unlocked: true, ammo: '30' },
      { id: 3, name: 'Shotgun', icon: '💥', unlocked: true, ammo: '8' },
      { id: 4, name: 'SMG', icon: '🔥', unlocked: false, ammo: '50' },
      { id: 5, name: 'Sniper', icon: '🎲', unlocked: false, ammo: '10' },
      { id: 6, name: 'Rocket', icon: '🚀', unlocked: false, ammo: '5' },
      { id: 7, name: 'Laser', icon: '⚡', unlocked: false, ammo: '100' },
      { id: 8, name: 'Flamethrower', icon: '🌡️', unlocked: false, ammo: '200' }
    ];

    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.setupEventListeners();
    this.renderWeapons();
  }

  setupEventListeners() {
    const overlay = document.querySelector('.weapon-wheel-overlay');

    // E key to toggle weapon wheel (no conflict with AZERTY/QWERTY movement), Escape to close
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();

      if (key === 'escape' && this.isOpen) {
        this.close();
        return;
      }

      if (key === 'e') {
        // Always allow closing even if other menus opened on top
        if (this.isOpen) {
          this.close();
          return;
        }

        // Don't open if a blocking modal is currently active.
        // We detect "active" via signals each manager actually sets, since inline
        // style="display:none" gets stripped at init by other init scripts.
        const pauseOpen = document.getElementById('pause-menu')?.classList.contains('is-open');
        const levelUpActive = document.getElementById('upgrade-choices')?.children.length > 0;
        const shopEl = document.getElementById('shop');
        const shopOpen = shopEl?.style.display === 'flex' || shopEl?.style.display === 'block';
        const gameOverEl = document.getElementById('game-over');
        const gameOverOpen = gameOverEl?.style.display === 'flex' || gameOverEl?.style.display === 'block';
        const settingsOpen = document.getElementById('settings-menu')?.style.display === 'block';

        if (pauseOpen || levelUpActive || shopOpen || gameOverOpen || settingsOpen) {
          return;
        }

        this.toggle();
      }
    });

    // Auto-close wheel if any blocking modal becomes visible
    ['level-up-screen', 'shop', 'game-over', 'settings-menu', 'pause-menu'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      new MutationObserver(() => {
        if (!this.isOpen) return;
        const becameVisible = el.style.display !== 'none' && el.style.display !== '';
        if (becameVisible || el.classList.contains('is-open')) {
          this.close();
        }
      }).observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    });

    // Click overlay to close
    if (overlay) {
      overlay.addEventListener('click', () => this.close());
    }

    // Mouse movement for hover effect
    document.addEventListener('mousemove', (e) => {
      if (this.isOpen) {
        this.updateHover(e);
      }
    });
  }

  renderWeapons() {
    const slotsContainer = document.getElementById('weapon-wheel-slots');
    if (!slotsContainer) {
      return;
    }

    slotsContainer.innerHTML = '';

    this.weapons.forEach((weapon, index) => {
      const slot = document.createElement('div');
      slot.className = 'weapon-slot';
      slot.dataset.weaponIndex = index;

      if (!weapon.unlocked) {
        slot.classList.add('locked');
      }

      if (index === this.currentWeaponIndex) {
        slot.classList.add('selected');
      }

      const slotInner = document.createElement('div');
      slotInner.className = 'weapon-slot-inner';

      const icon = document.createElement('div');
      icon.className = 'weapon-icon';
      icon.textContent = weapon.icon;

      const name = document.createElement('div');
      name.className = 'weapon-name';
      name.textContent = weapon.name;

      slotInner.appendChild(icon);
      slotInner.appendChild(name);

      // Add ammo display
      if (weapon.unlocked && weapon.ammo !== '∞') {
        const ammo = document.createElement('div');
        ammo.className = 'weapon-ammo';
        ammo.textContent = weapon.ammo;
        slotInner.appendChild(ammo);
      }

      // Add lock icon for locked weapons
      if (!weapon.unlocked) {
        const lock = document.createElement('div');
        lock.className = 'weapon-lock-icon';
        lock.textContent = '🔒';
        slotInner.appendChild(lock);
      }

      slot.appendChild(slotInner);

      // Click event
      slot.addEventListener('click', () => {
        if (weapon.unlocked) {
          this.selectWeapon(index);
        } else {
          // Show locked message
          if (typeof ToastManager !== 'undefined') {
            ToastManager.show('Arme verrouillée', '🔒', 'warning');
          }
        }
      });

      // Hover events
      slot.addEventListener('mouseenter', () => {
        if (weapon.unlocked) {
          this.hoveredWeaponIndex = index;
          this.updateCurrentDisplay(index);
        }
      });

      slot.addEventListener('mouseleave', () => {
        this.hoveredWeaponIndex = null;
        this.updateCurrentDisplay(this.currentWeaponIndex);
      });

      slotsContainer.appendChild(slot);
    });
  }

  updateHover(_e) {
    // Optional: could implement mouse position-based selection
    // For now, relying on hover events from renderWeapons
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;

    const weaponWheel = document.getElementById('weapon-wheel');
    if (weaponWheel) {
      weaponWheel.style.display = 'block';
    }

    // Note: Weapon wheel is instant selection, no need to pause game
    // Pause functionality removed as GameEngine doesn't implement pause() method

    this.updateCurrentDisplay(this.currentWeaponIndex);
  }

  close() {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;

    const weaponWheel = document.getElementById('weapon-wheel');
    if (weaponWheel) {
      weaponWheel.style.display = 'none';
    }

    // Note: No resume needed as game wasn't paused
  }

  selectWeapon(index) {
    const weapon = this.weapons[index];

    if (!weapon || !weapon.unlocked) {
      return;
    }

    this.currentWeaponIndex = index;

    // Update selected class
    const slots = document.querySelectorAll('.weapon-slot');
    slots.forEach((slot, i) => {
      if (i === index) {
        slot.classList.add('selected');
      } else {
        slot.classList.remove('selected');
      }
    });

    // Notify game engine of weapon change
    if (window.gameEngine && window.gameEngine.changeWeapon) {
      window.gameEngine.changeWeapon(weapon.id, weapon.name);
    }

    // Show toast
    if (typeof ToastManager !== 'undefined') {
      ToastManager.show(`${weapon.icon} ${weapon.name}`, '✓', 'success');
    }

    this.updateCurrentDisplay(index);

    // Close weapon wheel after selection
    setTimeout(() => {
      this.close();
    }, 300);
  }

  updateCurrentDisplay(index) {
    const weapon = this.weapons[index];
    if (!weapon) {
      return;
    }

    const currentDisplay = document.getElementById('weapon-wheel-current');
    if (currentDisplay) {
      currentDisplay.textContent = weapon.name;
    }
  }

  // Public method to unlock weapons
  unlockWeapon(weaponId) {
    const weapon = this.weapons.find(w => w.id === weaponId);
    if (weapon) {
      weapon.unlocked = true;
      this.renderWeapons();

      if (typeof ToastManager !== 'undefined') {
        ToastManager.show(`${weapon.icon} ${weapon.name} débloqué!`, '🔓', 'success');
      }
    }
  }

  // Public method to update ammo count
  updateAmmo(weaponId, ammo) {
    const weapon = this.weapons.find(w => w.id === weaponId);
    if (weapon) {
      weapon.ammo = ammo === Infinity ? '∞' : ammo.toString();
      this.renderWeapons();
    }
  }

  // Public method to get current weapon
  getCurrentWeapon() {
    return this.weapons[this.currentWeaponIndex];
  }

  // Public method to set weapons from game state
  setWeapons(weaponsArray) {
    if (Array.isArray(weaponsArray) && weaponsArray.length > 0) {
      this.weapons = weaponsArray;
      this.renderWeapons();
    }
  }

  // Reset to default state
  reset() {
    this.currentWeaponIndex = 0;
    this.hoveredWeaponIndex = null;
    this.isOpen = false;

    // Reset unlocks (only pistol unlocked by default)
    this.weapons.forEach((weapon, index) => {
      weapon.unlocked = index < 3; // First 3 weapons unlocked
    });

    this.renderWeapons();
    this.close();
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  window.weaponWheel = new WeaponWheel();
}
