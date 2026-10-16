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
async function jsonBody(req: IncomingMessage, limit = 8192) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > limit) throw new HttpError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new HttpError(400, 'Invalid JSON.'); }
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
      const cursor = url.searchParams.get('cursor') || undefined;
      if ([...url.searchParams.keys()].some(k => k !== 'cursor') || url.searchParams.getAll('cursor').length > 1 || (req.method !== 'GET' && url.search)) throw new HttpError(400, 'Invalid query parameters.');
      req.url = url.pathname;
      const evaluationRoute = /^\/api\/reviews\/([a-f0-9-]{36})\/evaluations\/([a-f0-9-]{36})$/.exec(req.url);
      const reviewRoute = /^\/api\/reviews\/([a-f0-9-]{36})(?:\/(history|export))?$/.exec(req.url || '');
      const commandRoute = /^\/api\/commands\/([a-f0-9-]{36})$/.exec(req.url || '');
      if (!['/api/review-rubric', '/api/me', '/api/members', '/api/settings', '/api/reviews', '/api/reviews/import'].includes(req.url || '') && !reviewRoute && !commandRoute && !evaluationRoute) throw new HttpError(404, 'Endpoint not found.');
      if (req.method === 'POST' && !origins.has(req.headers.origin || '')) throw new HttpError(403, 'Local origin required.');
      const identity = await authenticate(s, req.headers.authorization);
      if (req.method === 'GET' && req.url === '/api/review-rubric') return send(res, 200, await rubricStatus(s, identity));
      if (req.method === 'GET' && evaluationRoute) return send(res, 200, await reviewDetail(s, identity, evaluationRoute[1], evaluationRoute[2]));
      if (req.method === 'GET' && reviewRoute && !reviewRoute[2]) return send(res, 200, await reviewDetail(s, identity, reviewRoute[1]));
      if (req.method === 'GET' && commandRoute) return send(res, 200, await commandStatus(s, identity, commandRoute[1]));
      if (req.method === 'GET' && req.url === '/api/settings') return send(res, 200, await getSettings(s, identity));
      if (req.method === 'POST' && req.url === '/api/settings') return send(res, 200, await saveSettings(s, identity, await jsonBody(req, 196608)));
      if (req.method === 'GET' && req.url === '/api/me') return send(res, 200, await currentMember(s, identity));
      if (req.method === 'GET' && req.url === '/api/members') return send(res, 200, await listMembers(s, identity));
      if (req.method === 'POST' && req.url === '/api/members') return send(res, 200, await changeMember(s, identity, await jsonBody(req)));
      if (req.method === 'GET' && req.url === '/api/reviews') return send(res, 200, await listReviews(s, identity, cursor));
      if (req.method === 'POST' && (req.url === '/api/reviews' || req.url === '/api/reviews/import' || (reviewRoute && !reviewRoute[2]))) {
        requireMember((await membersRef(s).doc(identity.uid).get()).data(), identity, ['admin', 'reviewer']);
        const raw = await jsonBody(req, req.url === '/api/reviews/import' ? MAX_REVIEW_IMPORT_BYTES : reviewRoute ? 65536 : 131072);
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
