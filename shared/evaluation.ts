import type { engineVersions } from './scoring/engine.ts';
import { criteria } from './scoring/profiles.ts';
import type { EvaluationSettings } from './settings.ts';
export type Measure = { id: string; label: string; area: string; weight: number; evidence: string; partial: string; failure: string; requiredFinding: string };
export type EvaluationContract = {
  id: string; version: 1; kind: 'practice' | 'district'; definitionVersion: string; profileVersion: string;
  engineVersion: typeof engineVersions[number]; settingsRevision: number | null; settingsHash: string | null;
  context: EvaluationSettings | null; criteria: Measure[];
};
export const measuresFor = (r: { contract?: EvaluationContract }) => r.contract?.criteria.filter(c => c.weight > 0) || criteria;
export const STORAGE_VERSION = 3;
export const PAGE_SIZE = 20;
export type Page<T> = { items: T[]; nextCursor: string | null };
export type ReviewSummary = { id: string; name: string; revision: number; createdAt: string; updatedAt: string; published: boolean; status: string; score: number | null; reviewed: number; measureCount: number };
