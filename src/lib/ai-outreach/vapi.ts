import type { AiOutreachCall, AiOutreachSettings } from '@/lib/ai-outreach/types';

type CreateVapiOutboundCallInput = {
  call: AiOutreachCall;
  settings: AiOutreachSettings;
  agencyName?: string;
};

type VapiOutboundCallResult =
  | {
      mode: 'live';
      vapiCallId: string;
      callerNumber?: string | null;
      raw: unknown;
    }
  | {
      mode: 'not_configured';
      message: string;
    };

function buildAssistantOverrides(input: CreateVapiOutboundCallInput) {
  const { call, settings, agencyName } = input;
  const commissionUnit = settings.commissionType === 'percent' ? '%' : 'EUR';

  return {
    variableValues: {
      agencyName: agencyName || 'agentia imobiliara',
      agentName: call.agentName || 'agentul responsabil',
      ownerListingTitle: call.ownerListingTitle || 'proprietatea publicata online',
      ownerListingLocation: call.ownerListingLocation || '',
      ownerListingPrice: call.ownerListingPrice || '',
      desiredCommission: `${settings.desiredCommissionValue}${commissionUnit}`,
      minimumCommission: `${settings.minimumCommissionValue}${commissionUnit}`,
      allowNegotiation: settings.allowNegotiation ? 'da' : 'nu',
      allowVerbalAgreement: settings.allowVerbalAgreement ? 'da' : 'nu',
      allowExactAddressCollection: settings.allowExactAddressCollection ? 'da' : 'nu',
      recordCalls: settings.recordCalls ? 'da' : 'nu',
      discloseAi: settings.discloseAi ? 'da' : 'nu',
    },
  };
}

export async function createVapiOutboundCall(input: CreateVapiOutboundCallInput): Promise<VapiOutboundCallResult> {
  const apiKey = process.env.VAPI_API_KEY;
  const assistantId = process.env.AI_CALLS_DEFAULT_VAPI_ASSISTANT_ID || process.env.VAPI_ASSISTANT_ID;
  const phoneNumberId = process.env.AI_CALLS_DEFAULT_VAPI_PHONE_NUMBER_ID || process.env.VAPI_PHONE_NUMBER_ID;

  if (!apiKey || !assistantId || !phoneNumberId) {
    return {
      mode: 'not_configured',
      message: 'Vapi nu este configurat. Seteaza VAPI_API_KEY, AI_CALLS_DEFAULT_VAPI_ASSISTANT_ID si AI_CALLS_DEFAULT_VAPI_PHONE_NUMBER_ID.',
    };
  }

  const response = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: {
        number: input.call.ownerPhone,
      },
      assistantOverrides: buildAssistantOverrides(input),
      metadata: {
        agencyId: input.call.agencyId,
        agentId: input.call.agentId,
        ownerListingId: input.call.ownerListingId,
        aiOutreachCallId: input.call.id,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof payload === 'object' && payload && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `Vapi a raspuns cu ${response.status}.`,
    );
  }

  const vapiCallId =
    typeof payload === 'object' && payload && 'id' in payload && typeof payload.id === 'string'
      ? payload.id
      : null;

  if (!vapiCallId) {
    throw new Error('Vapi nu a returnat un ID de apel.');
  }

  return {
    mode: 'live',
    vapiCallId,
    callerNumber: null,
    raw: payload,
  };
}
