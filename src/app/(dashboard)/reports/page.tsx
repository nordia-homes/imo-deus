'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { BuyerSourceData, Contact, Property, SalesData, Viewing } from '@/lib/types';
import { summarizeReport } from '@/ai/flows/report-summarizer';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { LeadSourceChart } from '@/components/dashboard/lead-source-chart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgency } from '@/context/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import { isArchivedContact } from '@/lib/contact-aging';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  Home,
  Lightbulb,
  Loader2,
  Minus,
  Sparkles,
  Users,
} from 'lucide-react';

type AiReport = Awaited<ReturnType<typeof summarizeReport>>;
type StatusItem = { label: string; value: number; share: number };
type SourceItem = { source: string; count: number; share: number; fill: string };
type ComparisonItem = {
  label: string;
  currentLabel: string;
  previousLabel: string;
  currentValue: number;
  previousValue: number;
  delta: number;
  type?: 'currency' | 'number';
};
type FunnelItem = {
  label: string;
  reached: number;
  rateFromPrevious: number;
  rateFromStart: number;
};
type SourceConversionItem = {
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
type BlockerItem = {
  title: string;
  value: number;
  tone: 'high' | 'medium' | 'good';
  description: string;
  href: string;
};
type DetailMetricItem = {
  label: string;
  value: string;
  helper: string;
  href?: string;
};
type ScoreCardItem = {
  title: string;
  score: number;
  summary: string;
  trend: number;
  factors: string[];
  href: string;
};
type AlertItem = {
  title: string;
  description: string;
  tone: 'high' | 'medium' | 'good';
  href: string;
};
type ForecastItem = {
  title: string;
  currentValue: number;
  projectedValue: number;
  type: 'currency' | 'number';
  helper: string;
};
type SectionSignalItem = {
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

export default function ReportsPage() {
  const { agencyId } = useAgency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const contactsQuery = useMemoFirebase(() => (
    agencyId ? collection(firestore, 'agencies', agencyId, 'contacts') : null
  ), [firestore, agencyId]);
  const propertiesQuery = useMemoFirebase(() => (
    agencyId ? collection(firestore, 'agencies', agencyId, 'properties') : null
  ), [firestore, agencyId]);
  const viewingsQuery = useMemoFirebase(() => (
    agencyId ? collection(firestore, 'agencies', agencyId, 'viewings') : null
  ), [firestore, agencyId]);

  const { data: contacts, isLoading: contactsLoading } = useCollection<Contact>(contactsQuery);
  const { data: properties, isLoading: propertiesLoading } = useCollection<Property>(propertiesQuery);
  const { data: viewings, isLoading: viewingsLoading } = useCollection<Viewing>(viewingsQuery);
  const isLoading = contactsLoading || propertiesLoading || viewingsLoading;

  const metrics = useMemo(() => {
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

    const now = Date.now();
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
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!monthly[key]) monthly[key] = { date: new Date(date.getFullYear(), date.getMonth(), 1), sales: 0 };
      monthly[key].sales += item.price || 0;
    });

    const salesData = Object.values(monthly)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((item) => ({
        month: item.date.toLocaleString('ro-RO', { month: 'short', year: 'numeric' }),
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
  }, [contacts, properties, viewings]);

  const generateAiReport = async () => {
    setIsGenerating(true);
    setAiReport(null);
    try {
      const result = await summarizeReport({
        salesData: metrics.salesData,
        leadSourceData: metrics.buyerSourceData,
        kpis: {
          totalWonLeads: metrics.totalWonBuyers,
          conversionRate: metrics.conversionRate,
          averageDealSize: metrics.averageDealSize,
        },
        additionalMetrics: {
          totalLeads: metrics.totalLeads,
          activeLeads: metrics.activeLeads,
          lostLeads: metrics.lostLeads,
          totalProperties: metrics.totalProperties,
          activeProperties: metrics.activeProperties,
          soldProperties: metrics.soldProperties,
          reservedProperties: metrics.reservedProperties,
          inactiveProperties: metrics.inactiveProperties,
          totalSalesVolume: metrics.totalSalesVolume,
          activeInventoryValue: metrics.activeInventoryValue,
          totalViewings: metrics.totalViewings,
          completedViewings: metrics.completedViewings,
          scheduledViewings: metrics.scheduledViewings,
          cancelledViewings: metrics.cancelledViewings,
          viewingCompletionRate: metrics.viewingCompletionRate,
          propertiesNeedingOptimization: metrics.propertiesNeedingOptimization,
          leadsWithoutFollowUp: metrics.leadsWithoutFollowUp,
          leadsWithoutBudget: metrics.leadsWithoutBudget,
          dataQualityScore: metrics.dataQualityScore,
          leadsMissingCreatedAt: metrics.leadsMissingCreatedAt,
          propertiesMissingCreatedAt: metrics.propertiesMissingCreatedAt,
          propertiesLowMedia: metrics.propertiesLowMedia,
          propertiesWeakDescription: metrics.propertiesWeakDescription,
          highRiskLeads: metrics.highRiskLeads,
          contactedWithoutViewing: metrics.contactedWithoutViewing,
          negotiationStalled: metrics.negotiationStalled,
          activeWithoutViewings: metrics.activeWithoutViewings,
          reservedStale: metrics.reservedStale,
          avgHoursToFirstContact: metrics.avgHoursToFirstContact,
          avgDaysToViewing: metrics.avgDaysToViewing,
          avgDaysLeadToWin: metrics.avgDaysLeadToWin,
        },
        topSources: metrics.sourceRows.slice(0, 5).map((item) => ({
          source: item.source,
          count: item.count,
          share: item.share,
        })),
        statusBreakdown: metrics.statusRows.map((item) => ({ label: item.label, value: item.value })),
        scoreSummary: metrics.scoreRows.map((item) => ({
          title: item.title,
          score: item.score,
          trend: item.trend,
          summary: item.summary,
          factors: item.factors,
        })),
        alerts: metrics.alertRows.map((item) => ({
          title: item.title,
          description: item.description,
          tone: item.tone,
        })),
        forecast: metrics.forecastRows,
        funnelBreakdown: metrics.funnelRows.map((item) => ({
          label: item.label,
          reached: item.reached,
          rateFromPrevious: item.rateFromPrevious,
          rateFromStart: item.rateFromStart,
        })),
        dataConfidenceLabel: metrics.dataConfidenceLabel,
      });
      setAiReport(result);
      toast({
        title: 'Analiză completă!',
        description: 'Raportul AI a fost generat cu OpenAI.',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'A apărut o eroare',
        description: 'Nu am putut genera analiza AI. Vă rugăm să reîncercați.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const recommendations = (aiReport?.recommendations || '')
    .split('\n')
    .map((item) => item.replace(/^-/, '').trim())
    .filter(Boolean);

  return (
    <div className="agentfinder-reports-page space-y-6 bg-[#0F1E33] p-4 text-white lg:p-6">
      <div className="agentfinder-reports-hero flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold text-white">Rapoarte de Performanță</h1>
          <p className="max-w-3xl text-white/70">
            Pagina include acum o vedere completă asupra lead-urilor, portofoliului, vizionărilor și performanței comerciale.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-primary/30 bg-primary/10 text-primary">
          OpenAI activ pentru analiza AI
        </Badge>
      </div>

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Lightbulb className="text-primary" />
                Analiză și Recomandări AI
              </CardTitle>
              <CardDescription className="text-white/70">
                Sinteză executivă, puncte forte, riscuri și oportunități generate acum cu OpenAI.
              </CardDescription>
            </div>
            <Button onClick={generateAiReport} disabled={isLoading || isGenerating} className="bg-primary hover:bg-primary/90">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {aiReport ? 'Regenerează Analiza' : 'Generează Analiza AI'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGenerating && (
            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-white/70">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              OpenAI analizează datele din CRM...
            </div>
          )}
          {!isGenerating && aiReport && (
            <>
              <Alert className="border-white/10 bg-white/5 text-white">
                <AlertTitle>Sinteză Executivă</AlertTitle>
                <AlertDescription className="text-white/90">{aiReport.summary}</AlertDescription>
              </Alert>
              <div className="grid gap-4 lg:grid-cols-2">
                <ExecutivePanel
                  title="Ce se întâmplă"
                  text={aiReport.whatIsHappening}
                  subtitle="Lectura scurtă a situației actuale din business."
                />
                <ExecutivePanel
                  title="De ce se întâmplă"
                  text={aiReport.whyItIsHappening}
                  subtitle="Cauza dominantă sau explicația operațională cea mai probabilă."
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <p className="font-semibold text-emerald-300">Puncte forte</p>
                  <div className="mt-3 space-y-2 text-sm text-white/90">
                    {aiReport.strengths.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
                  </div>
                </div>
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                  <p className="flex items-center gap-2 font-semibold text-rose-300">
                    <CircleAlert className="h-4 w-4" />
                    Riscuri
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-white/90">
                    {aiReport.risks.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
                  </div>
                </div>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                  <p className="font-semibold text-sky-300">Oportunități</p>
                  <div className="mt-3 space-y-2 text-sm text-white/90">
                    {aiReport.opportunities.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
                  </div>
                </div>
              </div>
              <Alert className="border-primary/20 bg-primary/10 text-white">
                <AlertTitle className="text-primary">Acțiuni recomandate</AlertTitle>
                <AlertDescription className="text-white/90">
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {recommendations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
              <div className="grid gap-4 lg:grid-cols-3">
                <ExecutivePanel title="Prioritatea #1" text={aiReport.priority} subtitle="Cea mai importantă intervenție imediată." />
                <ExecutivePanel title="Cea mai mare pierdere" text={aiReport.biggestLoss} subtitle="Zona care trage cel mai mult în jos performanța." />
                <ExecutivePanel title="Ce facem azi" text={aiReport.todayFocus} subtitle="Acțiunea operațională de azi pentru a crea mișcare rapidă." />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <ExecutivePanel title="Ce nu facem acum" text={aiReport.notNow} subtitle="Lucrurile care nu merită să consume focusul imediat." />
                <ExecutivePanel title="Focus 7 zile" text={aiReport.next7DaysFocus} subtitle="Direcția recomandată pentru următoarea săptămână." />
                <ExecutivePanel title="KPI săptămâna viitoare" text={aiReport.nextWeekKpi} subtitle="Indicatorul principal care merită urmărit săptămâna viitoare." />
              </div>
              <Card className="border border-white/10 bg-white/5 text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-white">KPI-uri influențate</CardTitle>
                  <CardDescription className="text-white/65">
                    Indicatorii care ar trebui să se îmbunătățească dacă planul este executat bine.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {aiReport.affectedKpis.map((item, index) => (
                      <Badge key={`${item}-${index}`} variant="outline" className="border-white/15 bg-white/5 text-white/90">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          {!isGenerating && !aiReport && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-white/70">
              Apasă pe buton pentru a genera analiza OpenAI pe baza datelor curente.
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-0 text-xs text-white/45">
          Raportul AI din această pagină nu mai folosește Gemini.
        </CardFooter>
      </Card>

      <SectionHeader
        eyebrow="Decizie"
        title="Unde merită să intervii prima dată"
        description="Zona executivă a paginii: concluzie AI, scoruri explicabile, alerte relative și forecast simplu pentru finalul lunii."
      />

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Scoreboard Executiv</CardTitle>
          <CardDescription className="text-white/70">
            Patru semnale rapide pentru a înțelege în câteva secunde starea generală a business-ului și de ce arată așa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[170px] bg-white/10" />
              <Skeleton className="h-[170px] bg-white/10" />
              <Skeleton className="h-[170px] bg-white/10" />
              <Skeleton className="h-[170px] bg-white/10" />
            </>
          ) : (
            metrics.scoreRows.map((item) => (
              <ScoreboardCard key={item.title} item={item} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Alerte Proactive</CardTitle>
          <CardDescription className="text-white/70">
            Semnale care merită atenție imediată înainte să se transforme în pierdere de conversie sau de încredere în date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-[92px] bg-white/10" />
              <Skeleton className="h-[92px] bg-white/10" />
            </>
          ) : metrics.alertRows.length === 0 ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-white/85">
              Nu există alerte majore în acest moment. Indicatorii urmăriți sunt într-o zonă acceptabilă.
            </div>
          ) : (
            metrics.alertRows.map((item, index) => (
              <AlertRow key={`${item.title}-${index}`} item={item} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Blocaje Majore</CardTitle>
          <CardDescription className="text-white/70">
            Zonele care cer intervenție rapidă pentru a nu frâna conversia și viteza comercială.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
            </>
          ) : (
            metrics.blockerRows.map((item) => (
              <BlockerCard key={item.title} item={item} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Forecast Executiv</CardTitle>
          <CardDescription className="text-white/70">
            Estimare simplă de final de lună pe baza ritmului actual din CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
              <Skeleton className="h-[160px] bg-white/10" />
            </>
          ) : (
            metrics.forecastRows.map((item) => (
              <ForecastCard key={item.title} item={item} />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-none bg-[#152A47] text-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">Comparație în Timp</CardTitle>
          <CardDescription className="text-white/70">
            Ultimele 30 de zile versus cele 30 anterioare, ca să vezi direcția business-ului, nu doar fotografia de moment.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[140px] bg-white/10" />
              <Skeleton className="h-[140px] bg-white/10" />
              <Skeleton className="h-[140px] bg-white/10" />
              <Skeleton className="h-[140px] bg-white/10" />
            </>
          ) : (
            metrics.comparisonRows.map((item) => (
              <ComparisonCard key={item.label} item={item} />
            ))
          )}
        </CardContent>
      </Card>

      <SectionHeader
        eyebrow="Proces"
        title="Cum curge pipeline-ul"
        description="Blocaje, viteză, funnel și semnale de stagnare care arată unde se pierde momentum comercial."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <MetricSectionCard
          title="Viteză Proces"
          description="Cât de repede reacționează agenția și cât durează trecerea prin etapele importante."
          items={metrics.speedRows}
          isLoading={isLoading}
        />
        <MetricSectionCard
          title="Risc Comercial"
          description="Semnale de stagnare sau probabilitate mare de pierdere în pipeline și portofoliu."
          items={metrics.riskRows}
          isLoading={isLoading}
        />
      </div>

      <SectionHeader
        eyebrow="Output"
        title="Output detaliat și canale"
        description="Volumul comercial, performanța surselor și rezultatele care merită urmărite mai în profunzime."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 overflow-hidden border border-white/10 bg-[linear-gradient(180deg,#183557_0%,#132B49_100%)] text-white shadow-2xl">
          <CardHeader className="border-b border-white/10 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-white">Volum Vânzări Lunare</CardTitle>
                <CardDescription className="mt-1 text-white/70">Evoluția valorii vânzărilor înregistrate în CRM.</CardDescription>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-primary/80">
                Trend
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-7">
            {isLoading ? <Skeleton className="h-[250px] w-full bg-white/10" /> : <SalesChart data={metrics.salesData} />}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 overflow-hidden border border-white/10 bg-[linear-gradient(180deg,#183557_0%,#132B49_100%)] text-white shadow-2xl">
          <CardHeader className="border-b border-white/10 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-white">Distribuție Surse Cumpărători</CardTitle>
                <CardDescription className="mt-1 text-white/70">Canalele care aduc volum în pipeline.</CardDescription>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-primary/80">
                Top surse
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-7">
            {isLoading ? <Skeleton className="h-[250px] w-full bg-white/10" /> : <LeadSourceChart data={metrics.buyerSourceData} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><Users className="h-5 w-5 text-primary" /> Funnel Lead-uri</CardTitle>
            <CardDescription className="text-white/70">
              Conversii inferate din dovezi istorice deja existente în CRM: interacțiuni, vizionări, oferte și status final.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? <Skeleton className="h-[240px] w-full bg-white/10" /> : metrics.funnelRows.map((item) => (
              <div key={item.label} className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{item.label}</span>
                  <span className="text-white/70">{item.reached} lead-uri</span>
                </div>
                <Progress value={item.rateFromStart} className="h-2 bg-white/10 [&>div]:bg-primary" />
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>din startul funnel-ului: {pct(item.rateFromStart)}</span>
                  <span>din etapa anterioară: {pct(item.rateFromPrevious)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><Home className="h-5 w-5 text-primary" /> Portofoliu</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {isLoading ? <Skeleton className="h-[240px] w-full bg-white/10 sm:col-span-2" /> : (
              <>
                <MiniMetric label="Active" value={metrics.activeProperties} text="listări disponibile" />
                <MiniMetric label="De optimizat" value={metrics.propertiesNeedingOptimization} text="prezentare incompletă" />
                <MiniMetric label="Rezervate" value={metrics.reservedProperties} text="aproape de închidere" />
                <MiniMetric label="Vândute" value={metrics.soldProperties} text="tranzacții finalizate" />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><Activity className="h-5 w-5 text-primary" /> Operațional</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {isLoading ? <Skeleton className="h-[240px] w-full bg-white/10 sm:col-span-2" /> : (
              <>
                <MiniMetric label="Follow-up restant" value={metrics.leadsWithoutFollowUp} text="lead-uri reci" />
                <MiniMetric label="Fără buget" value={metrics.leadsWithoutBudget} text="calificare slabă" />
                <MiniMetric label="Vizionări" value={metrics.scheduledViewings} text="programate" />
                <MiniMetric label="Rată activare" value={pct(metrics.viewingCompletionRate)} text={`${metrics.completedViewings} finalizate`} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-[140px] bg-white/10" />
            <Skeleton className="h-[140px] bg-white/10" />
            <Skeleton className="h-[140px] bg-white/10" />
          </>
        ) : (
          metrics.outputRows.map((item) => <SignalCard key={item.title} item={item} />)
        )}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card className="min-w-0 border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Surse și Conversie</CardTitle>
            <CardDescription className="text-white/70">
              Nu doar volum, ci și cât de departe avansează lead-urile fiecărei surse spre câștig.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            {isLoading ? <Skeleton className="h-[250px] w-full bg-white/10" /> : (
              <div className="min-w-0 overflow-x-auto">
                <Table className="min-w-[520px]">
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/50">Sursă</TableHead>
                      <TableHead className="text-right text-white/50">Lead-uri</TableHead>
                      <TableHead className="text-right text-white/50">În vizionare+</TableHead>
                      <TableHead className="text-right text-white/50">Câștigate</TableHead>
                      <TableHead className="text-right text-white/50">Conv.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.sourceConversionRows.slice(0, 6).map((item) => (
                      <TableRow key={item.source} className="border-white/10 hover:bg-white/5">
                        <TableCell className="font-medium text-white">{item.source}</TableCell>
                        <TableCell className="text-right text-white/80">{item.leads}</TableCell>
                        <TableCell className="text-right text-white/80">{item.viewings}</TableCell>
                        <TableCell className="text-right text-white/80">{item.won}</TableCell>
                        <TableCell className="text-right text-white/80">{pct(item.winRate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-none bg-[#152A47] text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Instantaneu Business</CardTitle>
            <CardDescription className="text-white/70">Indicatori rapizi pentru decizii comerciale.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? <Skeleton className="h-[250px] w-full bg-white/10" /> : (
              <>
                <MiniPanel title="Volum total vânzări" value={euro(metrics.totalSalesVolume)} subtitle={`${metrics.soldProperties} proprietăți vândute`} />
                <MiniPanel title="Lead-uri active" value={`${metrics.activeLeads} / ${metrics.totalLeads}`} subtitle={`${metrics.archivedLeads} arhivate, ${metrics.lostLeads} pierdute`} />
                <MiniPanel title="Vizionări totale" value={String(metrics.totalViewings)} subtitle={`${metrics.completedViewings} finalizate, ${metrics.cancelledViewings} anulate`} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

function MiniMetric({ label, value, text }: { label: string; value: number | string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/70">{text}</p>
    </div>
  );
}

function MiniPanel({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/70">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/60">{subtitle}</p>
    </div>
  );
}

function ExecutivePanel({ title, text, subtitle }: { title: string; text: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/70">{title}</p>
      <p className="mt-2 text-base font-semibold leading-7 text-white">{text}</p>
      <p className="mt-2 text-sm text-white/60">{subtitle}</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.28em] text-primary/80">{eyebrow}</p>
      <div>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-white/65">{description}</p>
      </div>
    </div>
  );
}

function ForecastCard({ item }: { item: ForecastItem }) {
  const formatValue = (value: number) => item.type === 'currency' ? euro(value) : value.toLocaleString('ro-RO');
  const delta = item.projectedValue - item.currentValue;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.title}</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-white/55">Acum</p>
          <p className="text-2xl font-semibold text-white">{formatValue(item.currentValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/55">Forecast</p>
          <p className="text-2xl font-semibold text-primary">{formatValue(item.projectedValue)}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-white/70">{item.helper}</p>
      <p className="mt-2 text-xs text-white/50">Delta estimată: {formatValue(delta)}</p>
    </div>
  );
}

function SignalCard({ item }: { item: SectionSignalItem }) {
  const content = (
    <div className="rounded-3xl border border-white/10 bg-[#10243D] p-5 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#132B49]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">{item.title}</p>
          <p className="mt-3 text-4xl font-semibold leading-none text-white">{item.value}</p>
        </div>
        <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary/80" />
      </div>
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-sm leading-6 text-white/68">{item.helper}</p>
      </div>
    </div>
  );

  if (!item.href) return content;

  return <Link href={item.href}>{content}</Link>;
}

function ScoreboardCard({ item }: { item: ScoreCardItem }) {
  const tone =
    item.score >= 75 ? 'good' : item.score >= 55 ? 'medium' : 'high';
  const toneClass =
    tone === 'good'
      ? 'border-emerald-400/25 bg-emerald-400/10'
      : tone === 'medium'
        ? 'border-amber-400/25 bg-amber-400/10'
        : 'border-rose-400/25 bg-rose-400/10';
  const textClass =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'medium'
        ? 'text-amber-300'
        : 'text-rose-300';
  const trendColor = item.trend >= 0 ? 'text-emerald-300' : 'text-rose-300';

  return (
    <Link href={item.href} className={`block rounded-2xl border p-4 transition-colors hover:bg-white/10 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.title}</p>
      <p className={`mt-2 text-4xl font-semibold ${textClass}`}>{Math.round(item.score)}</p>
      <Progress value={item.score} className={`mt-4 h-2 bg-white/10 ${textClass} [&>div]:bg-current`} />
      <p className="mt-4 text-sm leading-6 text-white/80">{item.summary}</p>
      <p className={`mt-3 text-xs font-medium ${trendColor}`}>
        Trend: {item.trend >= 0 ? '+' : ''}{item.trend.toFixed(1)}%
      </p>
      <div className="mt-3 space-y-1 text-xs text-white/55">
        {item.factors.slice(0, 3).map((factor, index) => (
          <p key={`${item.title}-${index}`}>{factor}</p>
        ))}
      </div>
    </Link>
  );
}

function AlertRow({ item }: { item: AlertItem }) {
  const toneClass =
    item.tone === 'high'
      ? 'border-rose-400/25 bg-rose-400/10'
      : item.tone === 'medium'
        ? 'border-amber-400/25 bg-amber-400/10'
        : 'border-emerald-400/25 bg-emerald-400/10';
  const titleClass =
    item.tone === 'high'
      ? 'text-rose-300'
      : item.tone === 'medium'
        ? 'text-amber-300'
        : 'text-emerald-300';

  return (
    <Link href={item.href} className={`block rounded-2xl border p-4 transition-colors hover:bg-white/10 ${toneClass}`}>
      <p className={`text-sm font-semibold ${titleClass}`}>{item.title}</p>
      <p className="mt-2 text-sm leading-6 text-white/85">{item.description}</p>
    </Link>
  );
}

function MetricSectionCard({
  title,
  description,
  items,
  isLoading,
}: {
  title: string;
  description: string;
  items: DetailMetricItem[];
  isLoading: boolean;
}) {
  return (
    <Card className="border-none bg-[#152A47] text-white shadow-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-white">{title}</CardTitle>
            <CardDescription className="max-w-xl text-white/70">{description}</CardDescription>
          </div>
          <div className="hidden h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-white/5 lg:flex lg:items-center lg:justify-center">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-[220px] w-full bg-white/10" />
        ) : (
          items.map((item, index) => (
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-0 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:from-white/12 hover:via-white/7 hover:to-transparent"
              >
                <div className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white/75">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.label}</p>
                        <p className="mt-3 text-sm leading-6 text-white/72">{item.helper}</p>
                      </div>
                      <div className="shrink-0 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 text-right">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-primary/75">Metrică</p>
                        <p className="mt-1 text-2xl font-semibold text-white">{item.value}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
            <div
              key={item.label}
              className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/8 via-white/5 to-transparent p-0"
            >
              <div className="flex items-start gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white/75">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.label}</p>
                      <p className="mt-3 text-sm leading-6 text-white/72">{item.helper}</p>
                    </div>
                    <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Metrică</p>
                      <p className="mt-1 text-2xl font-semibold text-white">{item.value}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonCard({ item }: { item: ComparisonItem }) {
  const isUp = item.delta > 0;
  const isDown = item.delta < 0;
  const DeltaIcon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  const deltaColor = isUp ? 'text-emerald-300' : isDown ? 'text-rose-300' : 'text-white/60';
  const formatValue = (value: number) => item.type === 'currency' ? euro(value) : value.toLocaleString('ro-RO');
  const deltaLabel = `${item.delta > 0 ? '+' : ''}${item.type === 'currency' ? euro(item.delta).replace('€', '') : item.delta.toLocaleString('ro-RO')}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{formatValue(item.currentValue)}</p>
      <p className="mt-1 text-sm text-white/60">
        {item.currentLabel}: {formatValue(item.currentValue)}
      </p>
      <p className="text-sm text-white/60">
        {item.previousLabel}: {formatValue(item.previousValue)}
      </p>
      <div className={`mt-4 flex items-center gap-2 text-sm font-medium ${deltaColor}`}>
        <DeltaIcon className="h-4 w-4" />
        <span>Delta: {deltaLabel}</span>
      </div>
    </div>
  );
}

function BlockerCard({ item }: { item: BlockerItem }) {
  const toneClass =
    item.tone === 'high'
      ? 'border-rose-400/25 bg-rose-400/10'
      : item.tone === 'medium'
        ? 'border-amber-400/25 bg-amber-400/10'
        : 'border-emerald-400/25 bg-emerald-400/10';
  const textClass =
    item.tone === 'high'
      ? 'text-rose-300'
      : item.tone === 'medium'
        ? 'text-amber-300'
        : 'text-emerald-300';

  return (
    <Link href={item.href} className={`block rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{item.title}</p>
      <p className={`mt-2 text-3xl font-semibold ${textClass}`}>{item.value}</p>
      <p className="mt-3 text-sm leading-6 text-white/80">{item.description}</p>
      <p className="mt-4 text-xs font-medium text-white/55">Deschide lista afectata</p>
    </Link>
  );
}
