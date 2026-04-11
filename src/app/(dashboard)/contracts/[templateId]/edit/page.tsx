'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useAgency } from '@/context/AgencyContext';
import type { ContractTemplate } from '@/lib/types';
import { CONTRACT_TEMPLATE_CATEGORIES } from '@/lib/contracts';
import { useToast } from '@/hooks/use-toast';
import { DocumentTemplateEditor } from '@/components/contracts/DocumentTemplateEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditContractTemplatePage() {
  const params = useParams<{ templateId: string }>();
  const { agencyId, user, userProfile, isAgencyLoading } = useAgency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ContractTemplate['category']>('reservation');
  const [status, setStatus] = useState<ContractTemplate['status']>('draft');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const templateRef = useMemoFirebase(
    () => (agencyId && params?.templateId ? doc(firestore, 'agencies', agencyId, 'contractTemplates', params.templateId) : null),
    [agencyId, firestore, params]
  );
  const { data: template, isLoading } = useDoc<ContractTemplate>(templateRef);

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setDescription(template.description || '');
    setCategory(template.category);
    setStatus(template.status);
    setContent(template.content || '');
  }, [template]);

  async function handleSave(nextStatus?: ContractTemplate['status']) {
    if (!agencyId || !template || !user || userProfile?.role !== 'admin') return;
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nume lipsa',
        description: 'Template-ul trebuie sa aiba un nume.',
      });
      return;
    }

    try {
      setIsSaving(true);
      await updateDoc(doc(firestore, 'agencies', agencyId, 'contractTemplates', template.id), {
        name: name.trim(),
        description: description.trim(),
        category,
        status: nextStatus || status,
        content,
        headerMode: 'crm_prefilled',
        sourceType: 'document',
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
      });

      if (nextStatus) {
        setStatus(nextStatus);
      }

      toast({
        title: 'Template salvat',
        description: nextStatus === 'active'
          ? 'Template-ul a fost salvat si activat.'
          : 'Modificarile au fost salvate.',
      });
    } catch (error) {
      console.error('Failed to save document template:', error);
      toast({
        variant: 'destructive',
        title: 'Salvare esuata',
        description: 'Nu am putut salva template-ul.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isAgencyLoading || isLoading) {
    return (
      <div className="space-y-6 bg-[#0F1E33] p-4 text-white">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Skeleton className="h-[320px] rounded-3xl" />
          <Skeleton className="h-[780px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!template || !agencyId) {
    return (
      <div className="space-y-6 bg-[#0F1E33] p-4 text-white">
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100">
          Template-ul nu a fost gasit sau nu ai acces la el.
        </div>
        <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
          <Link href="/contracts">Inapoi la contracte</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#0F1E33] px-3 py-4 text-white lg:px-4 xl:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <Button asChild variant="ghost" className="-ml-4 w-fit text-white/70 hover:bg-white/5 hover:text-white">
            <Link href="/contracts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Inapoi la contracte
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Editor document contract</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || userProfile?.role !== 'admin'}
            className="bg-white/10 text-white hover:bg-white/15"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salveaza draft
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave('active')}
            disabled={isSaving || userProfile?.role !== 'admin'}
            className="bg-emerald-400 text-black hover:bg-emerald-300"
          >
            Activeaza template-ul
          </Button>
        </div>
      </div>

      <div className="grid gap-5">
        <div className="rounded-3xl border border-white/10 bg-[#152A47] px-5 py-4 text-white shadow-2xl">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_260px]">
            <div className="space-y-2">
              <Label className="text-white/80">Nume template</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="border-white/15 bg-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Categorie</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as ContractTemplate['category'])}>
                <SelectTrigger className="border-white/15 bg-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TEMPLATE_CATEGORIES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Descriere scurta</Label>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="border-white/15 bg-white/10 text-white"
                placeholder="Descriere interna pentru agentie"
              />
            </div>
          </div>
          {template.fileName ? (
            <p className="pt-3 text-xs text-white/55">Fisier sursa: {template.fileName}</p>
          ) : null}
        </div>

        <DocumentTemplateEditor
          content={content}
          onChange={setContent}
          templateName={name}
          category={category}
        />
      </div>
    </div>
  );
}
