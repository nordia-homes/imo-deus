import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function buildHtmlResponse(params: {
  codePresent: boolean;
  state: string | null;
  error: string | null;
}) {
  const { codePresent, state, error } = params;

  return `<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Storia Callback</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f7f6f1;
        color: #1f2937;
      }
      main {
        max-width: 640px;
        margin: 64px auto;
        padding: 32px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }
      p {
        line-height: 1.6;
        margin: 0 0 12px;
      }
      .meta {
        margin-top: 20px;
        padding: 16px;
        border-radius: 12px;
        background: #f9fafb;
        font-size: 14px;
      }
      code {
        font-family: Consolas, monospace;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Callback Storia primit</h1>
      <p>Endpoint-ul OAuth pentru Storia este activ si a raspuns corect.</p>
      <p>Integrarea completa a schimbului de cod OAuth va fi adaugata in pasul urmator.</p>
      <div class="meta">
        <p><strong>authorization code primit:</strong> ${codePresent ? 'da' : 'nu'}</p>
        <p><strong>state:</strong> <code>${state || '-'}</code></p>
        <p><strong>error:</strong> <code>${error || '-'}</code></p>
      </div>
    </main>
  </body>
</html>`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  console.info('[storia] oauth callback received', {
    hasCode: Boolean(code),
    state,
    error,
  });

  return new NextResponse(
    buildHtmlResponse({
      codePresent: Boolean(code),
      state,
      error,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}
