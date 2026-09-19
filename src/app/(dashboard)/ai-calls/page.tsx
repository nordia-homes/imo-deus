'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, limit, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import {
  ArrowUpDown,
  Bot,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Loader2,
  PhoneCall,
  RotateCcw,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_AI_OUTREACH_SETTINGS } from '@/lib/ai-outreach/defaults';
import {
  AI_OUTREACH_OUTCOME_META,
  getAiOutreachOutcomeMeta,
} from '@/lib/ai-outreach/status';
import type {
  AiOutreachCall,
  AiOutreachOutcome,
  AiOutreachSettings,
  AiOutreachStatus,
} from '@/lib/ai-outreach/types';
import { cn } from '@/lib/utils';

const CALLS_PAGE_SIZE = 10;
const CALLS_QUERY_LIMIT = 1000;

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Cele mai recente' },
  { value: 'oldest', label: 'Cele mai vechi' },
  { value: 'cost_desc', label: 'Cost descrescător' },
  { value: 'cost_asc', label: 'Cost crescător' },
  { value: 'duration_desc', label: 'Durată descrescătoare' },
] as const;

const TIMEZONE_OPTIONS = [
  { value: 'Europe/Bucharest', label: 'Europe/Bucharest' },
  { value: 'Europe/Chisinau', label: 'Europe/Chisinau' },
  { value: 'UTC', label: 'UTC' },
];

const TEMPLATE_OPTIONS = [
  { value: 'owner_acquisition', label: 'Achiziție proprietar' },
  { value: 'follow_up', label: 'Follow-up proprietar' },
  { value: 'details_collection', label: 'Colectare detalii' },
];

const badgeToneClasses = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  warning: 'border-orange-200 bg-orange-50 text-orange-700',
  muted: 'border-slate-200 bg-slate-100 text-slate-600',
} as const;

const statusFilterOptions: Array<{ value: 'all' | AiOutreachStatus; label: string }> = [
  { value: 'all', label: 'Toate statusurile' },
  { value: 'uncalled', label: 'Nesunat' },
  { value: 'queued', label: 'În așteptare' },
  { value: 'scheduled', label: 'Programate' },
  { value: 'calling', label: 'În apel' },
  { value: 'completed', label: 'Finalizate' },
  { value: 'failed', label: 'Eșuate' },
  { value: 'canceled', label: 'Anulate' },
];

const manualOutcomes: AiOutreachOutcome[] = [
  'collaborates',
  'does_not_collaborate',
  'call_later',
  'no_answer',
  'busy',
  'wrong_number',
  'invalid_number',
  'already_sold',
  'already_has_agency',
  'do_not_call',
  'verbal_agreement',
  'negotiation_success',
  'negotiation_blocked',
  'needs_human_review',
  'failed',
];

const humanAnsweredOutcomes = new Set<AiOutreachOutcome>([
  'collaborates',
  'does_not_collaborate',
  'call_later',
  'verbal_agreement',
  'negotiation_success',
  'negotiation_blocked',
  'already_sold',
  'already_has_agency',
  'do_not_call',
  'needs_human_review',
]);

function getCallDisplayMeta(call: AiOutreachCall) {
  if (call.status === 'canceled') {
    return { label: 'Anulat', tone: 'muted' as const };
  }

  return getAiOutreachOutcomeMeta(call.outcome);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ro-RO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatCost(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';

  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatBooleanLabel(value: boolean | null | undefined) {
  if (value === true) return 'Da';
  if (value === false) return 'Nu';
  return '-';
}

function formatArrayValue(value?: string[] | null) {
  if (!value?.length) return '-';
  return value.join(', ');
}

function dateKeyInTimezone(value: string | null | undefined, timezone: string, mode: 'day' | 'month') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return mode === 'month'
    ? `${values.year}-${values.month}`
    : `${values.year}-${values.month}-${values.day}`;
}

function getDateOnly(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function validateSettings(settings: AiOutreachSettings) {
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (!timePattern.test(settings.callWindowStart) || !timePattern.test(settings.callWindowEnd)) {
    return 'Completează intervalul orar în format HH:mm.';
  }

  const desired = Number(settings.desiredCommissionValue);
  const minimum = Number(settings.minimumCommissionValue);
  if (!Number.isFinite(desired) || desired <= 0) {
    return 'Comisionul dorit trebuie să fie un număr mai mare decât 0.';
  }

  if (!Number.isFinite(minimum) || minimum <= 0) {
    return 'Comisionul minim trebuie să fie un număr mai mare decât 0.';
  }

  if (minimum > desired) {
    return 'Comisionul minim nu poate fi mai mare decât comisionul dorit.';
  }

  if (!Number.isInteger(settings.maxDailyCalls) || settings.maxDailyCalls < 1) {
    return 'Limita zilnică trebuie să fie un număr întreg mai mare decât 0.';
  }

  if (
    settings.monthlyBudgetCap !== null &&
    (!Number.isFinite(settings.monthlyBudgetCap) || settings.monthlyBudgetCap < 0)
  ) {
    return 'Bugetul lunar trebuie să fie 0 sau o valoare pozitivă.';
  }

  if (!settings.defaultTemplateId.trim()) {
    return 'Adaugă un identificator de template pentru apeluri.';
  }

  if (!settings.timezone.trim()) {
    return 'Adaugă timezone-ul agenției.';
  }

  return null;
}

export default function AiCallsPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { user } = useUser();
  const { agencyId, userProfile } = useAgency();
  const { toast } = useToast();
  const isAdmin = userProfile?.role === 'admin';

  const [settings, setSettings] = useState<AiOutreachSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AiOutreachStatus>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | AiOutreachOutcome>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'cost_desc' | 'cost_asc' | 'duration_desc'>('newest');
  const [pageSize, setPageSize] = useState(CALLS_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedCall, setSelectedCall] = useState<AiOutreachCall | null>(null);
  const [manualOutcome, setManualOutcome] = useState<AiOutreachOutcome | ''>('');
  const [isRetryingCallId, setIsRetryingCallId] = useState<string | null>(null);
  const [isCancellingCallId, setIsCancellingCallId] = useState<string | null>(null);
  const [isSavingManualOutcome, setIsSavingManualOutcome] = useState(false);
  const [isCreatingTaskId, setIsCreatingTaskId] = useState<string | null>(null);

  const aiCallsQuery = useMemoFirebase(
    () =>
      agencyId
        ? query(
            collection(firestore, 'agencies', agencyId, 'aiOutreachCalls'),
            orderBy('createdAt', 'desc'),
            limit(CALLS_QUERY_LIMIT),
          )
        : null,
    [agencyId, firestore],
  );

  const {
    data: calls,
    isLoading: isLoadingCalls,
    error: callsError,
  } = useCollection<AiOutreachCall>(aiCallsQuery);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      if (!user) return;
      setIsLoadingSettings(true);

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/ai-outreach/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.message || 'Nu am putut încărca setările AI.');
        }

        if (isMounted) {
          setSettings(payload.settings as AiOutreachSettings);
          setHasChanges(false);
        }
      } catch (error) {
        toast({
          title: 'Setări AI indisponibile',
          description:
            error instanceof Error ? error.message : 'Nu am putut încărca setările.',
          variant: 'destructive',
        });

        if (isMounted && agencyId) {
          setSettings({ ...DEFAULT_AI_OUTREACH_SETTINGS, agencyId });
          setHasChanges(false);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSettings(false);
        }
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [agencyId, toast, user]);

  const stats = useMemo(() => {
    const list = calls ?? [];
    const completed = list.filter((call) => call.status === 'completed');
    const answered = completed.filter((call) => humanAnsweredOutcomes.has(call.outcome));
    const positive = completed.filter((call) =>
      ['collaborates', 'verbal_agreement', 'negotiation_success'].includes(call.outcome),
    );
    const failed = list.filter((call) => call.status === 'failed');
    const scheduled = list.filter((call) => call.status === 'scheduled');
    const calling = list.filter((call) => call.status === 'calling');
    const noAnswer = completed.filter((call) =>
      ['no_answer', 'busy', 'wrong_number', 'invalid_number'].includes(call.outcome),
    );
    const totalCost = list.reduce((sum, call) => sum + (typeof call.cost === 'number' ? call.cost : 0), 0);
    const doNotCall = completed.filter((call) => call.outcome === 'do_not_call').length;
    const timezone = settings?.timezone || 'Europe/Bucharest';
    const todayKey = dateKeyInTimezone(new Date().toISOString(), timezone, 'day');
    const currentMonthKey = dateKeyInTimezone(new Date().toISOString(), timezone, 'month');
    const dailyUsed = list.filter(
      (call) => dateKeyInTimezone(call.createdAt, timezone, 'day') === todayKey,
    ).length;
    const monthlyCost = list
      .filter(
        (call) => dateKeyInTimezone(call.createdAt, timezone, 'month') === currentMonthKey,
      )
      .reduce((sum, call) => sum + (typeof call.cost === 'number' ? call.cost : 0), 0);

    return {
      total: list.length,
      completed: completed.length,
      positive: positive.length,
      failed: failed.length,
      scheduled: scheduled.length,
      calling: calling.length,
      noAnswer: noAnswer.length,
      answered: answered.length,
      answerRate: answered.length ? Math.round((answered.length / completed.length) * 100) : 0,
      collaborationRate: answered.length ? Math.round((positive.length / answered.length) * 100) : 0,
      totalCost,
      doNotCall,
      dailyUsed,
      monthlyCost,
    };
  }, [calls, settings?.timezone]);

  const filteredCalls = useMemo(() => {
    const list = calls ?? [];
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const filtered = list.filter((call) => {
      if (statusFilter !== 'all' && call.status !== statusFilter) return false;
      if (outcomeFilter !== 'all' && call.outcome !== outcomeFilter) return false;
      if (dateFrom && getDateOnly(call.createdAt) < dateFrom) return false;
      if (dateTo && getDateOnly(call.createdAt) > dateTo) return false;

      if (!normalizedSearch) return true;

      const searchable = [
        call.ownerListingTitle,
        call.ownerListingId,
        call.ownerListingLocation,
        call.ownerPhone,
        call.agentName,
        getCallDisplayMeta(call).label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });

    return filtered.sort((left, right) => {
      if (sortOrder === 'oldest') {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      }

      if (sortOrder === 'cost_desc') {
        return (right.cost ?? -1) - (left.cost ?? -1);
      }

      if (sortOrder === 'cost_asc') {
        return (left.cost ?? -1) - (right.cost ?? -1);
      }

      if (sortOrder === 'duration_desc') {
        return (right.durationSeconds ?? -1) - (left.durationSeconds ?? -1);
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [calls, dateFrom, dateTo, outcomeFilter, searchQuery, sortOrder, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCalls.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCalls = filteredCalls.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  );

  const updateSetting = <K extends keyof AiOutreachSettings>(
    key: K,
    value: AiOutreachSettings[K],
  ) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    setHasChanges(true);
  };

  const saveSettings = async () => {
    if (!user || !settings) return;

    const validationError = validateSettings(settings);
    if (validationError) {
      toast({
        title: 'Setări incomplete',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/ai-outreach/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Nu am putut salva setările.');
      }

      setSettings(payload.settings as AiOutreachSettings);
      setHasChanges(false);
      toast({
        title: 'Setări salvate',
        description: 'AI-ul va folosi noile limite la următoarele apeluri.',
      });
    } catch (error) {
      toast({
        title: 'Salvare eșuată',
        description:
          error instanceof Error ? error.message : 'Nu am putut salva setările.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const retryCall = async (call: AiOutreachCall) => {
    if (!user) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Relansezi acest apel AI? Aceasta poate genera un nou apel și un cost suplimentar.',
      )
    ) {
      return;
    }

    setIsRetryingCallId(call.id);

    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/ai-outreach/calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerListing: {
            id: call.ownerListingId,
            title: call.ownerListingTitle || call.ownerListingId,
            price: call.ownerListingPrice || '',
            location: call.ownerListingLocation || '',
            ownerPhone: call.ownerPhone,
          },
          scheduledAt: null,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || 'Nu am putut relansa apelul AI.');
      }

      toast({
        title: payload.warning ? 'Apel salvat, integrare neconfigurată' : 'Apel AI relansat',
        description:
          payload.warning || 'Statusul se va actualiza automat după webhook-ul Vapi.',
      });
      setSelectedCall(payload.call as AiOutreachCall);
    } catch (error) {
      toast({
        title: 'Relansare eșuată',
        description:
          error instanceof Error ? error.message : 'Nu am putut relansa apelul AI.',
        variant: 'destructive',
      });
    } finally {
      setIsRetryingCallId(null);
    }
  };

  const cancelCall = async (call: AiOutreachCall) => {
    if (!agencyId) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Ești sigur că vrei să anulezi acest apel AI?')
    ) {
      return;
    }

    setIsCancellingCallId(call.id);

    try {
      const timestamp = new Date().toISOString();
      const callRef = doc(firestore, 'agencies', agencyId, 'aiOutreachCalls', call.id);
      const statusRef = doc(
        firestore,
        'agencies',
        agencyId,
        'aiOutreachOwnerListingStatuses',
        call.ownerListingId,
      );

      await updateDoc(callRef, {
        status: 'canceled',
        outcome: 'uncalled',
        endedAt: timestamp,
        endedReason: 'canceled_by_user',
        providerErrorMessage: null,
        updatedAt: timestamp,
      });

      await setDoc(
        statusRef,
        {
          agencyId,
          ownerListingId: call.ownerListingId,
          latestAiCallId: null,
          aiOutreachStatus: 'uncalled',
          aiOutreachOutcome: 'uncalled',
          aiOutreachUpdatedAt: timestamp,
          updatedAt: timestamp,
        },
        { merge: true },
      );

      await addDoc(collection(callRef, 'audit'), {
        agencyId,
        callId: call.id,
        action: 'canceled_by_user',
        actorUid: user?.uid || null,
        actorType: 'agent',
        summary: 'Apel AI anulat din pagina Apeluri AI.',
        createdAt: timestamp,
      });

      toast({
        title: 'Apel anulat',
        description: 'Anunțul a revenit în starea Nesunat.',
      });
      setSelectedCall(null);
    } catch (error) {
      toast({
        title: 'Anulare eșuată',
        description:
          error instanceof Error ? error.message : 'Nu am putut anula apelul.',
        variant: 'destructive',
      });
    } finally {
      setIsCancellingCallId(null);
    }
  };

  const saveManualOutcome = async (call: AiOutreachCall) => {
    if (!agencyId || !manualOutcome) return;
    setIsSavingManualOutcome(true);

    try {
      const timestamp = new Date().toISOString();
      const callRef = doc(firestore, 'agencies', agencyId, 'aiOutreachCalls', call.id);
      const statusRef = doc(
        firestore,
        'agencies',
        agencyId,
        'aiOutreachOwnerListingStatuses',
        call.ownerListingId,
      );
      const collaborationStatus =
        manualOutcome === 'collaborates' ||
        manualOutcome === 'verbal_agreement' ||
        manualOutcome === 'negotiation_success'
          ? 'yes'
          : manualOutcome === 'does_not_collaborate'
            ? 'no'
            : manualOutcome === 'call_later'
              ? 'call_later'
              : 'unknown';

      await updateDoc(callRef, {
        status: 'completed',
        outcome: manualOutcome,
        endedAt: call.endedAt || timestamp,
        updatedAt: timestamp,
      });

      await setDoc(
        statusRef,
        {
          agencyId,
          ownerListingId: call.ownerListingId,
          latestAiCallId: call.id,
          aiOutreachStatus: 'completed',
          aiOutreachOutcome: manualOutcome,
          aiOutreachUpdatedAt: timestamp,
          aiDoNotCall: manualOutcome === 'do_not_call',
          aiCollaborationStatus: collaborationStatus,
          aiAcceptedCommissionValue: call.result?.acceptedCommissionValue || null,
          aiNextFollowUpAt: manualOutcome === 'call_later' ? timestamp : null,
          updatedAt: timestamp,
        },
        { merge: true },
      );

      await addDoc(collection(callRef, 'audit'), {
        agencyId,
        callId: call.id,
        action: 'manual_outcome_updated',
        actorUid: user?.uid || null,
        actorType: 'agent',
        summary: `Rezultat marcat manual: ${AI_OUTREACH_OUTCOME_META[manualOutcome].label}.`,
        createdAt: timestamp,
      });

      toast({
        title: 'Rezultat actualizat',
        description: AI_OUTREACH_OUTCOME_META[manualOutcome].label,
      });
      setManualOutcome('');
    } catch (error) {
      toast({
        title: 'Actualizare eșuată',
        description:
          error instanceof Error ? error.message : 'Nu am putut actualiza rezultatul.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingManualOutcome(false);
    }
  };

  const copyPhone = async (call: AiOutreachCall) => {
    try {
      await navigator.clipboard.writeText(call.ownerPhone);
      toast({ title: 'Telefon copiat', description: call.ownerPhone });
    } catch {
      toast({
        title: 'Copiere eșuată',
        description: 'Telefonul nu a putut fi copiat automat.',
        variant: 'destructive',
      });
    }
  };

  const revokeDoNotCall = async (call: AiOutreachCall) => {
    if (!agencyId) return;

    try {
      const timestamp = new Date().toISOString();
      const callRef = doc(firestore, 'agencies', agencyId, 'aiOutreachCalls', call.id);
      const statusRef = doc(
        firestore,
        'agencies',
        agencyId,
        'aiOutreachOwnerListingStatuses',
        call.ownerListingId,
      );

      await updateDoc(callRef, {
        status: 'completed',
        outcome: 'uncalled',
        updatedAt: timestamp,
      });

      await setDoc(
        statusRef,
        {
          agencyId,
          ownerListingId: call.ownerListingId,
          latestAiCallId: null,
          aiOutreachStatus: 'uncalled',
          aiOutreachOutcome: 'uncalled',
          aiOutreachUpdatedAt: timestamp,
          aiDoNotCall: false,
          updatedAt: timestamp,
        },
        { merge: true },
      );

      await addDoc(collection(callRef, 'audit'), {
        agencyId,
        callId: call.id,
        action: 'do_not_call_revoked',
        actorUid: user?.uid || null,
        actorType: 'agent',
        summary: 'Restricția Do Not Call a fost revocată.',
        createdAt: timestamp,
      });

      toast({
        title: 'Do Not Call revocat',
        description: 'Anunțul poate fi apelat din nou.',
      });
      setSelectedCall(null);
    } catch (error) {
      toast({
        title: 'Revocare eșuată',
        description:
          error instanceof Error ? error.message : 'Nu am putut revoca restricția DNC.',
        variant: 'destructive',
      });
    }
  };

  const createFollowUpTask = async (call: AiOutreachCall) => {
    if (!agencyId || !user) return;
    setIsCreatingTaskId(call.id);

    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      await addDoc(collection(firestore, 'agencies', agencyId, 'tasks'), {
        description: `Follow-up proprietar: ${call.ownerListingTitle || call.ownerListingId}`,
        dueDate: dueDate.toISOString(),
        status: 'open',
        agentId: call.agentId || user.uid,
        agentName: call.agentName || null,
        propertyTitle: call.ownerListingTitle || null,
        participantName: call.ownerListingTitle || null,
        participantPhone: call.ownerPhone || null,
        createdAt: new Date().toISOString(),
      });

      toast({
        title: 'Task creat',
        description: 'Task-ul de follow-up a fost adăugat pentru mâine.',
      });
    } catch (error) {
      toast({
        title: 'Creare task eșuată',
        description:
          error instanceof Error ? error.message : 'Nu am putut crea task-ul de follow-up.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingTaskId(null);
    }
  };

  const canCancelCall = (call: AiOutreachCall) =>
    call.status === 'scheduled' || call.status === 'queued' || call.status === 'calling';

  const openCallDetails = (call: AiOutreachCall) => {
    setManualOutcome('');
    setSelectedCall(call);
  };

  return (
    <div className="space-y-6 px-3 pb-8 pt-3 sm:px-4 xl:px-5">
      <div className="rounded-[1.5rem] border border-white/75 bg-[linear-gradient(135deg,_rgba(21,42,71,1)_0%,_rgba(18,38,63,1)_52%,_rgba(11,26,45,1)_100%)] px-5 py-5 text-white shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
              <Bot className="h-3.5 w-3.5" />
              AI Outreach
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">Apeluri AI</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
              Configurează regulile comerciale, bugetul și intervalele orare. Vezi istoricul
              apelurilor, detaliile conversațiilor și rezultatele care cer intervenție umană.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {settings?.enabled ? (
              <Button
                variant="secondary"
                className="rounded-full"
                onClick={() => router.push('/owner-listings')}
              >
                <PhoneCall className="mr-2 h-4 w-4" />
                Pornește un apel
              </Button>
            ) : (
              <Button variant="secondary" className="rounded-full" disabled>
                <PhoneCall className="mr-2 h-4 w-4" />
                Apeluri AI inactive
              </Button>
            )}

            {isAdmin ? (
              <Button
                onClick={saveSettings}
                disabled={isSaving || isLoadingSettings || !settings || !hasChanges}
                className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {hasChanges ? 'Salvează setările' : 'Setări salvate'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total apeluri</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.total}</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Finalizate</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.completed}</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pozitive</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-emerald-600">
            {stats.positive}
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Răspuns</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.answerRate}%</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Colaborare</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-emerald-600">
            {stats.collaborationRate}%
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cost estimat</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{formatCost(stats.totalCost)}</CardContent>
        </Card>
      </div>

      {stats.scheduled || stats.calling ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.calling ? (
            <Card className="rounded-2xl border-blue-200 bg-blue-50/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-800">Apeluri în desfășurare</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold text-blue-800">
                {stats.calling}
              </CardContent>
            </Card>
          ) : null}

          {stats.scheduled ? (
            <Card className="rounded-2xl border-amber-200 bg-amber-50/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-800">Apeluri programate</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold text-amber-800">
                {stats.scheduled}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Utilizare zilnică</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{stats.dailyUsed}</span>
              <span className="text-sm text-muted-foreground">
                din {settings?.maxDailyCalls ?? 0} apeluri
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${Math.min(
                    100,
                    settings?.maxDailyCalls
                      ? (stats.dailyUsed / settings.maxDailyCalls) * 100
                      : 0,
                  )}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Buget lunar consumat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{formatCost(stats.monthlyCost)}</span>
              <span className="text-sm text-muted-foreground">
                {settings?.monthlyBudgetCap
                  ? `din ${formatCost(settings.monthlyBudgetCap)}`
                  : 'fără limită'}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${Math.min(
                    100,
                    settings?.monthlyBudgetCap
                      ? (stats.monthlyCost / settings.monthlyBudgetCap) * 100
                      : 0,
                  )}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.doNotCall ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-rose-700" />
            <div>
              <p className="font-semibold text-rose-900">
                {stats.doNotCall} anunțuri marcate Do Not Call
              </p>
              <p className="text-sm text-rose-800">
                Aceste numere nu vor mai fi apelate automat.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-rose-200 bg-white text-rose-700 hover:bg-rose-100"
            onClick={() => {
              setOutcomeFilter('do_not_call');
              setStatusFilter('all');
              setCurrentPage(1);
            }}
          >
            Vezi lista
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Setări agenție
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoadingSettings || !settings ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            ) : (
              <fieldset disabled={!isAdmin || isSaving} className="space-y-5">
                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <Label className="font-semibold">Apeluri AI active</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite agenților să pornească apeluri AI.
                    </p>
                  </div>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(value) => updateSetting('enabled', value)}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Comision dorit</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.desiredCommissionValue}
                      onChange={(event) =>
                        updateSetting('desiredCommissionValue', event.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label>Comision minim</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.minimumCommissionValue}
                      onChange={(event) =>
                        updateSetting('minimumCommissionValue', event.target.value)
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Tip comision</Label>
                  <Select
                    value={settings.commissionType}
                    onValueChange={(value) =>
                      updateSetting(
                        'commissionType',
                        value as AiOutreachSettings['commissionType'],
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Procent</SelectItem>
                      <SelectItem value="fixed">Sumă fixă</SelectItem>
                      <SelectItem value="mixed">Mixt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Start apeluri</Label>
                    <Input
                      type="time"
                      value={settings.callWindowStart}
                      onChange={(event) => updateSetting('callWindowStart', event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Stop apeluri</Label>
                    <Input
                      type="time"
                      value={settings.callWindowEnd}
                      onChange={(event) => updateSetting('callWindowEnd', event.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Timezone</Label>
                    <Select
                      value={settings.timezone}
                      onValueChange={(value) => updateSetting('timezone', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Template apel</Label>
                    <Select
                      value={settings.defaultTemplateId}
                      onValueChange={(value) =>
                        updateSetting('defaultTemplateId', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Limită zilnică apeluri</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={settings.maxDailyCalls}
                      onChange={(event) =>
                        updateSetting('maxDailyCalls', Number(event.target.value))
                      }
                    />
                  </div>
                  <div>
                    <Label>Buget lunar (EUR)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.monthlyBudgetCap ?? ''}
                      placeholder="Fără limită"
                      onChange={(event) =>
                        updateSetting(
                          'monthlyBudgetCap',
                          event.target.value === '' ? null : Number(event.target.value),
                        )
                      }
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <Label>Negociere AI</Label>
                      <p className="text-sm text-muted-foreground">
                        Permite AI-ului să negocieze în limitele configurate.
                      </p>
                    </div>
                    <Switch
                      checked={settings.allowNegotiation}
                      onCheckedChange={(value) => updateSetting('allowNegotiation', value)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <Label>Acord verbal permis</Label>
                      <p className="text-sm text-muted-foreground">
                        AI-ul poate colecta un acord verbal, fără a crea obligații contractuale.
                      </p>
                    </div>
                    <Switch
                      checked={settings.allowVerbalAgreement}
                      onCheckedChange={(value) =>
                        updateSetting('allowVerbalAgreement', value)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <Label>Colectare adresă exactă</Label>
                      <p className="text-sm text-muted-foreground">
                        AI-ul poate solicita adresa exactă în timpul conversației.
                      </p>
                    </div>
                    <Switch
                      checked={settings.allowExactAddressCollection}
                      onCheckedChange={(value) =>
                        updateSetting('allowExactAddressCollection', value)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <Label>Înregistrare apeluri</Label>
                      <p className="text-sm text-muted-foreground">
                        Păstrează înregistrarea când providerul o pune la dispoziție.
                      </p>
                    </div>
                    <Switch
                      checked={settings.recordCalls}
                      onCheckedChange={(value) => updateSetting('recordCalls', value)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <Label>Disclosure AI</Label>
                      <p className="text-sm text-muted-foreground">
                        AI-ul anunță că apelul este efectuat de un asistent automat.
                      </p>
                    </div>
                    <Switch
                      checked={settings.discloseAi}
                      onCheckedChange={(value) => updateSetting('discloseAi', value)}
                    />
                  </div>
                </div>
              </fieldset>
            )}

            {!isAdmin && settings ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Doar administratorii agenției pot modifica aceste setări.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="gap-4">
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-emerald-600" />
              Istoric apeluri
            </CardTitle>

            <div className="grid gap-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Caută anunț, telefon, agent sau rezultat..."
                    className="pl-9"
                  />
                </div>

                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as 'all' | AiOutreachStatus);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={outcomeFilter}
                  onValueChange={(value) => {
                    setOutcomeFilter(value as 'all' | AiOutreachOutcome);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate rezultatele</SelectItem>
                    {(Object.keys(AI_OUTREACH_OUTCOME_META) as AiOutreachOutcome[]).map(
                      (outcome) => (
                        <SelectItem key={outcome} value={outcome}>
                          {AI_OUTREACH_OUTCOME_META[outcome].label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[160px_160px_220px_120px_auto]">
                <div className="relative">
                  <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                    aria-label="De la data"
                  />
                </div>

                <div className="relative">
                  <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      setDateTo(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                    aria-label="Până la data"
                  />
                </div>

                <Select
                  value={sortOrder}
                  onValueChange={(value) => {
                    setSortOrder(
                      value as 'newest' | 'oldest' | 'cost_desc' | 'cost_asc' | 'duration_desc',
                    );
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} pe pagină
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setOutcomeFilter('all');
                    setDateFrom('');
                    setDateTo('');
                    setSortOrder('newest');
                    setCurrentPage(1);
                  }}
                  aria-label="Resetează filtrele"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {callsError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                Nu am putut încărca istoricul apelurilor.
              </div>
            ) : null}

            {isLoadingCalls ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : (calls ?? []).length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
                <PhoneCall className="mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Nu există apeluri AI încă</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Activează setările, apoi pornește apeluri din Anunțuri Proprietari.
                </p>
                <Button asChild variant="outline" className="mt-5 rounded-full">
                  <Link href="/owner-listings">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Deschide Anunțuri Proprietari
                  </Link>
                </Button>
              </div>
            ) : filteredCalls.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
                <Search className="mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Niciun rezultat pentru filtre</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Încearcă alte filtre sau resetează căutarea.
                </p>
                <Button
                  variant="outline"
                  className="mt-5 rounded-full"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setOutcomeFilter('all');
                    setDateFrom('');
                    setDateTo('');
                    setSortOrder('newest');
                    setCurrentPage(1);
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Resetează filtrele
                </Button>
              </div>
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-2xl border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Anunț</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Comision</TableHead>
                        <TableHead>Durată</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Acțiuni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCalls.map((call) => {
                        const meta = getCallDisplayMeta(call);

                        return (
                          <TableRow key={call.id}>
                            <TableCell className="max-w-[260px] truncate font-medium">
                              {call.ownerListingTitle || call.ownerListingId}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                                  badgeToneClasses[meta.tone],
                                )}
                              >
                                {meta.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{call.ownerPhone}</span>
                                <button
                                  type="button"
                                  onClick={() => copyPhone(call)}
                                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-slate-900"
                                  title="Copiază telefonul"
                                  aria-label="Copiază telefonul"
                                >
                                  <Clipboard className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell>
                              {call.result?.acceptedCommissionValue ||
                                call.result?.desiredCommission ||
                                '-'}
                            </TableCell>
                            <TableCell>
                              {call.durationSeconds ? `${call.durationSeconds}s` : '-'}
                            </TableCell>
                            <TableCell>{formatCost(call.cost)}</TableCell>
                            <TableCell>{call.agentName || '-'}</TableCell>
                            <TableCell>{formatDateTime(call.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openCallDetails(call)}
                              >
                                Detalii
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 md:hidden">
                  {paginatedCalls.map((call) => {
                    const meta = getCallDisplayMeta(call);

                    return (
                      <button
                        key={call.id}
                        type="button"
                        onClick={() => openCallDetails(call)}
                        className="w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">
                              {call.ownerListingTitle || call.ownerListingId}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {call.ownerPhone} · {call.agentName || 'Agent nedefinit'}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold',
                              badgeToneClasses[meta.tone],
                            )}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {formatDateTime(call.createdAt)}
                          {call.durationSeconds
                            ? ` · ${call.durationSeconds}s`
                            : ''}
                          {typeof call.cost === 'number'
                            ? ` · ${formatCost(call.cost)}`
                            : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {totalPages > 1 ? (
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={safeCurrentPage === 1}
                    >
                      Anterioară
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Pagina {safeCurrentPage} din {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                      disabled={safeCurrentPage === totalPages}
                    >
                      Următoare
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(selectedCall)}
        onOpenChange={(open) => {
          if (!open) setSelectedCall(null);
        }}
      >
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col overflow-hidden rounded-[1.5rem] p-0">
          {selectedCall ? (
            <>
              <DialogHeader className="border-b px-6 py-5">
                <div className="flex items-start justify-between gap-4 pr-6">
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-xl">
                      {selectedCall.ownerListingTitle || selectedCall.ownerListingId}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      {selectedCall.ownerPhone} · {selectedCall.agentName || 'Agent nedefinit'}
                    </DialogDescription>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold',
                      badgeToneClasses[getCallDisplayMeta(selectedCall).tone],
                    )}
                  >
                    {getCallDisplayMeta(selectedCall).label}
                  </span>
                </div>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <Tabs defaultValue="summary" className="p-6">
                <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-muted">
                  <TabsTrigger value="summary">Rezultat</TabsTrigger>
                  <TabsTrigger value="details">Detalii</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow
                      label="Rezultat AI"
                      value={getCallDisplayMeta(selectedCall).label}
                    />
                    <DetailRow
                      label="Comision acceptat"
                      value={
                        selectedCall.result?.acceptedCommissionValue ||
                        selectedCall.result?.desiredCommission ||
                        'Nediscutat'
                      }
                    />
                    <DetailRow
                      label="Adresă confirmată"
                      value={selectedCall.result?.exactAddress}
                    />
                    <DetailRow
                      label="Disponibilitate vizionare"
                      value={selectedCall.result?.viewingAvailability}
                    />
                    <DetailRow
                      label="Durată"
                      value={
                        selectedCall.durationSeconds
                          ? `${selectedCall.durationSeconds}s`
                          : null
                      }
                    />
                    <DetailRow label="Cost" value={formatCost(selectedCall.cost)} />
                    <DetailRow
                      label="Proprietate disponibilă"
                      value={formatBooleanLabel(
                        selectedCall.result?.propertyAvailable === 'yes'
                          ? true
                          : selectedCall.result?.propertyAvailable === 'no'
                            ? false
                            : undefined,
                      )}
                    />
                    <DetailRow
                      label="Încredere AI"
                      value={
                        selectedCall.result?.confidence !== undefined
                          ? `${selectedCall.result.confidence}%`
                          : null
                      }
                    />
                    <DetailRow
                      label="Câmpuri lipsă"
                      value={formatArrayValue(selectedCall.result?.missingFields)}
                    />
                    <DetailRow
                      label="Documente disponibile"
                      value={selectedCall.result?.documentsAvailable}
                    />
                    <DetailRow
                      label="Interes exclusivitate"
                      value={selectedCall.result?.exclusivityInterest}
                    />
                    <DetailRow
                      label="Preț minim"
                      value={selectedCall.result?.priceMinimum}
                    />
                    <DetailRow
                      label="Dorește callback"
                      value={formatBooleanLabel(selectedCall.result?.wantsHumanCallback)}
                    />
                  </div>

                  <div className="rounded-2xl border bg-muted/40 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Rezumat AI
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {selectedCall.summary || 'Rezumatul nu este încă disponibil.'}
                    </p>
                  </div>

                  {selectedCall.recordingUrl ? (
                    <Button asChild variant="outline" className="w-full rounded-full">
                      <a
                        href={selectedCall.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Deschide înregistrarea
                      </a>
                    </Button>
                  ) : null}
                </TabsContent>

                <TabsContent value="details" className="grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Telefon proprietar" value={selectedCall.ownerPhone} />
                  <DetailRow
                    label="Număr apelant"
                    value={selectedCall.callerNumber || 'Pool platformă'}
                  />
                  <DetailRow label="Agent" value={selectedCall.agentName} />
                  <DetailRow label="Încercare" value={selectedCall.attemptNumber} />
                  <DetailRow label="Creat la" value={formatDateTime(selectedCall.createdAt)} />
                  <DetailRow
                    label="Programat la"
                    value={formatDateTime(selectedCall.scheduledAt)}
                  />
                  <DetailRow
                    label="Vapi call ID"
                    value={selectedCall.vapiCallId}
                  />
                  <DetailRow
                    label="Eroare provider"
                    value={selectedCall.providerErrorMessage}
                  />
                </TabsContent>

                <TabsContent value="transcript">
                  <div className="max-h-[420px] overflow-y-auto rounded-2xl border bg-muted/30 p-4 text-sm leading-6">
                    <div className="mb-3 flex items-center gap-2 font-semibold">
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                      Conversație
                    </div>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {selectedCall.transcript?.trim() ||
                        'Transcriptul va apărea aici după finalizarea apelului.'}
                    </p>
                  </div>
                </TabsContent>
                </Tabs>

                <div className="border-t px-6 py-4">
                  <Label className="mb-2 block">Marchează manual rezultatul</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      value={manualOutcome}
                      onValueChange={(value) =>
                        setManualOutcome(value as AiOutreachOutcome)
                      }
                    >
                      <SelectTrigger className="sm:max-w-xs" aria-label="Alege rezultatul manual">
                        <SelectValue placeholder="Alege rezultatul" />
                      </SelectTrigger>
                      <SelectContent>
                        {manualOutcomes.map((outcome) => (
                          <SelectItem key={outcome} value={outcome}>
                            {AI_OUTREACH_OUTCOME_META[outcome].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={() => saveManualOutcome(selectedCall)}
                      disabled={!manualOutcome || isSavingManualOutcome}
                      className="rounded-full"
                    >
                      {isSavingManualOutcome ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Salvează rezultatul
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 border-t px-6 py-4">
                <Button
                  variant="outline"
                  onClick={() => createFollowUpTask(selectedCall)}
                  disabled={isCreatingTaskId === selectedCall.id}
                  className="rounded-full"
                >
                  {isCreatingTaskId === selectedCall.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarClock className="mr-2 h-4 w-4" />
                  )}
                  Creează task follow-up
                </Button>

                <Button
                  variant="outline"
                  onClick={() => copyPhone(selectedCall)}
                  className="rounded-full"
                >
                  <Clipboard className="mr-2 h-4 w-4" />
                  Copiază telefonul
                </Button>

                {selectedCall.outcome === 'do_not_call' ? (
                  <Button
                    variant="outline"
                    onClick={() => revokeDoNotCall(selectedCall)}
                    className="rounded-full text-emerald-700"
                  >
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    Revocă Do Not Call
                  </Button>
                ) : null}

                {canCancelCall(selectedCall) ? (
                  <Button
                    variant="outline"
                    onClick={() => cancelCall(selectedCall)}
                    disabled={isCancellingCallId === selectedCall.id}
                    className="rounded-full text-rose-700"
                  >
                    {isCancellingCallId === selectedCall.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-4 w-4" />
                    )}
                    Anulează apelul
                  </Button>
                ) : null}

                <Button
                  onClick={() => retryCall(selectedCall)}
                  disabled={isRetryingCallId === selectedCall.id || !settings?.enabled}
                  className="rounded-full"
                >
                  {isRetryingCallId === selectedCall.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Relansează apelul AI
                </Button>
              </DialogFooter>

            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 min-h-5 text-sm font-medium">
        {value === null || value === undefined || value === '' ? '-' : value}
      </p>
    </div>
  );
}
