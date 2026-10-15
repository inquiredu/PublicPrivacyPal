import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { listReviews, createReview, reviewAction, reviewHistory, exportReview, importReview } from './reviews.ts';
import { publicConfig, ports } from '../shared/config.ts';
import type { Services } from './firebase.ts';
import { authenticate, currentMember, listMembers, changeMember, HttpError, installation } from './operations.ts';

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
      const reviewRoute = /^\/api\/reviews\/([a-f0-9-]{36})(?:\/(history|export))?$/.exec(req.url || '');
      if (!['/api/me', '/api/members', '/api/reviews', '/api/reviews/import'].includes(req.url || '') && !reviewRoute) throw new HttpError(404, 'Endpoint not found.');
      if (req.method === 'POST' && !origins.has(req.headers.origin || '')) throw new HttpError(403, 'Local origin required.');
      const identity = await authenticate(s, req.headers.authorization);
      if (req.method === 'GET' && req.url === '/api/me') return send(res, 200, await currentMember(s, identity));
      if (req.method === 'GET' && req.url === '/api/members') return send(res, 200, await listMembers(s, identity));
      if (req.method === 'POST' && req.url === '/api/members') return send(res, 200, await changeMember(s, identity, await jsonBody(req)));
      if (req.method === 'GET' && req.url === '/api/reviews') return send(res, 200, await listReviews(s, identity));
      if (req.method === 'POST' && req.url === '/api/reviews') return send(res, 201, await createReview(s, identity, await jsonBody(req)));
      if (req.method === 'POST' && req.url === '/api/reviews/import') return send(res, 201, await importReview(s, identity, await jsonBody(req, 131072)));
      if (reviewRoute && req.method === 'POST' && !reviewRoute[2]) return send(res, 200, await reviewAction(s, identity, reviewRoute[1], await jsonBody(req)));
      if (reviewRoute && req.method === 'GET' && reviewRoute[2] === 'history') return send(res, 200, await reviewHistory(s, identity, reviewRoute[1]));
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
