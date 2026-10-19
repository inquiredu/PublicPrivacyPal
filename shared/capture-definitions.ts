import { z } from 'zod';

export const CAPTURE_DEFINITIONS_VERSION = 'capture-definitions-v1';
export const MAX_CAPTURE_DEFINITION_BYTES = 64 * 1024;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const captureDefinitionsSchema = z.object({
  version: z.literal(CAPTURE_DEFINITIONS_VERSION), id: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.enum(['practice', 'district']), profileVersion: z.string().min(1).max(80),
  definitionVersion: z.string().min(1).max(80), settingsRevision: z.number().int().positive().nullable(),
  measures: z.array(z.object({ id, label: z.string().min(1).max(2000), area: id, enabled: z.boolean(),
    requirements: z.array(z.object({ id, proposition: z.string().min(1).max(2000) }).strict()).max(8),
  }).strict()).min(1).max(50),
}).strict().refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_CAPTURE_DEFINITION_BYTES, 'Capture definitions exceed the size limit.');
export type CaptureDefinitions = z.infer<typeof captureDefinitionsSchema>;
