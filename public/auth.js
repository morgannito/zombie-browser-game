/**
 * AUTH MANAGER - JWT Authentication
 * Gere l'authentification JWT avant la connexion au jeu
 */

class AuthManager {
  constructor() {
    this.token = storageManager.get('authToken');
    this.player = storageManager.get('player', null);
  }

  async login(username) {
    try {
      const response = await fetch('/api/v1/auth/login', {
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

      storageManager.set('authToken', data.token);
      storageManager.set('player', data.player);

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
    storageManager.remove('authToken');
    storageManager.remove('player');
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
