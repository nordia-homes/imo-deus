import fs from 'node:fs/promises';
import path from 'node:path';

// Facebook's group composer rejects WebP even when its input accepts image/*.
// Use the bundled Chromium decoder so the desktop needs no extra native dependency.
export async function prepareFacebookPhotos(context, files) {
  let conversionPage;
  const prepared = [];
  try {
    for (const file of files) {
      const bytes = await fs.readFile(file);
      const isWebP = bytes.toString('ascii', 0, 4) === 'RIFF'
        && bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!isWebP) {
        prepared.push(file);
        continue;
      }
      conversionPage ||= await context.newPage();
      const jpegBase64 = await conversionPage.evaluate(async (base64) => {
        const binary = atob(base64);
        const data = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([data], { type: 'image/webp' }));
        try {
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Procesarea fotografiei nu este disponibilă.');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bitmap, 0, 0);
          return canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
        } finally {
          bitmap.close();
        }
      }, bytes.toString('base64'));
      const target = path.join(path.dirname(file), `${path.parse(file).name}-facebook.jpg`);
      await fs.writeFile(target, Buffer.from(jpegBase64, 'base64'));
      prepared.push(target);
    }
    return prepared;
  } finally {
    await conversionPage?.close();
  }
}

export async function assertFacebookUploadAccepted(scope) {
  const text = await scope.innerText();
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/format (?:care )?nu este acceptat|(?:unsupported|not supported) (?:file )?(?:type|format)|(?:file|format|type) (?:is )?not supported|fisierele nu pot fi incarcate|(?:files|photos) (?:could not|cannot|can't) be uploaded/.test(normalized)) {
    const error = new Error('Facebook a respins fotografiile. Verifică formatul fișierelor; fotografiile WebP trebuie convertite în JPEG.');
    error.code = 'PHOTO_UPLOAD_REJECTED';
    throw error;
  }
}
