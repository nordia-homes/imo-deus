'use client';

import { useMemo, useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { CheckSquare, ExternalLink, Facebook, Loader2, Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAgency } from '@/context/AgencyContext';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { getAgencyFacebookGroups } from '@/lib/facebook-groups';
import type { FacebookPromotionSession, Property } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ACTION_CARD_INTERACTIVE_CLASSNAME, ACTION_PILL_CLASSNAME } from './cardStyles';

export function FacebookGroupPromotionLauncherCard({ property }: { property: Property }) {
  const isMobile = useIsMobile();
  const { agency, agencyId } = useAgency();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableGroups = useMemo(() => getAgencyFacebookGroups(agency), [agency]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);

  const selectedGroups = useMemo(
    () => availableGroups.filter((group) => selectedUrls.includes(group.url)),
    [availableGroups, selectedUrls]
  );

  const handleToggleGroup = (groupUrl: string, checked: boolean) => {
    setSelectedUrls((current) =>
      checked ? [...current, groupUrl] : current.filter((url) => url !== groupUrl)
    );
  };

  const handleSelectAll = () => {
    setSelectedUrls(availableGroups.map((group) => group.url));
  };

  const handleClearSelection = () => {
    setSelectedUrls([]);
  };

  const handleOpenPromotion = async () => {
    if (!agencyId || !user) return;
    if (selectedGroups.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nu ai selectat niciun grup',
        description: 'Selectează cel puțin un grup Facebook pentru publicare.',
      });
      return;
    }

    setIsSubmitting(true);

    const startedAt = new Date().toISOString();

    try {
      const groupsWithStatus = selectedGroups.map((group) => ({
        ...group,
        status: 'pending' as const,
      }));

      const jobRef = await addDoc(collection(firestore, 'agencies', agencyId, 'facebookPromotionJobs'), {
        propertyId: property.id,
        propertyTitle: property.title,
        propertyDescription: property.description || '',
        propertyImages: property.images || [],
        createdAt: startedAt,
        createdBy: user.uid,
        status: 'pending',
        groups: groupsWithStatus,
      });

      const sessionPayload: FacebookPromotionSession = {
        jobId: jobRef.id,
        propertyId: property.id,
        propertyTitle: property.title,
        propertyDescription: property.description || '',
        propertyImages: property.images || [],
        groups: groupsWithStatus,
        currentGroupIndex: 0,
        startedAt,
      };

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('imodeus:facebookPromotionSession', JSON.stringify(sessionPayload));
      }

      toast({
        title: 'Sesiunea de promovare a fost pregătită',
        description: 'Runner-ul asistat pornește acum pentru această proprietate.',
      });

      setIsOpen(false);
      setSelectedUrls([]);
      router.push('/facebook-promotion-runner');
    } catch (error) {
      console.error('Failed to start Facebook promotion job:', error);
      toast({
        variant: 'destructive',
        title: 'Nu am putut porni promovarea',
        description: 'Încearcă din nou. Dacă problema persistă, verifică drepturile și conexiunea.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setIsOpen(nextOpen);
        if (!nextOpen) {
          setSelectedUrls([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <Card
          className={cn(
            `${ACTION_CARD_INTERACTIVE_CLASSNAME} cursor-pointer p-0`
          )}
        >
          <CardContent className="flex w-full items-center justify-between p-2">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${ACTION_PILL_CLASSNAME}`}>
                <Facebook className="h-4 w-4 text-emerald-200" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-white">Promovare grupuri Facebook</p>
                <p className="text-xs text-white/60">
                  Selectezi grupurile, iar sesiunea asistată pornește direct din această proprietate.
                </p>
              </div>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${ACTION_PILL_CLASSNAME}`}>
              <Rocket className="h-4 w-4 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent
        className={cn(
          'flex max-h-[88vh] flex-col overflow-hidden bg-[#0F1E33] text-white sm:max-w-2xl',
          isMobile && 'flex h-screen w-screen max-w-full flex-col rounded-none border-none p-0'
        )}
      >
        <DialogHeader className={cn('p-6', isMobile && 'shrink-0 border-b border-white/10 p-4 text-center')}>
          <DialogTitle className="text-left text-xl font-semibold text-white">
            Promovare grupuri Facebook
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-6 text-white/65">
            Selectează grupurile în care vrei să publici această proprietate. După confirmare, descrierea și pozele proprietății sunt pregătite pentru sesiunea asistată.
          </DialogDescription>
        </DialogHeader>

        <div className={cn(isMobile ? 'flex-1 overflow-y-auto p-4' : 'min-h-0 flex-1 overflow-y-auto px-6 pb-6')}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{property.title}</p>
                <p className="mt-1 text-xs text-white/60">
                  {property.images?.length || 0} poze disponibile • descrierea existentă va fi folosită ca atare
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
                  onClick={handleSelectAll}
                >
                  Selectează toate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
                  onClick={handleClearSelection}
                >
                  Resetează
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {availableGroups.map((group, index) => {
                const checkboxId = `facebook-group-${index}`;
                const isSelected = selectedUrls.includes(group.url);

                return (
                  <label
                    key={`${group.url}-${index}`}
                    htmlFor={checkboxId}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                      isSelected
                        ? 'border-emerald-300/28 bg-emerald-400/10'
                        : 'border-white/8 bg-[#10233b] hover:bg-[#132844]'
                    )}
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleToggleGroup(group.url, !!checked)}
                      className="mt-1 border-white/30 data-[state=checked]:border-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">
                          {group.name || `Grup Facebook ${index + 1}`}
                        </p>
                        <ExternalLink className="h-4 w-4 shrink-0 text-white/40" />
                      </div>
                      <p className="mt-1 truncate text-xs text-white/55">{group.url}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex items-center gap-2 text-sm text-white/70">
                <CheckSquare className="h-4 w-4 text-emerald-200" />
                <span>{selectedGroups.length} grupuri selectate</span>
              </div>
              <Button
                type="button"
                onClick={handleOpenPromotion}
                disabled={isSubmitting || selectedGroups.length === 0}
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                Confirmă selecția
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
