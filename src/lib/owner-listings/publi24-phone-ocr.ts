import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';

type BinaryImage = number[][];

function toBinary(ctx: SKRSContext2D, width: number, height: number, threshold = 245): BinaryImage {
  const { data } = ctx.getImageData(0, 0, width, height);
  const output = Array.from({ length: height }, () => Array<number>(width).fill(0));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const luminance = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      output[y][x] = luminance < threshold && data[offset + 3] > 20 ? 1 : 0;
    }
  }
  return output;
}

function bounds(image: BinaryImage) {
  const height = image.length;
  const width = image[0]?.length || 0;
  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;
  const rowInk = (y: number) => image[y]?.reduce((sum, value) => sum + value, 0) || 0;
  const columnInk = (x: number) => image.reduce((sum, row) => sum + (row[x] || 0), 0);
  while (top < height && rowInk(top) === 0) top += 1;
  while (bottom > top && rowInk(bottom) === 0) bottom -= 1;
  while (left < width && columnInk(left) === 0) left += 1;
  while (right > left && columnInk(right) === 0) right -= 1;
  return { top, bottom, left, right };
}

function slice(image: BinaryImage, crop: ReturnType<typeof bounds>) {
  const output: BinaryImage = [];
  for (let y = crop.top; y <= crop.bottom; y += 1) output.push(image[y].slice(crop.left, crop.right + 1));
  return output;
}

function resize(image: BinaryImage, width = 20, height = 28) {
  const sourceHeight = image.length;
  const sourceWidth = image[0]?.length || 0;
  if (!sourceHeight || !sourceWidth) return Array.from({ length: height }, () => Array<number>(width).fill(0));
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      image[Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / height))][
        Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / width))
      ]
    )
  );
}

function difference(left: BinaryImage, right: BinaryImage) {
  let score = 0;
  for (let y = 0; y < left.length; y += 1) {
    for (let x = 0; x < left[0].length; x += 1) score += left[y][x] === right[y][x] ? 0 : 1;
  }
  return score;
}

function createTemplates() {
  const output: Array<{ digit: string; image: BinaryImage }> = [];
  for (const font of ['Arial', 'Helvetica', 'Verdana', 'Tahoma', 'sans-serif']) {
    for (const size of [22, 24, 26, 28, 30, 32]) {
      for (const weight of ['normal', 'bold']) {
        for (let digit = 0; digit <= 9; digit += 1) {
          const canvas = createCanvas(26, 34);
          const context = canvas.getContext('2d');
          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = 'black';
          context.font = `${weight} ${size}px ${font}`;
          context.textBaseline = 'middle';
          context.textAlign = 'center';
          context.fillText(String(digit), canvas.width / 2, canvas.height / 2 + 1);
          const image = toBinary(context, canvas.width, canvas.height);
          output.push({ digit: String(digit), image: resize(slice(image, bounds(image))) });
        }
      }
    }
  }
  return output;
}

let templateCache: ReturnType<typeof createTemplates> | null = null;

function classify(segment: BinaryImage, templates: ReturnType<typeof createTemplates>) {
  const normalized = resize(slice(segment, bounds(segment)));
  return templates.reduce(
    (best, template) => {
      const score = difference(normalized, template.image);
      return score < best.score ? { digit: template.digit, score } : best;
    },
    { digit: '?', score: Number.POSITIVE_INFINITY }
  );
}

function phoneScore(phone: string, templateScore: number) {
  let penalty = /^\d+$/.test(phone) ? 0 : 500;
  if (/^07\d{8}$/.test(phone)) penalty -= 35;
  else if (/^0(?:2|3)\d{8}$/.test(phone)) penalty -= 25;
  else if (/^0\d{9}$/.test(phone)) penalty -= 12;
  else if (/^\d{8}$/.test(phone)) penalty += 16;
  else if (/^\d{9}$/.test(phone)) penalty += 12;
  else if (/^\d{11,}$/.test(phone)) penalty += 40;
  if (/(\d)\1{4,}/.test(phone)) penalty += 22;
  return templateScore + penalty;
}

/** Decode the phone image with prebuilt Skia canvas, without launching Chromium. */
export async function recognizePubli24PhoneWithoutBrowser(base64: string, hintedLength?: number | null) {
  try {
    const image = await loadImage(Buffer.from(base64, 'base64'));
    if (!image.width || !image.height) return '';
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const binary = toBinary(context, canvas.width, canvas.height);
    const cropped = slice(binary, bounds(binary));
    const width = cropped[0]?.length || 0;
    if (!cropped.length || !width) return '';

    const ink = Array.from({ length: width }, (_, x) => cropped.reduce((sum, row) => sum + row[x], 0));
    templateCache ||= createTemplates();
    const counts = Array.from(new Set([10, hintedLength || 0, 9, 8, 11].filter((value) => value >= 8 && value <= 11)));
    let best = { phone: '', score: Number.POSITIVE_INFINITY };

    for (const count of counts) {
      const averageWidth = width / count;
      const divisions = [0];
      for (let index = 1; index < count; index += 1) {
        const center = Math.round(index * averageWidth);
        let selected = { x: center, score: Number.POSITIVE_INFINITY };
        for (let x = Math.max(divisions[index - 1] + 6, center - 6); x <= Math.min(width - 6, center + 6); x += 1) {
          const score = ink[x] + Math.abs(x - divisions[index - 1] - averageWidth) * 0.7;
          if (score < selected.score) selected = { x, score };
        }
        divisions.push(selected.x);
      }
      divisions.push(width);

      let total = 0;
      const digits = Array.from({ length: count }, (_, index) => {
        const guess = classify(cropped.map((row) => row.slice(divisions[index], divisions[index + 1])), templateCache!);
        total += guess.score;
        return guess.digit;
      });
      const phone = digits.join('');
      const score = phoneScore(phone, total / count);
      if (score < best.score) best = { phone, score };
    }
    return best.phone;
  } catch {
    return '';
  }
}
