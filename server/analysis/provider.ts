import type { AnalysisRequest } from './contract.ts';
import { z } from 'zod';

export const usageSchema = z.object({ inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable(), cachedInputTokens: z.number().int().nonnegative().nullable(), reasoningTokens: z.number().int().nonnegative().nullable(), costMicros: z.number().int().nonnegative().nullable() }).strict();
export type Usage = z.infer<typeof usageSchema>;
export type ProviderResponse = { status: 'completed'; output: unknown; requestId: string; usage: Usage } | { status: 'refused' | 'incomplete'; requestId: string; usage: Usage };
export const providerResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('completed'), output: z.unknown(), requestId: z.string().min(1).max(200), usage: usageSchema }).strict(),
  z.object({ status: z.enum(['refused', 'incomplete']), requestId: z.string().min(1).max(200), usage: usageSchema }).strict(),
]);
export class ProviderFailure extends Error {
  constructor(readonly kind: 'not_sent' | 'rejected' | 'unknown', message: string) { super(message); }
}
/** Implement this interface on the server for any hosted or local inference system. */
export interface AnalysisProvider {
  readonly id: string; readonly model: string; readonly version: string;
  readonly settings: Readonly<Record<string, string | number | boolean>>;
  readonly maxCostMicros: number;
  readonly offline: boolean;
  generate(request: AnalysisRequest, options: { attemptId: string; signal: AbortSignal }): Promise<ProviderResponse>;
  // Lookup must never create a new provider request. No implementation means unknown stays unknown.
  reconcile?(attemptId: string, signal: AbortSignal): Promise<ProviderResponse | null>;
}
export const zeroUsage: Usage = { inputTokens: null, outputTokens: null, cachedInputTokens: null, reasoningTokens: null, costMicros: 0 };
