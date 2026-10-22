import { startAssistanceWorker } from './analysis/jobs.ts';
import { startSegmentedWorker } from './analysis/segmented-jobs.ts';
import { loadConfig } from './config.ts';
import { localServices } from './firebase.ts';
import { apiServer } from './http.ts';
import { startReviewWorker } from './reviews.ts';
import { ports } from '../shared/config.ts';
const services = localServices(loadConfig());
const server = apiServer(services);
const stopWorker = startReviewWorker(services);
const stopAssistance = startAssistanceWorker(services);
const stopSegmented = startSegmentedWorker(services);
server.listen(ports.api, '127.0.0.1', () => console.log(`Local API: http://127.0.0.1:${ports.api}`));
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  if (stopping) return; stopping = true;
  const worker = Promise.all([stopWorker(), stopAssistance(), stopSegmented()]);
  server.close(() => { void worker.then(() => services.close()).then(() => process.exit(0)); });
});
