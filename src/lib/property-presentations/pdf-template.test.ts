import { describe, expect, it } from 'vitest';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import jsQR from 'jsqr';
import type { Property } from '@/lib/types';
import { renderPropertyPresentationHtml, type PropertyPresentationTemplateInput } from './pdf-template';

const fixture = (changes: Partial<PropertyPresentationTemplateInput> = {}): PropertyPresentationTemplateInput => ({
  property: {
    id: 'listing-1', title: 'Apartament 3 camere', propertyType: 'Apartament',
    transactionType: 'Vânzare', address: 'Strada Exemplu 12', location: 'București',
    price: 134800, rooms: 3, bathrooms: 2, squareFootage: 79,
    images: [{ url: 'https://photos.example/cover.jpg', alt: 'Living' }],
  } as Property,
  agency: null, agent: null, generatedAt: new Date('2026-09-23'),
  ...changes,
});

describe('property presentation brochure', () => {
  it('embeds a decodable vector QR without an external request', async () => {
    const url = 'https://nordia.ro/properties/listing-1?source=pdf&language=ro';
    const html = renderPropertyPresentationHtml(fixture({ publicPropertyUrl: url }));
    const svg = html.match(/<svg class="qr-code"[\s\S]*?<\/svg>/)?.[0];
    expect(svg).toBeTruthy();
    // Rasterize the actual exported vector, then decode it with an independent reader.
    const image = await loadImage(Buffer.from(svg!.replace('class="qr-code"', 'width="496" height="496"')));
    const canvas = createCanvas(496, 496);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, 496, 496);
    const pixels = context.getImageData(0, 0, 496, 496);
    expect(jsQR(pixels.data, 496, 496)?.data).toBe(url);
    expect(html).not.toContain('qrserver.com');
    expect(html).toContain('href="https://nordia.ro/properties/listing-1?source=pdf&amp;language=ro"');
  });

  it('does not fabricate a gallery from a single photograph or duplicate URLs', () => {
    const input = fixture();
    input.property.images = Array(4).fill(input.property.images[0]);
    const html = renderPropertyPresentationHtml(input);
    expect(html.match(/<img class="photo"/g)).toHaveLength(1);
    expect(html).not.toContain('<section class="cover-gallery">');
    expect(html).not.toContain('photo-crop');
    expect(html).not.toContain('Confort &amp; detalii');
  });

  it('retains each distinct photograph once across the cover and gallery pages', () => {
    const input = fixture();
    input.property.images = Array.from({ length: 7 }, (_, i) => ({ url: `https://photos.example/${i}.jpg`, alt: `Photo ${i}` }));
    const html = renderPropertyPresentationHtml(input);
    for (const photo of input.property.images) {
      expect(html.split(`src="${photo.url}"`)).toHaveLength(2);
    }
    expect(html.match(/<section class="page/g)).toHaveLength(2);
  });

  it('does not invent links, zero commission or agent contact information', () => {
    const html = renderPropertyPresentationHtml(fixture({ publicPropertyUrl: 'javascript:alert(1)' }));
    expect(html).not.toContain('<svg class="qr-code"');
    expect(html).not.toContain('Comision cumpărător:');
    expect(html).not.toContain('07XX');
    expect(html).not.toContain('contact@agentie');
    expect(html).toContain('data:font/ttf;base64,');
  });
});
