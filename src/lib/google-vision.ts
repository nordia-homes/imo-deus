import { GoogleAuth } from 'google-auth-library';

const GOOGLE_VISION_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const GOOGLE_VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

function getGoogleVisionCredentials() {
  const normalizePrivateKey = (value: string) => {
    const trimmed = value.trim().replace(/^"(.*)"$/s, '$1').replace(/^'(.*)'$/s, '$1');
    const withNewlines = trimmed.replace(/\\n/g, '\n');
    return withNewlines
      .replace(/-----BEGIN PRIVATE KEY-----\s*/g, '-----BEGIN PRIVATE KEY-----\n')
      .replace(/\s*-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----')
      .trim();
  };

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    '';
  const clientEmail =
    process.env.GOOGLE_CLOUD_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL ||
    '';
  const rawPrivateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || '';
  const privateKey = rawPrivateKey ? normalizePrivateKey(rawPrivateKey) : '';

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Lipsesc variabilele Google Vision: GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_CLIENT_EMAIL, GOOGLE_CLOUD_PRIVATE_KEY.'
    );
  }

  return {
    projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
}

async function getGoogleVisionAccessToken() {
  const credentials = getGoogleVisionCredentials();
  try {
    const auth = new GoogleAuth({
      credentials,
      projectId: credentials.projectId,
      scopes: [GOOGLE_VISION_SCOPE],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    if (!token) {
      throw new Error('Nu am putut obtine tokenul OAuth pentru Google Vision.');
    }

    return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('DECODER routines') || message.includes('private key')) {
      throw new Error(
        'GOOGLE_CLOUD_PRIVATE_KEY nu este in format corect in .env.local. Cheia trebuie copiata exact din JSON-ul service account si pastrata intre ghilimele, cu \\n in loc de linii noi.'
      );
    }
    throw error;
  }
}

export type GoogleVisionWordBox = {
  text: string;
  confidence?: number;
};

export type GoogleVisionOcrResult = {
  fullText: string;
  words: GoogleVisionWordBox[];
};

export async function extractDocumentTextWithGoogleVision(params: {
  contentBase64: string;
  mimeType: string;
}): Promise<GoogleVisionOcrResult> {
  const { contentBase64, mimeType } = params;

  if (!mimeType.startsWith('image/')) {
    throw new Error('Momentan OCR-ul CI suporta doar imagini (jpg, jpeg, png, webp).');
  }

  const token = await getGoogleVisionAccessToken();
  const response = await fetch(GOOGLE_VISION_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      requests: [
        {
          image: {
            content: contentBase64,
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION',
            },
          ],
          imageContext: {
            languageHints: ['ro'],
          },
        },
      ],
    }),
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        responses?: Array<{
          error?: { message?: string };
          fullTextAnnotation?: {
            text?: string;
            pages?: Array<{
              blocks?: Array<{
                paragraphs?: Array<{
                  words?: Array<{
                    confidence?: number;
                    symbols?: Array<{ text?: string }>;
                  }>;
                }>;
              }>;
            }>;
          };
        }>;
      }
    | null;

  if (!response.ok) {
    const apiMessage = payload?.responses?.[0]?.error?.message;
    throw new Error(apiMessage || `Google Vision a raspuns cu ${response.status}.`);
  }

  const visionResponse = payload?.responses?.[0];
  if (visionResponse?.error?.message) {
    throw new Error(visionResponse.error.message);
  }

  const fullText = visionResponse?.fullTextAnnotation?.text?.trim() || '';
  const words =
    visionResponse?.fullTextAnnotation?.pages?.flatMap((page) =>
      (page.blocks || []).flatMap((block) =>
        (block.paragraphs || []).flatMap((paragraph) =>
          (paragraph.words || []).map((word) => ({
            text: (word.symbols || []).map((symbol) => symbol.text || '').join(''),
            confidence: word.confidence,
          }))
        )
      )
    ) || [];

  return {
    fullText,
    words: words.filter((word) => word.text.trim().length > 0),
  };
}
