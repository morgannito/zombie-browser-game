/**
 * INITIALIZATION HELPERS
 * Helper functions for initializing UI components
 * @module initHelpers
 * @author Claude Code
 * @version 2.0.0
 */

function initInstructionsToggle() {
  const instructionsPanel = document.getElementById('instructions');
  const instructionsToggle = document.getElementById('instructions-toggle');
  const instructionsHeader = document.getElementById('instructions-header');

  if (!instructionsPanel || !instructionsToggle || !instructionsHeader) {
    console.warn('Instructions elements not found');
    return;
  }

  // Toggle function
  const toggleInstructions = () => {
    instructionsPanel.classList.toggle('collapsed');

    // Update button icon
    if (instructionsPanel.classList.contains('collapsed')) {
      instructionsToggle.textContent = '▼';
    } else {
      instructionsToggle.textContent = '▲';
    }
  };

  // Add click event listeners
  instructionsHeader.addEventListener('click', toggleInstructions);

  // Prevent double-toggle when clicking the button directly
  instructionsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  console.log('✅ Instructions toggle initialized');
}

/* ============================================
   MINIMAP TOGGLE HANDLER (MOBILE)
   ============================================ */

function initMinimapToggle() {
  const minimap = document.getElementById('minimap');
  const minimapToggle = document.getElementById('minimap-toggle');

  if (!minimap || !minimapToggle) {
    console.warn('Minimap elements not found');
    return;
  }

  // Check if mobile
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // Start with minimap hidden on mobile
    minimap.classList.add('hidden-mobile');

    // Toggle function
    minimapToggle.addEventListener('click', () => {
      minimap.classList.toggle('hidden-mobile');
      minimapToggle.classList.toggle('active');
    });

    console.log('✅ Minimap toggle initialized (mobile)');
  }
}

/* ============================================
   CAMERA RECENTER BUTTON
   ============================================ */

function initCameraRecenter() {
  const cameraRecenterBtn = document.getElementById('camera-recenter-btn');

  if (!cameraRecenterBtn) {
    console.error('[Camera Recenter] Button element not found in DOM!');
    return;
  }

  // Show the button (it starts hidden)
  cameraRecenterBtn.style.display = 'flex';
  console.log('[Camera Recenter] Button found and displayed');

  // Recenter camera on click
  cameraRecenterBtn.addEventListener('click', () => {
    console.log('[Camera Recenter] Button clicked');

    if (!window.gameEngine) {
      console.error('[Camera Recenter] gameEngine not found');
      if (window.toastManager) {
        window.toastManager.show('❌ Jeu non initialisé', 'error', 2000);
      }
      return;
    }

    if (!window.gameEngine.camera) {
      console.error('[Camera Recenter] camera not found');
      if (window.toastManager) {
        window.toastManager.show('❌ Caméra non disponible', 'error', 2000);
      }
      return;
    }

    if (!window.gameState) {
      console.error('[Camera Recenter] gameState not found');
      if (window.toastManager) {
        window.toastManager.show('❌ État de jeu non disponible', 'error', 2000);
      }
      return;
    }

    const player = window.gameState.getPlayer();
    if (!player) {
      console.warn('[Camera Recenter] Player not found');
      if (window.toastManager) {
        window.toastManager.show('⚠️ Joueur non trouvé', 'warning', 2000);
      }
      return;
    }

    // Recenter camera
    window.gameEngine.camera.recenter(player, window.innerWidth, window.innerHeight);
    console.log('[Camera Recenter] Camera recentered successfully');

    // Visual feedback
    cameraRecenterBtn.style.transform = 'scale(0.85)';
    setTimeout(() => {
      cameraRecenterBtn.style.transform = 'scale(1)';
    }, 100);

    // Audio feedback
    if (window.audioManager && typeof window.audioManager.playSound === 'function') {
      window.audioManager.playSound('click');
    }

    // Toast notification
    if (window.toastManager) {
      window.toastManager.show('🎯 Caméra recentrée', 'success', 1500);
    }
  });

  // Also allow keyboard shortcut (C key)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
      // Don't trigger if typing in input field
      if (!document.querySelector('input:focus') && !document.querySelector('textarea:focus')) {
        cameraRecenterBtn.click();
      }
    }
  });

  console.log('✅ Camera recenter button initialized');
}

// Export to window
window.initInstructionsToggle = initInstructionsToggle;
window.initMinimapToggle = initMinimapToggle;
window.initCameraRecenter = initCameraRecenter;
