import { GoogleAuth, type IdTokenClient } from 'google-auth-library';

type RemoteOlxPhoneResult = {
  phone: string;
  stage: string;
};

const idTokenClients = new Map<string, Promise<IdTokenClient>>();

function normalizeRemoteBaseUrl() {
  return String(process.env.OLX_PHONE_BROWSER_URL || '').trim().replace(/\/+$/, '');
}

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('004') && digits.length === 13) return digits.slice(3);
  if (digits.startsWith('4') && digits.length === 11) return digits.slice(1);
  if (/^0[237]\d{8}$/.test(digits)) return digits;
  return '';
}

async function getIdTokenClient(audience: string) {
  const existing = idTokenClients.get(audience);
  if (existing) return existing;

  const clientPromise = new GoogleAuth()
    .getIdTokenClient(audience)
    .catch((error) => {
      idTokenClients.delete(audience);
      throw error;
    });
  idTokenClients.set(audience, clientPromise);
  return clientPromise;
}

export function hasRemoteOlxPhoneBrowser() {
  return Boolean(normalizeRemoteBaseUrl());
}

export function describeRemoteOlxPhoneStage(stage: string) {
  switch (stage) {
    case 'login_required':
      return 'OLX solicita autentificare pentru telefonul acestui anunt. Anuntul a fost trimis automat la retry.';
    case 'access_denied':
      return 'OLX a limitat temporar afisarea telefonului. Anuntul a fost trimis automat la retry.';
    case 'rate_limited':
      return 'Limita temporara OLX pentru afisarea telefoanelor a fost atinsa. Anuntul a fost trimis automat la retry.';
    case 'listing_unavailable':
      return 'Anuntul OLX nu mai este disponibil la sursa. Verificarea va fi repetata automat.';
    case 'worker_unavailable':
      return 'Serviciul OLX este temporar ocupat. Anuntul a fost trimis automat la retry.';
    default:
      return 'Telefonul nu a fost disponibil in sesiunea OLX. Anuntul a fost trimis automat la retry.';
  }
}

export async function resolveOlxPhoneViaRemoteWorker(url: string): Promise<RemoteOlxPhoneResult> {
  const baseUrl = normalizeRemoteBaseUrl();
  if (!baseUrl) return { phone: '', stage: 'not_configured' };

  try {
    const client = await getIdTokenClient(baseUrl);
    const response = await client.request<Partial<RemoteOlxPhoneResult>>({
      url: `${baseUrl}/resolve`,
      method: 'POST',
      data: { url },
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return {
      phone: normalizePhone(response.data?.phone),
      stage: String(response.data?.stage || 'unknown').slice(0, 80),
    };
  } catch (error) {
    console.warn('Remote OLX phone worker request failed.', {
      errorType: error instanceof Error ? error.name : typeof error,
      serviceHost: (() => {
        try {
          return new URL(baseUrl).host;
        } catch {
          return 'invalid';
        }
      })(),
    });
    return { phone: '', stage: 'worker_unavailable' };
  }
}
