/**
 * AUTH MANAGER - JWT Authentication
 * Gère l'authentification JWT avant la connexion au jeu
 */

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('authToken');
    this.player = JSON.parse(localStorage.getItem('player') || 'null');
  }

  async login(username) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();

      this.token = data.token;
      this.player = data.player;

      localStorage.setItem('authToken', data.token);
      localStorage.setItem('player', JSON.stringify(data.player));

      console.log('[Auth] Login successful:', data.player.username);
      return data;
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      throw error;
    }
  }

  logout() {
    this.token = null;
    this.player = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('player');
  }

  isAuthenticated() {
    return !!this.token;
  }

  getToken() {
    return this.token;
  }

  getPlayer() {
    return this.player;
  }
}

// Instance globale
window.authManager = new AuthManager();
console.log('[Auth] AuthManager initialized');
