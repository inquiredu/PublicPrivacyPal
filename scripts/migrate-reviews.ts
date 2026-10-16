import { loadConfig } from '../server/config.ts';
import { localServices } from '../server/firebase.ts';
import { migrateReviews } from '../server/review-migration.ts';
import { acquireMaintenance, releaseMaintenance } from '../server/maintenance.ts';
import { saveBackup } from './backup-operations.ts';
const s = localServices(loadConfig());
try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--resume-lock')) throw new Error('Use local:migrate-reviews, or --resume-lock LOCK_ID after a failed migration.');
  if (!args.length) console.log(`Pre-migration backup: ${await saveBackup(s)}`);
  const lock = args[1] || await acquireMaintenance(s, 'Review storage migration');
  try { console.log(await migrateReviews(s, lock)); await releaseMaintenance(s, lock); }
  catch (e) { throw new Error(`Migration stopped; maintenance remains active with lock ${lock}. ${e instanceof Error ? e.message : e}`); }
} finally { await s.close(); }
