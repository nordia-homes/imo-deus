import type { parseMetaPeriod } from '@/lib/meta-insights-period';
export type PerformanceEvidence = {id:string;objective:string;providerObjective:string|null;attribution:string;current:ReturnType<typeof parseMetaPeriod>};
/** Descriptive efficiency comparison, not a causal diagnosis or profitability forecast. */
export function assessMetaPerformance(rows:PerformanceEvidence[]) {
 const unknown=(reason:string)=>({weakerId:null as string|null,metric:null as string|null,reason,values:[] as Array<{id:string;costPerResult:number|null;results:number}>,recommendation:null as null|{change:string;reason:string;measurement:string;constraints:string;expectedOutcome:string},certainty:'Comparație descriptivă a perioadei raportate; fără semnificație statistică sau rentabilitate demonstrate.'});
 if(rows.length!==2||rows[0].id===rows[1].id)return unknown('Sunt necesare două campanii distincte.');
 const [a,b]=rows;
 if(a.objective!==b.objective||!['leads','traffic'].includes(a.objective))return unknown('Obiectivele diferă sau indicatorul rezultatului cerut de obiectiv nu este disponibil. Nu clasific apeluri sau mesaje după leaduri ori clicuri.');
 if(a.attribution!==b.attribution||a.current.currency!==b.current.currency||a.current.period.since!==b.current.period.since||a.current.period.until!==b.current.period.until)return unknown('Moneda, perioada sau atribuirea nu sunt comparabile.');
 const expectedObjective=a.objective==='leads'?['OUTCOME_LEADS','LEAD_GENERATION']:['OUTCOME_TRAFFIC','LINK_CLICKS'];
 if(rows.some(row=>!row.providerObjective||!expectedObjective.includes(row.providerObjective)))return unknown('Obiectivul Meta nu confirmă obiectivul configurat în CRM. Reverifică setările înainte de clasificare.');
 if(rows.some(row=>!row.current.dataAvailable||row.current.leadMetric!=='lead'))return unknown('Rapoartele sau definiția rezultatului nu sunt disponibile pentru ambele campanii.');
 const metric=a.objective==='leads'?'CPL':'CPC',key=a.objective==='leads'?'leads':'clicks';
 const values=rows.map(row=>{const spend=row.current.spend,results=row.current[key];return {id:row.id,spend,results,costPerResult:spend!==null&&results!==null&&results>0?spend/results:null};});
 if(values.some(row=>!Number.isFinite(row.spend)||row.spend===null||row.spend<=0||row.results===null||!Number.isSafeInteger(row.results)||row.results<0||row.costPerResult!==null&&!Number.isFinite(row.costPerResult)))return unknown('Lipsesc cheltuieli pozitive și rezultate valide pentru ambele campanii; nu transform datele lipsă în zero.');
 const [x,y]=values;
 const base={...unknown(''),metric,values:values.map(row=>({id:row.id,costPerResult:row.costPerResult,results:row.results!}))};
 if(x.results===0&&y.results===0)return {...base,reason:'Ambele campanii au cheltuieli și zero rezultate raportate. Nu există un câștigător după costul per rezultat.'};
 if(x.costPerResult!==null&&y.costPerResult!==null&&Math.abs(x.costPerResult-y.costPerResult)<=1e-9*Math.max(1,x.costPerResult,y.costPerResult))return {...base,reason:'Costul per rezultat este egal; nu desemnez o campanie mai slabă.'};
 const weaker=x.results===0?x:y.results===0?y:x.costPerResult!>y.costPerResult!?x:y;
 const weak=rows.find(row=>row.id===weaker.id)!;
 const reason=weaker.results===0?'Are cheltuieli pozitive și zero rezultate raportate, în timp ce cealaltă campanie are rezultate.':'Are '+metric+' mai mare în aceeași perioadă și monedă. Aceasta indică eficiență mai slabă numai după acest indicator.';
 const hasClicks=weak.current.clicks!==null&&weak.current.clicks>0;
 const change=a.objective==='leads'&&hasClicks
  ? 'Pregătește o variantă a formularului sau paginii de destinație cu cerințe de contact simplificate și mesaj concordant cu oferta proprietății. Verifică mai întâi că evenimentul lead este măsurat corect.'
  : 'Pregătește o variantă de reclamă schimbând numai imaginea principală cu o fotografie aprobată a aceleiași proprietăți. Păstrează textul și destinația pentru a izola schimbarea.';
 return {...base,weakerId:weaker.id,reason,recommendation:{change,reason:a.objective==='leads'&&hasClicks?'Există clicuri raportate; verificarea măsurării și testul conversiei după clic sunt ipoteze de lucru, nu cauze demonstrate.':'Costul rezultatului justifică un test controlat al materialului; datele nu demonstrează că imaginea este cauza.',measurement:'Compară '+metric+' și numărul de '+(key==='leads'?'leaduri':'clicuri')+' pe perioade complete egale, cu aceeași atribuire, înainte de a decide păstrarea variantei.',constraints:'Păstrează bugetul, moneda, audiența și obiectivul. Pregătirea recomandării nu aplică modificări și nu aprobă cheltuieli.',expectedOutcome:'Ipoteză de îmbunătățire; nu există un procent de creștere sau un rezultat garantat.'}};
}
