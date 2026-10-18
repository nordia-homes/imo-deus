import {expect,it} from 'vitest';
import {crmNameMatch} from '../crm-name-resolution';
import {independentStep} from '../independent-step';
it.each([['Cișmigiu','Cismigiu','exact'],['Cristian Avadanii','Croatian Avadanii','similar'],['Apartament Cișmigiu','apartament cismigiu','exact'],['Matei Alin','Alin Matei','exact'],['Rosetti 12','Rosetti 13',null],['Matei Andrei','Matei Alin',null]])('resolves %s / %s without changing numeric identities',(name,query,match)=>expect(crmNameMatch(name!,query!)).toBe(match));
it('never skips reference dependencies or conditional requirements',()=>{
 const goal={schemaVersion:1,coverage:{requirements:[{steps:[1],resolution:'planned',independent:true,execution:{mode:'execute',conditions:[]}}]}};
 expect(independentStep({actions:[{propertyId:'p'}],goal},0)).toBe(true);
 expect(independentStep({actions:[{propertyId:'@step:1:propertyId'}],goal},0)).toBe(false);
 expect(independentStep({actions:[{}],goal:{...goal,coverage:{requirements:[{...goal.coverage.requirements[0],execution:{mode:'execute',conditions:[{satisfied:true}]}}]}}},0)).toBe(false);
});
