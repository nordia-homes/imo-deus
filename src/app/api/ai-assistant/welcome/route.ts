import { NextResponse } from 'next/server';
import { generateAssistantWelcome } from '@/ai/flows/assistant-welcome';

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const result = await generateAssistantWelcome(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI Assistant welcome route failed:', error);
    return NextResponse.json(
      { error: 'Nu am putut genera introducerea pentru AI Assistant.' },
      { status: 500 }
    );
  }
}
