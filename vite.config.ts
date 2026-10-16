import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ports } from './shared/config.ts';
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: ports.web, strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${ports.api}` },
    fs: { deny: ['**/.private/**', '**/.local/**', '**/firebase-export-*/**', '**/auth_export/**', '**/firestore_export/**', '**/privacypal-backup.json', '**/firebase-export-metadata.json', '**/config/*.json', '**/.git/**', '**/.env*', '**/*.{pem,key}'] },
  },
  build: { outDir: 'dist', manifest: true, rolldownOptions: { output: { codeSplitting: { groups: [
    { name: 'firestore', test: /node_modules\/@firebase\/firestore/ },
    { name: 'auth', test: /node_modules\/@firebase\/auth/ },
    { name: 'react', test: /node_modules\/(?:react|react-dom|scheduler)\// },
  ] } } } },
});
