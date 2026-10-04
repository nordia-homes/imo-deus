import {it,expect} from 'vitest';
import {functionPayload} from '../function-tools';
import {actionSchema} from '../contracts';
it('normalizes only optional null fields in compound action payloads',()=>{
 const payload=functionPayload('propose_actions',JSON.stringify({payload:JSON.stringify({actions:[{kind:'create_contact',name:'Client',phone:'0123456789',email:null,contactType:'Cumparator'},{kind:'schedule_viewing',contactId:'@step:1:contactId',propertyId:'p1',viewingDate:'2027-01-01T12:00:00Z',duration:null,notes:null}]})}));
 expect(actionSchema.parse(payload.actions[0]).email).toBe('');
 expect(actionSchema.parse(payload.actions[1])).toMatchObject({duration:60,notes:''});
 expect(()=>actionSchema.parse(functionPayload('propose_actions',JSON.stringify({payload:JSON.stringify({actions:[{kind:'create_contact',name:null}]})})).actions[0])).toThrow();
});
