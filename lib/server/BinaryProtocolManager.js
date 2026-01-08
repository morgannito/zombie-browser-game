/**
 * BINARY PROTOCOL MANAGER - MessagePack Encoding/Decoding
 * Reduces network payload size by 40-50% vs JSON
 * Optional: Falls back to JSON for unsupported clients
 * @version 1.0.0
 */

const { encode, decode } = require('@msgpack/msgpack');

class BinaryProtocolManager {
  constructor() {
    this.enabled = true; // Can be disabled for debugging
    this.compressionStats = {
      messagesSent: 0,
      bytesJson: 0,
      bytesBinary: 0,
      compressionRatio: 0
    };
  }

  /**
   * Encode game state to MessagePack binary format
   * @param {Object} data - Game state or delta to encode
   * @returns {Buffer} MessagePack encoded binary data
   */
  encodeGameState(data) {
    if (!this.enabled) {
      return data; // Return JSON if disabled
    }

    try {
      // Calculate JSON size for stats (only in dev mode)
      if (process.env.NODE_ENV === 'development') {
        const jsonSize = JSON.stringify(data).length;
        this.compressionStats.bytesJson += jsonSize;
      }

      // Encode to MessagePack
      const binaryData = encode(data);

      // Update stats
      this.compressionStats.messagesSent++;
      this.compressionStats.bytesBinary += binaryData.length;

      // Calculate compression ratio
      if (this.compressionStats.bytesJson > 0) {
        this.compressionStats.compressionRatio =
          (1 - (this.compressionStats.bytesBinary / this.compressionStats.bytesJson)) * 100;
      }

      return binaryData;
    } catch (error) {
      console.error('[BinaryProtocol] Encoding error:', error);
      return data; // Fallback to JSON on error
    }
  }

  /**
   * Decode MessagePack binary data to JavaScript object
   * @param {Buffer|Uint8Array} binaryData - MessagePack encoded data
   * @returns {Object} Decoded game state
   */
  decodeGameState(binaryData) {
    if (!this.enabled || !Buffer.isBuffer(binaryData)) {
      return binaryData; // Return as-is if disabled or not binary
    }

    try {
      return decode(binaryData);
    } catch (error) {
      console.error('[BinaryProtocol] Decoding error:', error);
      return null;
    }
  }

  /**
   * Get compression statistics
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      enabled: this.enabled,
      messagesSent: this.compressionStats.messagesSent,
      bytesJson: this.compressionStats.bytesJson,
      bytesBinary: this.compressionStats.bytesBinary,
      compressionRatio: this.compressionStats.compressionRatio.toFixed(2) + '%',
      bytesSaved: this.compressionStats.bytesJson - this.compressionStats.bytesBinary
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.compressionStats = {
      messagesSent: 0,
      bytesJson: 0,
      bytesBinary: 0,
      compressionRatio: 0
    };
  }

  /**
   * Enable or disable binary protocol
   * @param {boolean} enabled - Enable state
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`[BinaryProtocol] ${enabled ? 'Enabled' : 'Disabled'}`);
  }
}

module.exports = BinaryProtocolManager;
