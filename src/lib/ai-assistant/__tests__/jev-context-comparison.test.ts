import {it,expect} from 'vitest';import fs from 'node:fs';
import {selectCapabilities,visibleTools} from '../capability-catalog';import {coreToolSchemas,actionToolSchemas} from '../tool-schemas';import {functionDefinition} from '../function-tools';import {buildInstructions} from '../policy';
it('compares identical policy inputs and the complete catalog against modular contexts',()=>{
 const names=[...Object.keys(coreToolSchemas),...Object.keys(actionToolSchemas)].filter(name=>name!=='load_capabilities');
 const ctx={uid:'synthetic',role:'admin'} as any;
 const inputs=['Salut','Găsește apartamente în Titan sub 130000 euro','Programează o vizionare pentru apartamentul Cișmigiu cu Matei Alin mâine la 07:30'];
 const rows=inputs.map(prompt=>{const modules=selectCapabilities(prompt),selected=visibleTools([...names,'load_capabilities'],modules,prompt);const common={memory:[],readiness:{}};
 const baseline=buildInstructions(ctx,{...common,allowedTools:names}),modular=buildInstructions(ctx,{...common,allowedTools:selected,modules});
 const baselineBytes=Buffer.byteLength(baseline+JSON.stringify(names.map(functionDefinition))+prompt),modularBytes=Buffer.byteLength(modular+JSON.stringify(selected.map(functionDefinition))+prompt);
 expect(modularBytes).toBeLessThan(baselineBytes);return {prompt,baselineBytes,modularBytes,reductionPercent:Number((100*(1-modularBytes/baselineBytes)).toFixed(1))};});
 fs.writeFileSync('docs/jarvis/evals/JEV_CONTEXT_COMPARISON.json',JSON.stringify({scope:'Full-catalog policy versus modular assembly with identical synthetic inputs. Not an A/B production planner benchmark or billable-token measurement. Dynamic planner catalog metadata and history not included.',liveProviderCalls:0,jevIncrementalSpeedOrCostBenefitMeasured:false,rows},null,2)+'\n');
});
