// scripts/submit.mjs
// Usage: npm run submit "Subject" "Body"
import { io } from 'socket.io-client';

const SERVER = 'http://localhost:3000';
const TENANT_ID = 'tenant-001';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: npm run submit "Subject" "Body (min 10 chars)"');
  process.exit(1);
}

const [subject, body] = args;

// Submit ticket
let ticketId;
try {
  const res = await fetch(`${SERVER}/api/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId: TENANT_ID, subject, body }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (data.fields) {
      console.error('Validation error:');
      for (const f of data.fields) {
        console.error(`  ${f.field}: ${f.message}`);
      }
    } else {
      console.error(`Error: ${data.message ?? res.statusText}`);
    }
    process.exit(1);
  }

  ticketId = data.ticketId;
} catch (err) {
  if (err.cause?.code === 'ECONNREFUSED') {
    console.error(`Error: Server not running on ${SERVER}`);
  } else {
    console.error(`Error: ${err.message}`);
  }
  process.exit(1);
}

console.log(`\nTicket submitted: ${ticketId}\n`);

// Connect Socket.io and watch events
const socket = io(SERVER, { transports: ['websocket'] });

const timeout = setTimeout(() => {
  console.error('\nTimed out waiting for events.');
  socket.disconnect();
  process.exit(1);
}, 60_000);

socket.on('connect', () => {
  socket.emit('join:ticket', ticketId);
});

socket.on('connect_error', () => {
  console.error(`Error: Could not connect to socket on ${SERVER}`);
  clearTimeout(timeout);
  socket.disconnect();
  process.exit(1);
});

socket.on('ticket:received', (data) => {
  console.log(`[ticket:received]  status: ${data.status}`);
});

socket.on('phase1:started', (data) => {
  console.log(`[phase1:started]   attempt: ${data.attempt}`);
});

socket.on('phase1:complete', (data) => {
  const r = data.result ?? {};
  console.log(`[phase1:complete]  category: ${r.category} | priority: ${r.priority} | sentiment: ${r.sentiment}`);
});

socket.on('phase2:started', (data) => {
  console.log(`[phase2:started]   attempt: ${data.attempt}`);
});

socket.on('phase2:complete', (data) => {
  const reply = data.result?.customerReply ?? '';
  const preview = reply.length > 80 ? reply.slice(0, 80) + '...' : reply;
  console.log(`[phase2:complete]  reply: "${preview}"`);
});

socket.on('ticket:completed', () => {
  console.log(`[ticket:completed] status: completed\n`);
  clearTimeout(timeout);
  socket.disconnect();
  process.exit(0);
});

socket.on('ticket:failed', () => {
  console.log(`[ticket:failed]    status: failed\n`);
  clearTimeout(timeout);
  socket.disconnect();
  process.exit(1);
});
