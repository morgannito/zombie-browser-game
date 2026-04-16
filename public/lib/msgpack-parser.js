/**
 * socket.io-msgpack-parser — Browser UMD bundle
 *
 * Self-contained: inlines notepack.io (browser build) + component-emitter.
 * Exposes window.msgpackParser so GameEngine can pass it to io({ parser }).
 *
 * Activation: loaded by index.html only when the server sets
 * <meta name="msgpack" content="1"> (i.e. ENABLE_MSGPACK=true env var).
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* notepack.io — browser/decode.js                                     */
  /* ------------------------------------------------------------------ */
  function NotepackDecoder(buffer) {
    this._offset = 0;
    if (buffer instanceof ArrayBuffer) {
      this._buffer = buffer;
      this._view = new DataView(this._buffer);
    } else if (ArrayBuffer.isView(buffer)) {
      this._buffer = buffer.buffer;
      this._view = new DataView(this._buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      throw new Error('Invalid argument');
    }
  }

  function utf8Read(view, offset, length) {
    var string = '', chr = 0;
    for (var i = offset, end = offset + length; i < end; i++) {
      var byte_ = view.getUint8(i);
      if ((byte_ & 0x80) === 0x00) { string += String.fromCharCode(byte_); continue; }
      if ((byte_ & 0xe0) === 0xc0) {
        string += String.fromCharCode(((byte_ & 0x1f) << 6) | (view.getUint8(++i) & 0x3f));
        continue;
      }
      if ((byte_ & 0xf0) === 0xe0) {
        string += String.fromCharCode(
          ((byte_ & 0x0f) << 12) | ((view.getUint8(++i) & 0x3f) << 6) | (view.getUint8(++i) & 0x3f)
        );
        continue;
      }
      if ((byte_ & 0xf8) === 0xf0) {
        chr = ((byte_ & 0x07) << 18) | ((view.getUint8(++i) & 0x3f) << 12) |
              ((view.getUint8(++i) & 0x3f) << 6) | (view.getUint8(++i) & 0x3f);
        if (chr >= 0x010000) {
          chr -= 0x010000;
          string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
        } else {
          string += String.fromCharCode(chr);
        }
        continue;
      }
      throw new Error('Invalid byte ' + byte_.toString(16));
    }
    return string;
  }

  NotepackDecoder.prototype._array = function (length) {
    var value = new Array(length);
    for (var i = 0; i < length; i++) { value[i] = this._parse(); }
    return value;
  };
  NotepackDecoder.prototype._map = function (length) {
    var key = '', value = {};
    for (var i = 0; i < length; i++) { key = this._parse(); value[key] = this._parse(); }
    return value;
  };
  NotepackDecoder.prototype._str = function (length) {
    var value = utf8Read(this._view, this._offset, length);
    this._offset += length;
    return value;
  };
  NotepackDecoder.prototype._bin = function (length) {
    var value = this._buffer.slice(this._offset, this._offset + length);
    this._offset += length;
    return value;
  };
  NotepackDecoder.prototype._parse = function () {
    var prefix = this._view.getUint8(this._offset++);
    var value, length = 0, type = 0, hi = 0, lo = 0;
    if (prefix < 0xc0) {
      if (prefix < 0x80) return prefix;
      if (prefix < 0x90) return this._map(prefix & 0x0f);
      if (prefix < 0xa0) return this._array(prefix & 0x0f);
      return this._str(prefix & 0x1f);
    }
    if (prefix > 0xdf) return (0xff - prefix + 1) * -1;
    switch (prefix) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;
      case 0xc4: length = this._view.getUint8(this._offset); this._offset += 1; return this._bin(length);
      case 0xc5: length = this._view.getUint16(this._offset); this._offset += 2; return this._bin(length);
      case 0xc6: length = this._view.getUint32(this._offset); this._offset += 4; return this._bin(length);
      case 0xc7: length = this._view.getUint8(this._offset); type = this._view.getInt8(this._offset + 1); this._offset += 2; return [type, this._bin(length)];
      case 0xc8: length = this._view.getUint16(this._offset); type = this._view.getInt8(this._offset + 2); this._offset += 3; return [type, this._bin(length)];
      case 0xc9: length = this._view.getUint32(this._offset); type = this._view.getInt8(this._offset + 4); this._offset += 5; return [type, this._bin(length)];
      case 0xca: value = this._view.getFloat32(this._offset); this._offset += 4; return value;
      case 0xcb: value = this._view.getFloat64(this._offset); this._offset += 8; return value;
      case 0xcc: value = this._view.getUint8(this._offset); this._offset += 1; return value;
      case 0xcd: value = this._view.getUint16(this._offset); this._offset += 2; return value;
      case 0xce: value = this._view.getUint32(this._offset); this._offset += 4; return value;
      case 0xcf: hi = this._view.getUint32(this._offset) * Math.pow(2, 32); lo = this._view.getUint32(this._offset + 4); this._offset += 8; return hi + lo;
      case 0xd0: value = this._view.getInt8(this._offset); this._offset += 1; return value;
      case 0xd1: value = this._view.getInt16(this._offset); this._offset += 2; return value;
      case 0xd2: value = this._view.getInt32(this._offset); this._offset += 4; return value;
      case 0xd3: hi = this._view.getInt32(this._offset) * Math.pow(2, 32); lo = this._view.getUint32(this._offset + 4); this._offset += 8; return hi + lo;
      case 0xd4:
        type = this._view.getInt8(this._offset); this._offset += 1;
        if (type === 0x00) { this._offset += 1; return void 0; }
        return [type, this._bin(1)];
      case 0xd5: type = this._view.getInt8(this._offset); this._offset += 1; return [type, this._bin(2)];
      case 0xd6: type = this._view.getInt8(this._offset); this._offset += 1; return [type, this._bin(4)];
      case 0xd7:
        type = this._view.getInt8(this._offset); this._offset += 1;
        if (type === 0x00) { hi = this._view.getInt32(this._offset) * Math.pow(2, 32); lo = this._view.getUint32(this._offset + 4); this._offset += 8; return new Date(hi + lo); }
        return [type, this._bin(8)];
      case 0xd8: type = this._view.getInt8(this._offset); this._offset += 1; return [type, this._bin(16)];
      case 0xd9: length = this._view.getUint8(this._offset); this._offset += 1; return this._str(length);
      case 0xda: length = this._view.getUint16(this._offset); this._offset += 2; return this._str(length);
      case 0xdb: length = this._view.getUint32(this._offset); this._offset += 4; return this._str(length);
      case 0xdc: length = this._view.getUint16(this._offset); this._offset += 2; return this._array(length);
      case 0xdd: length = this._view.getUint32(this._offset); this._offset += 4; return this._array(length);
      case 0xde: length = this._view.getUint16(this._offset); this._offset += 2; return this._map(length);
      case 0xdf: length = this._view.getUint32(this._offset); this._offset += 4; return this._map(length);
    }
    throw new Error('Could not parse');
  };

  function notepackDecode(buffer) {
    var decoder = new NotepackDecoder(buffer);
    var value = decoder._parse();
    if (decoder._offset !== buffer.byteLength) {
      throw new Error((buffer.byteLength - decoder._offset) + ' trailing bytes');
    }
    return value;
  }

  /* ------------------------------------------------------------------ */
  /* notepack.io — browser/encode.js                                     */
  /* ------------------------------------------------------------------ */
  function utf8Write(view, offset, str) {
    var c = 0;
    for (var i = 0, l = str.length; i < l; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) { view.setUint8(offset++, c); }
      else if (c < 0x800) { view.setUint8(offset++, 0xc0 | (c >> 6)); view.setUint8(offset++, 0x80 | (c & 0x3f)); }
      else if (c < 0xd800 || c >= 0xe000) { view.setUint8(offset++, 0xe0 | (c >> 12)); view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f); view.setUint8(offset++, 0x80 | (c & 0x3f)); }
      else { i++; c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff)); view.setUint8(offset++, 0xf0 | (c >> 18)); view.setUint8(offset++, 0x80 | (c >> 12) & 0x3f); view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f); view.setUint8(offset++, 0x80 | (c & 0x3f)); }
    }
  }
  function utf8Length(str) {
    var c = 0, length = 0;
    for (var i = 0, l = str.length; i < l; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) length += 1;
      else if (c < 0x800) length += 2;
      else if (c < 0xd800 || c >= 0xe000) length += 3;
      else { i++; length += 4; }
    }
    return length;
  }
  function _encode(bytes, defers, value) {
    var type = typeof value, i = 0, l = 0, hi = 0, lo = 0, length = 0, size = 0;
    if (type === 'string') {
      length = utf8Length(value);
      if (length < 0x20) { bytes.push(length | 0xa0); size = 1; }
      else if (length < 0x100) { bytes.push(0xd9, length); size = 2; }
      else if (length < 0x10000) { bytes.push(0xda, length >> 8, length); size = 3; }
      else if (length < 0x100000000) { bytes.push(0xdb, length >> 24, length >> 16, length >> 8, length); size = 5; }
      else throw new Error('String too long');
      defers.push({ _str: value, _length: length, _offset: bytes.length });
      return size + length;
    }
    if (type === 'number') {
      if (Math.floor(value) !== value || !isFinite(value)) { bytes.push(0xcb); defers.push({ _float: value, _length: 8, _offset: bytes.length }); return 9; }
      if (value >= 0) {
        if (value < 0x80) { bytes.push(value); return 1; }
        if (value < 0x100) { bytes.push(0xcc, value); return 2; }
        if (value < 0x10000) { bytes.push(0xcd, value >> 8, value); return 3; }
        if (value < 0x100000000) { bytes.push(0xce, value >> 24, value >> 16, value >> 8, value); return 5; }
        hi = (value / Math.pow(2, 32)) >> 0; lo = value >>> 0;
        bytes.push(0xcf, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo); return 9;
      } else {
        if (value >= -0x20) { bytes.push(value); return 1; }
        if (value >= -0x80) { bytes.push(0xd0, value); return 2; }
        if (value >= -0x8000) { bytes.push(0xd1, value >> 8, value); return 3; }
        if (value >= -0x80000000) { bytes.push(0xd2, value >> 24, value >> 16, value >> 8, value); return 5; }
        hi = Math.floor(value / Math.pow(2, 32)); lo = value >>> 0;
        bytes.push(0xd3, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo); return 9;
      }
    }
    if (type === 'object') {
      if (value === null) { bytes.push(0xc0); return 1; }
      if (Array.isArray(value)) {
        length = value.length;
        if (length < 0x10) { bytes.push(length | 0x90); size = 1; }
        else if (length < 0x10000) { bytes.push(0xdc, length >> 8, length); size = 3; }
        else if (length < 0x100000000) { bytes.push(0xdd, length >> 24, length >> 16, length >> 8, length); size = 5; }
        else throw new Error('Array too large');
        for (i = 0; i < length; i++) size += _encode(bytes, defers, value[i]);
        return size;
      }
      if (value instanceof Date) {
        var time = value.getTime();
        hi = Math.floor(time / Math.pow(2, 32)); lo = time >>> 0;
        bytes.push(0xd7, 0, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo); return 10;
      }
      if (value instanceof ArrayBuffer) {
        length = value.byteLength;
        if (length < 0x100) { bytes.push(0xc4, length); size = 2; }
        else if (length < 0x10000) { bytes.push(0xc5, length >> 8, length); size = 3; }
        else if (length < 0x100000000) { bytes.push(0xc6, length >> 24, length >> 16, length >> 8, length); size = 5; }
        else throw new Error('Buffer too large');
        defers.push({ _bin: value, _length: length, _offset: bytes.length }); return size + length;
      }
      if (typeof value.toJSON === 'function') return _encode(bytes, defers, value.toJSON());
      var keys = [], key = '', allKeys = Object.keys(value);
      for (i = 0, l = allKeys.length; i < l; i++) { key = allKeys[i]; if (typeof value[key] !== 'function') keys.push(key); }
      length = keys.length;
      if (length < 0x10) { bytes.push(length | 0x80); size = 1; }
      else if (length < 0x10000) { bytes.push(0xde, length >> 8, length); size = 3; }
      else if (length < 0x100000000) { bytes.push(0xdf, length >> 24, length >> 16, length >> 8, length); size = 5; }
      else throw new Error('Object too large');
      for (i = 0; i < length; i++) { key = keys[i]; size += _encode(bytes, defers, key); size += _encode(bytes, defers, value[key]); }
      return size;
    }
    if (type === 'boolean') { bytes.push(value ? 0xc3 : 0xc2); return 1; }
    if (type === 'undefined') { bytes.push(0xd4, 0, 0); return 3; }
    throw new Error('Could not encode');
  }
  function notepackEncode(value) {
    var bytes = [], defers = [];
    var size = _encode(bytes, defers, value);
    var buf = new ArrayBuffer(size);
    var view = new DataView(buf);
    var deferIndex = 0, deferWritten = 0, nextOffset = -1;
    if (defers.length > 0) nextOffset = defers[0]._offset;
    var defer, deferLength = 0, offset = 0;
    for (var i = 0, l = bytes.length; i < l; i++) {
      view.setUint8(deferWritten + i, bytes[i]);
      if (i + 1 !== nextOffset) continue;
      defer = defers[deferIndex]; deferLength = defer._length; offset = deferWritten + nextOffset;
      if (defer._bin) { var bin = new Uint8Array(defer._bin); for (var j = 0; j < deferLength; j++) view.setUint8(offset + j, bin[j]); }
      else if (defer._str) utf8Write(view, offset, defer._str);
      else if (defer._float !== undefined) view.setFloat64(offset, defer._float);
      deferIndex++; deferWritten += deferLength;
      if (defers[deferIndex]) nextOffset = defers[deferIndex]._offset;
    }
    return buf;
  }

  /* ------------------------------------------------------------------ */
  /* component-emitter (minimal inline)                                   */
  /* ------------------------------------------------------------------ */
  function Emitter(obj) { if (obj) return mixin(obj); }
  function mixin(obj) { for (var key in Emitter.prototype) obj[key] = Emitter.prototype[key]; return obj; }
  Emitter.prototype.on = Emitter.prototype.addEventListener = function (event, fn) {
    this._callbacks = this._callbacks || {};
    (this._callbacks['$' + event] = this._callbacks['$' + event] || []).push(fn);
    return this;
  };
  Emitter.prototype.once = function (event, fn) {
    function on() { this.off(event, on); fn.apply(this, arguments); }
    on.fn = fn; this.on(event, on); return this;
  };
  Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function (event, fn) {
    this._callbacks = this._callbacks || {};
    if (0 === arguments.length) { this._callbacks = {}; return this; }
    var callbacks = this._callbacks['$' + event];
    if (!callbacks) return this;
    if (1 === arguments.length) { delete this._callbacks['$' + event]; return this; }
    var cb;
    for (var i = 0; i < callbacks.length; i++) { cb = callbacks[i]; if (cb === fn || cb.fn === fn) { callbacks.splice(i, 1); break; } }
    if (callbacks.length === 0) delete this._callbacks['$' + event];
    return this;
  };
  Emitter.prototype.emit = function (event) {
    this._callbacks = this._callbacks || {};
    var args = new Array(arguments.length - 1), callbacks = this._callbacks['$' + event];
    for (var i = 1; i < arguments.length; i++) args[i - 1] = arguments[i];
    if (callbacks) { callbacks = callbacks.slice(0); for (var i = 0, len = callbacks.length; i < len; ++i) callbacks[i].apply(this, args); }
    return this;
  };
  Emitter.prototype.listeners = function (event) { this._callbacks = this._callbacks || {}; return this._callbacks['$' + event] || []; };
  Emitter.prototype.hasListeners = function (event) { return !!this.listeners(event).length; };

  /* ------------------------------------------------------------------ */
  /* socket.io-msgpack-parser (adapted from index.js)                    */
  /* ------------------------------------------------------------------ */
  var PacketType = { CONNECT: 0, DISCONNECT: 1, EVENT: 2, ACK: 3, CONNECT_ERROR: 4 };

  var isInteger = Number.isInteger || function (v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; };
  var isString_ = function (v) { return typeof v === 'string'; };
  var isObject_ = function (v) { return Object.prototype.toString.call(v) === '[object Object]'; };

  function Encoder() {}
  Encoder.prototype.encode = function (packet) { return [notepackEncode(packet)]; };

  function Decoder() {}
  Emitter(Decoder.prototype);
  Decoder.prototype.add = function (obj) {
    var decoded = notepackDecode(obj);
    this._checkPacket(decoded);
    this.emit('decoded', decoded);
  };
  function isDataValid(decoded) {
    switch (decoded.type) {
      case PacketType.CONNECT: return decoded.data === undefined || isObject_(decoded.data);
      case PacketType.DISCONNECT: return decoded.data === undefined;
      case PacketType.CONNECT_ERROR: return isString_(decoded.data) || isObject_(decoded.data);
      default: return Array.isArray(decoded.data);
    }
  }
  Decoder.prototype._checkPacket = function (decoded) {
    var isTypeValid = isInteger(decoded.type) && decoded.type >= PacketType.CONNECT && decoded.type <= PacketType.CONNECT_ERROR;
    if (!isTypeValid) throw new Error('invalid packet type');
    if (!isString_(decoded.nsp)) throw new Error('invalid namespace');
    if (!isDataValid(decoded)) throw new Error('invalid payload');
    var isAckValid = decoded.id === undefined || isInteger(decoded.id);
    if (!isAckValid) throw new Error('invalid packet id');
  };
  Decoder.prototype.destroy = function () {};

  /* ------------------------------------------------------------------ */
  /* Export as window.msgpackParser                                      */
  /* ------------------------------------------------------------------ */
  global.msgpackParser = {
    protocol: 5,
    Encoder: Encoder,
    Decoder: Decoder
  };

})(typeof window !== 'undefined' ? window : this);
