import { z } from 'zod';

export const ports = { auth: 9099, firestore: 8080, api: 8787, web: 5173 } as const;
export const projectIdSchema = z.string().regex(/^demo-[a-z0-9-]{3,24}$/, 'Only demo- emulator projects are supported.');
const domainSchema = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.(?:example|test)$/, 'Use synthetic .example or .test domains for local development.');
export const publicConfigSchema = z.object({
  mode: z.literal('emulator'),
  projectId: projectIdSchema,
  districtId: z.string().regex(/^[a-z][a-z0-9-]{2,39}$/),
  districtName: z.string().trim().min(3).max(100),
}).strict();
export const configSchema = publicConfigSchema.extend({
  allowedDomains: z.array(domainSchema).min(1).max(10),
  bootstrapAdminEmail: z.email().toLowerCase(),
}).refine(c => c.allowedDomains.includes(c.bootstrapAdminEmail.split('@')[1]), {
  message: 'The bootstrap administrator must belong to a configured synthetic district domain.',
  path: ['bootstrapAdminEmail'],
});
export type LocalConfig = z.infer<typeof configSchema>;
export type PublicConfig = z.infer<typeof publicConfigSchema>;
export const roles = ['admin', 'reviewer', 'viewer', 'staff'] as const;
export type Role = typeof roles[number];
export const memberCommandSchema = z.object({
  email: z.email().toLowerCase(), role: z.enum(roles), active: z.boolean(),
}).strict();
export const isDistrictEmail = (config: LocalConfig, email: string) => config.allowedDomains.includes(email.toLowerCase().split('@')[1]);
export function publicConfig(config: LocalConfig): PublicConfig {
  return publicConfigSchema.parse({ mode: config.mode, projectId: config.projectId, districtId: config.districtId, districtName: config.districtName });
}
