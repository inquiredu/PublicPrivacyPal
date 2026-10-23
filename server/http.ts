import { reviewDashboard } from './review-dashboard.ts';
import { reviewQueues } from '../shared/review-dashboard.ts';
import { requestQueues } from '../shared/request-dashboard.ts';
import { requestDashboard, requestCommand, requestCommandStatus, requestDetail, requestHistory, listRequests } from './requests.ts';
import { assistanceDetail } from './analysis/jobs.ts';
import { z } from 'zod';
import { segmentedRunSummary, segmentedRunDetail, segmentedAttemptDetail, segmentedRequestDetail, segmentedOutputDetail, segmentedProposalDetail } from './segmented-reviews.ts';
import { commandIdentity, commandStatus } from './commands.ts';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { rubricStatus, reviewDetail, listReviews, createReview, reviewAction, reviewHistory, exportReview, importReview } from './reviews.ts';
import { publicConfig, ports } from '../shared/config.ts';
import { MAX_REVIEW_IMPORT_BYTES } from '../shared/review.ts';
import type { Services } from './firebase.ts';
import { authenticate, currentMember, listMembers, changeMember, HttpError, installation, membersRef, requireMember } from './operations.ts';
import { getSettings, saveSettings } from './settings.ts';

const hosts = new Set([`127.0.0.1:${ports.web}`, `localhost:${ports.web}`, `127.0.0.1:${ports.api}`, `localhost:${ports.api}`]);
const origins = new Set([...hosts].map(host => `http://${host}`));
async function jsonBody(req: IncomingMessage, limit = 8192, capture = false) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > limit) throw new HttpError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  let raw;
  try { raw = JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new HttpError(400, 'Invalid JSON.'); }
  if (capture && raw?.sourceBundle?.version !== 'pasted-source-bundle-v2' && size > 131072) throw new HttpError(413, 'Request body exceeds its versioned byte limit.');
  return raw;
}
function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
export function apiServer(s: Services) {
  const server = createServer(async (req, res) => {
    try {
      if (!hosts.has(req.headers.host || '')) throw new HttpError(403, 'Local host required.');
      if (req.headers.origin && !origins.has(req.headers.origin)) throw new HttpError(403, 'Local origin required.');
      if (req.method === 'GET' && req.url === '/api/config') return send(res, 200, publicConfig(s.config));
      if (req.method === 'GET' && req.url === '/api/health') {
        try { await installation(s); return send(res, 200, { initialized: true }); }
        catch (error) { if (error instanceof HttpError) return send(res, 200, { initialized: false, message: error.message }); throw error; }
      }
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const queue = url.searchParams.get('queue') || 'all';
      if (!(url.pathname === '/api/review-dashboard' ? reviewQueues : requestQueues).includes(queue as never) || (url.searchParams.has('queue') && (!['/api/requests', '/api/review-dashboard'].includes(url.pathname) || req.method !== 'GET')) || url.searchParams.getAll('queue').length > 1) throw new HttpError(400, 'Invalid request queue.');
      const reviewFilters = { search: url.searchParams.get('search') ?? undefined, tier: url.searchParams.get('tier') ?? undefined };
      if (['search','tier'].some(k => url.searchParams.getAll(k).length > 1 || (url.searchParams.has(k) && (url.pathname !== '/api/review-dashboard' || req.method !== 'GET')))) throw new HttpError(400, 'Invalid review filters.');
      const cursor = url.searchParams.get('cursor') || undefined;
      if ([...url.searchParams.keys()].some(k => !['cursor','queue','search','tier'].includes(k)) || url.searchParams.getAll('cursor').length > 1 || (req.method !== 'GET' && url.search)) throw new HttpError(400, 'Invalid query parameters.');
      req.url = url.pathname;
      const evaluationRoute = /^\/api\/reviews\/([a-f0-9-]{36})\/evaluations\/([a-f0-9-]{36})$/.exec(req.url);
      const reviewRoute = /^\/api\/reviews\/([a-f0-9-]{36})(?:\/(history|export|assistance|prompt))?$/.exec(req.url || '');
      const requestRoute = /^\/api\/requests\/([a-zA-Z0-9_-]{1,128})(?:\/(history))?$/.exec(req.url);
      const requestReceiptRoute = /^\/api\/request-commands\/([a-f0-9-]{36})$/.exec(req.url);
      const commandRoute = /^\/api\/commands\/([a-f0-9-]{36})$/.exec(req.url || '');
      const segmentedRoute = /^\/api\/reviews\/([a-f0-9-]{36})\/segmented-runs(?:\/([a-f0-9-]{36})(?:\/(attempts|requests|outputs)\/([a-f0-9-]{36}|[a-f0-9]{64})|\/proposals\/([a-f0-9]{64})\/([a-zA-Z0-9_-]{1,80}))?)?$/.exec(req.url);
      if (!['/api/review-rubric', '/api/me', '/api/members', '/api/settings', '/api/reviews', '/api/reviews/import', '/api/requests', '/api/request-dashboard', '/api/review-dashboard'].includes(req.url || '') && !reviewRoute && !commandRoute && !evaluationRoute && !segmentedRoute && !requestRoute && !requestReceiptRoute) throw new HttpError(404, 'Endpoint not found.');
      if (req.method === 'POST' && !origins.has(req.headers.origin || '')) throw new HttpError(403, 'Local origin required.');
      const identity = await authenticate(s, req.headers.authorization);
      if (req.method === 'GET' && req.url === '/api/review-dashboard') return send(res, 200, await reviewDashboard(s, identity, queue as typeof reviewQueues[number], cursor, reviewFilters as import('../shared/review-dashboard.ts').ReviewFilters));
      if (req.method === 'GET' && req.url === '/api/request-dashboard') { if (cursor) throw new HttpError(400, 'No cursor allowed.'); return send(res, 200, await requestDashboard(s, identity)); }
      if (req.method === 'GET' && requestReceiptRoute) { if (cursor) throw new HttpError(400, 'No cursor allowed.'); return send(res, 200, await requestCommandStatus(s, identity, requestReceiptRoute[1])); }
      if (req.method === 'GET' && req.url === '/api/requests') return send(res, 200, await listRequests(s, identity, cursor, queue as typeof requestQueues[number]));
      if (req.method === 'GET' && requestRoute) {
        if (requestRoute[2]) return send(res, 200, await requestHistory(s, identity, requestRoute[1], cursor));
        if (cursor) throw new HttpError(400, 'No cursor allowed.');
        return send(res, 200, await requestDetail(s, identity, requestRoute[1]));
      }
      if (req.method === 'POST' && (req.url === '/api/requests' || requestRoute && !requestRoute[2])) {
        const raw = await jsonBody(req, 24576); const command = commandIdentity(req.headers['idempotency-key'], req.url!, raw);
        return send(res, requestRoute ? 200 : 201, await requestCommand(s, identity, requestRoute?.[1] || null, raw, command));
      }
      if (segmentedRoute && req.method === 'GET') {
        const [, reviewId, runId, kind, itemId, outcomeId, measureId] = segmentedRoute;
        if (!z.uuid().safeParse(reviewId).success || (runId && !z.uuid().safeParse(runId).success) || (kind === 'attempts' && !z.uuid().safeParse(itemId).success) || ((kind === 'requests' || kind === 'outputs') && !/^[a-f0-9]{64}$/.test(itemId))) throw new HttpError(400, 'Invalid segmented record reference.');
        if (!runId) return send(res, 200, await segmentedRunSummary(s, identity, reviewId, cursor));
        if (outcomeId) return send(res, 200, await segmentedProposalDetail(s, identity, reviewId, runId, outcomeId, measureId, cursor));
        if (!kind) return send(res, 200, await segmentedRunDetail(s, identity, reviewId, runId, cursor));
        if (cursor) throw new HttpError(400, 'This record does not accept a page cursor.');
        if (kind === 'attempts') return send(res, 200, await segmentedAttemptDetail(s, identity, reviewId, runId, itemId));
        if (kind === 'requests') return send(res, 200, await segmentedRequestDetail(s, identity, reviewId, runId, itemId));
        return send(res, 200, await segmentedOutputDetail(s, identity, reviewId, runId, itemId));
      }
      if (req.method === 'GET' && req.url === '/api/review-rubric') return send(res, 200, await rubricStatus(s, identity));
      if (req.method === 'GET' && evaluationRoute) return send(res, 200, await reviewDetail(s, identity, evaluationRoute[1], evaluationRoute[2]));
      if (req.method === 'GET' && reviewRoute && !reviewRoute[2]) return send(res, 200, await reviewDetail(s, identity, reviewRoute[1]));
      if (req.method === 'GET' && reviewRoute && ['assistance', 'prompt'].includes(reviewRoute[2])) return send(res, 200, await assistanceDetail(s, identity, reviewRoute[1], reviewRoute[2] === 'prompt'));
      if (req.method === 'GET' && commandRoute) return send(res, 200, await commandStatus(s, identity, commandRoute[1]));
      if (req.method === 'GET' && req.url === '/api/settings') return send(res, 200, await getSettings(s, identity));
      if (req.method === 'POST' && req.url === '/api/settings') return send(res, 200, await saveSettings(s, identity, await jsonBody(req, 196608)));
      if (req.method === 'GET' && req.url === '/api/me') return send(res, 200, await currentMember(s, identity));
      if (req.method === 'GET' && req.url === '/api/members') return send(res, 200, await listMembers(s, identity));
      if (req.method === 'POST' && req.url === '/api/members') return send(res, 200, await changeMember(s, identity, await jsonBody(req)));
      if (req.method === 'GET' && req.url === '/api/reviews') return send(res, 200, await listReviews(s, identity, cursor));
      if (req.method === 'POST' && (req.url === '/api/reviews' || req.url === '/api/reviews/import' || (reviewRoute && !reviewRoute[2]))) {
        requireMember((await membersRef(s).doc(identity.uid).get()).data(), identity, ['admin', 'reviewer']);
        const raw = await jsonBody(req, req.url === '/api/reviews/import' ? MAX_REVIEW_IMPORT_BYTES : reviewRoute ? 65536 : 512 * 1024, req.url === '/api/reviews');
        const command = commandIdentity(req.headers['idempotency-key'], req.url!, raw);
        if (reviewRoute) return send(res, 200, await reviewAction(s, identity, reviewRoute[1], raw, command));
        return send(res, 201, req.url === '/api/reviews/import' ? await importReview(s, identity, raw, command) : await createReview(s, identity, raw, false, command));
      }
      if (reviewRoute && req.method === 'GET' && reviewRoute[2] === 'history') return send(res, 200, await reviewHistory(s, identity, reviewRoute[1], cursor));
      if (reviewRoute && req.method === 'GET' && reviewRoute[2] === 'export') return send(res, 200, await exportReview(s, identity, reviewRoute[1]));
      throw new HttpError(405, 'Method not allowed.');
    } catch (error) {
      const known = error instanceof HttpError;
      if (!known) console.error('Local API error:', error instanceof Error ? error.message : 'unknown error');
      send(res, known ? error.status : 503, { error: known ? error.message : 'Local services are unavailable. Check that the emulators are running.' });
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  return server;
}
