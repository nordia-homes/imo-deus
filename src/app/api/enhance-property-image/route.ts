import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const OPENAI_IMAGE_EDIT_URL = 'https://api.openai.com/v1/images/edits';
const ENHANCE_PROMPT = 'Enhance this photo for selling the apartment.';

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { message: 'OPENAI_API_KEY nu este setata.' },
      { status: 500 }
    );
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    let openAiResponse: Response;

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => null);
      const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';

      if (!imageUrl) {
        return NextResponse.json(
          { message: 'Lipseste imageUrl pentru imbunatatirea imaginii.' },
          { status: 400 }
        );
      }

      openAiResponse = await fetch(OPENAI_IMAGE_EDIT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: ENHANCE_PROMPT,
          images: [{ image_url: imageUrl }],
          output_format: 'png',
        }),
      });
    } else {
      const formData = await request.formData();
      const image = formData.get('image');

      if (!(image instanceof File)) {
        return NextResponse.json(
          { message: 'Imaginea nu a fost trimisa corect.' },
          { status: 400 }
        );
      }

      const outbound = new FormData();
      outbound.append('model', 'gpt-image-1');
      outbound.append('prompt', ENHANCE_PROMPT);
      outbound.append('output_format', 'png');
      outbound.append('image', image, image.name || 'property-photo.png');

      openAiResponse = await fetch(OPENAI_IMAGE_EDIT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: outbound,
      });
    }

    const payload = await openAiResponse.json().catch(() => null);

    if (!openAiResponse.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        'OpenAI nu a putut procesa imaginea.';

      return NextResponse.json({ message }, { status: openAiResponse.status });
    }

    const firstImage = Array.isArray(payload?.data) ? payload.data[0] : null;
    const imageBase64 = firstImage?.b64_json;

    if (!imageBase64) {
      return NextResponse.json(
        { message: 'OpenAI nu a returnat o imagine imbunatatita.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      imageBase64,
      mimeType: 'image/png',
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'A aparut o eroare la imbunatatirea imaginii.';

    return NextResponse.json({ message }, { status: 500 });
  }
}
