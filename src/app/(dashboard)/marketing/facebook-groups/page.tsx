'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ExternalLink, Facebook, Link2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  defaultFacebookGroups,
  getFacebookGroupPurpose,
  type FacebookGroupPurpose,
} from '@/lib/facebook-groups';
import type { FacebookGroup } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import '@/components/marketing/tiktok-ads/tiktok-workspace.css';

type GroupDraft = FacebookGroup & { purpose: FacebookGroupPurpose };

const purposeLabels: Record<FacebookGroupPurpose, string> = {
  sale: 'Vânzări',
  rent: 'Închirieri',
  both: 'Ambele',
};

function prepareGroups(groups: FacebookGroup[]): GroupDraft[] {
  return groups.map((group) => ({ ...group, purpose: getFacebookGroupPurpose(group) }));
}

function getGroupHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function FacebookGroupsPage() {
  const firestore = useFirestore();
  const { agency, agencyId, isAgencyLoading } = useAgency();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'sale' | 'rent'>('sale');
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAgencyLoading) return;
    setGroups(prepareGroups(
      agency?.facebookGroups?.length ? agency.facebookGroups : defaultFacebookGroups
    ));
  }, [agency?.facebookGroups, isAgencyLoading]);

  const visibleGroups = useMemo(
    () => groups
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => group.purpose === activeTab || group.purpose === 'both'),
    [activeTab, groups]
  );

  function updateGroup(index: number, patch: Partial<GroupDraft>) {
    setGroups((current) => current.map((group, currentIndex) => (
      currentIndex === index ? { ...group, ...patch } : group
    )));
  }

  function addGroup() {
    setGroups((current) => [...current, { name: '', url: '', purpose: activeTab }]);
  }

  function removeGroup(index: number) {
    setGroups((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function saveGroups() {
    if (!agencyId) return;
    const sanitized = groups
      .map((group) => ({
        name: group.name.trim(),
        url: group.url.trim(),
        purpose: group.purpose,
      }))
      .filter((group) => group.name && group.url);

    if (sanitized.some((group) => !/^https?:\/\/(www\.)?facebook\.com\//i.test(group.url))) {
      toast({
        variant: 'destructive',
        title: 'Link Facebook invalid',
        description: 'Fiecare grup trebuie să aibă un link facebook.com valid.',
      });
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(firestore, 'agencies', agencyId), { facebookGroups: sanitized });
      setGroups(prepareGroups(sanitized));
      toast({
        title: 'Grupurile au fost salvate',
        description: 'Automatizarea va filtra lista după tipul proprietății.',
      });
    } catch (error) {
      console.error('Failed to save Facebook groups', error);
      toast({
        variant: 'destructive',
        title: 'Salvare eșuată',
        description: 'Grupurile Facebook nu au putut fi salvate.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[var(--app-page-bg)] p-4 md:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        <div className="tt-design settings-tiktok">
          <style>{`
            .settings-tiktok .tt-hero { min-height: 0 !important; padding: 24px 28px !important; }
          `}</style>
          <header className="tt-hero">
            <div>
              <div className="tt-hero-kicker">
                <Facebook size={17} />
                <span className="tt-eyebrow">GRUPURI FACEBOOK</span>
              </div>
              <h1>Grupuri <em>Facebook</em></h1>
              <p className="tt-hero-lead">
                Organizează grupurile după tipul anunțului.
                <br />
                <strong>La publicare apar doar grupurile potrivite proprietății.</strong>
              </p>
            </div>
            <div className="space-y-3">
              <div className="tt-scene" aria-hidden="true">
                <div className="tt-scene-halo" />
                <div className="tt-scene-sheet tt-scene-sheet--back">
                  <span>ORGANIZARE</span>
                  <div className="flex h-full items-center justify-center">
                    <div className="rounded-2xl border border-white/60 bg-white/80 p-4 text-slate-700">
                      <Facebook size={30} />
                    </div>
                  </div>
                </div>
                <div className="tt-scene-sheet tt-scene-sheet--front">
                  <span className="tt-scene-brand">
                    <Facebook size={12} /> GRUPURI
                  </span>
                  <div className="flex h-full items-center justify-center">
                    <div className="w-28 rounded-[2rem] border border-white bg-white/85 p-4 text-center shadow-xl">
                      <Link2 className="mx-auto text-blue-700" size={28} />
                      <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Publicare
                      </span>
                      <strong className="block text-sm text-slate-900">Filtrată automat</strong>
                    </div>
                  </div>
                  <div className="tt-scene-caption">
                    <small>GRUPURI CONFIGURATE</small>
                    <strong>Anunțul ajunge unde trebuie.</strong>
                    <span>vânzări și închirieri</span>
                  </div>
                </div>
                <div className="tt-scene-tag tt-scene-tag--video">
                  <Facebook size={16} />
                  <span>
                    Facebook
                    <br />
                    <strong>Groups</strong>
                  </span>
                </div>
                <div className="tt-scene-tag tt-scene-tag--spark">
                  <Link2 size={16} />
                  <span>Publicare automată</span>
                </div>
              </div>
              <Button
                onClick={saveGroups}
                disabled={saving || isAgencyLoading || !agencyId}
                className="tt-button tt-button--default w-full rounded-full px-6"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvează grupurile
              </Button>
            </div>
          </header>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'sale' | 'rent')}>
          <TabsList className="grid h-14 w-full grid-cols-2 rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-surface-soft)] p-1.5 md:w-[480px]">
            <TabsTrigger value="sale" className="h-full rounded-xl text-sm data-[state=active]:bg-[var(--app-surface)]">
              Grupuri pentru vânzări
            </TabsTrigger>
            <TabsTrigger value="rent" className="h-full rounded-xl text-sm data-[state=active]:bg-[var(--app-surface)]">
              Grupuri pentru închirieri
            </TabsTrigger>
          </TabsList>

          {(['sale', 'rent'] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-5 space-y-4">
              {isAgencyLoading ? (
                <div className="flex min-h-48 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                </div>
              ) : visibleGroups.length ? (
                <>
                <div className="hidden overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm lg:block">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold text-slate-600">Grup</TableHead>
                        <TableHead className="font-bold text-slate-600">Link Facebook</TableHead>
                        <TableHead className="font-bold text-slate-600">Folosit pentru</TableHead>
                        <TableHead className="text-right font-bold text-slate-600">Acțiuni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleGroups.map(({ group, index }) => {
                        const groupHref = getGroupHref(group.url);
                        return (
                          <TableRow key={`${index}-${group.url}`} className="hover:bg-slate-50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
                                  <Facebook className="h-4 w-4" />
                                </span>
                                <Input
                                  value={group.name}
                                  onChange={(event) => updateGroup(index, { name: event.target.value })}
                                  placeholder="Ex: Imobiliare București"
                                  className="h-11 rounded-xl"
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="relative min-w-0 flex-1">
                                  <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    value={group.url}
                                    onChange={(event) => updateGroup(index, { url: event.target.value })}
                                    placeholder="https://www.facebook.com/groups/..."
                                    className="h-11 rounded-xl pl-9"
                                  />
                                </div>
                                {groupHref ? (
                                  <Button asChild type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl">
                                    <a href={groupHref} target="_blank" rel="noopener noreferrer" aria-label={`Deschide ${group.name || 'grupul Facebook'}`}>
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={group.purpose}
                                onValueChange={(purpose) => updateGroup(index, { purpose: purpose as FacebookGroupPurpose })}
                              >
                                <SelectTrigger className="h-11 rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sale">Vânzări</SelectItem>
                                  <SelectItem value="rent">Închirieri</SelectItem>
                                  <SelectItem value="both">Ambele</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 rounded-xl text-rose-600 hover:text-rose-700"
                                onClick={() => removeGroup(index)}
                                aria-label={`Șterge ${group.name || 'grupul'}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid gap-4 lg:hidden">
                  {visibleGroups.map(({ group, index }) => {
                    const groupHref = getGroupHref(group.url);
                    return (
                    <Card key={`${index}-${group.url}`} className="rounded-3xl border-[var(--app-card-border)] bg-[var(--app-surface)] shadow-[var(--app-card-shadow)]">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Facebook className="h-4 w-4 text-[#1877f2]" />
                            Grup Facebook
                          </div>
                          <Badge variant="outline" className="rounded-full">
                            {purposeLabels[group.purpose]}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`group-name-${index}`}>Denumire</Label>
                          <Input
                            id={`group-name-${index}`}
                            value={group.name}
                            onChange={(event) => updateGroup(index, { name: event.target.value })}
                            placeholder="Ex: Imobiliare București"
                            className="h-11 rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`group-url-${index}`}>Link grup</Label>
                          <div className="flex gap-2">
                            <div className="relative min-w-0 flex-1">
                              <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id={`group-url-${index}`}
                                value={group.url}
                                onChange={(event) => updateGroup(index, { url: event.target.value })}
                                placeholder="https://www.facebook.com/groups/..."
                                className="h-11 rounded-xl pl-9"
                              />
                            </div>
                            {groupHref ? (
                              <Button asChild type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl">
                                <a href={groupHref} target="_blank" rel="noopener noreferrer" aria-label={`Deschide ${group.name || 'grupul Facebook'}`}>
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            ) : (
                              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl" disabled aria-label="Link indisponibil">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-end gap-3">
                          <div className="flex-1 space-y-2">
                            <Label>Folosit pentru</Label>
                            <Select
                              value={group.purpose}
                              onValueChange={(purpose) => updateGroup(index, { purpose: purpose as FacebookGroupPurpose })}
                            >
                              <SelectTrigger className="h-11 rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sale">Vânzări</SelectItem>
                                <SelectItem value="rent">Închirieri</SelectItem>
                                <SelectItem value="both">Ambele</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 shrink-0 rounded-xl text-destructive hover:text-destructive"
                            onClick={() => removeGroup(index)}
                            aria-label={`Șterge ${group.name || 'grupul'}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
                </>
              ) : (
                <Card className="rounded-3xl border-dashed border-[var(--app-card-border)] bg-[var(--app-surface-soft)]">
                  <CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
                    <Facebook className="h-8 w-8 text-muted-foreground" />
                    <p className="font-semibold">Nu există grupuri pentru {tab === 'sale' ? 'vânzări' : 'închirieri'}.</p>
                    <p className="text-sm text-muted-foreground">Adaugă primul grup pentru această categorie.</p>
                  </CardContent>
                </Card>
              )}

              <Button type="button" variant="outline" onClick={addGroup} className="rounded-full">
                <Plus className="mr-2 h-4 w-4" />
                Adaugă grup pentru {tab === 'sale' ? 'vânzări' : 'închirieri'}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
