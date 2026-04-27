// scripts/testSocket.mjs
// Submits a ticket, immediately joins its socket room, then watches all 6 events.
// Usage: node scripts/testSocket.mjs

import { io } from 'socket.io-client';

const SERVER = 'http://localhost:3000';

const EVENTS = [
  'ticket:received',
  'phase1:started',
  'phase1:complete',
  'phase2:started',
  'phase2:complete',
  'ticket:completed',
  'ticket:failed',
];

// 1. Submit ticket first
const res = await fetch(`${SERVER}/api/tickets`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify({
    tenantId: 'tenant-001',
    subject:  'Login issue',
    body:     'I cannot log in to my account for the past hour, password is correct.',
  }),
});

const { ticketId } = await res.json();
console.log(`\nTicket submitted: ${ticketId}\n`);

// 2. Both clients join the room immediately before worker picks it up
function createClient(name) {
  const socket = io(SERVER, { transports: ['websocket'] });

  socket.on('connect', () => {
    console.log(`[${name}] connected — joining room for ticket ${ticketId}`);
    socket.emit('join:ticket', ticketId);
  });

  socket.on('disconnect', () => {
    console.log(`[${name}] disconnected`);
  });

  for (const event of EVENTS) {
    socket.on(event, (data) => {
      console.log(`[${name}] EVENT ✅ ${event}`, JSON.stringify(data, null, 2));
    });
  }

  return socket;
}

const client1 = createClient('Agent-1');
const client2 = createClient('Agent-2');

// 3. Disconnect Agent-2 after 5s to test isolation
setTimeout(() => {
  console.log('\n[Agent-2] disconnecting to test isolation...');
  client2.disconnect();
  console.log('[Agent-1] should still receive remaining events\n');
}, 5000);

// 4. Exit after 60s
setTimeout(() => {
  console.log('\nTest complete.');
  client1.disconnect();
  process.exit(0);
}, 60000);

process.on('SIGINT', () => {
  client1.disconnect();
  process.exit(0);
});
