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
    console.warn('Camera recenter button not found');
    return;
  }

  // Show the button (it starts hidden)
  cameraRecenterBtn.style.display = 'flex';

  // Recenter camera on click
  cameraRecenterBtn.addEventListener('click', () => {
    if (window.gameEngine && window.gameEngine.camera && window.gameState) {
      const player = window.gameState.getPlayer();
      if (player) {
        window.gameEngine.camera.recenter(player, window.innerWidth, window.innerHeight);

        // Visual feedback
        cameraRecenterBtn.style.transform = 'scale(0.85)';
        setTimeout(() => {
          cameraRecenterBtn.style.transform = 'scale(1)';
        }, 100);

        // Audio feedback
        if (window.audioManager) {
          window.audioManager.play('click');
        }

        // Toast notification
        if (window.toastManager) {
          window.toastManager.show('Caméra recentrée', 'success', 1000);
        }
      }
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
