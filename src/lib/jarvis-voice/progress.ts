// Only verified stage identifiers select narration; raw tool text is never spoken.
export function voiceProgressText(stage?: string) {
  if (stage === 'query_records') return 'Consult datele din aplicație pentru cererea ta.';
  if (stage === 'search_properties') return 'Caut proprietatea potrivită în portofoliu.';
  if (stage === 'facebook_publication_preflight') return 'Verific proprietatea, contul Facebook și grupurile pentru publicare.';
  if (stage === 'verify_request_coverage' || stage === 'goal_coverage') return 'Verific să fie îndeplinite toate cerințele tale.';
  if (stage === 'propose_actions') return 'Pregătesc pașii necesari pentru cererea ta.';
  if (stage === 'planning') return 'Verific ce mai este necesar pentru cererea ta.';
  if (stage === 'provider_retry' || stage === 'tool_retry') return 'Durează puțin mai mult. Încerc din nou să obțin informațiile necesare.';
  return 'Mă ocup de cererea ta. Încă aștept rezultatul.';
}
export function startVoiceProgress(say: (text: string) => Promise<void>, cancel: () => void) {
  let stage: string | undefined, stopped = false, speaking = false;
  const tick = async () => {
    if (stopped || speaking) return;
    speaking = true;
    try { await say(voiceProgressText(stage)); } catch { /* Progress must not fail the request. */ }
    finally { speaking = false; }
  };
  let interval: ReturnType<typeof setInterval> | undefined;
  const first = setTimeout(() => { void tick(); interval = setInterval(() => void tick(), 5000); }, 1000);
  return { update: (_text: string, next?: string) => { stage = next; }, stop: () => { stopped = true; clearTimeout(first); clearInterval(interval); cancel(); } };
}
