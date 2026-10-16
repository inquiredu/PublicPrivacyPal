import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// The matching worker is shipped by Vite; no CDN or document URLs are used.
GlobalWorkerOptions.workerSrc = workerUrl;
export async function extractDistrictPdf(file: File) {
  if (!/\.pdf$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error('Choose a PDF no larger than 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('This file is not a readable PDF. Paste the text instead.');
  const task = getDocument({ data: bytes, password: '', useWorkerFetch: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const pdf = await task.promise; const pagesRead = Math.min(pdf.numPages, 5); const text: string[] = [];
        for (let i = 1; i <= pagesRead; i++) {
          const page = await pdf.getPage(i); const content = await page.getTextContent();
          text.push(content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim());
          if (text.join('\n\n').length > 30000) throw new Error('This document contains too much text. Paste a shorter excerpt instead.');
        }
        const joined = text.join('\n\n').trim();
        if (!joined) throw new Error('No text was found. Image-only or protected PDFs need manually pasted text.');
        return { text: joined, pagesRead, totalPages: pdf.numPages };
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PDF reading timed out. Paste the text instead.')), 10000); }),
    ]);
  } finally { clearTimeout(timer); await task.destroy(); }
}
