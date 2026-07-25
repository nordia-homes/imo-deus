import { describe, expect, it } from 'vitest';

import { getSafeOlxBrowserFailure } from '@/lib/owner-listings/agent-olx-phone';
import { isBrowserLifecycleError } from '@/lib/owner-listings/browser';
import { hasOlxSecurityChallengeSignals } from '@/lib/owner-listings/olx-cloud-phone';
import { describeRemoteOlxPhoneStage } from '@/lib/owner-listings/remote-olx-phone';

describe('OLX phone browser resilience', () => {
  it('recognizes the closed Chromium process reported by App Hosting', () => {
    const error = new Error(
      'browserType.launch: Target page, context or browser has been closed ' +
        '--disable-background-timer-throttling /workspace/.next/standalone/node_modules/playwright-core pid=24'
    );

    expect(isBrowserLifecycleError(error)).toBe(true);
  });

  it('does not treat ordinary OLX content failures as browser crashes', () => {
    expect(isBrowserLifecycleError(new Error('OLX API returned status 429'))).toBe(false);
    expect(isBrowserLifecycleError(new Error('Telefonul nu este afisat in acest anunt.'))).toBe(false);
  });

  it('never exposes Playwright launch arguments or server paths to the user', () => {
    const rawError = new Error(
      'browserType.launch: Target page, context or browser has been closed ' +
        '--no-sandbox --disable-dev-shm-usage /workspace/.next/standalone/node_modules/playwright-core pid=24'
    );
    const safeFailure = getSafeOlxBrowserFailure(rawError);

    expect(safeFailure.stage).toBe('browser_restarted');
    expect(safeFailure.message).toContain('reincarcat');
    expect(safeFailure.message).not.toMatch(/browserType|--no-sandbox|workspace|node_modules|pid=/i);
  });

  it('returns an actionable but sanitized message for an unavailable browser', () => {
    const safeFailure = getSafeOlxBrowserFailure(new Error('Unexpected launch failure with sensitive details'));

    expect(safeFailure.stage).toBe('browser_failed');
    expect(safeFailure.message).toContain('retry');
    expect(safeFailure.message).not.toContain('sensitive details');
  });

  it('classifies OLX authentication and throttling without leaking technical errors', () => {
    expect(describeRemoteOlxPhoneStage('login_required')).toContain('autentificare');
    expect(describeRemoteOlxPhoneStage('access_denied')).toContain('limitat');
    expect(describeRemoteOlxPhoneStage('rate_limited')).toContain('Limita');
    expect(describeRemoteOlxPhoneStage('browserType.launch')).not.toContain('browserType');
  });

  it('does not confuse ordinary OLX seller verification copy with a CAPTCHA', () => {
    const accountHtml = `
      <main>
        <h1>Anunturile tale</h1>
        <p>Pentru a continua sa vinzi, confirma cateva date.</p>
        <a href="/myaccount/settings">Setari</a>
      </main>
    `;

    expect(
      hasOlxSecurityChallengeSignals('https://www.olx.ro/myaccount/', accountHtml)
    ).toBe(false);
  });

  it('still recognizes explicit CAPTCHA and Cloudflare challenge signals', () => {
    expect(
      hasOlxSecurityChallengeSignals(
        'https://www.olx.ro/challenge/',
        '<iframe src="https://challenges.cloudflare.com/turnstile"></iframe>'
      )
    ).toBe(true);
    expect(
      hasOlxSecurityChallengeSignals(
        'https://www.olx.ro/myaccount/',
        '<div class="g-recaptcha"></div>'
      )
    ).toBe(true);
  });
});
