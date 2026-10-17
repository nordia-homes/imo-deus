import { describe, expect, it } from 'vitest';
import { metaControlAction, metaControlExecutionPrompt, metaControlRequest } from '../meta-control';
import { explicitlyRequestedSafeAction } from '../autonomy';
const action = { kind:'existing_operation', operation:'meta_campaign_pause',params:{campaignId:'c'},query:{},body:{jarvisPause:true,propertyId:'p',expectedRevision:'a'.repeat(64)}} as any;
it('requires an exact bound pause action',()=>{ expect(metaControlAction(action)).toBe(true); for(const body of [{...action.body,status:'DELETED'},{...action.body,expectedRevision:''},{propertyId:'p'}]) expect(metaControlAction({...action,body})).toBe(false); });
it.each(['Nu pune campania pe pauză.','Publică toate campaniile.','Nu opri celelalte campanii.','Oprește campania dacă am confirmat explicit.'])('does not authorize pause from %s',prompt=>{expect(explicitlyRequestedSafeAction(action,prompt)).toBe(false);});
it('authorizes the direct pause and normalizes Romanian diacritics',()=>{expect(metaControlRequest('Pune campania pe pauză.')).toBe('pause');expect(explicitlyRequestedSafeAction(action,'Pune campania pe pauză.')).toBe(true);});
it('does not treat an isolated or stale selection as authorization',()=>{expect(metaControlExecutionPrompt('Confirm pauza Meta: c',[])).toBe('Confirm pauza Meta: c');});
