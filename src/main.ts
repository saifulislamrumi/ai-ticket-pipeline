// src/main.ts — single process entry point
// Runs API + all workers in one process so they share the socketServer singleton.
import './api/index.ts';
import './workers/phase1Worker.ts';
import './workers/phase2Worker.ts';
import './workers/dlqMonitor.ts';
