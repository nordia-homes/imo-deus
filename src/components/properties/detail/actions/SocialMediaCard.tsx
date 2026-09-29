'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Share2 } from 'lucide-react';
import type { Property } from '@/lib/types';
import { cn } from '@/lib/utils';
import SocialPostStudio, { type SocialPropertySummary } from '@/components/communications/SocialPostStudio';
import { useCommunications } from '@/components/communications/useCommunications';
import type { Connection } from '@/lib/communications/model';
import { ACTION_CARD_INTERACTIVE_CLASSNAME, ACTION_PILL_CLASSNAME } from './cardStyles';

export function SocialMediaCard({ property }: { property: Property }) {
  const api = useCommunications();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [properties, setProperties] = useState<SocialPropertySummary[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [admin, setAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashboard, propertyList] = await Promise.all([api('dashboard'), api('properties')]);
      setConnections((dashboard.connections || []).filter((connection: Connection) => ['messenger', 'instagram'].includes(connection.channel)));
      setAdmin(Boolean(dashboard.admin));
      setProperties(propertyList.properties || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Editorul nu a putut fi încărcat.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className={cn(`${ACTION_CARD_INTERACTIVE_CLASSNAME} p-0 cursor-pointer`)}>
          <CardContent className="flex w-full items-center justify-between p-2">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', ACTION_PILL_CLASSNAME)}>
                <Share2 className="h-4 w-4 text-emerald-200" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-white">Publica pe pagina ta Facebook</p>
                <p className="text-xs text-white/60">Posteaza proprietatea cu descrierea si pozele din anunt.</p>
              </div>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${ACTION_PILL_CLASSNAME}`}>
              <Send className="h-4 w-4 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="h-[100dvh] w-[100vw] max-w-none overflow-y-auto rounded-none border-0 bg-slate-50 p-2 text-slate-900 sm:max-w-none sm:p-7">
        <DialogHeader className="mx-auto hidden w-full max-w-[1600px] pb-2 pr-12 text-left min-[1101px]:flex">
          <DialogTitle className="text-xl">Creează postare · {property.title}</DialogTitle>
        </DialogHeader>
        <div className="tt-design tt-workspace mi-workspace mi-property-social-studio mx-auto w-full max-w-[1600px] flex-1">
          <style>{`@media (max-width: 1100px) { html body .mi-property-social-studio .mi-studio-layout { grid-template-columns: minmax(0, 1fr); } html body .mi-property-social-studio .mi-preview-column { position: static; } html body .mi-property-social-studio .mi-preview-panel { max-width: 620px; } html body .mi-property-social-studio .mi-studio-actions { flex-wrap: nowrap; } html body .mi-property-social-studio .mi-studio-actions button { flex: 1 1 0; min-width: 0; justify-content: center; padding-inline: 8px; white-space: nowrap; font-size: 12px; } }`}</style>
          {loading && <p className="p-6 text-sm text-slate-500">Se încarcă editorul de postări…</p>}
          {error && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
          {!loading && !error && <SocialPostStudio
            properties={properties}
            connections={connections}
            initialPropertyId={property.id}
            admin={admin}
            api={api}
            onSaved={async () => { await load(); setOpen(false); }}
          />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
