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

// Export to window
window.initInstructionsToggle = initInstructionsToggle;
window.initMinimapToggle = initMinimapToggle;
