import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createVapiOutboundCall } from '@/lib/ai-outreach/vapi';
import { withDefaultAiOutreachSettings } from '@/lib/ai-outreach/defaults';
const transport = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', transport);
  for (const key of ['VAPI_API_KEY', 'AI_CALLS_DEFAULT_VAPI_ASSISTANT_ID', 'AI_CALLS_DEFAULT_VAPI_PHONE_NUMBER_ID']) vi.stubEnv(key, 'fixture-only');
  transport.mockResolvedValue(new Response(JSON.stringify({ id: 'simulated-call' }), { status: 201 }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
function input(ownerPhone: string) { return { call: { id: 'call', agencyId: 'agency', agentId: 'agent', ownerListingId: 'listing', ownerPhone } as any, settings: withDefaultAiOutreachSettings('agency') }; }

it.each(['0722123456', '+40 722 123 456', '0040722123456', '722123456'])('sends %s in international format without changing the CRM snapshot', async phone => {
  const data = input(phone);
  expect(await createVapiOutboundCall(data)).toMatchObject({ mode: 'live', vapiCallId: 'simulated-call' });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport.mock.calls[0][0]).toBe('https://api.vapi.ai/call');
  const body = JSON.parse(transport.mock.calls[0][1].body);
  expect(body.customer.number).toBe('+40722123456');
  expect(body.metadata).toMatchObject({ agencyId: 'agency', aiOutreachCallId: 'call', ownerListingId: 'listing' });
  expect(data.call.ownerPhone).toBe(phone);
});
it.each(['', '22334455', '+441234567890', '0123123123'])('rejects incomplete or unsupported phone %s before HTTP', async phone => {
  await expect(createVapiOutboundCall(input(phone))).rejects.toMatchObject({ definitivelyRejected: true });
  expect(transport).not.toHaveBeenCalled();
});
it('does not treat a successful HTTP response without call ID as a confirmed launch', async () => {
  transport.mockResolvedValue(new Response('{}', { status: 201 }));
  await expect(createVapiOutboundCall(input('0722123456'))).rejects.toMatchObject({ definitivelyRejected: false });
  expect(transport).toHaveBeenCalledTimes(1);
});
it('does not issue HTTP requests without credentials', async () => {
  vi.stubEnv('VAPI_API_KEY', '');
  expect(await createVapiOutboundCall(input('0722123456'))).toMatchObject({ mode: 'not_configured' });
  expect(transport).not.toHaveBeenCalled();
});
