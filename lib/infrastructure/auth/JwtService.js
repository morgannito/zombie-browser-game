/**
 * JWT SERVICE
 * Gère l'authentification JWT pour sécuriser les connexions
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JwtService {
  constructor(logger) {
    this.logger = logger;
    this.secret = process.env.JWT_SECRET || this.generateSecret();
    this.expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    if (!process.env.JWT_SECRET) {
      this.logger.warn('JWT_SECRET not set in environment, using generated secret', {
        secret: this.secret.slice(0, 8) + '...'
      });
    }

    this.logger.info('JWT Service initialized', {
      expiresIn: this.expiresIn
    });
  }

  /**
   * Génère un secret aléatoire si non fourni
   */
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Génère un token JWT
   * @param {{ userId: string, username: string }} payload
   * @returns {string} token
   */
  generateToken(payload) {
    try {
      const token = jwt.sign(
        {
          userId: payload.userId,
          username: payload.username,
          iat: Math.floor(Date.now() / 1000)
        },
        this.secret,
        { expiresIn: this.expiresIn }
      );

      this.logger.info('JWT token generated', {
        userId: payload.userId,
        username: payload.username
      });

      return token;
    } catch (error) {
      this.logger.error('Failed to generate JWT token', {
        error: error.message
      });
      throw new Error('Token generation failed');
    }
  }

  /**
   * Vérifie un token JWT
   * @param {string} token
   * @returns {{ userId: string, username: string, iat: number, exp: number } | null}
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret);

      this.logger.debug('JWT token verified', {
        userId: decoded.userId,
        username: decoded.username
      });

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        this.logger.warn('JWT token expired', {
          expiredAt: error.expiredAt
        });
      } else if (error.name === 'JsonWebTokenError') {
        this.logger.warn('Invalid JWT token', {
          error: error.message
        });
      } else {
        this.logger.error('JWT verification error', {
          error: error.message
        });
      }

      return null;
    }
  }

  /**
   * Décode un token sans vérifier la signature (pour inspection)
   * @param {string} token
   * @returns {any | null}
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      this.logger.error('Failed to decode token', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Middleware Socket.IO pour authentification
   * @returns {Function}
   */
  socketMiddleware() {
    return (socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        this.logger.warn('Socket connection without token', {
          socketId: socket.id
        });
        return next(new Error('Authentication required'));
      }

      const decoded = this.verifyToken(token);

      if (!decoded) {
        this.logger.warn('Socket connection with invalid token', {
          socketId: socket.id
        });
        return next(new Error('Invalid or expired token'));
      }

      // Attacher les infos utilisateur au socket
      socket.userId = decoded.userId;
      socket.username = decoded.username;

      this.logger.info('Socket authenticated', {
        socketId: socket.id,
        userId: decoded.userId,
        username: decoded.username
      });

      next();
    });
  }

  /**
   * Middleware Express pour authentification
   * @returns {Function}
   */
  expressMiddleware() {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({
          error: 'No authorization header'
        });
      }

      const parts = authHeader.split(' ');

      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
          error: 'Invalid authorization header format. Expected: Bearer <token>'
        });
      }

      const token = parts[1];
      const decoded = this.verifyToken(token);

      if (!decoded) {
        return res.status(401).json({
          error: 'Invalid or expired token'
        });
      }

      req.userId = decoded.userId;
      req.username = decoded.username;

      next();
    };
  }
}

module.exports = JwtService;
