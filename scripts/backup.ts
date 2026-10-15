import { loadConfig } from '../server/config.ts';
import { localServices } from '../server/firebase.ts';
import { releaseMaintenance } from '../server/maintenance.ts';
import { verifyBackup } from './backup-files.ts';
import { saveBackup } from './backup-operations.ts';

process.umask(0o077);
const config = loadConfig();
const [command, value, ...extra] = process.argv.slice(2);
if (extra.length) throw new Error('Unexpected backup arguments.');
if (command === 'verify' && value) {
  const manifest = verifyBackup(value, config);
  console.log(`Verified local backup ${manifest.backupId}, created ${manifest.createdAt}. ${manifest.files.length} files. No services or records changed.`);
} else {
  const s = localServices(config);
  try {
    if (command === 'save' && !value) console.log(`Local backup saved and verified: ${await saveBackup(s)}`);
    else if (command === 'resume' && value && /^[a-f0-9-]{36}$/.test(value)) {
      await releaseMaintenance(s, value); console.log('Maintenance ended. No backup success is implied.');
    } else throw new Error('Use local:backup, local:backup:verify -- PATH, or local:resume -- LOCK_ID.');
  } catch (error) { console.error(error instanceof Error ? error.message : 'Backup operation failed.'); process.exitCode = 1; }
  finally { await s.close(); }
}
