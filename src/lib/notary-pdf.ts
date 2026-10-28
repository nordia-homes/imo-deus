import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { calculatePublicNotaryFees, splitNotaryCosts, type NotaryInputs } from './public-notary';

export async function createNotaryPdf(inputs: NotaryInputs, fontBytes: Uint8Array, options: { date?: Date; fallbackRate?: boolean; boldFontBytes?: Uint8Array } = {}) {
  const fees = calculatePublicNotaryFees(inputs);
  const { buyerTotal, sellerTotal } = splitNotaryCosts(fees);
  const date = options.date ?? new Date();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const bold = options.boldFontBytes ? await pdf.embedFont(options.boldFontBytes, { subset: true }) : font;
  pdf.setTitle('Taxe notariale - costuri cumpărător și vânzător');
  pdf.setCreationDate(date);
  const page = pdf.addPage([595.28, 841.89]);
  const ink = rgb(0,0,0), muted = ink, gold = rgb(.88,.66,.27);
  const money = (value: number, currency = 'lei') => `${value.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} ${currency}`;
  const text = (value: string, x: number, y: number, size = 11, color = ink, face: PDFFont = font) => page.drawText(value, { x, y, size, font: face, color });
  const right = (value: string, y: number, size = 11, color = ink, face: PDFFont = bold) => text(value, 551 - face.widthOfTextAtSize(value, size), y, size, color, face);
  const rule = (y: number) => page.drawLine({ start: {x:44,y}, end:{x:551,y}, thickness:.6, color:rgb(.78,.80,.79) });
  page.drawRectangle({x:0,y:733,width:595.28,height:109,color:rgb(.06,.10,.11)});
  text('TAXELE PENTRU NOUL TĂU ACASĂ',44,803,11,gold,bold);
  text('Cine plătește. Cât plătește.',44,768,25,rgb(1,1,1),bold);
  text('Estimare taxe notariale | Vânzare - cumpărare',44,747,10,rgb(.86,.88,.87));
  text('DATELE TRANZACȚIEI',44,709,11,ink,bold);
  right(date.toLocaleDateString('ro-RO'),709,10,muted,font);
  const person = (value: string) => value === 'individual' ? 'Persoană fizică' : 'Persoană juridică';
  const details = [
    ['Prețul proprietății',money(inputs.price,inputs.currency === 'eur' ? 'EUR':'lei')],
    ['Curs utilizat',`1 EUR = ${inputs.exchangeRate.toLocaleString('ro-RO',{maximumFractionDigits:6})} lei${options.fallbackRate?' (rezervă)':''}`],
    ['Deținere / Ipotecă',`${inputs.ownershipDuration==='over3'?'Peste 3 ani':'Sub 3 ani'} / ${inputs.mortgage ? money(inputs.mortgageValue,inputs.mortgageCurrency==='eur'?'EUR':'lei'):'Fără ipotecă'}`],
    ['Cumpărător',person(inputs.buyerType)], ['Vânzător',person(inputs.sellerType)],
  ];
  let y=683;
  details.forEach(([label,value]) => {text(label,44,y,11,muted);right(value,y);y-=22;});
  rule(579);
  text('COSTURI CUMPĂRĂTOR',44,555,13,ink,bold);
  const rows: Array<[string,number]> = [
    ['Onorariu notarial vânzare, cu TVA',fees.notaryFee], ['Taxă ANCPI vânzare',fees.ancpiFee], ['Extras de autentificare',fees.authenticationFee],
    ...(inputs.mortgage ? [['Onorariu notarial ipotecă, cu TVA',fees.mortgageNotaryFee],['Taxă ANCPI ipotecă',fees.mortgageAncpiFee]] as Array<[string,number]> : []),
  ];
  y=528;
  rows.forEach(([label,value],i) => {
    if(i%2===0) page.drawRectangle({x:36,y:y-9,width:523,height:28,color:rgb(.95,.96,.95)});
    text(label,44,y,11);right(money(value),y,12);y-=29;
  });
  const totalBar = (label: string, value: number, top: number) => {
    page.drawRectangle({x:36,y:top-47,width:523,height:47,color:gold});
    text(label,48,top-28,12,ink,bold);right(money(value),top-30,21);
  };
  totalBar('TOTAL CUMPĂRĂTOR',buyerTotal,y+6);
  y-=70; text('COSTURI VÂNZĂTOR',44,y,13,ink,bold);
  y-=28; text('Impozit datorat de vânzător',44,y,11);right(money(fees.saleTax),y,12);
  y-=23; totalBar('TOTAL VÂNZĂTOR',sellerTotal,y);
  y-=77; text('Total tranzacție (ambele părți)',44,y,11,muted);right(money(fees.totalFees),y,13);
  text('Repartizare orientativă. Părțile pot conveni altfel pentru costurile contractuale.',44,113,9,muted);
  text('TVA de 19% inclus în onorarii. Sumele finale se confirmă cu notarul.',44,97,9,muted);
  text('Sursă: notar-bucuresti.ro/calculator-taxe-notariale-vanzare',44,81,9,muted);
  rule(61);text('CALCULATOR TAXE NOTARIALE',44,40,9,ink,bold);right('1 / 1',40,9,muted,font);
  return pdf.save();
}

export async function downloadNotaryPdf(inputs: NotaryInputs, fallbackRate: boolean) {
  const fonts = await Promise.all(['Medium','Bold'].map(async weight => {
    const response = await fetch(`/fonts/manrope/Manrope-${weight}.ttf`);
    if(!response.ok) throw new Error('Fontul documentului nu a putut fi încărcat.');
    return new Uint8Array(await response.arrayBuffer());
  }));
  const bytes = await createNotaryPdf(inputs,fonts[0],{fallbackRate,boldFontBytes:fonts[1]});
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));
  const anchor = document.createElement('a');
  anchor.href=url;anchor.download=`taxe-notariale-${new Date().toISOString().slice(0,10)}.pdf`;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
