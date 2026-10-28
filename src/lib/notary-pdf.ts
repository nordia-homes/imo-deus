import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { calculatePublicNotaryFees, type NotaryInputs } from './public-notary';

export async function createNotaryPdf(inputs: NotaryInputs, fontBytes: Uint8Array, options: { date?: Date; fallbackRate?: boolean } = {}) {
  const fees = calculatePublicNotaryFees(inputs);
  const date = options.date ?? new Date();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  pdf.setTitle('Estimare taxe notariale');
  pdf.setSubject('Detalierea costurilor unei tranzacții imobiliare');
  pdf.setCreationDate(date);
  const page = pdf.addPage([595.28, 841.89]);
  const ink = rgb(.07, .11, .12), muted = rgb(.36, .40, .41), gold = rgb(.65, .47, .21);
  const money = (value: number, currency = 'lei') => `${value.toLocaleString('ro-RO', { maximumFractionDigits: 2 })} ${currency}`;
  const text = (value: string, x: number, y: number, size = 10, color = ink) => page.drawText(value, { x, y, size, font, color });
  const right = (value: string, y: number, size = 11, color = ink) => text(value, 551 - font.widthOfTextAtSize(value, size), y, size, color);
  const line = (y: number) => page.drawLine({ start: { x: 44, y }, end: { x: 551, y }, thickness: .6, color: rgb(.86,.87,.85) });
  page.drawRectangle({ x: 0, y: 703, width: 595.28, height: 139, color: ink });
  text('PLANURI CLARE. DECIZII INFORMATE.', 44, 797, 9, rgb(.90,.75,.48));
  text('Taxele pentru noul tău acasă', 44, 758, 25, rgb(1,1,1));
  text('Estimare taxe notariale | Vânzare - cumpărare', 44, 730, 11, rgb(.79,.82,.81));
  text('DATELE TRANZACȚIEI', 44, 674, 10, gold);
  right(date.toLocaleDateString('ro-RO'), 674, 10, muted);
  const person = (value: string) => value === 'individual' ? 'Persoană fizică' : 'Persoană juridică';
  const details = [
    ['Prețul proprietății', money(inputs.price, inputs.currency === 'eur' ? 'EUR' : 'lei')],
    ['Curs valutar utilizat', `1 EUR = ${inputs.exchangeRate.toLocaleString('ro-RO', { maximumFractionDigits: 6 })} lei${options.fallbackRate ? ' (rezervă)' : ''}`],
    ['Perioada de deținere', inputs.ownershipDuration === 'over3' ? 'Peste 3 ani' : 'Sub 3 ani'],
    ['Cumpărător / Vânzător', `${person(inputs.buyerType)} / ${person(inputs.sellerType)}`],
    ['Ipotecă', inputs.mortgage ? money(inputs.mortgageValue, inputs.mortgageCurrency === 'eur' ? 'EUR' : 'lei') : 'Fără ipotecă'],
  ];
  let y = 646;
  for (const [label, value] of details) { text(label, 44, y, 10, muted); right(value, y, 10); y -= 25; }
  line(519);
  text('DETALIEREA TAXELOR', 44, 490, 10, gold);
  right('SUME ÎN LEI', 490, 9, muted);
  const rows: Array<[string, number]> = [
    ['Onorariu notarial vânzare, cu TVA', fees.notaryFee],
    ['Taxă ANCPI vânzare', fees.ancpiFee],
    ['Impozit datorat de vânzător', fees.saleTax],
    ...(inputs.mortgage ? [['Onorariu notarial ipotecă, cu TVA', fees.mortgageNotaryFee], ['Taxă ANCPI ipotecă', fees.mortgageAncpiFee]] as Array<[string, number]> : []),
    ['Extras de autentificare', fees.authenticationFee],
  ];
  y = 456;
  rows.forEach(([label, amount], index) => {
    if (index % 2 === 0) page.drawRectangle({ x: 36, y: y - 13, width: 523, height: 35, color: rgb(.97,.97,.95) });
    text(label, 44, y, 10); right(money(amount), y, 11); y -= 36;
  });
  const totalY = y - 73;
  page.drawRectangle({ x: 36, y: totalY, width: 523, height: 82, color: rgb(.96,.92,.83) });
  text('TOTAL ESTIMAT AL TRANZACȚIEI', 52, totalY + 54, 9, gold);
  const total = money(fees.totalFees);
  text(total, 52, totalY + 20, 25);
  text('Include impozitul vânzătorului.', 333, totalY + 27, 9, muted);
  text('Estimare orientativă, conform formulelor calculatorului notarului.', 44, 115, 9, muted);
  text('TVA de 19% inclus în onorarii. Sumele finale se confirmă cu notarul.', 44, 99, 9, muted);
  text('Sursă: notar-bucuresti.ro/calculator-taxe-notariale-vanzare', 44, 83, 8, muted);
  line(61);
  text('CALCULATOR TAXE NOTARIALE', 44, 40, 8, gold);
  right('1 / 1', 40, 8, muted);
  return pdf.save();
}

export async function downloadNotaryPdf(inputs: NotaryInputs, fallbackRate: boolean) {
  const response = await fetch('/fonts/manrope/Manrope.ttf');
  if (!response.ok) throw new Error('Fontul documentului nu a putut fi încărcat.');
  const bytes = await createNotaryPdf(inputs, new Uint8Array(await response.arrayBuffer()), { fallbackRate });
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `taxe-notariale-${new Date().toISOString().slice(0,10)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
