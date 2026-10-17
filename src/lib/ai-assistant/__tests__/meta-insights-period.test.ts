import { describe,it,expect } from 'vitest';
import { metaComparisonPeriods,parseMetaPeriod,metaMetricChanges } from '@/lib/meta-insights-period';
const expected={campaignId:'123',accountId:'456',currency:'EUR',period:{since:'2026-10-10',until:'2026-10-16'}};
const row={campaign_id:'123',account_id:'456',account_currency:'EUR',date_start:'2026-10-10',date_stop:'2026-10-16',spend:'120',impressions:'1000',clicks:'30',actions:[{action_type:'lead',value:'4'},{action_type:'onsite_conversion.lead_grouped',value:'4'}]};
describe('Meta period evidence',()=>{
 it.each(['2026-03-30T01:00:00Z','2026-10-26T01:00:00Z','2026-01-01T00:00:00Z'])('uses calendar days across DST/year boundaries %s',date=>{const periods=metaComparisonPeriods(new Date(date));expect(Date.parse(periods.current.until)-Date.parse(periods.current.since)).toBe(6*86400000);expect(Date.parse(periods.current.since)-Date.parse(periods.previous.until)).toBe(86400000);});
 it('uses Bucharest date before UTC midnight',()=>expect(metaComparisonPeriods(new Date('2026-10-16T22:00:00Z')).current).toEqual(expected.period));
 it('does not double count overlapping leads',()=>expect(parseMetaPeriod({data:[row]},expected)).toMatchObject({spend:120,leads:4,costPerLead:30}));
 it.each([undefined,null,'',-1,'NaN','Infinity',true])('does not turn invalid spend %s into zero',spend=>expect(parseMetaPeriod({data:[{...row,spend}]},expected).spend).toBeNull());
 it.each([undefined,[],[{action_type:'onsite_conversion.lead_grouped',value:'4'}],[{action_type:'lead',value:'4'},{action_type:'lead',value:'4'}],[{action_type:'lead',value:'1.5'}]])('does not invent aggregate leads from %j',actions=>expect(parseMetaPeriod({data:[{...row,actions}]},expected).leads).toBeNull());
 it('keeps explicit zero and avoids division by zero',()=>expect(parseMetaPeriod({data:[{...row,actions:[{action_type:'lead',value:'0'}]}]},expected)).toMatchObject({leads:0,costPerLead:null}));
 it('does not treat an empty report as no spend',()=>expect(parseMetaPeriod({data:[]},expected)).toMatchObject({spend:null,dataAvailable:false}));
 it.each([{campaign_id:'999'},{account_id:'999'},{account_currency:'RON'},{date_start:'2026-10-09'},{date_stop:'2026-10-15'}])('rejects wrong dimensions %j',patch=>expect(()=>parseMetaPeriod({data:[{...row,...patch}]},expected)).toThrow());
 it.each([{data:[row,row]},{data:[row],paging:{next:'https://example.invalid'}},{}])('rejects incomplete or ambiguous payload %j',payload=>expect(()=>parseMetaPeriod(payload,expected)).toThrow());
 it('calculates signed changes and leaves percent with zero base unavailable',()=>{const a=parseMetaPeriod({data:[row]},expected),b=parseMetaPeriod({data:[{...row,spend:'100',clicks:'0'}]},expected);expect(metaMetricChanges(a,b)).toMatchObject({spend:{difference:20,percent:20},clicks:{difference:30,percent:null}});});
});
