import { createHash, timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { TikTokAdsError } from './errors';
import { OPERATION_CLASS } from './capabilities';
import { randomOpaque, sha256Hex } from './crypto';
import type {
  TikTokAccountPermissionRecord,
  TikTokActor,
  TikTokAdvertiserRecord,
  TikTokCapability,
  TikTokOperationRequest,
} from './types';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stable(child)]));
  }
  return value;
}

export function hashOperationIntent(input: {
  organizationId: string;
  actorUid: string;
  capability: TikTokCapability;
  advertiserId?: string | null;
  propertyId?: string | null;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
}) {
  return createHash('sha256').update(JSON.stringify(stable(input))).digest('hex');
}

function switchEnabled(name: string, defaultValue: boolean) {
  const value = process.env[name];
  if (value == null || value === '') return defaultValue;
  return /^(1|true|yes|on)$/i.test(value);
}

export function assertKillSwitches(capability: TikTokCapability) {
  const operationClass = OPERATION_CLASS[capability];
  if (operationClass === 'READ_ONLY') {
    if (!switchEnabled('TIKTOK_READS_ENABLED', true)) throw new TikTokAdsError('KILL_SWITCH_ACTIVE', 'Citirile TikTok Ads sunt oprite operațional.');
    return;
  }
  if (!switchEnabled('TIKTOK_WRITES_ENABLED', true)) throw new TikTokAdsError('KILL_SWITCH_ACTIVE', 'Mutațiile TikTok Ads sunt oprite operațional.');
  if (operationClass === 'SPEND_AFFECTING' && !switchEnabled('TIKTOK_SPEND_MUTATIONS_ENABLED', false)) {
    throw new TikTokAdsError('KILL_SWITCH_ACTIVE', 'Operațiile care pot genera spend sunt oprite operațional.');
  }
}

export function assertActorPolicy(actor: TikTokActor, capability: TikTokCapability) {
  const operationClass = OPERATION_CLASS[capability];
  if (operationClass === 'READ_ONLY') return;
  if (actor.type === 'ai') throw new TikTokAdsError('SPEND_NOT_AUTHORIZED', 'AI-ul poate pregăti drafturi, dar nu poate executa mutații TikTok direct.');
  if (actor.role !== 'admin' && actor.role !== 'platform_admin') {
    throw new TikTokAdsError('UNAUTHORIZED', 'Doar un administrator poate modifica resurse TikTok Ads.');
  }
  if (operationClass === 'SPEND_AFFECTING' && actor.type !== 'human') {
    throw new TikTokAdsError('SPEND_NOT_AUTHORIZED', 'Operația necesită confirmarea explicită a unui utilizator uman.');
  }
}

export function assertAdvertiserWriteEligibility(advertiser: TikTokAdvertiserRecord) {
  if (!advertiser.authorized) {
    throw new TikTokAdsError('ADVERTISER_SUSPENDED', 'Accesul la advertiser-ul TikTok nu mai este autorizat.');
  }
  const state = `${advertiser.status || ''} ${advertiser.reviewStatus || ''}`.trim().toLowerCase();
  if (/under.?review|pending.?review|in.?review|(^|\W)pending(\W|$)/.test(state)) {
    throw new TikTokAdsError('ADVERTISER_UNDER_REVIEW', 'Advertiser-ul TikTok este în review.');
  }
  if (/not.?approved|disapprov|reject/.test(state)) {
    throw new TikTokAdsError('ADVERTISER_REJECTED', 'Advertiser-ul TikTok a fost respins sau nu este aprobat.');
  }
  if (/suspend|disable|removed|inactive|contract.*not.*effective|not.?effective/.test(state)) {
    throw new TikTokAdsError('ADVERTISER_SUSPENDED', 'Advertiser-ul TikTok nu este eligibil pentru mutații.');
  }
  if (!/(^|\W|_)(approved|active|enable|enabled|verified)(\W|_|$)/.test(state)) {
    throw new TikTokAdsError('ADVERTISER_UNDER_REVIEW', 'Eligibilitatea advertiser-ului TikTok nu este confirmată; sincronizează statusul înainte de mutații.');
  }
}

export function assertFreshTikTokAccountPermissions(
  permission: TikTokAccountPermissionRecord,
  workflow: 'existing_post' | 'new_video_ads_only',
  now = Date.now()
) {
  const verifiedAt = Date.parse(permission.lastVerifiedAt);
  if (!Number.isFinite(verifiedAt) || verifiedAt < now - 15 * 60_000 || verifiedAt > now + 5 * 60_000) {
    throw new TikTokAdsError('PERMISSION_MISSING', 'Permisiunile contului TikTok sunt stale sau au un timestamp invalid; reconciliază-le înainte de operație.');
  }
  if (permission.verificationStatus !== 'verified' || !permission.deliverAds) {
    throw new TikTokAdsError('PERMISSION_MISSING', 'Contul TikTok nu are o autorizare Deliver ads verificată.');
  }
  if (workflow === 'existing_post' && !permission.existingPosts) {
    throw new TikTokAdsError('PERMISSION_MISSING', 'Contul TikTok nu are permisiunea Existing posts.');
  }
  const providerIdentityCanFailSafely = permission.permissionEvidence === 'advertiser_identity'
    && permission.identityType === 'BC_AUTH_TT'
    && Boolean(permission.identityAuthorizedBcId);
  if (workflow === 'new_video_ads_only' && (!permission.publishAndManageNewVideos || !permission.onlyShowAsAds) && !providerIdentityCanFailSafely) {
    throw new TikTokAdsError('PERMISSION_MISSING', 'Contul TikTok nu are Publish and manage new videos + Only show as ads.');
  }
}

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function issueSpendAuthorization(input: {
  organizationId: string;
  actor: TikTokActor;
  capability: TikTokCapability;
  advertiserId?: string | null;
  propertyId?: string | null;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
}) {
  if (OPERATION_CLASS[input.capability] !== 'SPEND_AFFECTING') {
    throw new TikTokAdsError('INVALID_REQUEST', 'Capability-ul selectat nu necesită o autorizare de spend.');
  }
  assertActorPolicy(input.actor, input.capability);
  const token = randomOpaque(32);
  const tokenHash = sha256Hex(token);
  const intentHash = hashOperationIntent({ ...input, actorUid: input.actor.uid });
  const createdAt = new Date();
  await adminDb.collection('agencies').doc(input.organizationId).collection('tiktokSpendAuthorizations').doc(tokenHash).create({
    organizationId: input.organizationId,
    actorUid: input.actor.uid,
    capability: input.capability,
    advertiserId: input.advertiserId || null,
    propertyId: input.propertyId || null,
    idempotencyKey: input.idempotencyKey || null,
    intentHash,
    createdAt: createdAt.toISOString(),
    expiresAt: Timestamp.fromMillis(createdAt.getTime() + 10 * 60_000),
    expiresAtIso: new Date(createdAt.getTime() + 10 * 60_000).toISOString(),
    consumedAt: null,
  });
  return { token, expiresAt: new Date(createdAt.getTime() + 10 * 60_000).toISOString(), intentHash };
}

export async function consumeSpendAuthorization(request: TikTokOperationRequest) {
  if (OPERATION_CLASS[request.capability] !== 'SPEND_AFFECTING') return;
  if (!request.authorizationToken) throw new TikTokAdsError('SPEND_NOT_AUTHORIZED', 'Lipsește confirmarea explicită pentru operația care poate genera spend.');
  const tokenHash = sha256Hex(request.authorizationToken);
  const ref = adminDb.collection('agencies').doc(request.organizationId).collection('tiktokSpendAuthorizations').doc(tokenHash);
  const intentHash = hashOperationIntent({
    organizationId: request.organizationId,
    actorUid: request.actor.uid,
    capability: request.capability,
    advertiserId: request.advertiserId,
    propertyId: request.propertyId,
    payload: request.payload,
    idempotencyKey: request.idempotencyKey,
  });
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new TikTokAdsError('SPEND_NOT_AUTHORIZED', 'Confirmarea de spend este invalidă.');
    const data = snapshot.data() as { organizationId?: string; actorUid?: string; intentHash?: string; expiresAt?: { toMillis?: () => number } | string; consumedAt?: string | null };
    if (data.organizationId !== request.organizationId || data.actorUid !== request.actor.uid || !data.intentHash || !constantTimeEqual(data.intentHash, intentHash)) {
      throw new TikTokAdsError('SPEND_NOT_AUTHORIZED', 'Confirmarea nu corespunde exact operației curente.');
    }
    const expiresAtMs = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : data.expiresAt?.toMillis?.() || 0;
    if (!expiresAtMs || expiresAtMs <= Date.now() || data.consumedAt) {
      throw new TikTokAdsError('SPEND_NOT_AUTHORIZED', 'Confirmarea de spend a expirat sau a fost deja folosită.');
    }
    transaction.update(ref, { consumedAt: new Date().toISOString() });
  });
}

const MONEY_KEY = /(^|_)(budget|bid|spend|cost|price|amount)(_|$)/i;
const MONEY_VALUE = /^-?(0|[1-9]\d*)(\.\d+)?$/;

function isMoneyAmountKey(key: string) {
  if (!MONEY_KEY.test(key)) return false;
  if (/(^|_)(mode|type|strategy|optimization|event|currency|precision|status|name|id)(_|$)/i.test(key)) return false;
  // Enum-like fields such as budget_mode are settings, not money amounts.
  // Provider JSON Schema still validates their exact contract.
  return true;
}

export function validateMoneyPayload(payload: Record<string, unknown>, advertiser: { currency?: string | null; currencyPrecision?: number | null }) {
  const money: Array<{ path: string; value: string }> = [];
  const visit = (value: unknown, path: string, key: string) => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${path}[${index}]`, key));
    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => visit(child, `${path}.${childKey}`, childKey));
    }
    if (value == null || !isMoneyAmountKey(key)) return;
    if (typeof value === 'number' && !Number.isInteger(value)) {
      throw new TikTokAdsError('INVALID_BUDGET', `${path} trebuie trimis ca șir decimal exact, nu floating point.`);
    }
    const normalized = String(value);
    if (!MONEY_VALUE.test(normalized)) throw new TikTokAdsError('INVALID_BUDGET', `${path} nu este o valoare monetară validă.`);
    money.push({ path, value: normalized });
  };
  Object.entries(payload).forEach(([key, value]) => visit(value, `$.${key}`, key));
  if (!money.length) return [];
  if (!advertiser.currency || advertiser.currencyPrecision == null) {
    throw new TikTokAdsError('INVALID_BUDGET', 'Currency și precision trebuie sincronizate din advertiser înaintea unei operații monetare.');
  }
  for (const field of money) {
    const decimals = field.value.split('.')[1]?.length || 0;
    if (decimals > advertiser.currencyPrecision) {
      throw new TikTokAdsError('INVALID_BUDGET', `${field.path} depășește precizia ${advertiser.currencyPrecision} pentru ${advertiser.currency}.`);
    }
    const digits = field.value.replace('-', '').replace('.', '').replace(/^0+/, '') || '0';
    const padded = digits + '0'.repeat(Math.max(0, advertiser.currencyPrecision - decimals));
    if (BigInt(padded) > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new TikTokAdsError('INVALID_BUDGET', `${field.path} depășește reprezentarea monetară sigură pentru transport.`);
    }
    if (field.value.startsWith('-')) throw new TikTokAdsError('INVALID_BUDGET', `${field.path} nu poate fi negativ.`);
  }
  return money;
}

function payloadKeys(value: unknown, output: string[] = []) {
  if (Array.isArray(value)) value.forEach((child) => payloadKeys(child, output));
  else if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      if (key !== '_imodeus') {
        output.push(key.replace(/[^a-z0-9]/gi, '').toLowerCase());
        payloadKeys(child, output);
      }
    });
  }
  return output;
}

export function assertCapabilityPayloadBoundaries(capability: TikTokCapability, payload: Record<string, unknown>) {
  const keys = payloadKeys(payload);
  const has = (pattern: RegExp) => keys.some((key) => pattern.test(key));
  if (['CAMPAIGN_UPDATE', 'ADGROUP_UPDATE', 'AD_UPDATE'].includes(capability)
    && (has(/budget|bid|spend|cost|price|amount/) || has(/^(status|operationstatus)$/) || has(/schedule/))) {
    throw new TikTokAdsError('INVALID_REQUEST', 'Bugetul, bid-ul, statusul și programarea folosesc capabilities dedicate cu policy de spend.');
  }
  if (capability === 'TARGETING_UPDATE' && (has(/budget|bid|spend|cost|price|amount/) || has(/^(status|operationstatus)$/) || has(/schedule/))) {
    throw new TikTokAdsError('INVALID_REQUEST', 'Targeting update nu poate modifica buget, bid, status sau programare.');
  }
}

function decimalMinorUnits(value: string, precision: number) {
  const [integer, fraction = ''] = value.split('.');
  return BigInt(integer) * BigInt(10) ** BigInt(precision) + BigInt((fraction + '0'.repeat(precision)).slice(0, precision) || '0');
}

export function assertSignificantChangeSafeguard(capability: TikTokCapability, payload: Record<string, unknown>, precision: number, advertiserTimezone?: string | null) {
  if (!['BUDGET_UPDATE', 'BID_UPDATE', 'SCHEDULE_UPDATE'].includes(capability)) return;
  const metadata = payload._imodeus;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TikTokAdsError('SPEND_NOT_AUTHORIZED', 'Operația necesită baseline-ul curent și confirmarea de schimbare în _imodeus.');
  }
  const safety = metadata as Record<string, unknown>;
  if (capability === 'SCHEDULE_UPDATE') {
    if (!advertiserTimezone || safety.advertiserTimezone !== advertiserTimezone) {
      throw new TikTokAdsError('INVALID_REQUEST', 'Programarea trebuie confirmată în timezone-ul sincronizat al advertiser-ului.');
    }
    const previous = typeof safety.previousEndAt === 'string' ? Date.parse(safety.previousEndAt) : NaN;
    const dates: string[] = [];
    const findDates = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(findDates);
      if (!value || typeof value !== 'object') return;
      Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
        if (key !== '_imodeus' && /schedule.*end|end.*time/i.test(key) && typeof child === 'string') dates.push(child);
        else if (key !== '_imodeus') findDates(child);
      });
    };
    findDates(payload);
    const next = dates.length === 1 ? Date.parse(dates[0]) : NaN;
    if (!Number.isFinite(previous) || !Number.isFinite(next)) throw new TikTokAdsError('INVALID_REQUEST', 'Programarea necesită previousEndAt și un nou end time valid.');
    if (next > previous && safety.significantChangeApproved !== true) throw new TikTokAdsError('SPEND_NOT_AUTHORIZED', 'Extinderea programării necesită confirmare explicită.');
    return;
  }
  const previousAmount = typeof safety.previousAmount === 'string' && MONEY_VALUE.test(safety.previousAmount) && !safety.previousAmount.startsWith('-') ? safety.previousAmount : null;
  const money = validateMoneyPayload(Object.fromEntries(Object.entries(payload).filter(([key]) => key !== '_imodeus')), { currency: 'SAFE', currencyPrecision: precision });
  if (!previousAmount || !money.length) throw new TikTokAdsError('INVALID_BUDGET', 'Schimbarea necesită previousAmount și noua valoare monetară exactă.');
  const previous = decimalMinorUnits(previousAmount, precision);
  const next = decimalMinorUnits(money[0].value, precision);
  const configuredBps = Number(process.env.TIKTOK_ADS_SIGNIFICANT_CHANGE_BPS || 2500);
  const thresholdBps = Number.isFinite(configuredBps) ? Math.max(1, Math.min(Math.trunc(configuredBps), 10000)) : 2500;
  const significant = next > previous && (previous === BigInt(0) || (next - previous) * BigInt(10000) >= previous * BigInt(thresholdBps));
  if (significant && safety.significantChangeApproved !== true) {
    throw new TikTokAdsError('SPEND_NOT_AUTHORIZED', `Creșterea depășește pragul intern de ${thresholdBps / 100}% și necesită confirmare explicită.`);
  }
}

export function assertAdsOnlyPayload(payload: Record<string, unknown>) {
  const serialized = JSON.stringify(payload).toLowerCase();
  const forbidden = ['video.publish', 'content posting', 'organic_publish', 'show_on_profile', 'show on profile'];
  if (forbidden.some((term) => serialized.includes(term))) {
    throw new TikTokAdsError('INVALID_REQUEST', 'Workflow-ul Ads Only nu poate conține instrucțiuni de publicare organică.');
  }
  let explicitAdsOnly = false;
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (['onlyshowasads', 'adsonly', 'onlyshowinads'].includes(normalized) && child === true) explicitAdsOnly = true;
      visit(child);
    }
  };
  visit(payload);
  if (!explicitAdsOnly) {
    throw new TikTokAdsError('INVALID_REQUEST', 'Workflow-ul video nou trebuie să confirme explicit Only show as ads.');
  }
}
