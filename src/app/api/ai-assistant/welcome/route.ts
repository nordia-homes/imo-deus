import { NextResponse } from 'next/server';
import { assistantContext } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';

export async function POST(request: Request) {
  try {
    await assistantContext(request);
    return NextResponse.json({ title: 'Ce vrei să rezolvăm în CRM?', subtitle: 'Caută, verifică și pregătește acțiuni reale dintr-o singură conversație.', suggestions: ['Găsește 5 apartamente în Titan sub 130000 euro.', 'Arată-mi vizionările de mâine și sarcinile restante.', 'Găsește ofertele potrivite unui client.', 'Verifică starea conexiunii WhatsApp.'] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return assistantError(error);
  }
}
