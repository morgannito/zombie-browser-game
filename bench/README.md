# Load Benchmark Harness

Multi-client smoke/load test for the zombie game server. Spawns N virtual clients, authenticates each, connects via WebSocket, and reports latency + bandwidth metrics.

## Prerequisites

- Node.js 18+
- Server running locally (`npm start` or `npm run dev`)
- `socket.io-client` in devDependencies (already present)

## Starting the server

```bash
cp .env.example .env   # first time only
npm run dev            # development (nodemon)
npm start              # production
```

The server defaults to port **3000**. Override with `PORT=3050` if needed.

## Running the benchmark

```bash
# Quick run — 10 clients, 30 seconds
npm run bench

# Custom run — 20 clients, 60 seconds
BENCH_URL=http://127.0.0.1:3050 BENCH_CLIENTS=20 BENCH_DURATION_MS=60000 npm run bench

# Full options
BENCH_URL=http://127.0.0.1:3000 \
BENCH_CLIENTS=50 \
BENCH_DURATION_MS=120000 \
BENCH_MOVE_HZ=30 \
npm run bench
```

## Environment variables

| Variable            | Default                   | Description                        |
|---------------------|---------------------------|------------------------------------|
| `BENCH_URL`         | `http://127.0.0.1:3050`   | Base URL of the running server     |
| `BENCH_CLIENTS`     | `10`                      | Number of virtual clients to spawn |
| `BENCH_DURATION_MS` | `30000`                   | Test duration in milliseconds      |
| `BENCH_MOVE_HZ`     | `30`                      | playerMove emissions per second    |

## Generating a report

After a run, `bench/last-run.json` is written automatically:

```bash
npm run bench:report

# Or from a custom file
node bench/metrics-report.js bench/last-run.json
```

## What the metrics mean

### Ack Latency
Round-trip time from emitting `playerMove` to receiving the socket.io acknowledgement. Measured per event.

- **Median** — typical latency; expect <10ms locally
- **P95** — 95% of events complete faster than this; good SLO target
- **P99** — worst-case tail; values >150ms indicate event loop blocking or GC pauses

### Messages/sec
Total packets received by all clients divided by elapsed time. Includes all socket events.

- **per_client** — normalised view; helps compare runs with different client counts

### Bandwidth (KB/s)
Estimated from `JSON.stringify` of each received message (excludes WebSocket framing overhead — treat as a lower bound).

### Server health
Snapshot of `/health` fetched at end of run; compare across runs to detect memory growth.

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

Do not run against the production VPS. Local development only.
