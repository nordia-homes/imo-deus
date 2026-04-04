import { NextResponse } from 'next/server';
import { chat } from '@/ai/flows/chat';

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const result = await chat(input);
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI Assistant chat route failed:', error);
    return NextResponse.json(
      { error: 'Nu am putut procesa cererea pentru AI Assistant.' },
      { status: 500 }
    );
  }
}
