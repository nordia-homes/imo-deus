'use server';

import type { Agency, Contact, Property, UserProfile, Viewing } from '@/lib/types';
import { isArchivedContact } from '@/lib/contact-aging';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_ASSISTANT_MODEL = process.env.OPENAI_ASSISTANT_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';

type ChatHistoryMessage = {
  role: 'user' | 'model';
  content: Array<{ text: string }>;
};

interface ChatInput {
  history: ChatHistoryMessage[];
  prompt: string;
  contacts?: Contact[];
  properties?: Property[];
  viewings?: Viewing[];
  agency?: Agency;
  user?: UserProfile;
}

interface ChatOutput {
  response: string;
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  const textParts = outputs.flatMap((entry: any) => {
    const content = Array.isArray(entry?.content) ? entry.content : [];
    return content
      .map((item: any) => {
        if (typeof item?.text === 'string') return item.text;
        if (typeof item?.output_text === 'string') return item.output_text;
        if (typeof item?.content?.[0]?.text === 'string') return item.content[0].text;
        return '';
      })
      .filter((text: string) => text.trim().length > 0);
  });

  return textParts.join('\n').trim();
}

function getTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function buildContext(input: ChatInput) {
  const now = new Date();
  const nowTime = now.getTime();
  const activeContacts = (input.contacts || []).filter((contact) => !isArchivedContact(contact));
  const archivedContacts = (input.contacts || []).filter((contact) => isArchivedContact(contact));
  const activeProperties = (input.properties || []).filter((property) => property.status === 'Activ');
  const propertiesNeedingWork = activeProperties.filter(
    (property) => (property.images?.length || 0) < 8 || (property.description?.trim().length || 0) < 180
  );
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setDate(tomorrow.getDate() + 1);
  const next24Hours = new Date(nowTime + 24 * 60 * 60 * 1000);

  const todayViewings = (input.viewings || []).filter((viewing) => {
    const time = getTime(viewing.viewingDate);
    return viewing.status === 'scheduled' && time !== null && time >= today.getTime() && time < tomorrow.getTime();
  });
  const tomorrowViewings = (input.viewings || []).filter((viewing) => {
    const time = getTime(viewing.viewingDate);
    return viewing.status === 'scheduled' && time !== null && time >= tomorrow.getTime() && time < tomorrowEnd.getTime();
  });

  const remainingTodayViewings = todayViewings.filter((viewing) => {
    const time = getTime(viewing.viewingDate);
    return time !== null && time >= nowTime;
  });

  const passedTodayViewings = todayViewings.filter((viewing) => {
    const time = getTime(viewing.viewingDate);
    return time !== null && time < nowTime;
  });

  const next24HourViewings = (input.viewings || []).filter((viewing) => {
    const time = getTime(viewing.viewingDate);
    return viewing.status === 'scheduled' && time !== null && time >= nowTime && time < next24Hours.getTime();
  });

  const upcomingViewingWindows = (input.viewings || [])
    .filter((viewing) => viewing.status === 'scheduled')
    .map((viewing) => {
      const time = getTime(viewing.viewingDate);
      if (time === null) return null;
      const date = new Date(time);
      const hour = date.getHours();
      let bucket = 'later';

      if (time >= today.getTime() && time < tomorrow.getTime()) {
        bucket = 'today';
      } else if (time >= tomorrow.getTime() && time < tomorrowEnd.getTime()) {
        if (hour < 12) bucket = 'tomorrow_morning';
        else if (hour < 17) bucket = 'tomorrow_afternoon';
        else bucket = 'tomorrow_evening';
      }

      return {
        contactName: viewing.contactName,
        propertyTitle: viewing.propertyTitle,
        viewingDate: viewing.viewingDate,
        bucket,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 30);

  const stalledFollowUpContacts = activeContacts
    .filter((contact) => !['Nou', 'Pierdut', 'Câștigat'].includes(contact.status))
    .map((contact) => {
      const interactionTimes = (contact.interactionHistory || [])
        .map((entry) => getTime(entry.date))
        .filter((value): value is number => value !== null);
      const offerTimes = (contact.offers || [])
        .map((offer) => getTime(offer.date))
        .filter((value): value is number => value !== null);
      const latestTime = Math.max(0, ...interactionTimes, ...offerTimes, getTime(contact.createdAt) || 0);
      const hoursWithoutAction = latestTime ? Math.floor((Date.now() - latestTime) / (1000 * 60 * 60)) : null;
      return {
        name: contact.name,
        status: contact.status,
        budget: contact.budget || 0,
        city: contact.city || null,
        hoursWithoutAction,
      };
    })
    .filter((contact) => (contact.hoursWithoutAction || 0) >= 72)
    .sort((left, right) => (right.hoursWithoutAction || 0) - (left.hoursWithoutAction || 0))
    .slice(0, 15);

  const negotiationContacts = activeContacts
    .filter((contact) => contact.status === 'În negociere')
    .map((contact) => ({
      name: contact.name,
      budget: contact.budget || 0,
      offers: contact.offers?.length || 0,
      city: contact.city || null,
    }))
    .slice(0, 12);

  const viewingReadyContacts = activeContacts
    .filter((contact) => ['Contactat', 'Interesat', 'Vizionare'].includes(contact.status))
    .map((contact) => ({
      name: contact.name,
      status: contact.status,
      budget: contact.budget || 0,
      city: contact.city || null,
      interactions: contact.interactionHistory?.length || 0,
    }))
    .slice(0, 20);

  const contactsSummary = activeContacts.slice(0, 80).map((contact) => ({
    name: contact.name,
    status: contact.status,
    budget: contact.budget || 0,
    priority: contact.priority || null,
    city: contact.city || null,
    offers: contact.offers?.length || 0,
    interactions: contact.interactionHistory?.length || 0,
    createdAt: contact.createdAt || null,
  }));

  const propertiesSummary = activeProperties.slice(0, 60).map((property) => ({
    title: property.title,
    status: property.status,
    price: property.price,
    images: property.images?.length || 0,
    descriptionLength: property.description?.trim().length || 0,
    rooms: property.rooms,
    zone: property.zone || null,
  }));

  return {
    todayIso: now.toISOString(),
    currentTime: {
      iso: now.toISOString(),
      locale: Intl.DateTimeFormat('ro-RO', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'Europe/Bucharest',
      }).format(now),
      timezone: 'Europe/Bucharest',
    },
    agency: input.agency ? { name: input.agency.name } : null,
    user: input.user ? { name: input.user.name, role: input.user.role || 'agent' } : null,
    counts: {
      activeContacts: activeContacts.length,
      archivedContacts: archivedContacts.length,
      activeProperties: activeProperties.length,
      propertiesNeedingWork: propertiesNeedingWork.length,
      scheduledToday: todayViewings.length,
      remainingTodayViewings: remainingTodayViewings.length,
      passedTodayViewings: passedTodayViewings.length,
      scheduledTomorrow: tomorrowViewings.length,
      next24HourViewings: next24HourViewings.length,
      stalledFollowUpContacts: stalledFollowUpContacts.length,
      negotiationsInProgress: negotiationContacts.length,
    },
    todayViewings: todayViewings.slice(0, 20).map((viewing) => ({
      contactName: viewing.contactName,
      propertyTitle: viewing.propertyTitle,
      viewingDate: viewing.viewingDate,
    })),
    remainingTodayViewings: remainingTodayViewings.slice(0, 20).map((viewing) => ({
      contactName: viewing.contactName,
      propertyTitle: viewing.propertyTitle,
      viewingDate: viewing.viewingDate,
    })),
    passedTodayViewings: passedTodayViewings.slice(0, 20).map((viewing) => ({
      contactName: viewing.contactName,
      propertyTitle: viewing.propertyTitle,
      viewingDate: viewing.viewingDate,
    })),
    tomorrowViewings: tomorrowViewings.slice(0, 20).map((viewing) => ({
      contactName: viewing.contactName,
      propertyTitle: viewing.propertyTitle,
      viewingDate: viewing.viewingDate,
    })),
    next24HourViewings: next24HourViewings.slice(0, 20).map((viewing) => ({
      contactName: viewing.contactName,
      propertyTitle: viewing.propertyTitle,
      viewingDate: viewing.viewingDate,
    })),
    upcomingViewingWindows,
    contacts: contactsSummary,
    properties: propertiesSummary,
    stalledFollowUpContacts,
    negotiations: negotiationContacts,
    viewingReadyContacts,
    propertiesNeedingWork: propertiesNeedingWork.slice(0, 20).map((property) => ({
      title: property.title,
      price: property.price,
      images: property.images?.length || 0,
      descriptionLength: property.description?.trim().length || 0,
      zone: property.zone || null,
    })),
  };
}

function buildFallback(input: ChatInput, reason?: string): string {
  const activeContacts = (input.contacts || []).filter((contact) => !isArchivedContact(contact));
  const activeProperties = (input.properties || []).filter((property) => property.status === 'Activ');
  const scheduledViewings = (input.viewings || []).filter((viewing) => viewing.status === 'scheduled');

  return [
    'Lucrez momentan cu fallback local, nu cu răspuns OpenAI live.',
    ...(reason ? [`Motiv: ${reason}`, ''] : ['']),
    '',
    `Ai ${activeContacts.length} lead-uri active, ${activeProperties.length} proprietăți active și ${scheduledViewings.length} vizionări programate.`,
    '',
    'Dacă vrei valoare imediată, cere-mi una dintre acestea:',
    '- "Spune-mi care sunt primele 3 lead-uri pe care trebuie să le sun azi și de ce."',
    '- "Scrie-mi un mesaj WhatsApp care mută clientul spre vizionare."',
    '- "Arată-mi unde pierdem acum în pipeline și ce fac azi."',
    '- "Spune-mi ce proprietăți active trebuie promovate sau corectate urgent."',
  ].join('\n');
}

export async function chat(input: ChatInput): Promise<ChatOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { response: buildFallback(input, 'Cheia OPENAI_API_KEY nu este încărcată în procesul Next.js.') };
  }

  const context = buildContext(input);
  const historyLines = input.history.slice(-8).map((message) => {
    const text = message.content.map((part) => part.text).join('\n');
    return `${message.role === 'model' ? 'Asistent' : 'Utilizator'}: ${text}`;
  });

  const systemPrompt = [
    'Ești creierul comercial și operațional al unei agenții imobiliare din România.',
    'Scrii în română.',
    'Gândești și răspunzi ca un agent imobiliar senior excepțional, cu zeci de ani de experiență reală în vânzări, listare, follow-up, negociere, calificare, repoziționare de portofoliu și disciplină de pipeline.',
    'Acționezi ca un om care trăiește din tranzacții închise, nu din rapoarte frumoase.',
    'Te comporți ca o combinație între closer comercial, secretară executivă de teren și manager de vânzări foarte bun.',
    'Nu suna ca un chatbot generic. Nu scrie corporatist. Nu scrie vag. Nu scrie academic.',
    'Fii concis, foarte specific, foarte practic și orientat pe pași care produc rezultat comercial.',
    'Folosește exclusiv contextul CRM furnizat.',
    'Ține cont că unele lead-uri sunt arhivate și nu trebuie tratate ca lead-uri active.',
    'Obiectivul tău central este unul singur: creșterea agresivă a vânzărilor prin prioritizare bună, timing bun, follow-up bun, vizionări bine pregătite, negocieri mișcate și proprietăți bine poziționate.',
    'Gândești această meserie din toate unghiurile: psihologie client, timing, fricțiune operațională, calitate listare, ritm de follow-up, momentul apelului, momentul mesajului, pregătirea unei vizionări, readucerea unui lead în joc și trecerea lui în etapa următoare.',
    'Când recomanzi acțiuni, prioritizează în ordinea asta: 1. lead-uri aproape de pasul următor, 2. vizionări care trebuie confirmate, pregătite sau monetizate prin follow-up, 3. negocieri care pot fi deblocate, 4. proprietăți active care frânează conversia, 5. igiena de pipeline.',
    'Când utilizatorul cere analiză, nu te limita la observații. Spune clar: ce se întâmplă, de ce contează comercial, ce facem azi, ce facem în următoarele 24-48h și ce rezultat urmărim.',
    'Când utilizatorul cere mesaje sau follow-up, scrie ca un agent foarte bun de vânzări: natural, ferm, cald, scurt, fără fraze artificiale, cu pas următor clar și cu presiune comercială sănătoasă.',
    'Când utilizatorul cere prioritizare, dă un top clar ordonat după impact comercial imediat și explică de ce acel contact sau acea proprietate merită timpul acum.',
    'Când utilizatorul cere despre proprietăți, gândește-te ca un agent care vrea mai multe vizionări și oferte: media, descriere, claritate, diferențiere, preț, lipsă de tracțiune, potrivire cu cererea activă.',
    'Dacă vezi riscuri sau blocaje, numește-le direct și spune ce acțiune concretă le rezolvă.',
    'Nu inventa date lipsă. Dacă CRM-ul nu confirmă ceva, spune asta scurt și mergi pe cea mai bună inferență posibilă.',
    'Nu enumera toate datele din context dacă nu ajută. Selectează doar ce produce decizie mai bună.',
    'Când răspunzi, folosește de regulă această structură mentală: diagnostic scurt, prioritate, acțiuni concrete, rezultat urmărit.',
    'Gândește absolut fiecare răspuns ca un om care își pune întrebări reale de teren: merită sunat acum sau mai târziu, merită mesaj sau apel, merită împins spre vizionare sau încă trebuie calificat, merită negociere sau repoziționare.',
    'Folosește explicit currentTime din context ca referință de adevăr pentru "acum".',
    'O vizionare programată mai devreme în aceeași zi, dar înainte de currentTime, nu mai este upcoming; trateaz-o ca vizionare trecută și gândește follow-up sau feedback, nu confirmare.',
    'Când vorbești despre "următoarele 24 de ore", folosește doar next24HourViewings, nu toate vizionările din ziua curentă.',
    'Când vorbești despre "mai târziu azi", folosește remainingTodayViewings.',
    'Când vorbești despre "ce a trecut deja azi", folosește passedTodayViewings.',
    'Regulă operațională importantă pentru confirmări: dacă acum este seară și vizionarea este mâine după ora 12:00, confirmarea se face mâine dimineață, nu în seara precedentă.',
    'Regulă operațională importantă pentru confirmări: dacă vizionarea este după ora 11:00, confirmarea se face întotdeauna în ziua vizionării.',
    'Respectă aceste reguli când recomanzi apeluri, mesaje de confirmare sau priorități pentru vizionări.',
    'Regulă operațională importantă pentru follow-up după vizionare: dacă vizionarea a avut loc astăzi, follow-up-ul se face cel mai devreme mâine, niciodată în aceeași zi cu vizionarea.',
    'Pentru follow-up după vizionare, gândește foarte fin momentul: uneori follow-up în aceeași zi dacă interesul e cald, uneori a doua zi dimineață dacă vizionarea a fost seara, uneori apel înainte de a se răci interesul. Nu da reguli mecanice; decide în funcție de moment și etapă.',
    'Pentru follow-up înainte de vizionare, gândește diferențiat: dacă vizionarea e azi, confirmarea trebuie să reducă riscul de no-show; dacă e mâine dimineață, confirmarea trebuie făcută suficient de devreme; dacă e mâine după-amiază, ritmul de confirmare poate fi diferit. Ține cont de timing, nu răspunde generic.',
    'Când ai contexte despre vizionări programate, folosește bucket-urile de timp furnizate și gândește concret ce se face pentru today, tomorrow_morning, tomorrow_afternoon sau tomorrow_evening.',
    'Pentru lead-uri reci, nu propune doar "urmărește". Spune exact cum încerci să le readuci în joc: apel, mesaj, ofertă alternativă, schimbare de unghi sau închidere curată.',
    'Pentru lead-uri bune, obiectivul este mereu mișcarea spre pasul următor: apel, vizionare, ofertă, negociere sau decizie.',
    'Pentru negocieri, gândește ca un closer: clarifică blocajul, scoate următorul pas, evită stagnarea și cere poziționare fermă.',
    'Dacă utilizatorul cere o viziune de ansamblu, gândește-te ca un geniu al imobiliarelor: vezi simultan lead-urile, proprietățile, ritmul, urgența, timingul și leverage-ul comercial.',
    'Dacă utilizatorul cere programarea unei vizionări și ai suficiente date, poți încheia răspunsul cu un bloc exact în formatul:',
    '[ACTION:scheduleViewing]',
    '{"propertyTitle":"...","contactName":"...","isoDateTime":"..."}',
    '[/ACTION]',
    'Când o etapă din funnel e slabă, descrie pierderea înainte de a intra în acea etapă, nu ca și cum lead-urile au ajuns deja acolo.',
    'Dacă utilizatorul întreabă pe cine să sune, răspunde ca un manager comercial foarte bun: ordonează lead-urile și explică de ce fiecare merită timpul acum.',
    'Dacă utilizatorul cere oportunități, vorbește despre leverage comercial real: follow-up mai rapid, vizionări, negociere, ofertare, repoziționare de portofoliu. Nu vorbi despre investiții în surse de lead decât dacă utilizatorul cere explicit marketing.',
  ].join('\n');

  const prompt = [
    systemPrompt,
    '',
    'Context CRM:',
    JSON.stringify(context, null, 2),
    '',
    'Istoric conversație:',
    historyLines.length > 0 ? historyLines.join('\n') : 'Fără istoric.',
    '',
    `Cererea utilizatorului: ${input.prompt}`,
  ].join('\n');

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_ASSISTANT_MODEL,
        input: prompt,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Assistant chat failed with status ${response.status}: ${errorText}`);
      }

      const payload = await response.json();
      const text = extractResponseText(payload);
    return { response: text || buildFallback(input, 'OpenAI a răspuns fără text util pentru acest mesaj.') };
  } catch (error) {
    console.error('OpenAI assistant chat failed, using fallback:', error);
    const reason = error instanceof Error ? error.message : 'Eroare necunoscută la apelul OpenAI.';
    return { response: buildFallback(input, reason) };
  }
}
