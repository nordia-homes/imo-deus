// Independence is explicit in goal coverage; dependency references always take precedence.
export function independentStep(plan: {actions: unknown[];goal?:any}, index:number) {
 const action=plan.actions[index];
 if(!action || JSON.stringify(action).includes('@step:') || plan.goal?.schemaVersion!==1)return false;
 const requirements=plan.goal?.coverage?.requirements?.filter((row:any)=>row.steps?.includes(index+1));
 return Boolean(requirements?.length && requirements.every((row:any)=>row.independent===true && row.steps.length===1 && row.resolution==='planned' && row.execution?.mode==='execute' && row.execution.conditions?.length===0));
}
