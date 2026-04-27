# AI-Powered Support Ticket Processing Pipeline

A Node.js backend service that processes customer support tickets through a 2-phase AI pipeline — automatic triage, response drafting, real-time updates, and full audit trail.

---

## How It Works

1. Client submits a ticket via `POST /api/tickets`
2. API responds immediately with a ticket ID (`202 Accepted`)
3. **Phase 1** — AI reads the ticket and produces: category, priority, sentiment, escalation flag, routing target, summary
4. **Phase 2** — AI uses the Phase 1 output to generate: customer reply draft, internal note, next actions
5. Support agent sees every step update in real-time via Socket.io
6. Full ticket state queryable at any time via `GET /api/tickets/:taskId`

Failed phases retry automatically with exponential backoff. Permanently failed tickets land in a Dead Letter Queue.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v24 + TypeScript (ESM) |
| Framework | Express 4.x |
| Database | PostgreSQL 16 (raw `pg`, no ORM) |
| Queue | AWS SQS via LocalStack (local dev) |
| AI Gateway | Portkey — Groq → Claude → OpenAI → Gemini fallback |
| Validation | Zod 3.x |
| Logger | Pino 9.x |
| Real-time | Socket.io 4.x |
| Testing | Jest + Supertest |

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 24.x | `nvm install 24` |
| PostgreSQL | 16 | `apt install postgresql` or [official installer](https://www.postgresql.org/download/) |
| uv (Python) | Latest | `curl -Ls https://astral.sh/uv/install.sh \| sh` |

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in all required values (see Environment Variables section below).

### 3. Create the database

```bash
createdb ticket_pipeline
```

### 4. Run migrations

```bash
npm run migrate
```

Expected output:
```
Ran: 001_create_tickets.sql
Ran: 002_create_ticket_phases.sql
Ran: 003_create_ticket_events.sql
```

### 5. Start LocalStack (SQS emulator)

```bash
uv run localstack start
```

Wait until you see `Ready.` in the output.

### 6. Create SQS queues

```bash
npm run queues:create
```

Creates 4 queues: `phase1Queue`, `phase1Queue-DLQ`, `phase2Queue`, `phase2Queue-DLQ`.

### 7. Start the server

```bash
npm run dev:single
```

This starts the API + all 3 workers (Phase 1, Phase 2, DLQ monitor) in a single process — required for Socket.io to work correctly.

### 8. Verify setup

```bash
# Health check
curl http://localhost:3000/health

# Expected: {"status":"ok","timestamp":"..."}
```

---

## Environment Variables

Create a `.env` file at the project root with the following:

```bash
# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# PostgreSQL
DATABASE_URL=postgresql://rumi:1060@localhost:5432/ticket_pipeline

# AWS SQS — LocalStack for local dev
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localhost:4566

# SQS Queue URLs
PHASE1_QUEUE_URL=http://localhost:4566/000000000000/phase1Queue
PHASE2_QUEUE_URL=http://localhost:4566/000000000000/phase2Queue
PHASE1_DLQ_URL=http://localhost:4566/000000000000/phase1Queue-DLQ
PHASE2_DLQ_URL=http://localhost:4566/000000000000/phase2Queue-DLQ

# Portkey AI Gateway
PORTKEY_API_KEY=pk-...
PORTKEY_CONFIG_ID=pc-...

# Worker config (optional — defaults shown)
MAX_RETRY_ATTEMPTS=3
RETRY_BASE_DELAY_MS=500
RETRY_MAX_DELAY_MS=8000
RETRY_MAX_JITTER_MS=500
SQS_VISIBILITY_TIMEOUT=60
SQS_WAIT_TIME_SECONDS=20
```

---

## API Reference

### `GET /health`

Returns server status.

```json
{ "status": "ok", "timestamp": "2026-04-27T10:00:00.000Z" }
```

---

### `POST /api/tickets`

Submit a new support ticket.

**Request body:**
```json
{
  "tenantId": "company-abc",
  "subject": "Cannot log in to my account",
  "body": "I have been trying to log in for the past hour and keep getting an error."
}
```

**Response `202`:**
```json
{ "ticketId": "uuid-here", "status": "queued" }
```

**Response `400` (validation failed):**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "code": 400,
  "fields": [{ "field": "body", "message": "Body must be at least 10 characters" }]
}
```

---

### `GET /api/tickets/:taskId`

Get the full state of a ticket including AI results and audit trail.

**Response `200`:**
```json
{
  "ticketId": "uuid-here",
  "status": "completed",
  "phases": {
    "phase1": {
      "status": "completed",
      "attempts": 1,
      "output": {
        "category": "technical",
        "priority": "high",
        "sentiment": "frustrated",
        "escalation": false,
        "routingTarget": "tier2",
        "summary": "User unable to log in since yesterday."
      }
    },
    "phase2": {
      "status": "completed",
      "attempts": 1,
      "output": {
        "customerReply": "Hi, thank you for reaching out...",
        "internalNote": "Likely a session token issue. Check auth logs.",
        "nextActions": ["Reset user session", "Check auth service logs"]
      }
    }
  },
  "events": [
    { "eventType": "queued", "phase": null, "payload": {}, "createdAt": "..." },
    { "eventType": "phase_started", "phase": "phase1", "payload": { "attempt": 1 }, "createdAt": "..." },
    { "eventType": "phase_completed", "phase": "phase1", "payload": { "provider": "groq", "latencyMs": 1200 }, "createdAt": "..." },
    { "eventType": "phase_started", "phase": "phase2", "payload": { "attempt": 1 }, "createdAt": "..." },
    { "eventType": "phase_completed", "phase": "phase2", "payload": { "provider": "groq", "latencyMs": 980 }, "createdAt": "..." },
    { "eventType": "completed", "phase": null, "payload": {}, "createdAt": "..." }
  ]
}
```

**Response `404`:**
```json
{ "error": "NOT_FOUND", "message": "Ticket uuid-here not found", "code": 404 }
```

---

### `POST /api/tickets/:taskId/replay`

Re-run a failed ticket. Smart enough to skip phases that already succeeded.

**Response `202`:**
```json
{ "ticketId": "uuid-here", "status": "queued" }
```

**Response `409` (ticket not failed):**
```json
{ "error": "CONFLICT", "message": "Only failed tickets can be replayed", "code": 409 }
```

---

## Real-Time Updates (Socket.io)

Connect to `http://localhost:3000` and join a ticket room to receive live events.

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  socket.emit('join:ticket', '<ticketId>');
});

// Events fire in this order for a successful ticket:
socket.on('ticket:received',  (data) => console.log(data));
socket.on('phase1:started',   (data) => console.log(data));
socket.on('phase1:complete',  (data) => console.log(data)); // includes triage result
socket.on('phase2:started',   (data) => console.log(data));
socket.on('phase2:complete',  (data) => console.log(data)); // includes reply draft
socket.on('ticket:completed', (data) => console.log(data));

// On failure:
socket.on('ticket:failed', (data) => console.log(data));
```

Every event payload includes `taskId` and `timestamp`.

---

## Project Structure

```
src/
├── api/              # Express + Socket.io server bootstrap
├── config/           # Environment variable loading
├── controllers/      # Request/response handlers
├── db/               # PostgreSQL connection pool
├── logger/           # Pino logger setup
├── prompts/          # AI prompt builders (phase1, phase2)
├── queue/            # SQS client (send, receive, delete)
├── repositories/     # DB queries (tickets, phases, events)
├── routes/           # Express route definitions
├── schemas/          # Zod schemas for input + AI output validation
├── services/         # AI gateway, triage service, resolution service
├── socket/           # Socket.io server + emitToTicket helper
├── types/            # Shared TypeScript types
├── utils/            # Backoff calculator, error types
├── workers/          # SQS long-polling workers
│   ├── phase1Worker.ts
│   ├── phase2Worker.ts
│   └── dlqMonitor.ts
└── main.ts           # Single-process entry point (API + all workers)

migrations/           # SQL migration files (idempotent, versioned)
scripts/              # Queue provisioning script
tests/                # Unit, integration, and E2E tests
```

---

## npm Scripts

| Command | Description |
|---|---|
| `npm run dev:single` | Start API + all workers in one process (recommended) |
| `npm run migrate` | Run database migrations |
| `npm run queues:create` | Provision all 4 SQS queues in LocalStack |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm test` | Run all tests |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output (production) |

---

## Retry & Failure Handling

Failed AI calls retry automatically with exponential backoff + jitter:

| Attempt | Base Delay | + Jitter | Approx Wait |
|---|---|---|---|
| 1 | 2s | 0–500ms | ~2s |
| 2 | 4s | 0–500ms | ~4s |
| 3 | 8s | 0–500ms | ~8s |
| After 3 | → DLQ | | Ticket marked `failed` |

- **Zod validation failures** (malformed AI output) — do not retry, go straight to `failed`
- **Network / timeout errors** — retry via SQS visibility timeout expiry
- **DLQ** — `dlqMonitor` picks up permanently failed tickets, marks them `failed`, emits `ticket:failed` socket event

---

## Database Schema

Three tables:

- **`tickets`** — master record (id, tenantId, subject, body, status, timestamps)
- **`ticket_phases`** — per-phase lifecycle (status, attempts, AI output, timestamps)
- **`ticket_events`** — immutable append-only audit log (eventType, phase, payload)

---

## Important: Single Process Required

Always use `npm run dev:single` — not `npm run dev:all`.

Workers and API must share the same process to use the same Socket.io singleton. Running them as separate processes (via `concurrently`) silently breaks real-time events.
