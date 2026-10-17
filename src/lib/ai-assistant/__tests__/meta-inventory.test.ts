import { expect,it } from 'vitest';
import { metaCampaignActivity,metaInventoryRequest } from '../meta-inventory';
it('recognizes the two original requests with Romanian diacritics',()=>{expect(metaInventoryRequest('Arată-mi campaniile Meta active.')).toBe('active');expect(metaInventoryRequest('Arată-mi proprietățile fără campanie activă.')).toBe('without');expect(metaInventoryRequest('Oprește campaniile active.')).toBeNull();});
it.each(['ACTIVE','PAUSED','ARCHIVED','DELETED','IN_PROCESS','WITH_ISSUES'])('separates actual activity from provider state %s',state=>{expect(metaCampaignActivity(state,state)).toBe(state==='ACTIVE'?'active':['PAUSED','ARCHIVED','DELETED'].includes(state)?'inactive':'unknown');});
it.each([['ACTIVE','PAUSED'],['PAUSED','ACTIVE'],['ACTIVE','WITH_ISSUES'],['ACTIVE','IN_PROCESS'],['',''],['UNKNOWN','UNKNOWN']])('does not claim inactivity from inconsistent %s/%s', (status,effective)=>{expect(metaCampaignActivity(status,effective)).toBe('unknown');});
