export type TikTokDomainErrorCode =
  | 'UNAUTHORIZED'
  | 'CONNECTION_EXPIRED'
  | 'CONNECTION_REVOKED'
  | 'PERMISSION_MISSING'
  | 'ADVERTISER_UNDER_REVIEW'
  | 'ADVERTISER_REJECTED'
  | 'ADVERTISER_SUSPENDED'
  | 'BILLING_NOT_READY'
  | 'INVALID_BUDGET'
  | 'INVALID_TARGETING'
  | 'INVALID_CREATIVE'
  | 'AD_REJECTED'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'SCHEMA_INCOMPATIBLE'
  | 'CAPABILITY_UNAVAILABLE'
  | 'TENANT_ACCESS_DENIED'
  | 'RESOURCE_NOT_OWNED'
  | 'SPEND_NOT_AUTHORIZED'
  | 'KILL_SWITCH_ACTIVE'
  | 'CONFLICT'
  | 'PARTIAL_FAILURE'
  | 'INVALID_REQUEST';

const STATUS_BY_CODE: Record<TikTokDomainErrorCode, number> = {
  UNAUTHORIZED: 401,
  CONNECTION_EXPIRED: 401,
  CONNECTION_REVOKED: 401,
  PERMISSION_MISSING: 403,
  ADVERTISER_UNDER_REVIEW: 409,
  ADVERTISER_REJECTED: 409,
  ADVERTISER_SUSPENDED: 409,
  BILLING_NOT_READY: 409,
  INVALID_BUDGET: 400,
  INVALID_TARGETING: 400,
  INVALID_CREATIVE: 400,
  AD_REJECTED: 409,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
  TIMEOUT: 504,
  SCHEMA_INCOMPATIBLE: 503,
  CAPABILITY_UNAVAILABLE: 501,
  TENANT_ACCESS_DENIED: 403,
  RESOURCE_NOT_OWNED: 404,
  SPEND_NOT_AUTHORIZED: 403,
  KILL_SWITCH_ACTIVE: 503,
  CONFLICT: 409,
  PARTIAL_FAILURE: 502,
  INVALID_REQUEST: 400,
};

export class TikTokAdsError extends Error {
  readonly code: TikTokDomainErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly correlationId?: string;
  readonly safeDetails?: Record<string, unknown>;

  constructor(
    code: TikTokDomainErrorCode,
    message: string,
    options?: {
      status?: number;
      retryable?: boolean;
      correlationId?: string;
      safeDetails?: Record<string, unknown>;
      cause?: unknown;
    }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'TikTokAdsError';
    this.code = code;
    this.status = options?.status ?? STATUS_BY_CODE[code];
    this.retryable = options?.retryable ?? false;
    this.correlationId = options?.correlationId;
    this.safeDetails = options?.safeDetails;
  }
}

export function formatTikTokAdsError(error: unknown) {
  if (error instanceof TikTokAdsError) {
    return {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        correlationId: error.correlationId,
        ...(error.safeDetails ? { details: error.safeDetails } : {}),
      },
    };
  }
  return {
    status: 500,
    body: {
      code: 'PROVIDER_UNAVAILABLE' as const,
      message: 'Integrarea TikTok Ads nu este disponibilă.',
      retryable: false,
    },
  };
}

export function normalizeTikTokProviderError(input: {
  status?: number;
  message?: string;
  correlationId?: string;
  retryAfterSeconds?: number | null;
}) {
  const status = input.status || 500;
  const message = (input.message || '').toLowerCase();
  if (status === 401 || message.includes('token') && (message.includes('expire') || message.includes('invalid'))) {
    return new TikTokAdsError('CONNECTION_EXPIRED', 'Conexiunea TikTok Ads a expirat. Reconectează contul.', {
      correlationId: input.correlationId,
    });
  }
  if (status === 403 || message.includes('permission') || message.includes('scope')) {
    return new TikTokAdsError('PERMISSION_MISSING', 'TikTok nu a acordat permisiunea necesară acestei operații.', {
      correlationId: input.correlationId,
    });
  }
  if (status === 429) {
    return new TikTokAdsError('RATE_LIMITED', 'TikTok a limitat temporar numărul de cereri.', {
      retryable: true,
      correlationId: input.correlationId,
      safeDetails: input.retryAfterSeconds == null ? undefined : { retryAfterSeconds: input.retryAfterSeconds },
    });
  }
  if (status === 408 || status === 504 || message.includes('timeout')) {
    return new TikTokAdsError('TIMEOUT', 'TikTok nu a răspuns în intervalul permis.', {
      retryable: true,
      correlationId: input.correlationId,
    });
  }
  return new TikTokAdsError('PROVIDER_UNAVAILABLE', 'TikTok Ads a refuzat sau nu a putut procesa operația.', {
    status: status >= 400 && status <= 599 ? status : 502,
    retryable: status >= 500,
    correlationId: input.correlationId,
  });
}
