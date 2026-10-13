import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { prepareFacebookPhotos, assertFacebookUploadAccepted } from '../../desktop/automation/facebook-photo-upload.mjs';

let browser;
let context;
let fixturePage;
let dir;
before(async () => {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve('node_modules/playwright-core/.local-browsers');
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  fixturePage = await context.newPage();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'imodeus-photo-test-'));
});
after(async () => {
  await browser?.close();
  if (dir && path.dirname(path.resolve(dir)) === path.resolve(os.tmpdir())
    && path.basename(dir).startsWith('imodeus-photo-test-')) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('converts WebP by file signature, preserves dimensions and flattens transparency to white', async () => {
  const base64 = await fixturePage.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 60;
    return canvas.toDataURL('image/webp').split(',')[1];
  });
  const file = path.join(dir, 'mislabelled.jpg');
  const original = Buffer.from(base64, 'base64');
  await fs.writeFile(file, original);
  const pagesBefore = context.pages().length;
  const [converted] = await prepareFacebookPhotos(context, [file]);
  assert.equal(context.pages().length, pagesBefore);
  assert.match(converted, /-facebook\.jpg$/);
  const jpeg = await fs.readFile(converted);
  assert.equal(jpeg.subarray(0, 3).toString('hex'), 'ffd8ff');
  assert.deepEqual(await fs.readFile(file), original);
  const decoded = await fixturePage.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + base64)).blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, pixel: [...ctx.getImageData(0, 0, 1, 1).data] };
  }, jpeg.toString('base64'));
  assert.deepEqual(decoded, { width: 80, height: 60, pixel: [255, 255, 255, 255] });
  assert.deepEqual(await prepareFacebookPhotos(context, [converted]), [converted]);
});

test('does not confuse Facebook rejection with slow upload', async () => {
  await fixturePage.setContent('<div role="dialog">Fişierele nu pot fi încărcate: 01.webp</div>');
  await assert.rejects(assertFacebookUploadAccepted(fixturePage.getByRole('dialog')), { code: 'PHOTO_UPLOAD_REJECTED' });
  await fixturePage.setContent('<div role="dialog">This file type is not supported</div>');
  await assert.rejects(assertFacebookUploadAccepted(fixturePage.getByRole('dialog')), { code: 'PHOTO_UPLOAD_REJECTED' });
  await fixturePage.setContent('<div role="dialog">Editează tot · Postează</div>');
  await assert.doesNotReject(assertFacebookUploadAccepted(fixturePage.getByRole('dialog')));
});
