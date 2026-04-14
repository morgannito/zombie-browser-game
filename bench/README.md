# Load Benchmark Harness

Multi-client smoke/load test for the zombie game server. Spawns N virtual clients, authenticates each, connects via WebSocket, and reports latency + bandwidth metrics.

## Prerequisites

- Node.js 18+
- Server running locally (`npm start` or `npm run dev`)
- `socket.io-client` in devDependencies (already present)

## Starting the server

```bash
# Copy environment file if needed
cp .env.example .env

# Start in development mode
npm run dev

# Or production mode
npm start
```

The server defaults to port **3000**. Override with `PORT=3050` if needed.

## Running the benchmark

```bash
# Quick run — 10 clients, 30 seconds
npm run bench

# Custom run — 20 clients, 60 seconds, against port 3050
BENCH_URL=http://127.0.0.1:3050 BENCH_CLIENTS=20 BENCH_DURATION_MS=60000 npm run bench

# All options
BENCH_URL=http://127.0.0.1:3000 \
BENCH_CLIENTS=50 \
BENCH_DURATION_MS=120000 \
BENCH_MOVE_HZ=30 \
npm run bench
```

## Environment variables

| Variable            | Default                   | Description                          |
|---------------------|---------------------------|--------------------------------------|
| `BENCH_URL`         | `http://127.0.0.1:3050`   | Base URL of the running server       |
| `BENCH_CLIENTS`     | `10`                      | Number of virtual clients to spawn   |
| `BENCH_DURATION_MS` | `30000`                   | Test duration in milliseconds        |
| `BENCH_MOVE_HZ`     | `30`                      | playerMove emissions per second      |

## Generating a report

After a benchmark run, `bench/last-run.json` is written automatically. Generate a formatted report with:

```bash
npm run bench:report

# Or from a specific results file
node bench/metrics-report.js bench/last-run.json
```

## What the metrics mean

### Ack Latency
Round-trip time from emitting `playerMove` to receiving the server acknowledgement callback. Measured per event.

- **Median** — typical latency for most events
- **P95** — 95% of events are faster than this; a good performance SLO target
- **P99** — worst-case tail latency; high values indicate GC pauses or event loop blocking

### Messages/sec
Total packets received by all clients divided by elapsed time. Includes all socket events (`gameState`, `playerJoined`, etc.).

- **per_client** — normalised view; helps detect whether a single noisy client is skewing the total

### Bandwidth (KB/s)
Bytes received, estimated by `JSON.stringify`-ing each message. Does not account for WebSocket framing overhead — treat as a lower bound.

### Server health
Snapshot of `/health` fetched at the end of the run. Useful to compare pre/post memory and uptime.

## Example expected output

```
Zombie Game — Load Benchmark
  URL:      http://127.0.0.1:3050
  Clients:  10
  Duration: 30000ms
  Move Hz:  30

=== BENCHMARK RESULTS ===

{
  "duration_sec": "30.15",
  "clients_connected": 10,
  "clients_total": 10,
  "errors": 0,
  "latency_ms": {
    "median": 4,
    "p95": 18,
    "p99": 35,
    "samples": 8820
  },
  "throughput": {
    "total_messages": 42600,
    "messages_per_sec": "1413.27",
    "messages_per_sec_per_client": "141.33",
    "total_bytes": 12988000,
    "bandwidth_kbps": "420.91",
    "bandwidth_kbps_per_client": "42.09"
  },
  "server_health": {
    "status": "ok",
    "uptime": 31.4,
    "memory": { "rss": 52428800 }
  }
}
```

## Safety

Do not run this benchmark against the production VPS. Running it against production will trigger rate limits and degrade service for real users. Local development use only.
