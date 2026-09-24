import fs from 'node:fs';
import dotenv from 'dotenv';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
dotenv.config({path:'.env.local',quiet:true});
initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n')})});
const db=getFirestore();
const agencies=await db.collection('agencies').select('name','customDomain','logoUrl','phone','email').get();
const matches=agencies.docs.filter(d=>/nordia/i.test(d.data().name||''));
console.log('Matching agencies:',matches.map(d=>({id:d.id,name:d.data().name})));
for(const agency of matches){
 const snap=await agency.ref.collection('properties').select('title','address','images').get();
 const hits=snap.docs.filter(d=>/conea/i.test(d.data().address||''));
 console.log('Matching properties:',hits.map(d=>({id:d.id,...d.data(),images:d.data().images?.length}))); 
 if(hits.length===1){
  const doc=await hits[0].ref.get();const raw=doc.data();
  const fields=['title','address','location','price','rooms','bathrooms','squareFootage','totalSurface','images','propertyType','transactionType','constructionYear','floor','totalFloors','partitioning','heatingSystem','kitchen','balconyTerrace','interiorState','city','zone','tagline','buyerCommissionValue','buyerCommissionType','agentName'];
  const property=Object.fromEntries(fields.filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]]));property.id=doc.id;
  let agent=null;if(raw.agentId){const a=(await db.collection('users').doc(raw.agentId).get()).data();if(a)agent={name:a.name,phone:a.phone,email:a.email};}
  const data={property,agency:{id:agency.id,...agency.data()},agent};
  fs.writeFileSync('tmp/presentation-real-source.json',JSON.stringify(data,null,2));
  console.log('Saved presentation-only source. Images:',property.images?.length,'Custom domain:',agency.data().customDomain||'none');
 }
}
