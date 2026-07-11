import { NextRequest, NextResponse } from 'next/server';
import type { TikTokStudioStoryboardScene } from '@/lib/types';

export const runtime = 'nodejs';

const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_TIKTOK_SCRIPT_MODEL = process.env.OPENAI_TIKTOK_SCRIPT_MODEL || 'gpt-5';
const OPENAI_TIKTOK_SCRIPT_RETRY_MODEL = process.env.OPENAI_TIKTOK_SCRIPT_RETRY_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4.1';

type PremiumScriptScene = {
  id: string;
  title: string;
  mediaType?: TikTokStudioStoryboardScene['mediaType'];
  currentVoiceover?: string;
};

type PremiumScriptResponse = {
  script?: unknown;
  scenes?: unknown;
};

type OpenAIResponsePayload = {
  output_text?: string;
  output?: unknown;
  error?: { message?: string };
};

function collectStrings(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item));
  if (typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return ['text', 'content', 'output_text', 'refusal']
    .flatMap((key) => collectStrings(record[key]));
}

function extractText(payload: OpenAIResponsePayload | null) {
  if (!payload) return '';
  return payload.output_text || collectStrings(payload.output).join('\n');
}

function splitTextAcrossScenes(text: string, count: number) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean || count <= 1) return [clean];
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length >= count) {
    const chunks = Array.from({ length: count }, () => [] as string[]);
    sentences.forEach((sentence, index) => chunks[Math.min(index, count - 1)].push(sentence));
    return chunks.map((chunk) => chunk.join(' ').trim());
  }
  const words = clean.split(/\s+/).filter(Boolean);
  const size = Math.ceil(words.length / count);
  return Array.from({ length: count }, (_, index) => words.slice(index * size, (index + 1) * size).join(' ').trim());
}

function normalizeScriptForTextarea(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeScenes(inputScenes: unknown): PremiumScriptScene[] {
  if (!Array.isArray(inputScenes)) return [];
  const normalized: PremiumScriptScene[] = [];
  inputScenes.forEach((scene) => {
    if (!scene || typeof scene !== 'object') return;
    const value = scene as Partial<PremiumScriptScene>;
    if (!value.id || typeof value.id !== 'string') return;
    normalized.push({
      id: value.id,
      title: typeof value.title === 'string' ? value.title : value.id,
      mediaType: value.mediaType,
      currentVoiceover: typeof value.currentVoiceover === 'string' ? value.currentVoiceover : '',
    });
  });
  return normalized.slice(0, 40);
}

function buildPrompt(input: {
  scenes: PremiumScriptScene[];
  currentScript: string;
  propertyContext: string;
  propertySnapshot: string;
  roomDescriptions: string;
  callToAction: string;
}) {
  const exampleScript = [
    'Daca ai putea locui intr-un apartament in care totul este deja pregatit pentru mutare, intr-o zona bine conectata si cu avantajele importante la indemana, ai veni sa il vezi?',
    'Astazi iti prezint o proprietate cu doua camere, gandita pentru confort imediat si pentru un stil de viata practic. Locuinta are spatii bine organizate, lumina placuta si detalii care fac diferenta in utilizarea de zi cu zi.',
    'Primul spatiu care te intampina este livingul, o incapere luminoasa si aerisita, potrivita atat pentru relaxare, cat si pentru momentele in care primesti musafiri. Atmosfera este calda, iar compartimentarea ajuta locuinta sa se simta practica si primitoare.',
    'Bucataria este zona in care functionalitatea conteaza cel mai mult. Este organizata astfel incat sa fie usor de folosit in fiecare zi, cu spatiu suficient pentru depozitare si pentru pregatirea meselor.',
    'Dormitorul pastreaza o nota linistita si confortabila, fiind locul potrivit pentru odihna. Spatiul este simplu de amenajat si ofera senzatia unei camere in care te poti retrage fara compromisuri.',
    'Baia completeaza locuinta cu o configuratie curata si practica, in ton cu restul proprietatii. Iar daca toate aceste detalii sunt ceea ce cauti, probabil urmatoarea intrebare este pretul.',
    'Proprietatea este disponibila la pretul comunicat in anunt. Daca iti doresti o locuinta moderna, bine pozitionata si usor de transformat in acasa, aceasta proprietate merita cu siguranta o vizionare.',
  ].join('\n\n');

  return [
    'Esti scenarist senior pentru video-uri imobiliare premium in limba romana.',
    'Scrie de la zero un script de voiceover pentru TikTok/Reels in stil editorial, cursiv, ca o prezentare imobiliara filmata profesionist.',
    'Model stilistic obligatoriu: HOOK puternic, INTRODUCEREA PROPRIETATII, prezentarea fiecarei incaperi pe rand, TRANZITIE CATRE PRET, PRETUL, INCHEIERE.',
    'Nu pune titluri precum HOOK sau INTRODUCERE in voiceover. In campul script foloseste doar paragrafe separate prin linie goala, in aceasta ordine: hook, introducere proprietate, incaperi, tranzitie catre pret, pret si incheiere, call to action.',
    'Nu folosi expresii tehnice sau etichete precum "Proprietate selectata", "Date", "Descriere portofoliu", "mediaType", "assetId" sau numele campurilor din aplicatie.',
    'Nu copia titlul cu separatorul "|". Transforma acele fragmente in avantaje naturale in propozitii.',
    'Nu copia scriptul curent. Foloseste-l doar ca exemplu negativ pentru ce trebuie evitat.',
    'Integreaza cursiv toate detaliile reale disponibile in propertySnapshot: an constructie, suprafata utila, suprafata totala/construita, suprafata balcon/terasa daca apare in descriere sau in campuri, etaj, numar total etaje, compartimentare, confort, stare interior, mobilare, incalzire, orientare, lift, parcare, metrou, zona, oras, adresa, dotari si caracteristici.',
    'Nu inventa detalii lipsa. Daca un detaliu nu exista in propertySnapshot, nu il mentiona.',
    'In introducerea proprietatii foloseste natural detaliile tehnice relevante: tip proprietate, camere, bai, suprafete, etaj, an constructie, balcon/terasa, zona si adresa.',
    'Hook-ul trebuie sa aiba fraza de impact si sumar descriptiv, fara pret.',
    'Pretul apare doar in ultimele scene, dupa o tranzitie naturala.',
    `Call to action final obligatoriu, adaptat cu diacritice daca poti: ${input.callToAction || 'Pentru detalii si vizionare, contacteaza echipa ImoDeus.'}`,
    'Pastreaza ordinea scenelor primite si scrie voiceoverLine pentru fiecare scene.id.',
    'Cand scena este Living, textul descrie livingul. Cand scena este Dormitor, textul descrie dormitorul. Cand scena este Baie, textul descrie baia. Sincronizarea vizual-voce este obligatorie.',
    'Daca exista mai multe scene pentru aceeasi incapere, imparte descrierea natural intre ele, fara repetitii.',
    'Durata recomandata totala este intre 90 si 105 secunde. Scrie aproximativ 215-245 de cuvinte in total.',
    'Foloseste diacritice romanesti in raspuns, chiar daca exemplul din prompt este fara diacritice.',
    'Returneaza strict JSON valid, fara markdown.',
    'Format JSON: {"script":"text complet cursiv cu paragrafe separate prin \\n\\n","scenes":[{"id":"scene-id","voiceoverLine":"fragment sincronizat pentru scena"}]}',
    '',
    `Exemplu de stil de urmat, adaptat si scurtat pentru durata ceruta:\n${exampleScript}`,
    '',
    `Date brute proprietate, sursa principala pentru script:\n${input.propertySnapshot || 'Nu exista snapshot de proprietate.'}`,
    '',
    `Descrieri utilizator pentru incaperi:\n${input.roomDescriptions || 'Nu exista descrieri suplimentare.'}`,
    '',
    `Context proprietate si instructiuni utilizator:\n${input.propertyContext || 'Nu exista context suplimentar.'}`,
    '',
    `Script curent de evitat ca stil, pentru ca este prea rigid si repetitiv:\n${input.currentScript || 'Nu exista script curent.'}`,
    '',
    `Scene timeline, in ordinea exacta a video-ului:\n${input.scenes.map((scene, index) => `${index + 1}. id=${scene.id}; title=${scene.title}; mediaType=${scene.mediaType || 'other'}; voiceover curent=${scene.currentVoiceover || '-'}`).join('\n')}`,
  ].join('\n');
}

function jsonSchemaFormat() {
  return {
    type: 'json_schema',
    name: 'premium_tiktok_script',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        script: { type: 'string' },
        scenes: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              voiceoverLine: { type: 'string' },
            },
            required: ['id', 'voiceoverLine'],
          },
        },
      },
      required: ['script', 'scenes'],
    },
  };
}

async function requestOpenAIScript(input: {
  apiKey: string;
  prompt: string;
  model: string;
  structured: boolean;
}) {
  const body: Record<string, unknown> = {
    model: input.model,
    input: input.structured
      ? input.prompt
      : `${input.prompt}\n\nDaca nu poti respecta schema JSON, scrie direct doar scriptul final cursiv, fara explicatii si fara markdown.`,
    max_output_tokens: 5200,
  };
  if (input.structured) {
    body.text = {
      format: jsonSchemaFormat(),
    };
  }
  const response = await fetch(OPENAI_RESPONSES_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as OpenAIResponsePayload | null;
  return { response, payload, rawText: extractText(payload).trim(), model: input.model };
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
    ]);
    await requireAgencyUserFromBearerToken(request.headers.get('authorization'));

    const body = await request.json().catch(() => ({}));
    const scenes = normalizeScenes(body.scenes);
    if (!scenes.length) {
      return NextResponse.json({ message: 'Nu exista scene in timeline pentru sincronizarea scriptului.' }, { status: 400 });
    }

    const currentScript = typeof body.currentScript === 'string' ? body.currentScript : '';
    const propertyContext = typeof body.propertyContext === 'string' ? body.propertyContext : '';
    const callToAction = typeof body.callToAction === 'string' ? body.callToAction : '';
    const propertySnapshot = body.propertySnapshot && typeof body.propertySnapshot === 'object'
      ? JSON.stringify(body.propertySnapshot, null, 2)
      : '';
    const roomDescriptions = Array.isArray(body.roomDescriptions)
      ? JSON.stringify(body.roomDescriptions, null, 2)
      : '';
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: 'OPENAI_API_KEY nu este configurat pentru generarea scriptului premium.' }, { status: 500 });
    }

    const prompt = buildPrompt({ scenes, currentScript, propertyContext, propertySnapshot, roomDescriptions, callToAction });
    let completion = await requestOpenAIScript({
      apiKey,
      prompt,
      model: OPENAI_TIKTOK_SCRIPT_MODEL,
      structured: true,
    });
    if ((!completion.response.ok || completion.rawText.length < 120) && OPENAI_TIKTOK_SCRIPT_RETRY_MODEL) {
      completion = await requestOpenAIScript({
        apiKey,
        prompt,
        model: OPENAI_TIKTOK_SCRIPT_RETRY_MODEL,
        structured: false,
      });
    }
    if (!completion.response.ok || !completion.payload) {
      return NextResponse.json({ message: completion.payload?.error?.message || 'OpenAI nu a putut genera scriptul premium.' }, { status: completion.response.status || 500 });
    }

    const rawText = completion.rawText;
    const parsed = safeParseJson(rawText) as PremiumScriptResponse | null;
    if (!parsed || typeof parsed.script !== 'string' || !Array.isArray(parsed.scenes)) {
      if (rawText.length < 120) {
        return NextResponse.json({ message: `OpenAI nu a returnat text suficient pentru script. Model incercat: ${completion.model}.` }, { status: 502 });
      }
      const chunks = splitTextAcrossScenes(rawText, scenes.length);
      return NextResponse.json({
        script: normalizeScriptForTextarea(rawText),
        scenes: scenes.map((scene, index) => ({
          id: scene.id,
          voiceoverLine: chunks[index] || scene.currentVoiceover || '',
        })),
        model: completion.model,
        format: 'plain_text_recovered',
      }, { status: 200 });
    }

    const sceneById = new Map<string, string>();
    parsed.scenes.forEach((scene) => {
      if (!scene || typeof scene !== 'object') return;
      const value = scene as { id?: unknown; voiceoverLine?: unknown };
      if (typeof value.id !== 'string' || typeof value.voiceoverLine !== 'string') return;
      sceneById.set(value.id, value.voiceoverLine.trim());
    });
    const normalizedScenes = scenes.map((scene) => ({
      id: scene.id,
      voiceoverLine: sceneById.get(scene.id) || scene.currentVoiceover || '',
    }));
    const script = normalizeScriptForTextarea(parsed.script);

    return NextResponse.json({
      script,
      scenes: normalizedScenes,
      model: completion.model,
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : 'Nu am putut genera scriptul premium.',
    }, { status: 500 });
  }
}
