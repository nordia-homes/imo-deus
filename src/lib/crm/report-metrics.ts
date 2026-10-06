import type { BuyerSourceData, Contact, Property, SalesData, Viewing } from '@/lib/types';
import { isArchivedContact } from '@/lib/contact-aging';

export type StatusItem = { label: string; value: number; share: number };
export type SourceItem = { source: string; count: number; share: number; fill: string };
export type ComparisonItem = {
  label: string;
  currentLabel: string;
  previousLabel: string;
  currentValue: number;
  previousValue: number;
  delta: number;
  type?: 'currency' | 'number';
};
export type FunnelItem = {
  label: string;
  reached: number;
  rateFromPrevious: number;
  rateFromStart: number;
};
export type SourceConversionItem = {
  source: string;
  leads: number;
  contacted: number;
  viewings: number;
  negotiating: number;
  won: number;
  lost: number;
  winRate: number;
  pipelineRate: number;
};
export type BlockerItem = {
  title: string;
  value: number;
  tone: 'high' | 'medium' | 'good';
  description: string;
  href: string;
};
export type DetailMetricItem = {
  label: string;
  value: string;
  helper: string;
  href?: string;
};
export type ScoreCardItem = {
  title: string;
  score: number;
  summary: string;
  trend: number;
  factors: string[];
  href: string;
};
export type AlertItem = {
  title: string;
  description: string;
  tone: 'high' | 'medium' | 'good';
  href: string;
};
export type ForecastItem = {
  title: string;
  currentValue: number;
  projectedValue: number;
  type: 'currency' | 'number';
  helper: string;
};
export type SectionSignalItem = {
  title: string;
  value: string;
  helper: string;
  href?: string;
};

const COLORS = ['#6EE7B7', '#60A5FA', '#FBBF24', '#FB7185', '#A78BFA', '#22D3EE'];
const euro = (value: number) => `€${Math.round(value || 0).toLocaleString('ro-RO')}`;
const pct = (value: number) => `${value.toFixed(1)}%`;
const PERIOD_DAYS = 30;

function getTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function isBetween(time: number | null, start: number, end: number) {
  return time !== null && time >= start && time < end;
}

function ratio(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function toneFromRate(rate: number, medium: number, high: number): 'good' | 'medium' | 'high' {
  if (rate >= high) return 'high';
  if (rate >= medium) return 'medium';
  return 'good';
}

function normalizeLeadSource(source?: string | null) {
  const raw = (source ?? '').trim();
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized === 'website') return 'Website';
  if (normalized === 'recomandare') return 'Recomandare';
  if (normalized === 'portal imobiliar') return 'Portal Imobiliar';
  if (normalized === 'telefon') return 'Telefon';
  if (!normalized || normalized === 'necunoscuta' || normalized === 'necunoscuta') return 'Altul';
  return 'Altul';
}

export function calculateCrmReport(contacts: Contact[] | null | undefined, properties: Property[] | null | undefined, viewings: Viewing[] | null | undefined, now = Date.now()) {
    if (!contacts || !properties || !viewings) {
      return {
        salesData: [] as SalesData[],
        buyerSourceData: [] as BuyerSourceData[],
        sourceRows: [] as SourceItem[],
        statusRows: [] as StatusItem[],
        comparisonRows: [] as ComparisonItem[],
        funnelRows: [] as FunnelItem[],
        sourceConversionRows: [] as SourceConversionItem[],
        blockerRows: [] as BlockerItem[],
        dataQualityRows: [] as DetailMetricItem[],
        speedRows: [] as DetailMetricItem[],
        riskRows: [] as DetailMetricItem[],
        scoreRows: [] as ScoreCardItem[],
        alertRows: [] as AlertItem[],
        forecastRows: [] as ForecastItem[],
        inputRows: [] as SectionSignalItem[],
        outputRows: [] as SectionSignalItem[],
        totalLeads: 0,
        archivedLeads: 0,
        activeLeads: 0,
        lostLeads: 0,
        totalWonBuyers: 0,
        conversionRate: 0,
        averageDealSize: 0,
        totalSalesVolume: 0,
        totalProperties: 0,
        activeProperties: 0,
        soldProperties: 0,
        reservedProperties: 0,
        inactiveProperties: 0,
        activeInventoryValue: 0,
        totalViewings: 0,
        completedViewings: 0,
        scheduledViewings: 0,
        cancelledViewings: 0,
        viewingCompletionRate: 0,
        propertiesNeedingOptimization: 0,
        leadsWithoutFollowUp: 0,
        leadsWithoutBudget: 0,
        dataQualityScore: 0,
        leadsMissingCreatedAt: 0,
        propertiesMissingCreatedAt: 0,
        propertiesLowMedia: 0,
        propertiesWeakDescription: 0,
        highRiskLeads: 0,
        contactedWithoutViewing: 0,
        negotiationStalled: 0,
        activeWithoutViewings: 0,
        reservedStale: 0,
        avgHoursToFirstContact: 0,
        avgDaysToViewing: 0,
        avgDaysLeadToWin: 0,
        dataConfidenceLabel: 'Scazuta',
      };
    }


    const currentPeriodStart = now - PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const previousPeriodStart = currentPeriodStart - PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const archivedContacts = contacts.filter((item) => isArchivedContact(item));
    const nonArchivedContacts = contacts.filter((item) => !isArchivedContact(item));
    const sold = properties.filter((item) => item.status === 'Vândut' && item.statusUpdatedAt);
    const active = properties.filter((item) => item.status === 'Activ');
    const reserved = properties.filter((item) => item.status === 'Rezervat').length;
    const inactive = properties.filter((item) => item.status === 'Inactiv' || item.status === 'Închiriat').length;
    const won = nonArchivedContacts.filter((item) => item.status === 'Câștigat');
    const lost = nonArchivedContacts.filter((item) => item.status === 'Pierdut');
    const activeLeads = nonArchivedContacts.filter((item) => !['Câștigat', 'Pierdut'].includes(item.status));

    const monthly: Record<string, { date: Date; sales: number }> = {};
    sold.forEach((item) => {
      const date = item.statusUpdatedAt ? new Date(item.statusUpdatedAt) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit' }).formatToParts(date);
      const year = Number(parts.find(p => p.type === 'year')!.value), month = Number(parts.find(p => p.type === 'month')!.value) - 1;
      const key = `${year}-${month}`;
      if (!monthly[key]) monthly[key] = { date: new Date(Date.UTC(year, month, 1)), sales: 0 };
      monthly[key].sales += item.price || 0;
    });

    const salesData = Object.values(monthly)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((item) => ({
        month: item.date.toLocaleString('ro-RO', { month: 'short', year: 'numeric', timeZone: 'Europe/Bucharest' }),
        sales: item.sales,
      }));

    const sourceCounts: Record<string, number> = {};
    nonArchivedContacts.forEach((item) => {
      const source = normalizeLeadSource(item.source);
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    const sourceRows = Object.entries(sourceCounts)
      .map(([source, count], index) => ({
        source,
        count,
        share: ratio(count, nonArchivedContacts.length),
        fill: COLORS[index % COLORS.length],
      }))
      .sort((a, b) => b.count - a.count);

    const buyerSourceData = sourceRows.map((item) => ({
      source: item.source,
      count: item.count,
      fill: item.fill,
    }));

    const orderedStatuses: Contact['status'][] = ['Nou', 'Contactat', 'Vizionare', 'În negociere', 'Câștigat', 'Pierdut'];
    const statusRows = orderedStatuses.map((label) => {
      const value = nonArchivedContacts.filter((item) => item.status === label).length;
      return { label, value, share: ratio(value, nonArchivedContacts.length) };
    });

    const statusRank: Record<Contact['status'], number> = {
      Nou: 0,
      Contactat: 1,
      Vizionare: 2,
      'În negociere': 3,
      'Câștigat': 4,
      Pierdut: -1,
    };

    const completedViewings = viewings.filter((item) => item.status === 'completed').length;
    const scheduledViewings = viewings.filter((item) => item.status === 'scheduled').length;
    const cancelledViewings = viewings.filter((item) => item.status === 'cancelled').length;
    const totalViewings = viewings.length;
    const activeAndWon = nonArchivedContacts.filter((item) => item.status !== 'Pierdut');
    const viewingsByContactId = new Map<string, Viewing[]>();
    viewings.forEach((item) => {
      const existing = viewingsByContactId.get(item.contactId) || [];
      existing.push(item);
      viewingsByContactId.set(item.contactId, existing);
    });

    const funnelEvidence = activeAndWon.map((item) => {
      const interactions = item.interactionHistory || [];
      const relatedViewings = viewingsByContactId.get(item.id) || [];
      const hasContactEvidence = interactions.length > 0 || statusRank[item.status] >= 1;
      const hasViewingEvidence = relatedViewings.length > 0 || statusRank[item.status] >= 2;
      const hasNegotiationEvidence = (item.offers?.length || 0) > 0 || statusRank[item.status] >= 3;
      const hasWonEvidence = item.status === 'Câștigat';

      return {
        pipeline: true,
        contacted: hasContactEvidence,
        viewing: hasViewingEvidence,
        negotiation: hasNegotiationEvidence,
        won: hasWonEvidence,
      };
    });
    const funnelStages: Array<{ label: string; key: keyof (typeof funnelEvidence)[number] }> = [
      { label: 'Intrate în pipeline', key: 'pipeline' },
      { label: 'Contactate', key: 'contacted' },
      { label: 'Ajunse la vizionare', key: 'viewing' },
      { label: 'Ajunse în negociere', key: 'negotiation' },
      { label: 'Câștigate', key: 'won' },
    ];
    const funnelRows = funnelStages.map((stage, index) => {
      const reached = funnelEvidence.filter((item) => item[stage.key]).length;
      const previousReached = index === 0
        ? funnelEvidence.length
        : funnelEvidence.filter((item) => item[funnelStages[index - 1].key]).length;
      return {
        label: stage.label,
        reached,
        rateFromPrevious: ratio(reached, previousReached),
        rateFromStart: ratio(reached, funnelEvidence.length),
      };
    });

    const leadsWithoutFollowUp = nonArchivedContacts.filter((item) => {
      if (item.status === 'Câștigat' || item.status === 'Pierdut') return false;
      const history = item.interactionHistory || [];
      if (history.length) {
        const latest = history.reduce((a, b) => new Date(a.date).getTime() > new Date(b.date).getTime() ? a : b);
        return now - new Date(latest.date).getTime() > 1000 * 60 * 60 * 24 * 3;
      }
      if (!item.createdAt) return true;
      return now - new Date(item.createdAt).getTime() > 1000 * 60 * 60 * 24 * 3;
    }).length;

    const propertiesLowMedia = active.filter((item) => (item.images?.length || 0) < 8).length;
    const propertiesWeakDescription = active.filter((item) => (item.description?.trim().length || 0) < 150).length;
    const propertiesNeedingOptimization = active.filter((item) => (
      (item.images?.length || 0) < 8 || (item.description?.trim().length || 0) < 150
    )).length;

    const totalSalesVolume = sold.reduce((sum, item) => sum + (item.price || 0), 0);
    const leadsWithoutBudget = nonArchivedContacts.filter((item) => !item.budget || item.budget <= 0).length;
    const leadsMissingCreatedAt = nonArchivedContacts.filter((item) => !item.createdAt).length;
    const propertiesMissingCreatedAt = properties.filter((item) => !item.createdAt).length;
    const conversionRate = nonArchivedContacts.length ? (won.length / nonArchivedContacts.length) * 100 : 0;
    const averageDealSize = sold.length ? totalSalesVolume / sold.length : 0;

    const contactsCurrent = nonArchivedContacts.filter((item) => isBetween(getTime(item.createdAt), currentPeriodStart, now)).length;
    const contactsPrevious = nonArchivedContacts.filter((item) => isBetween(getTime(item.createdAt), previousPeriodStart, currentPeriodStart)).length;
    const propertiesCurrent = properties.filter((item) => isBetween(getTime(item.createdAt), currentPeriodStart, now)).length;
    const propertiesPrevious = properties.filter((item) => isBetween(getTime(item.createdAt), previousPeriodStart, currentPeriodStart)).length;
    const viewingsCurrent = viewings.filter((item) => isBetween(getTime(item.viewingDate), currentPeriodStart, now)).length;
    const viewingsPrevious = viewings.filter((item) => isBetween(getTime(item.viewingDate), previousPeriodStart, currentPeriodStart)).length;
    const salesVolumeCurrent = sold
      .filter((item) => isBetween(getTime(item.statusUpdatedAt), currentPeriodStart, now))
      .reduce((sum, item) => sum + (item.price || 0), 0);
    const salesVolumePrevious = sold
      .filter((item) => isBetween(getTime(item.statusUpdatedAt), previousPeriodStart, currentPeriodStart))
      .reduce((sum, item) => sum + (item.price || 0), 0);

    const comparisonRows: ComparisonItem[] = [
      {
        label: 'Lead-uri noi',
        currentLabel: `ultimele ${PERIOD_DAYS} zile`,
        previousLabel: `${PERIOD_DAYS} zile anterioare`,
        currentValue: contactsCurrent,
        previousValue: contactsPrevious,
        delta: contactsCurrent - contactsPrevious,
      },
      {
        label: 'Proprietăți noi',
        currentLabel: `ultimele ${PERIOD_DAYS} zile`,
        previousLabel: `${PERIOD_DAYS} zile anterioare`,
        currentValue: propertiesCurrent,
        previousValue: propertiesPrevious,
        delta: propertiesCurrent - propertiesPrevious,
      },
      {
        label: 'Vizionări',
        currentLabel: `ultimele ${PERIOD_DAYS} zile`,
        previousLabel: `${PERIOD_DAYS} zile anterioare`,
        currentValue: viewingsCurrent,
        previousValue: viewingsPrevious,
        delta: viewingsCurrent - viewingsPrevious,
      },
      {
        label: 'Volum vânzări',
        currentLabel: `ultimele ${PERIOD_DAYS} zile`,
        previousLabel: `${PERIOD_DAYS} zile anterioare`,
        currentValue: salesVolumeCurrent,
        previousValue: salesVolumePrevious,
        delta: salesVolumeCurrent - salesVolumePrevious,
        type: 'currency',
      },
    ];

    const sourceConversionRows = sourceRows.map((item) => {
      const sourceContacts = nonArchivedContacts.filter((contact) => normalizeLeadSource(contact.source) === item.source);
      const leads = sourceContacts.length;
      const contacted = sourceContacts.filter((contact) => statusRank[contact.status] >= 1).length;
      const viewingsReached = sourceContacts.filter((contact) => statusRank[contact.status] >= 2).length;
      const negotiating = sourceContacts.filter((contact) => statusRank[contact.status] >= 3).length;
      const wonCount = sourceContacts.filter((contact) => contact.status === 'Câștigat').length;
      const lostCount = sourceContacts.filter((contact) => contact.status === 'Pierdut').length;

      return {
        source: item.source,
        leads,
        contacted,
        viewings: viewingsReached,
        negotiating,
        won: wonCount,
        lost: lostCount,
        winRate: ratio(wonCount, leads),
        pipelineRate: ratio(viewingsReached, leads),
      };
    });

    const completedOrScheduledPropertyIds = new Set(
      viewings
        .filter((item) => item.status === 'completed' || item.status === 'scheduled')
        .map((item) => item.propertyId)
    );
    const activeWithoutViewings = active.filter((item) => {
      const createdAt = getTime(item.createdAt);
      return (
        createdAt !== null &&
        now - createdAt > PERIOD_DAYS * 24 * 60 * 60 * 1000 &&
        !completedOrScheduledPropertyIds.has(item.id)
      );
    }).length;

    const contactedNotViewing = nonArchivedContacts.filter((item) => {
      const status = item.status;
      if (status !== 'Contactat') return false;
      const createdAt = getTime(item.createdAt);
      return createdAt !== null && now - createdAt > 7 * 24 * 60 * 60 * 1000;
    }).length;

    const negotiationStalled = nonArchivedContacts.filter((item) => {
      if (item.status !== 'În negociere') return false;
      const history = item.interactionHistory || [];
      const latestTime = history.length
        ? Math.max(...history.map((entry) => getTime(entry.date) || 0))
        : getTime(item.createdAt);
      return latestTime !== null && now - latestTime > 7 * 24 * 60 * 60 * 1000;
    }).length;

    const weakSources = sourceConversionRows.filter((item) => item.leads >= 3 && item.pipelineRate < 25).length;
    const reservedStale = properties.filter((item) => {
      if (item.status !== 'Rezervat') return false;
      const statusTime = getTime(item.statusUpdatedAt) || getTime(item.createdAt);
      return statusTime !== null && now - statusTime > 14 * 24 * 60 * 60 * 1000;
    }).length;
    const highRiskLeads = nonArchivedContacts.filter((item) => {
      if (item.status === 'Câștigat' || item.status === 'Pierdut') return false;
      const history = item.interactionHistory || [];
      const latestTime = history.length
        ? Math.max(...history.map((entry) => getTime(entry.date) || 0))
        : getTime(item.createdAt);
      const stale = latestTime !== null && now - latestTime > 7 * 24 * 60 * 60 * 1000;
      const weakQualification = !item.budget || item.budget <= 0;
      return stale || weakQualification;
    }).length;

    const firstContactDurations = nonArchivedContacts
      .map((item) => {
        const createdAt = getTime(item.createdAt);
        const firstInteraction = (item.interactionHistory || [])
          .map((entry) => getTime(entry.date))
          .filter((value): value is number => value !== null)
          .sort((a, b) => a - b)[0];
        if (createdAt === null || firstInteraction === undefined || firstInteraction < createdAt) {
          return null;
        }
        return (firstInteraction - createdAt) / (1000 * 60 * 60);
      })
      .filter((value): value is number => value !== null);

    const viewingLookup = new Map<string, number[]>();
    viewings.forEach((item) => {
      const viewingTime = getTime(item.viewingDate);
      if (viewingTime === null) return;
      const existing = viewingLookup.get(item.contactId) || [];
      existing.push(viewingTime);
      viewingLookup.set(item.contactId, existing);
    });
    const leadToViewingDurations = nonArchivedContacts
      .map((item) => {
        const createdAt = getTime(item.createdAt);
        const viewTimes = (viewingLookup.get(item.id) || []).sort((a, b) => a - b);
        const firstViewing = viewTimes[0];
        if (createdAt === null || firstViewing === undefined || firstViewing < createdAt) {
          return null;
        }
        return (firstViewing - createdAt) / (1000 * 60 * 60 * 24);
      })
      .filter((value): value is number => value !== null);

    const leadToWinDurations = nonArchivedContacts
      .filter((item) => item.status === 'Câștigat')
      .map((item) => {
        const createdAt = getTime(item.createdAt);
        const lastOfferDate = item.offers && item.offers.length > 0 ? item.offers[item.offers.length - 1]?.date : null;
        const lastInteractionDate =
          item.interactionHistory && item.interactionHistory.length > 0
            ? item.interactionHistory[item.interactionHistory.length - 1]?.date
            : null;
        const finalTime = getTime(lastOfferDate) || getTime(lastInteractionDate);
        if (createdAt === null || finalTime === null || finalTime < createdAt) {
          return null;
        }
        return (finalTime - createdAt) / (1000 * 60 * 60 * 24);
      })
      .filter((value): value is number => value !== null);

    const contactedStageCount = nonArchivedContacts.filter((item) => item.status === 'Contactat').length;
    const negotiationStageCount = nonArchivedContacts.filter((item) => item.status === 'În negociere').length;
    const activeSourceCount = sourceConversionRows.filter((item) => item.leads >= 3).length;
    const weakSourceRate = ratio(weakSources, activeSourceCount || 1);
    const followUpDelayRate = ratio(leadsWithoutFollowUp, activeLeads.length || 1);
    const contactedStuckRate = ratio(contactedNotViewing, contactedStageCount || 1);
    const negotiationStalledRate = ratio(negotiationStalled, negotiationStageCount || 1);
    const noTractionRate = ratio(activeWithoutViewings, active.length || 1);
    const staleReservationRate = ratio(reservedStale, reserved || 1);
    const lowMediaRate = ratio(propertiesLowMedia, active.length || 1);
    const weakDescriptionRate = ratio(propertiesWeakDescription, active.length || 1);
    const missingCreatedAtRate = ratio(leadsMissingCreatedAt + propertiesMissingCreatedAt, contacts.length + properties.length || 1);
    const budgetGapRate = ratio(leadsWithoutBudget, nonArchivedContacts.length || 1);
    const salesTrend = percentChange(salesVolumeCurrent, salesVolumePrevious);
    const viewingTrend = percentChange(viewingsCurrent, viewingsPrevious);

    const dataQualitySignals = [
      ratio(nonArchivedContacts.length - leadsMissingCreatedAt, nonArchivedContacts.length || 1),
      ratio(nonArchivedContacts.length - leadsWithoutBudget, nonArchivedContacts.length || 1),
      ratio(properties.length - propertiesMissingCreatedAt, properties.length || 1),
      ratio(active.length - propertiesLowMedia, active.length || 1),
      ratio(active.length - propertiesWeakDescription, active.length || 1),
    ];
    const dataQualityScore = average(dataQualitySignals);

    const dataQualityRows: DetailMetricItem[] = [
      {
        label: 'Scor calitate date',
        value: pct(dataQualityScore),
        helper: 'Cu cât e mai mare, cu atât rapoartele și recomandările sunt mai credibile.',
      },
      {
        label: 'Lead-uri fără data creării',
        value: String(leadsMissingCreatedAt),
        helper: 'Fără `createdAt`, metricile de viteză și comparațiile sunt mai puțin precise.',
        href: '/leads?reportPreset=missing-created-at',
      },
      {
        label: 'Proprietăți cu media slabă',
        value: String(propertiesLowMedia),
        helper: 'Listări active cu mai puțin de 8 imagini.',
        href: '/properties?reportPreset=weak-media',
      },
      {
        label: 'Descrieri insuficiente',
        value: String(propertiesWeakDescription),
        helper: 'Listări active cu descrieri prea scurte pentru conversie bună.',
        href: '/properties?reportPreset=weak-description',
      },
    ];

    const speedRows: DetailMetricItem[] = [
      {
        label: 'Timp mediu până la primul contact',
        value: `${average(firstContactDurations).toFixed(1)}h`,
        helper: 'Măsoară viteza de reacție la lead-urile noi.',
      },
      {
        label: 'Timp mediu până la prima vizionare',
        value: `${average(leadToViewingDurations).toFixed(1)} zile`,
        helper: 'Arată cât de repede împingi lead-ul către o interacțiune cu miză reală.',
      },
      {
        label: 'Timp mediu lead -> câștig',
        value: `${average(leadToWinDurations).toFixed(1)} zile`,
        helper: 'Bun pentru înțelegerea duratei reale de închidere.',
      },
      {
        label: 'Rată activare vizionări',
        value: pct(totalViewings ? ratio(completedViewings + scheduledViewings, totalViewings) : 0),
        helper: 'Procentul vizionărilor care nu au fost pierdute prin anulare.',
      },
    ];

    const riskRows: DetailMetricItem[] = [
      {
        label: 'Lead-uri cu risc ridicat',
        value: String(highRiskLeads),
        helper: 'Lead-uri active cu semnale de stagnare sau calificare slabă.',
        href: '/leads?reportPreset=high-risk',
      },
      {
        label: 'Contactați fără vizionare',
        value: String(contactedNotViewing),
        helper: 'Blocaj clasic între interes și acțiune comercială.',
        href: '/leads?reportPreset=contacted-no-viewing',
      },
      {
        label: 'Negocieri stagnante',
        value: String(negotiationStalled),
        helper: 'Lead-uri aproape de închidere, dar fără mișcare recentă.',
        href: '/leads?reportPreset=negotiation-stalled',
      },
      {
        label: 'Rezervări stagnante',
        value: String(reservedStale),
        helper: 'Proprietăți rezervate de peste 14 zile care pot ascunde blocaje de finalizare.',
        href: '/properties?reportPreset=reserved-stale',
      },
    ];

    const blockerRows: BlockerItem[] = [
      {
        title: 'Follow-up întârziat',
        value: leadsWithoutFollowUp,
        tone: toneFromRate(followUpDelayRate, 18, 30),
        description: `${pct(followUpDelayRate)} din lead-urile active nu au interacțiune recentă. Aici se răcește cel mai repede pipeline-ul.`,
        href: '/leads?reportPreset=followup-delayed',
      },
      {
        title: 'Contactați fără vizionare',
        value: contactedNotViewing,
        tone: toneFromRate(contactedStuckRate, 22, 35),
        description: `${pct(contactedStuckRate)} din lead-urile aflate în Contactat stau peste 7 zile fără să avanseze spre vizionare.`,
        href: '/leads?reportPreset=contacted-no-viewing',
      },
      {
        title: 'Negocieri stagnante',
        value: negotiationStalled,
        tone: toneFromRate(negotiationStalledRate, 20, 35),
        description: `${pct(negotiationStalledRate)} din negocieri nu au mișcare recentă și riscă să se răcească înainte de închidere.`,
        href: '/leads?reportPreset=negotiation-stalled',
      },
      {
        title: 'Active fără tracțiune',
        value: activeWithoutViewings,
        tone: toneFromRate(noTractionRate, 18, 30),
        description: `${pct(noTractionRate)} din portofoliul activ este mai vechi de 30 de zile fără vizionări programate sau finalizate.`,
        href: '/properties?reportPreset=active-no-traction',
      },
    ];
    blockerRows.sort((left, right) => {
      const toneRank = { high: 0, medium: 1, good: 2 };
      if (toneRank[left.tone] !== toneRank[right.tone]) {
        return toneRank[left.tone] - toneRank[right.tone];
      }
      return right.value - left.value;
    });

    const pipelineHealthScore = clamp(
      average([
        100 - followUpDelayRate * 1.4,
        100 - contactedStuckRate * 1.4,
        100 - negotiationStalledRate * 1.7,
        clamp(conversionRate * 2.2),
      ])
    );
    const portfolioHealthScore = clamp(
      average([
        100 - lowMediaRate,
        100 - weakDescriptionRate,
        100 - noTractionRate * 1.6,
        100 - staleReservationRate * 1.4,
      ])
    );
    const businessHealthScore = clamp(
      average([
        clamp(100 - ratio(lost.length, contacts.length || 1)),
        clamp(conversionRate * 2),
        clamp(ratio(completedViewings + scheduledViewings, totalViewings || 1)),
        clamp(100 + salesTrend / 2),
      ])
    );
    const businessHealthFactors = [
      `Conversie generală: ${pct(conversionRate)}.`,
      `Trend volum vânzări: ${salesTrend >= 0 ? '+' : ''}${salesTrend.toFixed(1)}% vs perioada anterioară.`,
      `${lost.length} lead-uri sunt marcate pierdute.`,
    ];
    const pipelineHealthFactors = [
      `${pct(followUpDelayRate)} din lead-urile active au follow-up restant.`,
      `${pct(contactedStuckRate)} din etapa Contactat stagnează fără vizionare.`,
      `${pct(negotiationStalledRate)} din negocieri sunt reci.`,
    ];
    const portfolioHealthFactors = [
      `${pct(noTractionRate)} din active nu au tracțiune comercială.`,
      `${pct(lowMediaRate)} din active au media insuficientă.`,
      `${pct(weakDescriptionRate)} din active au descrieri slabe.`,
    ];
    const dataQualityFactors = [
      `Scor de încredere în date: ${pct(dataQualityScore)}.`,
      `${pct(budgetGapRate)} din lead-uri nu au buget clar.`,
      `${pct(missingCreatedAtRate)} din înregistrări lipsesc date critice de timp.`,
    ];
    const scoreRows: ScoreCardItem[] = [
      {
        title: 'Business Health',
        score: businessHealthScore,
        summary: 'Imagine de ansamblu asupra conversiei, pierderilor și ritmului comercial.',
        trend: salesTrend,
        factors: businessHealthFactors,
        href: '/leads?reportPreset=won-or-lost',
      },
      {
        title: 'Pipeline Health',
        score: pipelineHealthScore,
        summary: 'Calitatea mișcării prin funnel și nivelul real de blocaj în lead-uri.',
        trend: viewingTrend,
        factors: pipelineHealthFactors,
        href: '/leads?reportPreset=followup-delayed',
      },
      {
        title: 'Portfolio Health',
        score: portfolioHealthScore,
        summary: 'Tracțiunea portofoliului activ și presiunea pe optimizare / repoziționare.',
        trend: -noTractionRate,
        factors: portfolioHealthFactors,
        href: '/properties?reportPreset=active-no-traction',
      },
      {
        title: 'Data Quality',
        score: dataQualityScore,
        summary: 'Cât de mult poți avea încredere în cifrele și concluziile generate de pagină.',
        trend: -(budgetGapRate + missingCreatedAtRate) / 2,
        factors: dataQualityFactors,
        href: '/leads?reportPreset=missing-created-at',
      },
    ];

    const alertRows: AlertItem[] = [
      ...(followUpDelayRate >= 25
        ? [{
            title: 'Restanță serioasă de follow-up în pipeline',
            description: `${pct(followUpDelayRate)} din lead-urile active nu au interacțiune recentă. Riscul real este răcirea lead-urilor înainte să ajungă la vizionare.`,
            tone: 'high' as const,
            href: '/leads?reportPreset=followup-delayed',
          }]
        : []),
      ...(average(firstContactDurations) > 24
        ? [{
            title: 'Reacție lentă la lead-urile noi',
            description: `Timpul mediu până la primul contact este ${average(firstContactDurations).toFixed(1)} ore, peste ritmul sănătos pentru lead-uri noi.`,
            tone: 'high' as const,
            href: '/leads?reportPreset=followup-delayed',
          }]
        : []),
      ...(contactedStuckRate >= 30
        ? [{
            title: 'Etapa Contactat pierde prea mult',
            description: `${pct(contactedStuckRate)} din lead-urile aflate în Contactat nu trec spre vizionare.`,
            tone: 'high' as const,
            href: '/leads?reportPreset=contacted-no-viewing',
          }]
        : []),
      ...(dataQualityScore < 75
        ? [{
            title: 'Calitate insuficientă a datelor',
            description: `Scorul de calitate a datelor este ${pct(dataQualityScore)} și reduce încrederea în concluziile manageriale.`,
            tone: 'medium' as const,
            href: '/leads?reportPreset=missing-created-at',
          }]
        : []),
      ...(noTractionRate >= 25
        ? [{
            title: 'Portofoliu activ fără tracțiune',
            description: `${pct(noTractionRate)} din proprietățile active sunt vechi și fără vizionări, ceea ce indică probleme de preț, prezentare sau promovare.`,
            tone: 'medium' as const,
            href: '/properties?reportPreset=active-no-traction',
          }]
        : []),
    ];

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const daysPassedThisMonth = Math.max(1, Math.ceil((now - monthStart.getTime()) / (1000 * 60 * 60 * 24)));
    const monthLength = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const projectMonthTotal = (value: number) => Math.round((value / daysPassedThisMonth) * monthLength);
    const contactsThisMonth = nonArchivedContacts.filter((item) => isBetween(getTime(item.createdAt), monthStart.getTime(), now)).length;
    const viewingsThisMonth = viewings.filter((item) => isBetween(getTime(item.viewingDate), monthStart.getTime(), now)).length;
    const wonThisMonth = nonArchivedContacts.filter((item) => item.status === 'Câștigat' && isBetween(getTime(item.createdAt), monthStart.getTime(), now)).length;
    const salesThisMonth = sold
      .filter((item) => isBetween(getTime(item.statusUpdatedAt), monthStart.getTime(), now))
      .reduce((sum, item) => sum + (item.price || 0), 0);

    const forecastRows: ForecastItem[] = [
      {
        title: 'Lead-uri lună curentă',
        currentValue: contactsThisMonth,
        projectedValue: projectMonthTotal(contactsThisMonth),
        type: 'number',
        helper: 'Estimare la final de lună pe baza ritmului actual de intrare în CRM.',
      },
      {
        title: 'Vizionări lună curentă',
        currentValue: viewingsThisMonth,
        projectedValue: projectMonthTotal(viewingsThisMonth),
        type: 'number',
        helper: 'Estimare de volum operațional dacă ritmul actual se păstrează.',
      },
      {
        title: 'Câștigate lună curentă',
        currentValue: wonThisMonth,
        projectedValue: projectMonthTotal(wonThisMonth),
        type: 'number',
        helper: 'Forecast simplu pentru rezultat comercial la finalul lunii.',
      },
      {
        title: 'Volum vânzări lună curentă',
        currentValue: salesThisMonth,
        projectedValue: projectMonthTotal(salesThisMonth),
        type: 'currency',
        helper: 'Estimare brută de volum la finalul lunii.',
      },
    ];

    const inputRows: SectionSignalItem[] = [
      { title: 'Lead-uri noi', value: String(contactsCurrent), helper: `${contactsPrevious} în perioada anterioară.`, href: '/leads?reportPreset=new-this-period' },
      { title: 'Surse active', value: String(sourceRows.length), helper: `${weakSources} surse cer intervenție.`, href: '/leads?reportPreset=weak-sources' },
      { title: 'Proprietăți noi', value: String(propertiesCurrent), helper: `${propertiesPrevious} în perioada anterioară.`, href: '/properties?reportPreset=new-this-period' },
    ];

    const outputRows: SectionSignalItem[] = [
      { title: 'Câștigate', value: String(won.length), helper: `${pct(conversionRate)} rată de conversie totală.`, href: '/leads?reportPreset=won-or-lost' },
      { title: 'Volum total vânzări', value: euro(totalSalesVolume), helper: `${sold.length} proprietăți vândute.`, href: '/properties?reportPreset=sold-this-period' },
      { title: 'Valoare medie tranzacție', value: euro(averageDealSize), helper: `${salesTrend >= 0 ? '+' : ''}${salesTrend.toFixed(1)}% trend pe vânzări vs perioada anterioară.` },
    ];
    const dataConfidenceLabel = dataQualityScore >= 80 ? 'Ridicata' : dataQualityScore >= 65 ? 'Medie' : 'Scazuta';

    return {
      salesData,
      buyerSourceData,
      sourceRows,
      statusRows,
      comparisonRows,
      funnelRows,
      sourceConversionRows,
      blockerRows,
      dataQualityRows,
      speedRows,
      riskRows,
      scoreRows,
      alertRows,
      forecastRows,
      inputRows,
      outputRows,
      totalLeads: nonArchivedContacts.length,
      archivedLeads: archivedContacts.length,
      activeLeads: activeLeads.length,
      lostLeads: lost.length,
      totalWonBuyers: won.length,
      conversionRate,
      averageDealSize,
      totalSalesVolume,
      totalProperties: properties.length,
      activeProperties: active.length,
      soldProperties: sold.length,
      reservedProperties: reserved,
      inactiveProperties: inactive,
      activeInventoryValue: active.reduce((sum, item) => sum + (item.price || 0), 0),
      totalViewings,
      completedViewings,
      scheduledViewings,
      cancelledViewings,
      viewingCompletionRate: totalViewings ? ((completedViewings + scheduledViewings) / totalViewings) * 100 : 0,
      propertiesNeedingOptimization,
      leadsWithoutFollowUp,
      leadsWithoutBudget,
      dataQualityScore,
      leadsMissingCreatedAt,
      propertiesMissingCreatedAt,
      propertiesLowMedia,
      propertiesWeakDescription,
      highRiskLeads,
      contactedWithoutViewing: contactedNotViewing,
      negotiationStalled,
      activeWithoutViewings: activeWithoutViewings,
      reservedStale,
      avgHoursToFirstContact: average(firstContactDurations),
      avgDaysToViewing: average(leadToViewingDurations),
      avgDaysLeadToWin: average(leadToWinDurations),
      dataConfidenceLabel,
    };

}
