// Preserve the local runner's guards and shutdown ownership while presenting
// expected setup failures (ports, configuration, backup mismatch) without a stack.
try { await import('./local.ts'); }
catch (error) { console.error(error instanceof Error ? error.message : 'Local startup failed.'); process.exitCode = 1; }
