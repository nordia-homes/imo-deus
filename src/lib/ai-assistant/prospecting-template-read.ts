import { getResource, type AssistantContext } from './access';
import { CommunicationError } from '@/lib/communications/server';
import { invokeOperation } from './operations';
import { requestsWhatsappProspecting } from './prospecting-consent';

// Recovery is read-only and limited to one unambiguous, currently connected
// WhatsApp account. Never retry forbidden access, provider errors or sends.
export async function readProspectingOperation(ctx: AssistantContext, input: Parameters<typeof invokeOperation>[1]) {
  try { return await invokeOperation(ctx, input, true); }
  catch (error) {
    if (input.operation !== 'whatsapp_templates' || !requestsWhatsappProspecting(ctx.prospectingRequest?.prompt || '') || !(error instanceof CommunicationError) || error.status !== 404) throw error;
    let missingReference = false;
    try { await getResource(ctx, 'channelConnections', input.params.connectionId); }
    catch (lookupError) { missingReference = lookupError instanceof CommunicationError && lookupError.status === 404; }
    if (!missingReference) throw error;
    const status = await invokeOperation(ctx, { operation: 'communications_status', params: {}, query: {}, body: {} }, true);
    const connections = Array.isArray(status.connections) ? status.connections.filter((row: Record<string, unknown>) => row.channel === 'whatsapp' && row.status === 'connected' && typeof row.id === 'string') : [];
    if (connections.length !== 1 || connections[0].id === input.params.connectionId) throw error;
    const connectionId = connections[0].id as string;
    const templates = await invokeOperation(ctx, { ...input, params: { ...input.params, connectionId } }, true);
    return { ...templates, resolvedConnectionId: connectionId, note: 'Referința inițială nu există. Catalogul a fost citit de la unica conexiune WhatsApp conectată a agenției. Pentru pregătire folosește resolvedConnectionId. Nu au fost trimise mesaje.' };
  }
}
