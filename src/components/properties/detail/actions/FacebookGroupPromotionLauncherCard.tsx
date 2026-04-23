'use client';

import { useMemo, useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { CheckSquare, ExternalLink, Facebook, Loader2, Rocket, RotateCcw } from 'lucide-react';
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
import { ACTION_CARD_INTERACTIVE_CLASSNAME, ACTION_ICON_CLASSNAME, ACTION_ICON_WRAPPER_CLASSNAME } from './cardStyles';

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
              <div className={ACTION_ICON_WRAPPER_CLASSNAME}>
                <Facebook className={ACTION_ICON_CLASSNAME} />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-white">Promovare grupuri Facebook</p>
                <p className="text-xs text-white/60">
                  Selectezi grupurile, iar sesiunea asistată pornește direct din această proprietate.
                </p>
              </div>
            </div>
            <div className={ACTION_ICON_WRAPPER_CLASSNAME}>
              <Rocket className={ACTION_ICON_CLASSNAME} />
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent
        className={cn(
          'facebook-groups-promotion-modal flex max-h-[88vh] flex-col overflow-hidden bg-[#0F1E33] text-white sm:max-w-2xl',
          isMobile && 'flex h-screen w-screen max-w-full flex-col rounded-none border-none p-0'
        )}
      >
        <DialogHeader className={cn('facebook-groups-promotion-modal__header p-6', isMobile && 'shrink-0 border-b border-white/10 p-4 text-center')}>
          <DialogTitle className="text-left text-xl font-semibold text-white">
            Promovare grupuri Facebook
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-6 text-white/65">
            Selectează grupurile în care vrei să publici această proprietate. După confirmare, descrierea și pozele proprietății sunt pregătite pentru sesiunea asistată.
          </DialogDescription>
        </DialogHeader>

        <div className={cn(isMobile ? 'flex-1 overflow-y-auto p-4' : 'min-h-0 flex-1 overflow-y-auto px-6 pb-6')}>
          <div className="facebook-groups-promotion-modal__panel rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{property.title}</p>
                <p className="mt-1 text-xs text-white/60">
                  {property.images?.length || 0} poze disponibile • descrierea existentă va fi folosită ca atare
                </p>
              </div>
              <div className="facebook-groups-promotion-modal__actions flex shrink-0 items-center gap-2 self-start sm:self-start">
                <Button
                  type="button"
                  variant="ghost"
                  className="facebook-groups-promotion-modal__secondary-button rounded-full border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
                  onClick={handleSelectAll}
                >
                  Selectează toate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="facebook-groups-promotion-modal__secondary-button h-10 w-10 rounded-full border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
                  onClick={handleClearSelection}
                  aria-label="Reseteaza selectia"
                  title="Reseteaza selectia"
                >
                  <RotateCcw className="h-4 w-4" />
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
                      'facebook-groups-promotion-modal__group-item flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                      isSelected
                        ? 'border-emerald-300/28 bg-emerald-400/10'
                        : 'border-white/8 bg-[#10233b] hover:bg-[#132844]'
                    )}
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleToggleGroup(group.url, !!checked)}
                      className="facebook-groups-promotion-modal__checkbox mt-1 border-white/30 data-[state=checked]:border-primary"
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
                className="facebook-groups-promotion-modal__primary-button rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                Confirmă selecția
              </Button>
            </div>
          </div>
        </div>
        <style jsx global>{`
          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal {
            border: 1px solid rgba(174, 195, 225, 0.78) !important;
            background:
              radial-gradient(circle at 12% 0%, rgba(196, 181, 253, 0.16), transparent 32%),
              radial-gradient(circle at 92% 6%, rgba(125, 211, 252, 0.22), transparent 34%),
              linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(238, 246, 255, 0.94) 54%, rgba(235, 253, 244, 0.92)) !important;
            color: #111827 !important;
            box-shadow:
              0 32px 90px rgba(30, 45, 74, 0.32),
              inset 0 1px 0 rgba(255, 255, 255, 0.98) !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal > button.absolute {
            border: 1px solid rgba(174, 195, 225, 0.76) !important;
            background: rgba(255, 255, 255, 0.78) !important;
            color: #273b5b !important;
            box-shadow: 0 10px 24px rgba(37, 55, 88, 0.12) !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__header {
            border-bottom-color: rgba(174, 195, 225, 0.52) !important;
            background:
              radial-gradient(circle at top right, rgba(125, 211, 252, 0.18), transparent 36%),
              linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(235, 243, 252, 0.92)) !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__header [data-radix-dialog-title],
          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__header .text-white {
            color: #111827 !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__header [data-radix-dialog-description],
          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__header .text-white\/65 {
            color: #5d6c86 !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__panel {
            border-color: rgba(191, 206, 230, 0.82) !important;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(239, 246, 255, 0.84)) !important;
            box-shadow:
              0 18px 38px rgba(45, 68, 104, 0.13),
              inset 0 1px 0 rgba(255, 255, 255, 0.96) !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__panel .text-white {
            color: #111827 !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__panel .text-white\/70,
          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__panel .text-white\/60,
          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__panel .text-white\/55,
          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__panel .text-white\/40 {
            color: #5d6c86 !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__panel .border-white\/10,
          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__panel .border-white\/8 {
            border-color: rgba(191, 206, 230, 0.82) !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__secondary-button {
            border-color: rgba(191, 206, 230, 0.82) !important;
            background: linear-gradient(145deg, rgba(244, 248, 254, 0.96), rgba(255, 255, 255, 0.9)) !important;
            color: #273b5b !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__secondary-button:hover {
            background: rgba(226, 236, 249, 0.9) !important;
            color: #1f2f49 !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__actions {
            flex-wrap: nowrap !important;
            align-items: center !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__group-item {
            border-color: rgba(191, 206, 230, 0.82) !important;
            background: linear-gradient(145deg, rgba(244, 248, 254, 0.96), rgba(255, 255, 255, 0.92)) !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__group-item:hover {
            background: rgba(226, 236, 249, 0.9) !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__group-item.border-emerald-300\\/28 {
            border-color: rgba(74, 222, 128, 0.42) !important;
            background: linear-gradient(135deg, rgba(220, 252, 231, 0.82), rgba(239, 246, 255, 0.88)) !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__checkbox {
            border-color: rgba(125, 146, 181, 0.92) !important;
            background: rgba(255, 255, 255, 0.96) !important;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.92),
              0 0 0 1px rgba(225, 233, 245, 0.75) !important;
            color: #ffffff !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__checkbox[data-state='checked'] {
            border-color: rgba(39, 66, 104, 0.96) !important;
            background: linear-gradient(135deg, rgba(39, 66, 104, 0.98), rgba(31, 59, 96, 0.98)) !important;
            box-shadow:
              0 8px 18px -12px rgba(39, 66, 104, 0.65),
              inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__checkbox svg {
            color: #ffffff !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__primary-button {
            border: 1px solid rgba(68, 91, 132, 0.16) !important;
            background: linear-gradient(135deg, rgba(39, 66, 104, 0.95) 0%, rgba(27, 52, 86, 0.98) 100%) !important;
            color: #ffffff !important;
            box-shadow: 0 18px 38px -22px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
          }

          [data-app-theme='agentfinder'] .facebook-groups-promotion-modal__primary-button:hover {
            background: linear-gradient(135deg, rgba(46, 77, 120, 0.98) 0%, rgba(31, 59, 96, 1) 100%) !important;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
