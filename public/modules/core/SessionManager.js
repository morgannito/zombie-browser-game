/**
 * SESSION MANAGEMENT - Reconnection handling
 * Manages player sessions and reconnection recovery
 * @module SessionManager
 * @author Claude Code
 * @version 2.0.0
 */

class SessionManager {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  /**
   * Generate a UUID v4
   * @returns {string} UUID
   */
  generateUUID() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      // RFC 4122 v4
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
      return (
        hex[0] + hex[1] + hex[2] + hex[3] + '-' +
        hex[4] + hex[5] + '-' +
        hex[6] + hex[7] + '-' +
        hex[8] + hex[9] + '-' +
        hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15]
      );
    }

    console.warn('[Session] Secure crypto unavailable, falling back to Math.random');
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get existing sessionId from localStorage or create a new one
   * @returns {string} Session ID
   */
  getOrCreateSessionId() {
    let sessionId = localStorage.getItem('zombie_session_id');

    if (!sessionId) {
      sessionId = this.generateUUID();
      localStorage.setItem('zombie_session_id', sessionId);
      console.log('[Session] Created new session ID:', sessionId);
    } else {
      console.log('[Session] Using existing session ID:', sessionId);
    }

    return sessionId;
  }

  /**
   * Get the current session ID
   * @returns {string}
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Reset session (for debugging or explicit logout)
   */
  resetSession() {
    localStorage.removeItem('zombie_session_id');
    this.sessionId = this.generateUUID();
    localStorage.setItem('zombie_session_id', this.sessionId);
    console.log('[Session] Reset session ID:', this.sessionId);
  }
}

// Export to window
window.SessionManager = SessionManager;
