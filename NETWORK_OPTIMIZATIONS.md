# Network Optimizations

## MessagePack Binary Parser

Replace the default JSON Socket.IO encoding with MessagePack (binary) for 40-60% smaller WebSocket frames.

### Activation

Set the environment variable before starting the server:

```
ENABLE_MSGPACK=true node server.js
```

### How it works

1. **Server** (`server/socketio.js`): when `ENABLE_MSGPACK=true`, passes `socket.io-msgpack-parser` as the parser option to the Socket.IO server.
2. **HTML injection** (`server/middleware.js`): a `GET /` route (registered before `express.static`) reads `public/index.html` and injects `<meta name="msgpack" content="1">`.
3. **Client loader** (`public/index.html`): an inline script checks for the meta tag and dynamically loads `/lib/msgpack-parser.js` (UMD bundle, synchronous, before app scripts), then sets `window.__msgpackEnabled = true`.
4. **Client connection** (`public/modules/core/GameEngine.js`): if `window.__msgpackEnabled && window.msgpackParser`, the `parser` option is passed to `io()`. A one-shot `connect_error` listener provides a fallback: if the handshake fails, msgpack is disabled and the socket reconnects with JSON.

### Default behaviour (no env var)

When `ENABLE_MSGPACK` is not set (or is not `'true'`), the server uses standard JSON encoding and the client parser injection is skipped. No breaking change.

### Client parser

`public/lib/msgpack-parser.js` is a self-contained UMD bundle (no CDN dependency) that inlines:
- `notepack.io` browser encode/decode
- `component-emitter`
- `socket.io-msgpack-parser` logic

### Dependencies

- `socket.io-msgpack-parser` ^3.0.2 (already in `package.json` dependencies)
- `notepack.io` (transitive, installed automatically)
