import type { Property } from '@/lib/types';
import type { PropertySalesContext } from '@/lib/property-sales-context';

export type PropertyPublicPerformance = {
  views: number;
  favorites: number;
  favoriteAdds: number;
};

export type SalesRecommendationPriority = 'critical' | 'high' | 'medium';

export type SalesRecommendation = {
  id: string;
  category: 'Conversie' | 'Preț' | 'Conținut' | 'Distribuție' | 'Date';
  priority: SalesRecommendationPriority;
  title: string;
  reason: string;
  action: string;
  impact: string;
  penalty: number;
};

export type PropertySalesAnalysis = {
  score: number;
  summary: string;
  recommendations: SalesRecommendation[];
};

type AnalysisInput = {
  property: Property;
  stats?: PropertyPublicPerformance | null;
  scheduledViewings?: number;
  completedViewings?: number;
  context?: PropertySalesContext | null;
  now?: Date;
};

const priorityRank: Record<SalesRecommendationPriority, number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizedTransaction(value: string) {
  return value.toLocaleLowerCase('ro-RO').includes('înch') || value.toLocaleLowerCase('ro-RO').includes('inch')
    ? 'închiriere'
    : 'vânzare';
}

export function buildPropertySalesAnalysis({
  property,
  stats,
  scheduledViewings = 0,
  completedViewings = 0,
  context = null,
  now = new Date(),
}: AnalysisInput): PropertySalesAnalysis {
  const recommendations: SalesRecommendation[] = [];
  const transaction = normalizedTransaction(property.transactionType);
  const goal = transaction === 'vânzare' ? 'vânzarea' : 'închirierea';
  const imagesCount = property.images?.filter((image) => Boolean(image.url)).length ?? 0;
  const descriptionLength = property.description?.trim().length ?? 0;
  const titleLength = property.title?.trim().length ?? 0;
  const propertyType = property.propertyType?.toLocaleLowerCase('ro-RO') || '';
  const isApartment = propertyType.includes('apart');
  const createdAt = parseDate(property.createdAt);
  const ageDays = createdAt
    ? Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000))
    : null;
  const views = Math.max(0, context?.publicStats.views ?? stats?.views ?? 0);
  const favoriteAdds = Math.max(0, context?.publicStats.favoriteAdds ?? stats?.favoriteAdds ?? 0);
  const favoriteRate = views > 0 ? favoriteAdds / views : 0;
  const hasPerformanceData = context?.publicStats.available ?? Boolean(stats);
  const scheduledCount = context?.viewings.scheduled ?? scheduledViewings;
  const completedCount = context?.viewings.completed ?? completedViewings;
  const publishedPortals = context?.portals.published.length ?? Object.values(property.promotions ?? {})
    .filter((promotion) => promotion?.status === 'published').length;
  const fallbackAdSpend = Object.values(property.advertisingCosts ?? {})
    .filter((value): value is number => typeof value === 'number')
    .reduce((total, value) => total + Math.max(0, value), 0);
  const knownAdSpend = context?.metaAds.available
    ? context.metaAds.spend + Math.max(0, Number(property.advertisingCosts?.google) || 0) + Math.max(0, Number(property.advertisingCosts?.tiktok) || 0)
    : fallbackAdSpend;

  const add = (recommendation: SalesRecommendation) => recommendations.push(recommendation);

  if (imagesCount < 8) {
    add({
      id: 'photo-pack',
      category: 'Conținut',
      priority: imagesCount < 4 ? 'critical' : 'high',
      title: 'Refă pachetul foto înainte de următorul val de promovare',
      reason: `Anunțul are ${imagesCount} ${imagesCount === 1 ? 'fotografie' : 'fotografii'}; cumpărătorul nu primește suficiente dovezi vizuale pentru a lua decizia de vizionare.`,
      action: 'Publică 12–18 cadre luminoase, cu fotografia principală orientată pe cel mai vandabil spațiu, apoi exteriorul, zona de zi, dormitoarele și detaliile diferențiatoare.',
      impact: 'Impact foarte ridicat asupra accesărilor și solicitărilor de vizionare',
      penalty: imagesCount < 4 ? 22 : 15,
    });
  } else if (imagesCount < 12) {
    add({
      id: 'photo-depth',
      category: 'Conținut',
      priority: 'medium',
      title: 'Completează povestea vizuală a proprietății',
      reason: `${imagesCount} fotografii oferă o prezentare decentă, dar lasă loc pentru obiecții și întrebări înainte de contact.`,
      action: 'Adaugă cadre pentru acces, vedere, depozitare, baie, balcon/terasă și împrejurimi; păstrează primele cinci imagini fără cadre redundante.',
      impact: 'Impact mediu asupra timpului petrecut în anunț',
      penalty: 7,
    });
  }

  if (descriptionLength < 350) {
    add({
      id: 'description',
      category: 'Conținut',
      priority: descriptionLength < 120 ? 'high' : 'medium',
      title: 'Transformă descrierea într-un argument de cumpărare',
      reason: `Descrierea are ${descriptionLength} caractere și nu exploatează suficient beneficiile, diferențiatorii și răspunsurile la obiecții.`,
      action: `Rescrie primele 160 de caractere cu beneficiul principal, apoi adaugă dovada, profilul cumpărătorului ideal și un îndemn clar pentru ${goal} rapidă.`,
      impact: 'Impact ridicat asupra conversiei din vizită în contact',
      penalty: descriptionLength < 120 ? 14 : 9,
    });
  }

  if (titleLength > 92 || titleLength < 35) {
    add({
      id: 'title',
      category: 'Conținut',
      priority: 'medium',
      title: 'Optimizează titlul pentru scanare și căutare',
      reason: titleLength > 92
        ? 'Titlul este prea lung și mesajul comercial esențial riscă să fie trunchiat în liste și pe mobil.'
        : 'Titlul este prea scurt pentru a comunica avantajul competitiv și criteriile importante de căutare.',
      action: 'Folosește 55–80 de caractere: tip + zonă + avantajul unic + un criteriu puternic, fără repetiții sau majuscule inutile.',
      impact: 'Impact mediu asupra ratei de accesare',
      penalty: 7,
    });
  }

  const missingFields = [
    property.constructionYear ? null : 'an construcție',
    isApartment && !property.floor ? 'etaj' : null,
    isApartment && !property.totalFloors ? 'număr total de etaje' : null,
    isApartment && !property.comfort ? 'confort' : null,
    isApartment && !property.partitioning ? 'compartimentare' : null,
    isApartment && !property.lift ? 'lift' : null,
    property.interiorState ? null : 'stare interior',
    property.heatingSystem ? null : 'încălzire',
    property.furnishing ? null : 'mobilare',
    property.parking ? null : 'parcare',
    property.orientation ? null : 'orientare',
    property.squareFootage > 0 ? null : 'suprafață utilă',
  ].filter((value): value is string => Boolean(value));

  if (missingFields.length > 0) {
    add({
      id: 'details',
      category: 'Date',
      priority: missingFields.length >= 4 ? 'high' : 'medium',
      title: 'Elimină golurile care generează neîncredere',
      reason: `Lipsesc ${missingFields.slice(0, 4).join(', ')}${missingFields.length > 4 ? ` și încă ${missingFields.length - 4}` : ''}.`,
      action: 'Completează toate câmpurile verificabile înainte de republicare; filtrele portalurilor și cumpărătorii calificați depind de aceste date.',
      impact: 'Impact ridicat asupra vizibilității în filtre și calității lead-urilor',
      penalty: Math.min(15, missingFields.length * 3),
    });
  }

  if (!property.latitude || !property.longitude || !property.address?.trim()) {
    add({
      id: 'location',
      category: 'Date',
      priority: 'high',
      title: 'Fixează localizarea exactă a anunțului',
      reason: 'Adresa sau coordonatele nu sunt complete, ceea ce slăbește căutările pe hartă și relevanța locală.',
      action: 'Validează adresa și pinul pe hartă, apoi evidențiază în descriere timpi reali către transport, școli și puncte de interes.',
      impact: 'Impact ridicat asupra descoperirii organice',
      penalty: 12,
    });
  }

  const imagesWithoutAlt = property.images?.filter((image) => image.url && !image.alt?.trim()).length ?? 0;
  if (imagesCount >= 8 && imagesWithoutAlt > Math.ceil(imagesCount / 2)) {
    add({
      id: 'image-seo',
      category: 'Conținut',
      priority: 'medium',
      title: 'Descrie imaginile pentru căutare și accesibilitate',
      reason: `${imagesWithoutAlt} din ${imagesCount} fotografii nu au descriere. Motoarele de căutare și utilizatorii care folosesc tehnologii asistive pierd context.`,
      action: 'Adaugă descrieri scurte și factuale pentru fiecare cadru: încăpere, avantaj și zonă; evită repetarea mecanică a titlului proprietății.',
      impact: 'Impact mediu asupra descoperirii organice și calității paginii',
      penalty: 5,
    });
  }

  if (ageDays !== null && ageDays >= 14 && property.videoTour?.status !== 'ready' && imagesCount >= 8) {
    add({
      id: 'video-tour',
      category: 'Conținut',
      priority: 'medium',
      title: 'Adaugă un tur video care pre-califică vizionările',
      reason: 'Proprietatea are material foto suficient, dar nu are un tur video finalizat care să explice fluxul spațiului.',
      action: 'Generează un video scurt, cu primele trei secunde dedicate avantajului principal și un traseu coerent prin proprietate; încheie cu CTA pentru vizionare.',
      impact: 'Impact mediu-ridicat asupra calității lead-urilor',
      penalty: 6,
    });
  }

  if (hasPerformanceData && views >= 40 && favoriteRate < 0.015) {
    add({
      id: 'price-test',
      category: 'Preț',
      priority: views >= 100 ? 'critical' : 'high',
      title: 'Rulează imediat un test controlat de preț și poziționare',
      reason: `${views} vizite au generat ${favoriteAdds} adăugări la favorite (${(favoriteRate * 100).toLocaleString('ro-RO', { maximumFractionDigits: 1 })}%). Există expunere, dar oferta nu convinge suficient.`,
      action: 'Compară prețul cu proprietăți concurente active și tranzacții relevante; testează 7 zile o repoziționare de 3–5% sau justifică explicit premiumul prin dovezi în primele imagini.',
      impact: 'Impact critic asupra conversiei; necesită validare CMA înainte de schimbare',
      penalty: views >= 100 ? 20 : 14,
    });
  }

  if (hasPerformanceData && favoriteAdds >= 3 && scheduledCount + completedCount === 0) {
    add({
      id: 'favorite-to-viewing',
      category: 'Conversie',
      priority: 'critical',
      title: 'Transformă interesul latent în vizionări',
      reason: `${favoriteAdds} persoane au salvat anunțul, dar nu există nicio vizionare înregistrată. Interesul se pierde înainte de contact sau programare.`,
      action: 'Adaugă un CTA explicit cu intervale disponibile în următoarele 48 de ore, răspunde rapid lead-urilor și relansează anunțul cu un motiv concret de acțiune.',
      impact: 'Impact foarte ridicat asupra numărului de vizionări',
      penalty: 18,
    });
  }

  if (ageDays !== null && ageDays >= 21 && (!hasPerformanceData || views < 30)) {
    add({
      id: 'distribution',
      category: 'Distribuție',
      priority: ageDays >= 45 ? 'high' : 'medium',
      title: 'Relansează distribuția, nu lăsa anunțul să îmbătrânească',
      reason: `Anunțul are ${ageDays} zile${hasPerformanceData ? ` și doar ${views} vizite publice` : ''}. Fără un impuls nou, vizibilitatea organică va continua să scadă.`,
      action: 'Schimbă fotografia principală și titlul, republică în canalele relevante, programează grupurile Facebook și concentrează bugetul într-un sprint măsurabil de 7 zile.',
      impact: 'Impact ridicat asupra expunerii calificate',
      penalty: ageDays >= 45 ? 13 : 8,
    });
  }

  if (publishedPortals === 0) {
    add({
      id: 'portals',
      category: 'Distribuție',
      priority: 'high',
      title: 'Activează distribuția pe portalurile cu intenție mare',
      reason: 'Nu există niciun portal marcat ca publicat pentru această proprietate.',
      action: 'Publică întâi anunțul complet optimizat, verifică afișarea și linkurile, apoi măsoară separat vizitele și lead-urile pentru fiecare canal.',
      impact: 'Impact foarte ridicat asupra cererii noi',
      penalty: 15,
    });
  }

  if ((context?.portals.errors.length ?? 0) > 0) {
    add({
      id: 'portal-errors',
      category: 'Distribuție',
      priority: 'critical',
      title: 'Repară publicările eșuate înainte de orice buget nou',
      reason: `Publicarea are erori pe: ${context!.portals.errors.join(', ')}. Proprietatea pierde trafic cu intenție mare cât timp anunțurile nu sunt active.`,
      action: 'Deschide cardul Publicare în portaluri, corectează validările și republică. Verifică apoi linkul public și starea sincronizării pentru fiecare portal.',
      impact: 'Impact critic asupra vizibilității și lead-urilor',
      penalty: 20,
    });
  }

  if ((context?.portals.pending.length ?? 0) > 0) {
    add({
      id: 'portal-pending',
      category: 'Distribuție',
      priority: 'medium',
      title: 'Urmărește publicările încă neconfirmate',
      reason: `Există publicări în așteptare pe: ${context!.portals.pending.join(', ')}.`,
      action: 'Confirmă că portalurile au acceptat anunțul și că pagina este accesibilă; dacă starea nu se schimbă, reia sincronizarea înainte de promovare.',
      impact: 'Impact mediu asupra acoperirii reale',
      penalty: 5,
    });
  }

  if (context?.facebook.latestStatus === 'error' || context?.facebook.latestStatus === 'needs_reauthentication') {
    add({
      id: 'facebook-error',
      category: 'Distribuție',
      priority: 'high',
      title: 'Recuperează distribuția Facebook întreruptă',
      reason: `Ultimul job Facebook este „${context.facebook.latestStatus === 'error' ? 'eroare' : 'reautentificare necesară'}”; ${context.facebook.failedGroups} publicări de grup sunt marcate cu probleme.`,
      action: 'Reconectează contul dacă este necesar, reia doar grupurile eșuate și păstrează publicările deja trimise. Elimină grupurile care blochează repetat fluxul.',
      impact: 'Impact ridicat asupra acoperirii locale',
      penalty: 14,
    });
  } else if (context && context.facebook.totalJobs === 0 && ageDays !== null && ageDays >= 2) {
    add({
      id: 'facebook-launch',
      category: 'Distribuție',
      priority: 'medium',
      title: 'Activează distribuția în grupurile Facebook potrivite',
      reason: `Nu există nicio publicare automată în grupuri pentru această proprietate de ${transaction}.`,
      action: `Pornește un val controlat numai în grupurile etichetate pentru ${transaction}, monitorizează aprobările și evită republicarea duplicată în același grup.`,
      impact: 'Impact mediu-ridicat asupra cererii locale',
      penalty: 7,
    });
  } else if (context && context.facebook.failedGroups >= 3 && context.facebook.failedGroups > context.facebook.submittedGroups * 0.25) {
    add({
      id: 'facebook-group-quality',
      category: 'Distribuție',
      priority: 'high',
      title: 'Curăță lista de grupuri Facebook cu rată mare de eșec',
      reason: `${context.facebook.failedGroups} încercări au eșuat, față de ${context.facebook.submittedGroups} trimiteri reușite sau în aprobare.`,
      action: 'Verifică regulile și eligibilitatea grupurilor eșuate, mută-le într-o listă de revizuire și concentrează automatizarea pe grupurile care acceptă constant postările.',
      impact: 'Impact ridicat asupra vitezei și stabilității distribuției',
      penalty: 11,
    });
  }

  if (context?.metaAds.available && context.metaAds.errorCampaigns > 0) {
    add({
      id: 'meta-errors',
      category: 'Distribuție',
      priority: 'high',
      title: 'Oprește pierderea de timp din campaniile Meta cu erori',
      reason: `${context.metaAds.errorCampaigns} ${context.metaAds.errorCampaigns === 1 ? 'campanie are' : 'campanii au'} stare de eroare.`,
      action: 'Corectează mai întâi campania, audiența, materialul sau destinația respinsă; publică din nou numai după validarea completă a landing page-ului.',
      impact: 'Impact ridicat asupra lansării promovării plătite',
      penalty: 12,
    });
  }

  if (context?.metaAds.available && context.metaAds.impressions >= 1000) {
    const clickRate = context.metaAds.clicks / context.metaAds.impressions;
    if (clickRate < 0.008) {
      add({
        id: 'meta-creative',
        category: 'Conversie',
        priority: 'high',
        title: 'Schimbă materialul Meta: reclama este văzută, dar nu atrage clickuri',
        reason: `${context.metaAds.impressions.toLocaleString('ro-RO')} afișări au generat ${context.metaAds.clicks.toLocaleString('ro-RO')} clickuri (${(clickRate * 100).toLocaleString('ro-RO', { maximumFractionDigits: 2 })}%).`,
        action: 'Testează separat o fotografie principală mai puternică și un hook bazat pe beneficiul unic. Nu crește bugetul până când varianta nouă nu îmbunătățește rata de click.',
        impact: 'Impact foarte ridicat asupra eficienței bugetului Meta',
        penalty: 15,
      });
    }
  }

  if (context?.metaAds.available && context.metaAds.clicks >= 20 && context.metaAds.leads === 0) {
    add({
      id: 'meta-landing-conversion',
      category: 'Conversie',
      priority: 'critical',
      title: 'Repară conversia după click înainte să mai cheltuiești',
      reason: `${context.metaAds.clicks} clickuri Meta nu au produs niciun lead înregistrat. Problema este după reclamă, nu lipsa de trafic.`,
      action: 'Verifică pagina publică pe mobil, viteza, formularul, telefonul și tracking-ul. Aliniază promisiunea reclamei cu prima imagine, prețul și CTA-ul paginii.',
      impact: 'Impact critic asupra costului per lead',
      penalty: 20,
    });
  }

  if (context && context.buyers.strongMatches > 0 && scheduledCount + completedCount === 0) {
    const names = context.buyers.topMatches
      .filter((buyer) => buyer.matchScore >= 70)
      .map((buyer) => `${buyer.name} (${buyer.matchScore}/100)`)
      .join(', ');
    add({
      id: 'matched-buyers',
      category: 'Conversie',
      priority: 'critical',
      title: 'Contactează cumpărătorii compatibili înainte de promovare rece',
      reason: `${context.buyers.strongMatches} cumpărători au compatibilitate de minimum 70/100${names ? `: ${names}` : ''}. Nu există încă vizionări pentru proprietate.`,
      action: 'Contactează-i individual cu motivul concret al potrivirii, două intervale de vizionare și linkul proprietății. Înregistrează răspunsul pentru recalibrarea potrivirilor.',
      impact: 'Impact critic: cea mai scurtă rută către o vizionare calificată',
      penalty: 18,
    });
  }

  if (knownAdSpend === 0 && ageDays !== null && ageDays >= 7) {
    add({
      id: 'paid-campaign',
      category: 'Distribuție',
      priority: 'medium',
      title: 'Pornește promovarea plătită doar după optimizarea ofertei',
      reason: 'Nu există costuri publicitare înregistrate, iar anunțul nu mai este în fereastra inițială de lansare.',
      action: 'După corectarea recomandărilor critice, rulează o campanie scurtă cu audiență locală și retargetare; oprește reclamele care nu produc vizite calificate.',
      impact: 'Impact mediu-ridicat, condiționat de calitatea anunțului',
      penalty: 6,
    });
  }

  recommendations.sort((a, b) => (
    priorityRank[b.priority] - priorityRank[a.priority]
    || b.penalty - a.penalty
    || a.title.localeCompare(b.title, 'ro-RO')
  ));

  const score = Math.max(0, Math.min(100, 100 - recommendations.reduce((total, item) => total + item.penalty, 0)));
  const criticalCount = recommendations.filter((item) => item.priority === 'critical').length;
  const summary = criticalCount > 0
    ? `${criticalCount} ${criticalCount === 1 ? 'blocaj critic cere' : 'blocaje critice cer'} intervenție înainte de următorul val de promovare.`
    : recommendations.length > 0
      ? 'Anunțul poate performa mai bine prin optimizările prioritizate mai jos.'
      : 'Anunțul este bine pregătit; urmărește conversia și ajustează pe baza datelor noi.';

  return { score, summary, recommendations: recommendations.slice(0, 6) };
}
