'use server';

/**
 * @fileOverview An OpenAI-powered analyzer for the reports page.
 *
 * Falls back to deterministic insights when the API key is missing or the
 * request fails, so the reports page always remains useful.
 */

import { z } from 'zod';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_REPORT_MODEL = process.env.OPENAI_REPORT_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';

const SalesDataSchema = z.object({
  month: z.string(),
  sales: z.number(),
});

const BuyerSourceDataSchema = z.object({
  source: z.string(),
  count: z.number(),
  fill: z.string(),
});

const KpiSchema = z.object({
  totalWonLeads: z.number(),
  conversionRate: z.number(),
  averageDealSize: z.number(),
});

const AdditionalMetricsSchema = z.object({
  totalLeads: z.number(),
  activeLeads: z.number(),
  lostLeads: z.number(),
  totalProperties: z.number(),
  activeProperties: z.number(),
  soldProperties: z.number(),
  reservedProperties: z.number(),
  inactiveProperties: z.number(),
  totalSalesVolume: z.number(),
  activeInventoryValue: z.number(),
  totalViewings: z.number(),
  completedViewings: z.number(),
  scheduledViewings: z.number(),
  cancelledViewings: z.number(),
  viewingCompletionRate: z.number(),
  propertiesNeedingOptimization: z.number(),
  leadsWithoutFollowUp: z.number(),
  leadsWithoutBudget: z.number(),
  dataQualityScore: z.number(),
  leadsMissingCreatedAt: z.number(),
  propertiesMissingCreatedAt: z.number(),
  propertiesLowMedia: z.number(),
  propertiesWeakDescription: z.number(),
  highRiskLeads: z.number(),
  contactedWithoutViewing: z.number(),
  negotiationStalled: z.number(),
  activeWithoutViewings: z.number(),
  reservedStale: z.number(),
  avgHoursToFirstContact: z.number(),
  avgDaysToViewing: z.number(),
  avgDaysLeadToWin: z.number(),
});

const TopSourceSchema = z.object({
  source: z.string(),
  count: z.number(),
  share: z.number(),
});

const ScoreSummarySchema = z.object({
  title: z.string(),
  score: z.number(),
  trend: z.number(),
  summary: z.string(),
  factors: z.array(z.string()),
});

const AlertSummarySchema = z.object({
  title: z.string(),
  description: z.string(),
  tone: z.enum(['high', 'medium', 'good']),
});

const ForecastSchema = z.object({
  title: z.string(),
  currentValue: z.number(),
  projectedValue: z.number(),
  type: z.enum(['currency', 'number']),
  helper: z.string(),
});

const FunnelBreakdownSchema = z.object({
  label: z.string(),
  reached: z.number(),
  rateFromPrevious: z.number(),
  rateFromStart: z.number(),
});

const SummarizeReportInputSchema = z.object({
  salesData: z.array(SalesDataSchema).describe('Monthly sales volume data.'),
  leadSourceData: z.array(BuyerSourceDataSchema).describe('Data on the count of leads from different sources.'),
  kpis: KpiSchema.describe(
    'Key Performance Indicators including total won leads, conversion rate (%), and average deal size (€).'
  ),
  additionalMetrics: AdditionalMetricsSchema.describe('Operational metrics calculated in the reports page.'),
  topSources: z.array(TopSourceSchema).max(5).describe('Top lead sources by volume.'),
  statusBreakdown: z.array(z.object({ label: z.string(), value: z.number() })).describe('Lead status funnel breakdown.'),
  scoreSummary: z.array(ScoreSummarySchema).max(4).describe('Executive health scores with trends and explanations.'),
  alerts: z.array(AlertSummarySchema).describe('The alerts currently surfaced to the manager.'),
  forecast: z.array(ForecastSchema).max(4).describe('Simple end-of-month forecast items.'),
  funnelBreakdown: z.array(FunnelBreakdownSchema).describe('Pipeline stages with inferred historical evidence.'),
  dataConfidenceLabel: z.string().describe('High-level confidence in the current report data.'),
});
type SummarizeReportInput = z.infer<typeof SummarizeReportInputSchema>;

const SummarizeReportOutputSchema = z.object({
  summary: z.string().describe('A concise executive summary in Romanian.'),
  recommendations: z.string().describe(
    "A bulleted list of 3-4 actionable recommendations in Romanian, formatted as a single string with each point starting with '-' and separated by new lines."
  ),
  strengths: z.array(z.string()).describe('2-4 strong points detected in the business performance.'),
  risks: z.array(z.string()).describe('2-4 risks or weaknesses that need attention.'),
  opportunities: z.array(z.string()).describe('2-4 concrete growth opportunities.'),
  whatIsHappening: z.string().describe('A concise description of what is happening in the business right now, in Romanian.'),
  whyItIsHappening: z.string().describe('A concise explanation of why the current situation is happening, in Romanian.'),
  priority: z.string().describe('The single most important priority right now, in Romanian.'),
  biggestLoss: z.string().describe('The biggest current drag on performance, in Romanian.'),
  todayFocus: z.string().describe('What the team should do today, in Romanian.'),
  notNow: z.string().describe('What the team should explicitly avoid focusing on right now, in Romanian.'),
  next7DaysFocus: z.string().describe('The most important 7-day action focus, in Romanian.'),
  affectedKpis: z.array(z.string()).describe('The KPIs most likely to be improved if the plan is executed well.'),
  nextWeekKpi: z.string().describe('The single KPI that should be watched next week, in Romanian.'),
});
type SummarizeReportOutput = z.infer<typeof SummarizeReportOutputSchema>;

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  const content = payload?.output?.[0]?.content;
  if (Array.isArray(content)) {
    const textItem = content.find((item: any) => typeof item?.text === 'string');
    if (textItem?.text) {
      return textItem.text;
    }
  }

  return '';
}

function buildFallback(input: SummarizeReportInput): SummarizeReportOutput {
  const {
    kpis,
    additionalMetrics,
    topSources,
    salesData,
    statusBreakdown,
    scoreSummary,
    alerts,
    forecast,
    funnelBreakdown,
    dataConfidenceLabel,
  } = input;

  const bestSource = topSources[0];
  const latestMonth = salesData[salesData.length - 1];
  const dominantStatus = [...statusBreakdown].sort((a, b) => b.value - a.value)[0];
  const weakestScore = [...scoreSummary].sort((a, b) => a.score - b.score)[0];
  const topAlert = alerts[0];
  const nextForecast = forecast[0];
  const funnelLeak = [...funnelBreakdown]
    .slice(1)
    .sort((a, b) => a.rateFromPrevious - b.rateFromPrevious)[0];
  const scoreLead =
    weakestScore
      ? `${weakestScore.title} este cel mai slab scor (${Math.round(weakestScore.score)}/100).`
      : 'Zona cu cea mai mare presiune rămâne execuția comercială.';
  const leakLead =
    funnelLeak
      ? `Cea mai mare pierdere apare înainte de etapa "${funnelLeak.label}": doar ${funnelLeak.rateFromPrevious.toFixed(1)}% dintre lead-urile din etapa anterioară ajung mai departe.`
      : 'Nu există încă suficient context pentru a izola clar o singură etapă cu pierdere maximă.';

  const strengths = [
    kpis.totalWonLeads > 0
      ? `Există ${kpis.totalWonLeads} cumpărători câștigați, semn că agenția convertește lead-uri în tranzacții.`
      : 'Există date de lucru în CRM care permit structurarea procesului comercial.',
    bestSource
      ? `Canalul ${bestSource.source} livrează cea mai mare pondere de lead-uri (${bestSource.share.toFixed(1)}%).`
      : 'Sursele de lead-uri sunt deja urmărite și pot fi optimizate pe baza datelor.',
    additionalMetrics.completedViewings > 0
      ? `Au fost finalizate ${additionalMetrics.completedViewings} vizionări, ceea ce arată activitate comercială reală.`
      : 'Există spațiu clar pentru a crește activitatea de vizionare și avansarea lead-urilor.',
    additionalMetrics.dataQualityScore >= 75
      ? `Calitatea datelor este ${dataConfidenceLabel.toLowerCase()} (${additionalMetrics.dataQualityScore.toFixed(0)}%), ceea ce face raportarea mai credibilă.`
      : null,
  ].filter(Boolean);

  const risks = [
    additionalMetrics.leadsWithoutFollowUp > 0
      ? `${additionalMetrics.leadsWithoutFollowUp} lead-uri au nevoie de follow-up și pot fi pierdute dacă nu sunt reangajate rapid.`
      : 'Nu există restanțe majore de follow-up identificate în datele disponibile.',
    additionalMetrics.propertiesNeedingOptimization > 0
      ? `${additionalMetrics.propertiesNeedingOptimization} proprietăți active au nevoie de optimizare foto sau descriere.`
      : 'Portofoliul activ nu indică probleme evidente de prezentare în datele analizate.',
    additionalMetrics.leadsWithoutBudget > 0
      ? `${additionalMetrics.leadsWithoutBudget} lead-uri nu au buget clar definit, ceea ce îngreunează calificarea.`
      : 'Majoritatea lead-urilor par să aibă semnale de calificare minime în CRM.',
    additionalMetrics.avgHoursToFirstContact > 24
      ? `Timpul mediu până la primul contact este de ${additionalMetrics.avgHoursToFirstContact.toFixed(1)} ore, prea lent pentru lead-uri noi.`
      : null,
  ].filter(Boolean);

  const opportunities = [
    additionalMetrics.contactedWithoutViewing > 0
      ? 'Cea mai clară oportunitate este să împingi mai repede lead-urile din Contactat în Vizionare, pentru că aici există interes, dar nu există încă suficientă mișcare comercială.'
      : 'Cea mai bună oportunitate este să accelerezi trecerea lead-urilor active spre pași comerciali clari, nu doar să menții contactul.',
    latestMonth
      ? `Ultimul volum de vânzări înregistrat este ${latestMonth.month} cu €${latestMonth.sales.toLocaleString()}, deci există bază pentru forecast lunar.`
      : 'Construirea unei serii lunare de vânzări mai consistente ar ajuta mult forecast-ul comercial.',
    nextForecast
      ? `${nextForecast.title} are acum un forecast de ${nextForecast.type === 'currency' ? `€${Math.round(nextForecast.projectedValue).toLocaleString()}` : nextForecast.projectedValue.toLocaleString('ro-RO')} la finalul lunii.`
      : null,
    dominantStatus
      ? `Statusul dominant este ${dominantStatus.label}; oportunitatea reală este să reduci timpul petrecut în această etapă și să obligi trecerea mai rapidă în etapa următoare.`
      : 'Funnel-ul poate fi optimizat prin disciplină mai bună în actualizarea statusurilor lead-urilor.',
    additionalMetrics.dataQualityScore < 75
      ? `Îmbunătățirea calității datelor ar crește semnificativ încrederea în deciziile comerciale și în analiza AI.`
      : null,
  ].filter(Boolean);

  return {
    summary:
      `${scoreLead} ` +
      `Agenția are ${input.additionalMetrics.totalLeads} lead-uri și ${input.additionalMetrics.totalProperties} proprietăți în CRM, cu o conversie totală de ${kpis.conversionRate.toFixed(1)}% și o valoare medie a tranzacției de €${Math.round(
        kpis.averageDealSize
      ).toLocaleString()}. ` +
      `${topAlert ? `Semnalul care cere intervenție imediată este: ${topAlert.description}` : 'Prioritatea rămâne curățarea blocajelor operaționale care țin lead-urile și portofoliul în loc.'}`,
    recommendations: [
      additionalMetrics.leadsWithoutFollowUp > 0
        ? `- Reia în următoarele 24 de ore contactul cu cele ${additionalMetrics.leadsWithoutFollowUp} lead-uri fără follow-up recent.`
        : '- Menține ritmul de follow-up și documentează toate interacțiunile noi în CRM.',
      additionalMetrics.propertiesNeedingOptimization > 0
        ? `- Prioritizează actualizarea celor ${additionalMetrics.propertiesNeedingOptimization} proprietăți active cu poze puține sau descrieri slabe.`
        : '- Auditează săptămânal portofoliul activ pentru a menține standardul de prezentare.',
      bestSource
        ? `- Construiește un mini-plan de conversie pentru sursa ${bestSource.source}, fiind canalul cu cea mai mare contribuție.`
        : '- Compară canalele de lead-uri și mută bugetul spre sursele cu engagement mai bun.',
      additionalMetrics.leadsWithoutBudget > 0
        ? '- Introdu un pas obligatoriu de calificare financiară pentru lead-urile fără buget definit.'
        : '- Urmărește mai strict trecerea lead-urilor din vizionare spre negociere și ofertă.',
    ].join('\n'),
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 4),
    opportunities: opportunities.slice(0, 4),
    whatIsHappening:
      `${scoreLead} ${leakLead} Business-ul produce activitate, dar nu transformă suficient de eficient volumul în progres comercial.`,
    whyItIsHappening:
      additionalMetrics.contactedWithoutViewing > 0
        ? `Problema nu pare să fie lipsa de interes inițial, ci slaba transformare a contactului inițial în pas concret. Lead-urile sunt atinse, dar nu sunt împinse suficient de repede spre vizionare, iar asta reduce șansa de negociere.`
        : `Cauza dominantă pare să fie execuția inegală: unele lead-uri și proprietăți sunt lucrate, dar ritmul nu este suficient de constant pentru a produce conversie bună la nivel de portofoliu.`,
    priority:
      additionalMetrics.leadsWithoutFollowUp > 0
        ? `Recuperează lead-urile fără follow-up înainte să devină pierderi aproape sigure.`
        : `Mută lead-urile din Contactat în Vizionare mai repede, pentru că aici se pierde momentum-ul comercial.`,
    biggestLoss:
      additionalMetrics.contactedWithoutViewing > 0
        ? `Cea mai mare pierdere nu este la intrarea lead-urilor, ci între Contactat și Vizionare. Acolo se consumă interesul fără să se transforme în întâlnire.`
        : `Cea mai mare pierdere vine din execuția fragmentată: prea multe lead-uri rămân în pipeline fără pas clar următor.`,
    todayFocus:
      additionalMetrics.leadsWithoutFollowUp > 0
        ? `Astăzi atacă lista de lead-uri întârziate și scoate din ea cât mai multe programări concrete, nu doar mesaje trimise.`
        : `Astăzi obiectivul nu este mai multă activitate generică, ci mai multe vizionări programate și negocieri repornite.`,
    notNow:
      `Nu deschide acum inițiative noi de marketing sau optimizări fine de proces. Fără curățarea blocajelor actuale, vei adăuga volum peste un pipeline deja ineficient.`,
    next7DaysFocus:
      additionalMetrics.propertiesNeedingOptimization > 0
        ? `În următoarele 7 zile combină două intervenții: recuperează lead-urile întârziate și repară proprietățile active care frânează interesul prin prezentare slabă.`
        : `În următoarele 7 zile măsoară dacă pipeline-ul se mișcă mai repede din Contactat în Vizionare și din Vizionare în Negociere.`,
    affectedKpis: [
      'Rata de conversie',
      'Timp până la prima vizionare',
      'Lead-uri cu follow-up restant',
      'Calitatea datelor din CRM',
    ],
    nextWeekKpi:
      additionalMetrics.contactedWithoutViewing > 0
        ? 'Timp până la prima vizionare'
        : 'Rata de conversie',
  };
}

export async function summarizeReport(input: SummarizeReportInput): Promise<SummarizeReportOutput> {
  if (input.salesData.length === 0 && input.leadSourceData.length === 0 && input.additionalMetrics.totalLeads === 0) {
    return {
      summary: 'Nu există suficiente date pentru a genera o analiză relevantă. Adăugați lead-uri, proprietăți și activitate comercială în CRM.',
      recommendations: '- Adaugă lead-uri noi.\n- Marchează statusurile corecte în funnel.\n- Înregistrează tranzacțiile câștigate și vizionările.',
      strengths: ['CRM-ul este pregătit să centralizeze datele odată ce activitatea este înregistrată consecvent.'],
      risks: ['Lipsa datelor istorice blochează forecast-ul și analiza canalelor de achiziție.'],
      opportunities: ['Popularea disciplinată a CRM-ului va permite decizii comerciale mult mai bune în pagina de rapoarte.'],
      whatIsHappening: 'Business-ul nu are încă suficiente date structurate pentru o evaluare managerială solidă.',
      whyItIsHappening: 'CRM-ul nu este populat suficient de consecvent cu lead-uri, interacțiuni și proprietăți.',
      priority: 'Populează consecvent CRM-ul cu lead-uri, interacțiuni și proprietăți.',
      biggestLoss: 'Cea mai mare pierdere este lipsa de date suficiente pentru decizii comerciale credibile.',
      todayFocus: 'Astăzi concentrează-te pe completarea datelor lipsă și pe înregistrarea interacțiunilor reale din CRM.',
      notNow: 'Nu încerca optimizări fine de strategie până nu există bază minimă de date credibile.',
      next7DaysFocus: 'În următoarele 7 zile, prioritizează completarea datelor de bază și înregistrarea activității comerciale.',
      affectedKpis: ['Calitatea datelor din CRM', 'Rata de conversie', 'Timp până la primul contact'],
      nextWeekKpi: 'Calitatea datelor din CRM',
    };
  }

  const fallback = buildFallback(input);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallback;
  }

  const prompt = [
    'You are a senior business analyst for a Romanian real-estate agency.',
    'Analyze only the structured data provided below.',
    'Write in Romanian.',
    'Be concrete, commercially sharp, and operationally useful.',
    'Use plain Romanian that sounds like a strong agency manager, not like generic consultant copy.',
    'Avoid vague phrases, filler, motivational language, and abstract business clichés.',
    'Each explanation must say clearly: what the signal is, why it matters, and what consequence it creates.',
    'Prefer short, dense sentences over long polished paragraphs.',
    'Do not hedge unless the data is truly insufficient.',
    'When a funnel stage has weak retention, describe it as a loss before entering that stage, not as if leads already reached that stage and got stuck there.',
    'Write opportunities like a senior real-estate agent or agency owner with deep commercial instinct, not like a marketing analyst.',
    'For opportunities, do not recommend investing more in lead sources or channels. Focus on commercial leverage: faster viewings, stronger negotiation progression, better portfolio positioning, better qualification, and clearer next-step discipline.',
    'Do not invent facts or hidden causes.',
    'The recommendations must be actionable in the next 7-14 days.',
    'Use the score explanations, forecast, alerts, and funnel evidence to anchor your conclusions.',
    'If a score is weak or an alert is critical, make that visible in the executive narrative.',
    'Also structure the executive guidance into: what is happening, why it is happening, what should be done today, what should explicitly not be done now, the next 7-day focus, which KPIs are most likely to improve, and the single KPI to watch next week.',
    JSON.stringify(input, null, 2),
  ].join('\n');

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_REPORT_MODEL,
        reasoning: { effort: 'low' },
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'report_analysis',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                summary: { type: 'string' },
                recommendations: { type: 'string' },
                strengths: {
                  type: 'array',
                  items: { type: 'string' },
                },
                risks: {
                  type: 'array',
                  items: { type: 'string' },
                },
                opportunities: {
                  type: 'array',
                  items: { type: 'string' },
                },
                whatIsHappening: { type: 'string' },
                whyItIsHappening: { type: 'string' },
                priority: { type: 'string' },
                biggestLoss: { type: 'string' },
                todayFocus: { type: 'string' },
                notNow: { type: 'string' },
                next7DaysFocus: { type: 'string' },
                affectedKpis: {
                  type: 'array',
                  items: { type: 'string' },
                },
                nextWeekKpi: { type: 'string' },
              },
              required: ['summary', 'recommendations', 'strengths', 'risks', 'opportunities', 'whatIsHappening', 'whyItIsHappening', 'priority', 'biggestLoss', 'todayFocus', 'notNow', 'next7DaysFocus', 'affectedKpis', 'nextWeekKpi'],
            },
          },
        },
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`OpenAI report summarizer failed with status ${response.status}`);
    }

    const payload = await response.json();
    const responseText = extractResponseText(payload);
    const parsed = SummarizeReportOutputSchema.parse(JSON.parse(responseText));

    return {
      summary: parsed.summary.trim(),
      recommendations: parsed.recommendations.trim(),
      strengths: parsed.strengths.slice(0, 4),
      risks: parsed.risks.slice(0, 4),
      opportunities: parsed.opportunities.slice(0, 4),
      whatIsHappening: parsed.whatIsHappening.trim(),
      whyItIsHappening: parsed.whyItIsHappening.trim(),
      priority: parsed.priority.trim(),
      biggestLoss: parsed.biggestLoss.trim(),
      todayFocus: parsed.todayFocus.trim(),
      notNow: parsed.notNow.trim(),
      next7DaysFocus: parsed.next7DaysFocus.trim(),
      affectedKpis: parsed.affectedKpis.slice(0, 5),
      nextWeekKpi: parsed.nextWeekKpi.trim(),
    };
  } catch (error) {
    console.error('OpenAI report summarizer failed, using deterministic fallback:', error);
    return fallback;
  }
}
