import fs from 'node:fs';
const project='studio-652232171-42fb6';
const agencyId='lTLGa8vkfrQOEZQ9iQwW';
const base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const res=await fetch(`${base}/agencies/${agencyId}:runQuery`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:'properties'}],where:{fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:{stringValue:'Activ'}}},select:{fields:['title','address','images','price','rooms','bathrooms','squareFootage','totalSurface','propertyType','transactionType','constructionYear','partitioning','city','zone','location','agentName','buyerCommissionValue','buyerCommissionType'].map(fieldPath=>({fieldPath}))},limit:100}}),signal:AbortSignal.timeout(20000)});
const data=await res.json();
if(!res.ok){console.log('Public query:',res.status,data.error?.message);process.exit(1)}
const val=v=>'stringValue'in v?v.stringValue:'integerValue'in v?Number(v.integerValue):'doubleValue'in v?v.doubleValue:'booleanValue'in v?v.booleanValue:'mapValue'in v?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,v])=>[k,val(v)])):'arrayValue'in v?(v.arrayValue.values||[]).map(val):null;
const docs=data.filter(r=>r.document).map(r=>({id:r.document.name.split('/').pop(),...Object.fromEntries(Object.entries(r.document.fields).map(([k,v])=>[k,val(v)]))}));
const hits=docs.filter(d=>/conea/i.test(d.address||'') || /conea/i.test(d.title||''));
console.log('Public listing count:',docs.length,'Property matches:',hits.map(p=>({id:p.id,title:p.title,address:p.address,images:p.images?.length,price:p.price})));
if(hits.length===1){fs.writeFileSync('tmp/presentation-real-source.json',JSON.stringify({property:hits[0],agency:{id:agencyId,name:'Nordia Homes',customDomain:'nordia.ro'},agent:{name:'Mirela',phone:'+40 744 128 805',email:'nordia.vanzari@gmail.com'},publicPropertyUrl:`https://nordia.ro/properties/${hits[0].id}`},null,2));}
