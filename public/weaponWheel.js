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

    // Q key to toggle weapon wheel
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'q') {
        // Don't open if other menus are open
        const pauseOpen = document.getElementById('pause-menu')?.style.display !== 'none';
        const settingsOpen = document.getElementById('settings-menu')?.style.display !== 'none';
        const gameOverOpen = document.getElementById('game-over')?.style.display !== 'none';
        const shopOpen = document.getElementById('shop')?.style.display !== 'none';
        const levelUpOpen = document.getElementById('level-up-screen')?.style.display !== 'none';

        if (pauseOpen || settingsOpen || gameOverOpen || shopOpen || levelUpOpen) {
          return;
        }

        this.toggle();
      }
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

  updateHover(e) {
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
