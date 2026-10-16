import { z } from 'zod';

export const tiers = ['Tier 1: Core System Tool', 'Tier 2: Site/Department Approved', 'Tier 3A: Requires Parent Consent', 'Tier 3B: No Account Required', 'Pending'] as const;
export type Tier = typeof tiers[number];
export const tierRuleSchema = z.object({
  dpa: z.boolean(), rostering: z.boolean(), noPersonalData: z.boolean(), parentPermission: z.boolean(),
  requirements: z.string().trim().max(1500),
}).strict();
export const tierPolicySchema = z.object({
  name: z.string().trim().min(1).max(120), version: z.string().trim().min(1).max(80),
  rules: z.record(z.enum(tiers), tierRuleSchema),
}).strict();
export type TierPolicy = z.infer<typeof tierPolicySchema>;
/** Optional synthetic starter; the administrator adopts and may edit it. No legal claims. */
export function exampleTierPolicy(): TierPolicy {
  return { name: 'Local tier policy example', version: 'local-tier-example-v1', rules: Object.fromEntries(tiers.map((tier, i) => [tier, {
    dpa: i < 2, rostering: i === 0, noPersonalData: i === 3, parentPermission: i === 2,
    requirements: ['Confirm district-wide agreement scope and automated rostering/SSO.', 'Confirm agreement scope and the responsible site or department.', 'Describe when parent permission is required and an alternative activity.', 'Confirm anonymous use without student accounts or personal data.', 'Assign a tier before approval.'][i],
  }])) as TierPolicy['rules'] };
}
