import { copyFileSync, constants } from 'node:fs';
try {
  copyFileSync('config/district.example.json', 'config/local.json', constants.COPYFILE_EXCL);
  console.log('Created config/local.json with a synthetic district. Next: npm run dev. In another terminal: npm run local:bootstrap.');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'EEXIST') console.log('config/local.json already exists; left unchanged.');
  else throw error;
}
