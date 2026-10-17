import {describe,it,expect} from 'vitest';
import {diagnoseMetaState} from '../meta-diagnosis';
import {metaStatusRequest} from '../meta-status';
const states=(effectiveStatus='ACTIVE')=>[{kind:'campaign',status:'ACTIVE',effectiveStatus:'ACTIVE'},{kind:'adSet',status:'ACTIVE',effectiveStatus:'ACTIVE'},{kind:'ad',status:'ACTIVE',effectiveStatus}];
describe('Meta evidence diagnosis',()=>{
 it.each(['DISAPPROVED','PENDING_BILLING_INFO','WITH_ISSUES'])('locates %s at the observed provider object',state=>{const result=diagnoseMetaState('published',states(state),true);expect(result.findings[0].location).toBe('Meta');expect(result.causeConfirmed).toBe(false);expect(result.deliveryConfirmed).toBe(false);});
 it.each(['PENDING_REVIEW','IN_PROCESS','PREAPPROVED'])('labels %s as workflow rather than a proven fault',state=>expect(diagnoseMetaState('published',states(state),true).findings[0].location).toBe('Flux Meta'));
 it.each(['PAUSED','CAMPAIGN_PAUSED','ADSET_PAUSED','ARCHIVED','DELETED'])('labels %s as configuration rather than app error',state=>expect(diagnoseMetaState('published',states(state),true).findings[0].location).toBe('Configurație Meta'));
 it('detects a saved pause mismatch without changing anything',()=>{const before=states();expect(diagnoseMetaState('paused',before,true).findings[0]).toMatchObject({location:'Date CRM',reason:expect.stringContaining('ACTIVE')});expect(before).toEqual(states());});
 it.each(['draft','ready','publishing','error'])('reports local %s with existing hierarchy as CRM discrepancy',state=>expect(diagnoseMetaState(state,states(),true).findings[0].location).toBe('Date CRM'));
 it('reports simultaneous provider and CRM observations',()=>expect(diagnoseMetaState('error',states('DISAPPROVED'),true).findings.map(r=>r.location)).toEqual(['Meta','Date CRM']));
 it('does not blame either side when identifiers are missing',()=>expect(diagnoseMetaState('error',[],false).findings[0].location).toBe('Date insuficiente'));
 it('keeps partial evidence explicit',()=>expect(diagnoseMetaState('published',states().slice(0,1),false).findings[0].reason).toContain('doar campania'));
 it('does not turn ACTIVE into delivery confirmation',()=>expect(diagnoseMetaState('published',states(),true)).toMatchObject({deliveryConfirmed:false,findings:[{location:'Nicio problemă demonstrată de stări'}]}));
 it('does not treat a published paused hierarchy as a local mismatch',()=>{const rows=states().map(r=>({...r,status:'PAUSED',effectiveStatus:'PAUSED'}));expect(diagnoseMetaState('published',rows,true).findings[0].location).toBe('Configurație Meta');});
 it('recognizes the original Romanian request, not its negation',()=>{expect(metaStatusRequest('Spune-mi dacă problema este în imoDeus sau la Meta.')).toBe('diagnose');expect(metaStatusRequest('Nu spune-mi dacă problema este în imoDeus sau la Meta.')).toBeNull();});
});
