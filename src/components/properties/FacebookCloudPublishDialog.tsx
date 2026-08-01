'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock3, Facebook, Loader2, Send, Trash2 } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  bucharestInputFromIso,
  bucharestLocalToIso,
  defaultBucharestScheduleInput,
  formatBucharestDateTime,
} from '@/lib/bucharest-time';
import { facebookCloudFetch } from '@/lib/facebook-cloud-client';
import { getAgencyFacebookGroups } from '@/lib/facebook-groups';
import type {
  FacebookCloudConnection,
  FacebookCloudPublishingJob,
  FacebookGroup,
  Property,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

type PublishMode = 'now' | 'schedule';

type Props = {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connections?: FacebookCloudConnection[];
  groups?: FacebookGroup[];
  initialConnectionId?: string | null;
  initialGroupUrls?: string[];
  existingJob?: FacebookCloudPublishingJob | null;
  onJobChange?: (job: FacebookCloudPublishingJob) => void;
};

export function FacebookCloudPublishDialog({
  property,
  open,
  onOpenChange,
  connections: providedConnections,
  groups: providedGroups,
  initialConnectionId,
  initialGroupUrls,
  existingJob,
  onJobChange,
}: Props) {
  const { user } = useUser();
  const { agency } = useAgency();
  const { toast } = useToast();
  const agencyGroups = useMemo(() => getAgencyFacebookGroups(agency), [agency]);
  const groups = providedGroups || agencyGroups;
  const [connections, setConnections] = useState<FacebookCloudConnection[]>(providedConnections || []);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [mode, setMode] = useState<PublishMode>('now');
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isEditing = existingJob?.status === 'scheduled';
  const isInProgress = Boolean(existingJob && ['queued', 'running', 'cooldown'].includes(existingJob.status));
  const selectedConnection = connections.find((item) => item.id === selectedConnectionId) || null;

  useEffect(() => {
    if (!open) return;
    const scheduleInput = existingJob?.scheduledAt
      ? bucharestInputFromIso(existingJob.scheduledAt)
      : defaultBucharestScheduleInput();
    setMode(isEditing ? 'schedule' : 'now');
    setDateValue(scheduleInput.date);
    setTimeValue(scheduleInput.time);
    setSelectedUrls(
      existingJob
        ? existingJob.groups.map((group) => group.url)
        : Array.from(new Set(initialGroupUrls || []))
    );

    let cancelled = false;
    async function loadConnections() {
      if (providedConnections) {
        setConnections(providedConnections);
        const preferred = existingJob
          ? existingJob.connectionId
          : initialConnectionId || property.defaultFacebookConnectionId;
        setSelectedConnectionId(
          preferred && providedConnections.some((item) => item.id === preferred)
            ? preferred
            : providedConnections.find((item) => item.status === 'connected')?.id || ''
        );
        return;
      }
      if (!user) return;
      setLoadingOptions(true);
      try {
        const response = await facebookCloudFetch(user, '/api/marketing/facebook-cloud/connections');
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || 'Conturile Facebook nu au putut fi încărcate.');
        if (cancelled) return;
        const loaded = (body.connections || []) as FacebookCloudConnection[];
        setConnections(loaded);
        const preferred = existingJob
          ? existingJob.connectionId
          : initialConnectionId || property.defaultFacebookConnectionId || body.defaultConnectionId;
        setSelectedConnectionId(
          preferred && loaded.some((item) => item.id === preferred)
            ? preferred
            : loaded.find((item) => item.status === 'connected')?.id || ''
        );
      } catch (error) {
        if (!cancelled) {
          toast({
            variant: 'destructive',
            title: 'Conturile Facebook nu sunt disponibile',
            description: error instanceof Error ? error.message : 'A apărut o eroare.',
          });
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }
    void loadConnections();
    return () => {
      cancelled = true;
    };
  }, [
    existingJob,
    initialConnectionId,
    initialGroupUrls,
    isEditing,
    open,
    property.defaultFacebookConnectionId,
    providedConnections,
    toast,
    user,
  ]);

  function toggleGroup(url: string, checked: boolean) {
    setSelectedUrls((current) => (
      checked
        ? Array.from(new Set([...current, url]))
        : current.filter((item) => item !== url)
    ));
  }

  async function submit() {
    if (!user || !selectedConnectionId || !selectedUrls.length) return;
    const scheduledAt = mode === 'schedule' ? bucharestLocalToIso(dateValue, timeValue) : null;
    if (mode === 'schedule' && !scheduledAt) {
      toast({
        variant: 'destructive',
        title: 'Ora nu este validă',
        description: 'Alege o dată și o oră validă pentru București.',
      });
      return;
    }
    if (scheduledAt && new Date(scheduledAt).getTime() < Date.now() + 60_000) {
      toast({
        variant: 'destructive',
        title: 'Ora este prea apropiată',
        description: 'Alege o oră cu cel puțin un minut în viitor.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await facebookCloudFetch(
        user,
        isEditing
          ? `/api/marketing/facebook-cloud/jobs/${existingJob.id}`
          : '/api/marketing/facebook-cloud/jobs',
        {
          method: isEditing ? 'PATCH' : 'POST',
          body: JSON.stringify({
            propertyId: property.id,
            connectionId: selectedConnectionId,
            groupUrls: selectedUrls,
            scheduledAt,
          }),
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || (isEditing ? 'Programarea nu a putut fi modificată.' : 'Publicarea nu a putut fi pornită.'));
      }
      onJobChange?.(body.job);
      onOpenChange(false);
      toast({
        title: isEditing
          ? 'Programare actualizată'
          : mode === 'schedule'
            ? 'Publicare programată'
            : 'Publicarea a început',
        description: mode === 'schedule' && scheduledAt
          ? `${formatBucharestDateTime(scheduledAt)} · ora București · ${selectedUrls.length} grupuri`
          : `${selectedUrls.length} grupuri · ${selectedConnection?.label || selectedConnection?.displayName || 'cont Facebook'}`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: isEditing ? 'Modificare eșuată' : 'Publicare eșuată',
        description: error instanceof Error ? error.message : 'A apărut o eroare.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelSchedule() {
    if (!user || !existingJob) return;
    setCancelling(true);
    try {
      const response = await facebookCloudFetch(
        user,
        `/api/marketing/facebook-cloud/jobs/${existingJob.id}`,
        { method: 'DELETE' }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Programarea nu a putut fi anulată.');
      onJobChange?.(body.job || { ...existingJob, status: 'cancelled', updatedAt: new Date().toISOString() });
      onOpenChange(false);
      toast({ title: isEditing ? 'Programare anulată' : 'Oprire solicitată' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Anulare eșuată',
        description: error instanceof Error ? error.message : 'A apărut o eroare.',
      });
    } finally {
      setCancelling(false);
    }
  }

  const canSubmit = Boolean(
    !isInProgress
    && selectedConnection
    && selectedConnection.status === 'connected'
    && selectedUrls.length
    && (mode === 'now' || (dateValue && timeValue))
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!submitting && !cancelling) onOpenChange(nextOpen);
    }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10 text-[#1877F2]">
              <Facebook className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{isEditing ? 'Modifică programarea Facebook' : isInProgress ? 'Publicare Facebook în curs' : 'Publică în grupurile Facebook'}</DialogTitle>
              <DialogDescription className="mt-1 line-clamp-2">{property.title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Se încarcă opțiunile...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Cont Facebook</Label>
              <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId} disabled={isInProgress}>
                <SelectTrigger>
                  <SelectValue placeholder="Alege contul Facebook" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((connection) => (
                    <SelectItem key={connection.id} value={connection.id}>
                      {connection.label || connection.displayName || 'Cont Facebook'}
                      {connection.status !== 'connected' ? ' · reconectare necesară' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!connections.length ? (
                <p className="text-xs text-destructive">Nu există niciun cont Facebook conectat.</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Grupuri Facebook</Label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={isInProgress} onClick={() => setSelectedUrls(groups.map((group) => group.url))}>
                    Toate
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={isInProgress} onClick={() => setSelectedUrls([])}>
                    Niciunul
                  </Button>
                </div>
              </div>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border bg-muted/20 p-2">
                {groups.map((group, index) => {
                  const id = `facebook-dialog-${property.id}-${index}`;
                  return (
                    <label key={group.url} htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 hover:bg-muted/50">
                      <Checkbox
                        id={id}
                        checked={selectedUrls.includes(group.url)}
                        disabled={isInProgress}
                        onCheckedChange={(checked) => toggleGroup(group.url, Boolean(checked))}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{group.name || `Grup ${index + 1}`}</span>
                        <span className="block truncate text-xs text-muted-foreground">{group.url}</span>
                      </span>
                    </label>
                  );
                })}
                {!groups.length ? (
                  <p className="p-3 text-sm text-muted-foreground">Nu există grupuri Facebook configurate.</p>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{selectedUrls.length} din {groups.length} selectate</p>
            </div>

            <div className="space-y-2">
              <Label>Când se publică?</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={isEditing || isInProgress}
                  onClick={() => setMode('now')}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors',
                    mode === 'now' ? 'border-[#1877F2] bg-[#1877F2]/5' : 'hover:bg-muted/50',
                    (isEditing || isInProgress) && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <Send className="mb-2 h-5 w-5 text-[#1877F2]" />
                  <span className="block text-sm font-semibold">Publică imediat</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Intră acum în coada contului ales.</span>
                </button>
                <button
                  type="button"
                  disabled={isInProgress}
                  onClick={() => setMode('schedule')}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors',
                    mode === 'schedule' ? 'border-[#1877F2] bg-[#1877F2]/5' : 'hover:bg-muted/50',
                    isInProgress && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <CalendarClock className="mb-2 h-5 w-5 text-[#1877F2]" />
                  <span className="block text-sm font-semibold">Programează</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Runnerul pornește automat la ora aleasă.</span>
                </button>
              </div>
            </div>

            {mode === 'schedule' ? (
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="facebook-schedule-date">Data</Label>
                    <Input id="facebook-schedule-date" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facebook-schedule-time">Ora</Label>
                    <Input id="facebook-schedule-time" type="time" step={300} value={timeValue} onChange={(event) => setTimeValue(event.target.value)} />
                  </div>
                </div>
                <p className="mt-3 flex items-center text-xs text-muted-foreground">
                  <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                  Ora este interpretată întotdeauna în fusul Europe/Bucharest, inclusiv la schimbarea orei.
                </p>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {existingJob && (isEditing || isInProgress) ? (
            <Button type="button" variant="destructive" disabled={submitting || cancelling} onClick={() => void cancelSchedule()}>
              {cancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {isEditing ? 'Anulează programarea' : 'Oprește publicarea'}
            </Button>
          ) : <span />}
          <Button type="button" disabled={!canSubmit || submitting || cancelling} onClick={() => void submit()}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : mode === 'schedule' ? <CalendarClock className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
            {isEditing ? 'Salvează modificările' : mode === 'schedule' ? 'Programează publicarea' : 'Publică acum'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
