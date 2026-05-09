import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function buildHtmlResponse(params: {
  success: boolean;
  state: string | null;
  error: string | null;
  message: string;
}) {
  const { success, state, error, message } = params;

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
      <h1>${success ? 'Cont Storia conectat' : 'Conectare Storia esuata'}</h1>
      <p>${message}</p>
      <p>Poti inchide aceasta fereastra si te poti intoarce in ImoDeus.</p>
      <div class="meta">
        <p><strong>status:</strong> <code>${success ? 'success' : 'error'}</code></p>
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
  const errorDescription = request.nextUrl.searchParams.get('error_description');

  console.info('[storia] oauth callback received', {
    hasCode: Boolean(code),
    state,
    error,
  });

  if (!code || !state || error) {
    return new NextResponse(
      buildHtmlResponse({
        success: false,
        state,
        error: error || errorDescription,
        message: errorDescription || error || 'Storia nu a returnat un cod OAuth valid.',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  try {
    const { finalizeStoriaAuthorization } = await import('@/lib/storia');
    await finalizeStoriaAuthorization({ code, state });

    return new NextResponse(
      buildHtmlResponse({
        success: true,
        state,
        error: null,
        message: 'Autorizarea OAuth a fost finalizata si contul agentiei este acum conectat la Storia.',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (callbackError) {
    return new NextResponse(
      buildHtmlResponse({
        success: false,
        state,
        error: callbackError instanceof Error ? callbackError.message : 'authorization_failed',
        message: callbackError instanceof Error ? callbackError.message : 'Nu am putut finaliza conectarea Storia.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
