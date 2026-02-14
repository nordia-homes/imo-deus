import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Owner listings API endpoint.' }, { status: 200 });
}
