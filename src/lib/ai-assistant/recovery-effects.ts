import { collectionFor, getResource, type AssistantContext } from './access';
import { payloadHash } from './approval';
import { resolveAction } from './dependencies';
import { continuePlanRevision } from './plan-revisions';
import { scopedCreationKey } from './execution-scope';
import { incompletePlanning, loadRequestCheckpoint } from './request-checkpoint';
import { uniqueReferences, type AccessReference } from './contracts';
import type { RecoveryRecord } from './request-recovery';

const resultResources: Record<string, AccessReference['resource']> = { contactId:'contacts', propertyId:'properties', viewingId:'viewings', taskId:'tasks', automationId:'assistantAutomations', saleId:'sales' };
// Deliberately omit provider credentials, approvals, tokens and arbitrary result bodies.
const currentFields = ['name','title','description','status','phone','viewingDate','dueDate','startTime','duration','propertyId','contactId','agentId','updatedAt'];
export async function recoveryEffects(ctx: AssistantContext, record: RecoveryRecord) {
 const checkpoint = await loadRequestCheckpoint(ctx, record.input);
 if (!checkpoint) return { phase:'planning_not_saved', steps:[], refs:[] as AccessReference[] };
 if (incompletePlanning(checkpoint, record.input.prompt)) return { phase:'planning_incomplete', steps:checkpoint.actions.map((action,index)=>({step:index+1,kind:action.kind,state:'prepared_only'})), refs:checkpoint.accessRefs };
 const previous: Record<string, unknown>[] = [], occurrences = new Map<string,number>();
 const steps: Record<string, unknown>[] = [], refs: AccessReference[] = [...checkpoint.accessRefs];
 for (const [index, action] of checkpoint.actions.entries()) {
  const base={step:index+1,kind:action.kind,...(action.kind==='existing_operation'?{operation:action.operation}:{})};
  let resolved;
  try { resolved=continuePlanRevision(resolveAction(action,previous),previous); }
  catch { steps.push({...base,state:'dependency_unresolved'});previous.push({step:index+1});continue; }
  const key=scopedCreationKey(record.executionScope,resolved,occurrences) || record.input.requestId+'-safe-'+index;
  const ledger=(await collectionFor(ctx,'assistantExecutions').doc(key).get()).data();
  // Absence is NOT proof of non-execution: some domain handlers own a separate ledger.
  if (!ledger) {steps.push({...base,state:'no_receipt',instruction:'Verifică starea CRM sau registrul specific domeniului înainte să propui o nouă creare/trimitere.'});previous.push({step:index+1});continue;}
  if (ledger.actorId!==ctx.uid || payloadHash([ledger.action])!==payloadHash([resolved])) throw new Error('Execuția salvată nu corespunde cererii recuperate.');
  if (ledger.status!=='completed') {steps.push({...base,state:'unconfirmed',executionState:ledger.status,instruction:'Nu repeta efectul; folosește reconcilierea specifică domeniului.'});previous.push({step:index+1});continue;}
  const receipt=ledger.result;
  if (!receipt || typeof receipt!=='object') throw new Error('Rezultatul execuției salvate este incomplet.');
  const references=Object.entries(resultResources).flatMap(([key,resource])=>typeof receipt[key]==='string'?[{resource,id:receipt[key]}]:[]);
  const currentRecords: Record<string, unknown>[]=[];
  let available=true;
  for (const ref of uniqueReferences(references)) {
   try {
    const current=await getResource(ctx,ref.resource,ref.id);
    if (current.deletedAt) {available=false;break;}
    currentRecords.push({...ref,updatedAt:current.updatedAt || null,...Object.fromEntries(currentFields.filter(field=>current[field]!==undefined).map(field=>[field,current[field]]))});
   } catch {available=false;break;}
  }
  if (!available) {steps.push({...base,state:'result_unavailable',instruction:'Rezultatul nu mai este accesibil sau disponibil. Nu îl recrea automat.'});previous.push({step:index+1});continue;}
  refs.push(...references);
  steps.push({...base,state:'completed',completedAt:ledger.completedAt || null,references,currentRecords,currentStateVerified:references.length>0,instruction:'Efect confirmat istoric. Starea actuală poate fi diferită; modifică înregistrarea existentă numai conform cererii actuale, cu revizia citită. Nu repeta crearea/trimiterea.'});
  previous.push({step:index+1,kind:action.kind,result:receipt});
 }
 return {phase:'saved_plan',steps,refs:uniqueReferences(refs)};
}
