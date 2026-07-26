import { PNG } from 'pngjs';
import { PUBLI24_PHONE_TEMPLATES } from '@/lib/owner-listings/publi24-phone-templates';

type BinaryImage = number[][];
type PhoneTemplate = { digit: string; image: BinaryImage };

function toBinary(
  data: Uint8Array,
  width: number,
  height: number,
  threshold = 245
): BinaryImage {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const offset = (y * width + x) * 4;
      const luminance = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      return luminance < threshold && data[offset + 3] > 20 ? 1 : 0;
    })
  );
}

function bounds(image: BinaryImage) {
  const height = image.length;
  const width = image[0]?.length || 0;
  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;
  const rowInk = (y: number) =>
    image[y]?.reduce((sum, value) => sum + value, 0) || 0;
  const columnInk = (x: number) =>
    image.reduce((sum, row) => sum + (row[x] || 0), 0);

  while (top < height && rowInk(top) === 0) top += 1;
  while (bottom > top && rowInk(bottom) === 0) bottom -= 1;
  while (left < width && columnInk(left) === 0) left += 1;
  while (right > left && columnInk(right) === 0) right -= 1;
  return { top, bottom, left, right };
}

function crop(
  image: BinaryImage,
  box: ReturnType<typeof bounds>
): BinaryImage {
  return Array.from(
    { length: box.bottom - box.top + 1 },
    (_, y) => image[box.top + y].slice(box.left, box.right + 1)
  );
}

function resize(image: BinaryImage, width = 20, height = 28): BinaryImage {
  const sourceHeight = image.length;
  const sourceWidth = image[0]?.length || 0;
  if (!sourceHeight || !sourceWidth) {
    return Array.from({ length: height }, () => Array<number>(width).fill(0));
  }

  return Array.from({ length: height }, (_, y) =>
    Array.from(
      { length: width },
      (_, x) =>
        image[
          Math.min(
            sourceHeight - 1,
            Math.floor((y * sourceHeight) / height)
          )
        ][
          Math.min(
            sourceWidth - 1,
            Math.floor((x * sourceWidth) / width)
          )
        ]
    )
  );
}

function unpackTemplate(encoded: string): BinaryImage {
  const bytes = Buffer.from(encoded, 'base64');
  return Array.from({ length: 28 }, (_, y) =>
    Array.from({ length: 20 }, (_, x) => {
      const index = y * 20 + x;
      return (bytes[Math.floor(index / 8)] >> (7 - (index % 8))) & 1;
    })
  );
}

let templateCache: PhoneTemplate[] | null = null;

function templates() {
  templateCache ||= PUBLI24_PHONE_TEMPLATES.map(([digit, encoded]) => ({
    digit,
    image: unpackTemplate(encoded),
  }));
  return templateCache;
}

function difference(left: BinaryImage, right: BinaryImage) {
  let score = 0;
  for (let y = 0; y < left.length; y += 1) {
    for (let x = 0; x < left[0].length; x += 1) {
      score += left[y][x] === right[y][x] ? 0 : 1;
    }
  }
  return score;
}

function classify(segment: BinaryImage, values: PhoneTemplate[]) {
  const normalized = resize(crop(segment, bounds(segment)));
  return values.reduce(
    (best, template) => {
      const score = difference(normalized, template.image);
      return score < best.score
        ? { digit: template.digit, score }
        : best;
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

/**
 * Decode Publi24's small phone PNG using pre-generated templates.
 * This path is deterministic across Windows and Linux and has no native runtime dependency.
 */
export async function recognizePubli24PhonePure(
  base64: string,
  hintedLength?: number | null
) {
  try {
    const png = PNG.sync.read(Buffer.from(base64, 'base64'));
    if (!png.width || !png.height) return '';
    const binary = toBinary(png.data, png.width, png.height);
    const cropped = crop(binary, bounds(binary));
    const width = cropped[0]?.length || 0;
    if (!cropped.length || !width) return '';

    const ink = Array.from({ length: width }, (_, x) =>
      cropped.reduce((sum, row) => sum + row[x], 0)
    );
    const values = templates();
    const counts = Array.from(
      new Set(
        [10, hintedLength || 0, 9, 8, 11].filter(
          (value) => value >= 8 && value <= 11
        )
      )
    );
    let best = { phone: '', score: Number.POSITIVE_INFINITY };

    for (const count of counts) {
      const averageWidth = width / count;
      const divisions = [0];
      for (let index = 1; index < count; index += 1) {
        const center = Math.round(index * averageWidth);
        let selected = { x: center, score: Number.POSITIVE_INFINITY };
        for (
          let x = Math.max(divisions[index - 1] + 6, center - 6);
          x <= Math.min(width - 6, center + 6);
          x += 1
        ) {
          const score =
            ink[x] +
            Math.abs(x - divisions[index - 1] - averageWidth) * 0.7;
          if (score < selected.score) selected = { x, score };
        }
        divisions.push(selected.x);
      }
      divisions.push(width);

      let total = 0;
      const digits = Array.from({ length: count }, (_, index) => {
        const guess = classify(
          cropped.map((row) =>
            row.slice(divisions[index], divisions[index + 1])
          ),
          values
        );
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
