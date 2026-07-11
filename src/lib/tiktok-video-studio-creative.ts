import type {
  TikTokStudioAsset,
  TikTokStudioBrandKit,
  TikTokStudioCreativeBrief,
  TikTokStudioCreativePreset,
  TikTokStudioQualityScore,
  TikTokStudioStoryboardScene,
  TikTokStudioSubtitlePreset,
  TikTokStudioVoiceProfile,
} from '@/lib/types';

const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';

type CreativeBriefInput = {
  title?: string;
  preset?: TikTokStudioCreativePreset;
  sourceAssets: TikTokStudioAsset[];
  propertyContext?: string | null;
  agentName?: string | null;
  agentPhone?: string | null;
  brandKit?: TikTokStudioBrandKit | null;
};

type PresetDefinition = {
  id: TikTokStudioCreativePreset;
  label: string;
  voiceProfile: TikTokStudioVoiceProfile;
  tone: string;
  pacing: 'calm' | 'balanced' | 'fast';
  hookStyle: string;
  defaultDurationSeconds: number;
  subtitlePreset: TikTokStudioSubtitlePreset;
};

export const TIKTOK_STUDIO_PRESETS: PresetDefinition[] = [
  {
    id: 'luxury_real_estate',
    label: 'Luxury Real Estate',
    voiceProfile: 'luxury_calm',
    tone: 'elegant, cald, premium, cu fraze cursive si senzatie de rafinament',
    pacing: 'calm',
    hookStyle: 'aspirational si vizual',
    defaultDurationSeconds: 52,
    subtitlePreset: 'luxury_white',
  },
  {
    id: 'modern_urban',
    label: 'Modern Urban',
    voiceProfile: 'young_social',
    tone: 'modern, urban, curat, dinamic, cu energie de social media premium',
    pacing: 'balanced',
    hookStyle: 'lifestyle urban si valoare imediata',
    defaultDurationSeconds: 42,
    subtitlePreset: 'minimal_premium',
  },
  {
    id: 'fast_tiktok_hook',
    label: 'Fast TikTok Hook',
    voiceProfile: 'young_social',
    tone: 'rapid, memorabil, social, cu energie si hook puternic in primele secunde',
    pacing: 'fast',
    hookStyle: 'direct, curios, orientat spre retentie',
    defaultDurationSeconds: 35,
    subtitlePreset: 'tiktok_bold',
  },
  {
    id: 'warm_family_home',
    label: 'Warm Family Home',
    voiceProfile: 'warm_feminine',
    tone: 'cald, apropiat, natural, cu accent pe confort, lumina si sentimentul de acasa',
    pacing: 'balanced',
    hookStyle: 'uman si emotional',
    defaultDurationSeconds: 48,
    subtitlePreset: 'heygen_pink',
  },
  {
    id: 'investor_deal',
    label: 'Investor Deal',
    voiceProfile: 'professional',
    tone: 'clar, pragmatic, convingator, orientat spre randament si decizie rapida',
    pacing: 'balanced',
    hookStyle: 'valoare, oportunitate si potential',
    defaultDurationSeconds: 42,
    subtitlePreset: 'high_contrast',
  },
  {
    id: 'new_development',
    label: 'New Development',
    voiceProfile: 'energetic',
    tone: 'modern, curat, increzator, cu accent pe cladire, facilitati si viata urbana',
    pacing: 'balanced',
    hookStyle: 'modern, fresh, orientat spre lifestyle',
    defaultDurationSeconds: 45,
    subtitlePreset: 'minimal_premium',
  },
];

function getPreset(id?: TikTokStudioCreativePreset) {
  return TIKTOK_STUDIO_PRESETS.find((preset) => preset.id === id) || TIKTOK_STUDIO_PRESETS[0];
}

function safeId(value: string, index: number) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return normalized || `scene-${index + 1}`;
}

function normalizeText(value: unknown, fallback: string) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function estimateDurationSeconds(script: string) {
  const words = script.split(/\s+/).filter(Boolean).length;
  return Math.max(18, Math.min(90, Math.round(words / 2.45)));
}

function getAssetLabel(asset: TikTokStudioAsset, index: number) {
  const name = asset.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
  if (name) return name;
  return `cadru ${index + 1}`;
}

function classifyMediaType(asset: TikTokStudioAsset): TikTokStudioStoryboardScene['mediaType'] {
  const name = asset.name.toLowerCase();
  if (/exterior|fatada|bloc|curte|intrare|building/.test(name)) return 'exterior';
  if (/living|sufragerie|camera de zi|salon/.test(name)) return 'living';
  if (/bucatar|kitchen/.test(name)) return 'kitchen';
  if (/dormitor|bedroom/.test(name)) return 'bedroom';
  if (/baie|bathroom/.test(name)) return 'bathroom';
  if (/balcon|terasa|terrace/.test(name)) return 'balcony';
  if (/vedere|view|panorama/.test(name)) return 'view';
  if (/detaliu|finisaj|hol|detail/.test(name)) return 'detail';
  return 'other';
}

function sortAssetsForSalesFlow(assets: TikTokStudioAsset[]) {
  const order: Record<NonNullable<TikTokStudioStoryboardScene['mediaType']>, number> = {
    exterior: 0,
    living: 1,
    kitchen: 2,
    bedroom: 3,
    bathroom: 4,
    balcony: 5,
    view: 6,
    detail: 7,
    other: 8,
  };
  return [...assets].sort((a, b) => order[classifyMediaType(a) || 'other'] - order[classifyMediaType(b) || 'other']);
}

function getMissingShots(assets: TikTokStudioAsset[]) {
  const present = new Set(assets.map(classifyMediaType));
  const important: Array<NonNullable<TikTokStudioStoryboardScene['mediaType']>> = ['exterior', 'living', 'kitchen', 'bedroom', 'bathroom'];
  return important
    .filter((type) => !present.has(type))
    .map((type) => {
      if (type === 'exterior') return 'Adauga o fotografie clara cu exteriorul sau intrarea cladirii.';
      if (type === 'living') return 'Adauga un cadru larg cu livingul pentru hook vizual.';
      if (type === 'kitchen') return 'Adauga o fotografie luminoasa cu bucataria.';
      if (type === 'bedroom') return 'Adauga cel putin un dormitor pentru context de locuire.';
      return 'Adauga o fotografie clara cu baia.';
    });
}

function fallbackHooks(title: string, preset: PresetDefinition) {
  if (preset.id === 'fast_tiktok_hook') {
    return [
      `Daca esti in cautarea unei proprietati care se remarca imediat, priveste atent.`,
      `Aceasta proprietate are exact acel tip de detaliu care opreste scroll-ul.`,
      `In cateva secunde iti arat de ce acest spatiu merita vazut.`,
    ];
  }
  if (preset.id === 'investor_deal') {
    return [
      `Pentru cine cauta o oportunitate imobiliara clara, aceasta proprietate merita analizata.`,
      `O proprietate cu potential bun incepe cu zona, compartimentarea si prezentarea corecta.`,
      `Hai sa vedem de ce acest spatiu poate fi o alegere inspirata.`,
    ];
  }
  return [
    `Va prezint ${title}, o proprietate care merita descoperita cu atentie.`,
    `Unele locuinte transmit din prima imagine o senzatie placuta de echilibru.`,
    `Daca va doriti un spatiu luminos si bine prezentat, acest tur este pentru dumneavoastra.`,
  ];
}

function buildFallbackStoryboard(input: CreativeBriefInput, script: string, preset: PresetDefinition): TikTokStudioStoryboardScene[] {
  const assets = sortAssetsForSalesFlow(input.sourceAssets).slice(0, 10);
  const totalDuration = estimateDurationSeconds(script);
  const duration = Math.max(2.4, totalDuration / Math.max(assets.length, 1));
  const lines = script
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return assets.map((asset, index) => {
    const label = getAssetLabel(asset, index);
    return {
      id: safeId(asset.id || label, index),
      assetId: asset.id,
      title: index === 0 ? 'Hook vizual' : `Scena ${index + 1}`,
      visualIntent: index === 0
        ? 'Deschidere puternica, cu cel mai atractiv cadru disponibil.'
        : `Prezinta natural ${label}, pastrand miscarea cinematica si compozitia curata.`,
      voiceoverLine: lines[index] || lines[lines.length - 1] || 'Un detaliu important al proprietatii este pus in valoare in acest cadru.',
      overlayText: index === 0 ? input.title || 'Tur video AI' : null,
      durationSeconds: Number(duration.toFixed(1)),
      motion: preset.pacing === 'fast'
        ? (index % 2 === 0 ? 'slow_push' : 'pan_right')
        : (index % 2 === 0 ? 'slow_push' : 'pull_back'),
      safeZone: 'center',
      mediaType: classifyMediaType(asset),
      qualityNote: asset.name ? null : 'Numele fisierului nu descrie clar incaperea; verifica manual cadrul.',
      missingShotRecommendation: null,
      crop: { x: 50, y: 50, scale: 1 },
    };
  });
}

function buildFallbackScript(input: CreativeBriefInput, preset: PresetDefinition) {
  const title = input.title || 'aceasta proprietate';
  const context = input.propertyContext ? ` ${input.propertyContext.trim()}` : '';
  const assetHints = input.sourceAssets.slice(0, 5).map(getAssetLabel).join(', ');
  const cta = input.brandKit?.defaultCallToAction
    || 'Pentru mai multe detalii despre aceasta proprietate si pentru a programa o vizionare, va rog sa ne contactati. Suntem disponibili la orice ora, nu percepem comision si iti vom raspunde detaliat la toate intrebarile. Pe curand.';

  return [
    `Va prezint ${title}, o proprietate gandita sa fie descoperita in ritm natural, imagine cu imagine.`,
    context || `Primele cadre pun in valoare atmosfera locuintei, iar detaliile vizuale creeaza o imagine clara asupra spatiului.`,
    assetHints ? `In tur observam pe rand ${assetHints}, astfel incat fiecare zona importanta sa fie usor de inteles.` : 'Turul evidentiaza zonele principale si felul in care spatiul poate fi folosit zi de zi.',
    preset.id === 'luxury_real_estate'
      ? 'Tonul este elegant, cald si discret, pentru ca proprietatea sa ramana in centrul atentiei.'
      : 'Prezentarea este cursiva, clara si potrivita pentru social media, fara sa piarda din informatiile importante.',
    cta,
  ].join(' ');
}

function buildCaption(title: string, preset: PresetDefinition) {
  const prefix = preset.id === 'fast_tiktok_hook'
    ? 'Un tur rapid pentru o proprietate care merita vazuta.'
    : 'Tur video AI pentru o proprietate prezentata clar si elegant.';
  return `${prefix}\n\n${title}\n\nScrie-ne pentru detalii si vizionare.`;
}

function buildCaptionVariants(title: string, preset: PresetDefinition) {
  return [
    buildCaption(title, preset),
    `${title}\n\nUn tur video scurt, clar si usor de urmarit. Pentru detalii si vizionare, scrie-ne.`,
    preset.id === 'investor_deal'
      ? `${title}\n\nO proprietate cu potential bun merita analizata la timp. Contacteaza-ne pentru detalii.`
      : `${title}\n\nDaca iti doresti o locuinta prezentata pe inteles, suntem aici cu toate detaliile.`,
  ];
}

function buildHashtags(preset: PresetDefinition) {
  const base = ['#imobiliare', '#tiktokimobiliar', '#turvideo', '#imodeus'];
  if (preset.id === 'luxury_real_estate') return [...base, '#luxuryrealestate', '#proprietatepremium'];
  if (preset.id === 'investor_deal') return [...base, '#investitiiimobiliare', '#oportunitate'];
  if (preset.id === 'new_development') return [...base, '#ansamblurezidential', '#locuintenoi'];
  return [...base, '#apartamentdevanzare', '#faracomision'];
}

function scoreBrief(input: {
  sourceAssets: TikTokStudioAsset[];
  script: string;
  hooks: string[];
  caption: string;
  hashtags: string[];
  storyboard: TikTokStudioStoryboardScene[];
  voiceId?: string | null;
  aspectRatio?: string | null;
}): TikTokStudioQualityScore {
  const checks = [
    {
      id: 'photos',
      label: 'Cel putin 5 fotografii pentru ritm vizual bun',
      passed: input.sourceAssets.length >= 5,
      impact: 'high' as const,
    },
    {
      id: 'hook',
      label: 'Hook clar pentru primele 3 secunde',
      passed: input.hooks.some((hook) => hook.length > 24),
      impact: 'high' as const,
    },
    {
      id: 'script',
      label: 'Script cursiv, suficient pentru voiceover',
      passed: input.script.split(/\s+/).filter(Boolean).length >= 55,
      impact: 'high' as const,
    },
    {
      id: 'cta',
      label: 'Call to action prezent in script',
      passed: /contact|vizionare|detalii|scrie|suna/i.test(input.script),
      impact: 'medium' as const,
    },
    {
      id: 'caption',
      label: 'Descriere TikTok pregatita separat',
      passed: input.caption.length >= 40,
      impact: 'medium' as const,
    },
    {
      id: 'hashtags',
      label: 'Hashtag-uri relevante pentru distributie',
      passed: input.hashtags.length >= 4,
      impact: 'medium' as const,
    },
    {
      id: 'storyboard',
      label: 'Storyboard pe scene generat',
      passed: input.storyboard.length >= Math.min(3, input.sourceAssets.length),
      impact: 'high' as const,
    },
    {
      id: 'voice',
      label: 'Voce ElevenLabs aleasa sau fallback configurat',
      passed: Boolean(input.voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID),
      impact: 'low' as const,
    },
    {
      id: 'aspect',
      label: 'Format vertical TikTok 9:16',
      passed: input.aspectRatio === '9:16',
      impact: 'medium' as const,
    },
  ];

  const score = checks.reduce((total, check) => {
    if (!check.passed) return total;
    return total + (check.impact === 'high' ? 15 : check.impact === 'medium' ? 10 : 5);
  }, 10);
  const capped = Math.min(100, score);
  const label = capped >= 86 ? 'premium' : capped >= 72 ? 'foarte_bun' : capped >= 52 ? 'bun' : 'slab';
  return {
    score: capped,
    label,
    strengths: checks.filter((check) => check.passed).slice(0, 4).map((check) => check.label),
    improvements: checks.filter((check) => !check.passed).map((check) => check.label),
    checks,
  };
}

function fallbackBrief(input: CreativeBriefInput): TikTokStudioCreativeBrief {
  const preset = getPreset(input.preset);
  const title = normalizeText(input.title, 'Video AI pentru TikTok');
  const hooks = fallbackHooks(title, preset);
  const script = buildFallbackScript({ ...input, title }, preset);
  const storyboard = buildFallbackStoryboard({ ...input, title }, script, preset);
  const caption = buildCaption(title, preset);
  const captionVariants = buildCaptionVariants(title, preset);
  const hashtags = buildHashtags(preset);
  const missingShots = getMissingShots(input.sourceAssets);
  const qualityScore = scoreBrief({
    sourceAssets: input.sourceAssets,
    script,
    hooks,
    caption,
    hashtags,
    storyboard,
    aspectRatio: '9:16',
  });

  return {
    preset: preset.id,
    title,
    hooks,
    selectedHook: hooks[0],
    script,
    caption,
    captionVariants,
    hashtags,
    storyboard,
    voiceProfile: preset.voiceProfile,
    recommendedDurationSeconds: Math.max(preset.defaultDurationSeconds, estimateDurationSeconds(script)),
    qualityScore,
    missingShots,
    weakPhotos: input.sourceAssets
      .filter((asset) => !asset.name || classifyMediaType(asset) === 'other')
      .slice(0, 4)
      .map((asset) => ({ assetId: asset.id, reason: 'Nu pot identifica sigur incaperea din numele fisierului; verifica manual daca merita inclusa.' })),
    brandKit: input.brandKit || null,
  };
}

function safeParseJson(text: string) {
  const trimmed = text.trim();
  const json = trimmed.match(/\{[\s\S]*\}/)?.[0] || trimmed;
  return JSON.parse(json) as Partial<TikTokStudioCreativeBrief>;
}

function normalizeBrief(parsed: Partial<TikTokStudioCreativeBrief>, fallback: TikTokStudioCreativeBrief, input: CreativeBriefInput): TikTokStudioCreativeBrief {
  const preset = getPreset(parsed.preset || fallback.preset);
  const title = normalizeText(parsed.title, fallback.title);
  const hooks = Array.isArray(parsed.hooks) && parsed.hooks.length
    ? parsed.hooks.map((hook) => normalizeText(hook, '')).filter(Boolean).slice(0, 3)
    : fallback.hooks;
  const script = normalizeText(parsed.script, fallback.script);
  const caption = normalizeText(parsed.caption, fallback.caption);
  const captionVariants = Array.isArray(parsed.captionVariants) && parsed.captionVariants.length
    ? parsed.captionVariants.map((item) => normalizeText(item, '')).filter(Boolean).slice(0, 4)
    : fallback.captionVariants || buildCaptionVariants(title, preset);
  const hashtags = Array.isArray(parsed.hashtags) && parsed.hashtags.length
    ? parsed.hashtags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 10)
    : fallback.hashtags;
  const rawStoryboard = Array.isArray(parsed.storyboard) ? parsed.storyboard : fallback.storyboard;
  const storyboard = rawStoryboard.map((scene, index) => ({
    id: normalizeText(scene.id, `scene-${index + 1}`),
    assetId: scene.assetId || input.sourceAssets[index]?.id || null,
    title: normalizeText(scene.title, `Scena ${index + 1}`),
    visualIntent: normalizeText(scene.visualIntent, 'Prezinta cadrul intr-un ritm natural si premium.'),
    voiceoverLine: normalizeText(scene.voiceoverLine, script.split(/(?<=[.!?])\s+/)[index] || fallback.storyboard[index]?.voiceoverLine || ''),
    overlayText: scene.overlayText || null,
    durationSeconds: Number(scene.durationSeconds) || fallback.storyboard[index]?.durationSeconds || 3.2,
    motion: scene.motion || fallback.storyboard[index]?.motion || 'slow_push',
    safeZone: scene.safeZone || 'center',
    mediaType: scene.mediaType || fallback.storyboard[index]?.mediaType || (input.sourceAssets[index] ? classifyMediaType(input.sourceAssets[index]) : 'other'),
    qualityNote: scene.qualityNote || null,
    missingShotRecommendation: scene.missingShotRecommendation || null,
    crop: scene.crop || fallback.storyboard[index]?.crop || { x: 50, y: 50, scale: 1 },
  } satisfies TikTokStudioStoryboardScene));
  const qualityScore = scoreBrief({
    sourceAssets: input.sourceAssets,
    script,
    hooks,
    caption,
    hashtags,
    storyboard,
    aspectRatio: '9:16',
  });

  return {
    preset: preset.id,
    title,
    hooks,
    selectedHook: normalizeText(parsed.selectedHook, hooks[0] || fallback.selectedHook),
    script,
    caption,
    captionVariants,
    hashtags,
    storyboard,
    voiceProfile: parsed.voiceProfile || preset.voiceProfile,
    recommendedDurationSeconds: Number(parsed.recommendedDurationSeconds) || Math.max(preset.defaultDurationSeconds, estimateDurationSeconds(script)),
    qualityScore,
    missingShots: Array.isArray(parsed.missingShots) ? parsed.missingShots.map((item) => String(item || '').trim()).filter(Boolean) : fallback.missingShots,
    weakPhotos: Array.isArray(parsed.weakPhotos) ? parsed.weakPhotos as TikTokStudioCreativeBrief['weakPhotos'] : fallback.weakPhotos,
    brandKit: parsed.brandKit || input.brandKit || null,
  };
}

export async function generateTikTokStudioCreativeBrief(input: CreativeBriefInput): Promise<TikTokStudioCreativeBrief> {
  const fallback = fallbackBrief(input);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const preset = getPreset(input.preset);
  const prompt = [
    'Esti creative director pentru video marketing imobiliar pe TikTok/Reels.',
    'Genereaza un concept complet pentru un AI video studio imobiliar premium.',
    'Returneaza strict JSON valid, fara markdown.',
    'Textul trebuie sa fie in limba romana, natural, cu diacritice.',
    'Scriptul trebuie sa fie cursiv, ca o compunere, nu o lista si nu copia propozitii rigide.',
    'Caption-ul este descrierea postarii TikTok, nu subtitrarea video.',
    'Nu inventa date concrete precum pret, etaj, suprafata sau zona daca nu apar in context.',
    'Orice numar din script trebuie scris cu litere, pentru pronuntie buna in ElevenLabs.',
    'Formula finala trebuie sa includa un call to action cald pentru detalii si vizionare.',
    `Preset: ${preset.label}. Ton: ${preset.tone}. Hook style: ${preset.hookStyle}.`,
    `Titlu: ${input.title || fallback.title}.`,
    `Context proprietate: ${input.propertyContext || 'Nu exista context suplimentar.'}`,
    `Agent: ${input.agentName || 'agent ImoDeus'} ${input.agentPhone || ''}`.trim(),
    `Fotografii disponibile: ${input.sourceAssets.map((asset, index) => `${index + 1}. id=${asset.id}, name=${asset.name}`).join('; ')}`,
    'Clasifica fiecare fotografie in mediaType: exterior, living, kitchen, bedroom, bathroom, balcony, view, detail sau other.',
    'Alege ordinea ideala pentru vanzare: exterior/hook, living, bucatarie, dormitoare, bai, balcon/vedere, detalii, CTA.',
    'Include missingShots si weakPhotos cu motive scurte.',
    'Genereaza 3 variante caption TikTok in captionVariants.',
    'Forma JSON: {"title":"...","hooks":["...","...","..."],"selectedHook":"...","script":"...","caption":"...","captionVariants":["..."],"hashtags":["#..."],"missingShots":["..."],"weakPhotos":[{"assetId":"...","reason":"..."}],"storyboard":[{"id":"scene-1","assetId":"...","title":"...","visualIntent":"...","voiceoverLine":"...","overlayText":"...","durationSeconds":3.2,"motion":"slow_push","safeZone":"center","mediaType":"living","qualityNote":"...","missingShotRecommendation":null,"crop":{"x":50,"y":50,"scale":1}}],"voiceProfile":"warm_feminine","recommendedDurationSeconds":45}',
  ].join('\n');

  try {
    const response = await fetch(OPENAI_RESPONSES_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4.1',
        input: prompt,
        max_output_tokens: 2200,
      }),
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> } | null;
    if (!response.ok || !payload) return fallback;
    const text = payload.output_text || (payload.output || []).flatMap((item) => item.content || []).map((item) => item.text || '').join('\n');
    const parsed = safeParseJson(text);
    return normalizeBrief(parsed, fallback, input);
  } catch {
    return fallback;
  }
}
