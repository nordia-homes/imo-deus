'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { FilePlus2, FileText, Loader2, PencilLine, Sparkles, Trash2 } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useAgency } from '@/context/AgencyContext';
import type { Contact, ContractTemplate, Property } from '@/lib/types';
import {
  buildContractPlaceholderMap,
  createDefaultContractHtml,
  CONTRACT_PLACEHOLDERS,
  CONTRACT_TEMPLATE_CATEGORIES,
  getCategoryLabel,
  renderContractContent,
  stripHtmlTags,
} from '@/lib/contracts';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

type CreateFormState = {
  name: string;
  category: ContractTemplate['category'];
  description: string;
  content: string;
  sourceFormat: 'manual' | 'docx';
  fileName: string;
};

const DEFAULT_CONTRACT_CONTENT = createDefaultContractHtml();

function CreateTemplateDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (state: CreateFormState) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [state, setState] = useState<CreateFormState>({
    name: '',
    category: 'reservation',
    description: '',
    content: DEFAULT_CONTRACT_CONTENT,
    sourceFormat: 'manual',
    fileName: '',
  });

  useEffect(() => {
    if (!open) {
      setState({
        name: '',
        category: 'reservation',
        description: '',
        content: DEFAULT_CONTRACT_CONTENT,
        sourceFormat: 'manual',
        fileName: '',
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-white/10 bg-[#10233b] text-white">
        <DialogHeader>
          <DialogTitle>Creeaza un template de contract</DialogTitle>
          <DialogDescription className="text-white/70">
            Contractul va fi editabil ca document. Dupa creare il poti rafina in editor si poti insera variabile oriunde in text.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white/80">Nume contract</Label>
            <Input
              value={state.name}
              onChange={(event) => setState((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ex: Contract de rezervare standard"
              className="border-white/15 bg-white/10 text-white placeholder:text-white/45"
            />
            <p className="text-xs text-white/55">
              Daca importi un document Word si lasi numele gol, il completam automat din numele fisierului.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Categorie</Label>
            <Select
              value={state.category}
              onValueChange={(value) => setState((current) => ({ ...current, category: value as ContractTemplate['category'] }))}
            >
              <SelectTrigger className="border-white/15 bg-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TEMPLATE_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Descriere</Label>
            <Textarea
              value={state.description}
              onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))}
              rows={4}
              className="border-white/15 bg-white/10 text-white placeholder:text-white/45"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Import document Word</Label>
            <Input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="border-white/15 bg-white/10 text-white file:text-white"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;

                try {
                  const mammoth = await import('mammoth/mammoth.browser');
                  const arrayBuffer = await file.arrayBuffer();
                  const result = await mammoth.convertToHtml({ arrayBuffer });
                  const importedContent = result.value.trim();

                  setState((current) => ({
                    ...current,
                    content: importedContent || current.content,
                    sourceFormat: 'docx',
                    fileName: file.name,
                    name: current.name || file.name.replace(/\.docx$/i, ''),
                  }));
                } catch (error) {
                  console.error('Failed to import DOCX file:', error);
                } finally {
                  event.target.value = '';
                }
              }}
            />
            <p className="text-xs text-white/55">
              Incarca documentul Word al agentiei, iar textul lui va fi importat in editor pentru modificare.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d1d31] p-4 text-sm leading-7 text-white/75">
            <p className="font-medium text-white">Continut initial pentru editor</p>
            <p className="mt-2">
              Template-ul va fi creat fie din documentul Word importat, fie dintr-un document gol pregatit automat. Continutul se editeaza exclusiv in editorul vizual de la pasul urmator, nu aici.
            </p>
            <p className="mt-3 text-white/55">
              Preview: {stripHtmlTags(state.content).slice(0, 220) || 'Document gol'}{stripHtmlTags(state.content).length > 220 ? '...' : ''}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => void onSubmit(state)}
            disabled={isSubmitting}
            className="bg-emerald-400 text-black hover:bg-emerald-300"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}
            Creeaza si deschide editorul
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FillContractDialog({
  open,
  onOpenChange,
  template,
  contacts,
  properties,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ContractTemplate | null;
  contacts: Contact[];
  properties: Property[];
}) {
  const { agency, user, userProfile } = useAgency();
  const { toast } = useToast();
  const [buyerId, setBuyerId] = useState<string>('none');
  const [ownerId, setOwnerId] = useState<string>('none');
  const [propertyId, setPropertyId] = useState<string>('none');
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const buyer = useMemo(() => contacts.find((contact) => contact.id === buyerId) || null, [buyerId, contacts]);
  const owner = useMemo(() => contacts.find((contact) => contact.id === ownerId) || null, [ownerId, contacts]);
  const property = useMemo(() => properties.find((entry) => entry.id === propertyId) || null, [propertyId, properties]);

  const placeholderMap = useMemo(() => {
    return buildContractPlaceholderMap({
      buyer,
      owner,
      property,
      agency,
      agent: userProfile,
    });
  }, [agency, buyer, owner, property, userProfile]);

  const mergedValues = useMemo(
    () => ({
      ...placeholderMap,
      ...manualValues,
    }),
    [manualValues, placeholderMap]
  );

  const renderedPreview = useMemo(
    () => renderContractContent(template?.content || '', mergedValues),
    [mergedValues, template?.content]
  );

  useEffect(() => {
    if (!open) {
      setBuyerId('none');
      setOwnerId('none');
      setPropertyId('none');
      setManualValues({});
    }
  }, [open]);

  async function handleGenerate() {
    if (!template || !user) return;

    try {
      setIsGenerating(true);
      const token = await user.getIdToken();
      const response = await fetch(`/api/contracts/templates/${template.id}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          values: mergedValues,
          contactId: buyer?.id || null,
          ownerId: owner?.id || null,
          propertyId: property?.id || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Nu am putut genera PDF-ul.');
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${template.name}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(objectUrl);

      toast({
        title: 'PDF generat',
        description: 'Documentul completat a fost descarcat.',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to generate contract PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Generare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut genera contractul.',
      });
    } finally {
      setIsGenerating(false);
    }
  }

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border-white/10 bg-[#081a2c] text-white">
        <DialogHeader>
          <DialogTitle>Completeaza contractul</DialogTitle>
          <DialogDescription className="text-white/70">
            Selectezi datele din CRM, ajustezi eventuale valori manuale si generezi PDF-ul final din documentul template.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-6">
            <Card className="rounded-3xl border-none bg-[#152A47] text-white shadow-2xl">
              <CardHeader>
                <CardTitle>Surse CRM</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Cumparator / client</Label>
                  <Select value={buyerId} onValueChange={setBuyerId}>
                    <SelectTrigger className="border-white/15 bg-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Fara selectie</SelectItem>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Proprietar</Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger className="border-white/15 bg-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Fara selectie</SelectItem>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Proprietate</Label>
                  <Select value={propertyId} onValueChange={setPropertyId}>
                    <SelectTrigger className="border-white/15 bg-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Fara selectie</SelectItem>
                      {properties.map((propertyEntry) => (
                        <SelectItem key={propertyEntry.id} value={propertyEntry.id}>{propertyEntry.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-none bg-[#152A47] text-white shadow-2xl">
              <CardHeader>
                <CardTitle>Valori manuale</CardTitle>
                <CardDescription className="text-white/70">
                  Aceste campuri suprascriu valorile luate automat din CRM atunci cand ai nevoie de ajustari rapide.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {CONTRACT_PLACEHOLDERS.filter((item) => item.key !== 'manual').map((item) => {
                  const normalizedKey = item.key.replace(/\./g, '_');
                  return (
                    <div key={item.token} className="space-y-2">
                      <Label className="text-white/80">{item.token}</Label>
                      <Input
                        value={manualValues[normalizedKey] || ''}
                        onChange={(event) =>
                          setManualValues((current) => ({
                            ...current,
                            [normalizedKey]: event.target.value,
                          }))
                        }
                        placeholder={item.label}
                        className="border-white/15 bg-white/10 text-white placeholder:text-white/45"
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-3xl border-none bg-[#152A47] text-white shadow-2xl">
            <CardHeader>
              <CardTitle>Preview document completat</CardTitle>
              <CardDescription className="text-white/70">
                Asa va arata contractul dupa inlocuirea variabilelor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="min-h-[760px] rounded-3xl border border-white/10 bg-[#0d1d31] p-6">
                <div
                  className="contract-preview prose prose-invert max-w-none text-white/90 [&_h1]:text-center [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:text-2xl [&_h2]:font-semibold [&_p]:leading-8"
                  dangerouslySetInnerHTML={{ __html: renderedPreview }}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => void handleGenerate()}
                  className="bg-emerald-400 text-black hover:bg-emerald-300"
                >
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Genereaza PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractsPage() {
  const router = useRouter();
  const { agencyId, userProfile, user, isAgencyLoading } = useAgency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [fillTemplate, setFillTemplate] = useState<ContractTemplate | null>(null);

  const templatesRef = useMemoFirebase(
    () => (agencyId ? collection(firestore, 'agencies', agencyId, 'contractTemplates') : null),
    [agencyId, firestore]
  );
  const contactsRef = useMemoFirebase(
    () => (agencyId ? collection(firestore, 'agencies', agencyId, 'contacts') : null),
    [agencyId, firestore]
  );
  const propertiesRef = useMemoFirebase(
    () => (agencyId ? collection(firestore, 'agencies', agencyId, 'properties') : null),
    [agencyId, firestore]
  );

  const { data: templates, isLoading: isTemplatesLoading } = useCollection<ContractTemplate>(templatesRef);
  const { data: contacts } = useCollection<Contact>(contactsRef);
  const { data: properties } = useCollection<Property>(propertiesRef);

  const sortedTemplates = useMemo(
    () => [...(templates || [])].sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))),
    [templates]
  );

  async function handleCreateTemplate(state: CreateFormState) {
    if (!agencyId || !user || userProfile?.role !== 'admin') return;
    const nextName = state.name.trim() || state.fileName.replace(/\.docx$/i, '').trim();
    if (!nextName) {
      toast({
        variant: 'destructive',
        title: 'Nume lipsa',
        description: 'Completeaza numele template-ului sau importa un document Word.',
      });
      return;
    }

    try {
      setIsCreating(true);
      const templateRef = doc(collection(firestore, 'agencies', agencyId, 'contractTemplates'));
      const now = new Date().toISOString();

      await setDoc(templateRef, {
        id: templateRef.id,
        agencyId,
        name: nextName,
        category: state.category,
        description: state.description.trim(),
        sourceType: 'document',
        content: state.content,
        sourceFormat: state.sourceFormat,
        sourcePdfUrl: '',
        sourcePdfPath: '',
        fileName: state.fileName,
        pageCount: 0,
        status: 'draft',
        fields: [],
        createdAt: now,
        updatedAt: now,
        createdBy: user.uid,
        updatedBy: user.uid,
      } satisfies ContractTemplate);

      toast({
        title: 'Template creat',
        description: 'Contractul document a fost creat. Deschid editorul vizual.',
      });
      setIsCreateOpen(false);
      router.push(`/contracts/${templateRef.id}/edit`);
    } catch (error) {
      console.error('Failed to create contract template:', error);
      toast({
        variant: 'destructive',
        title: 'Creare esuata',
        description: 'Nu am putut crea template-ul.',
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!agencyId || userProfile?.role !== 'admin') return;

    try {
      await deleteDoc(doc(firestore, 'agencies', agencyId, 'contractTemplates', templateId));
      toast({
        title: 'Template sters',
        description: 'Template-ul a fost eliminat.',
      });
    } catch (error) {
      console.error('Failed to delete contract template:', error);
      toast({
        variant: 'destructive',
        title: 'Stergere esuata',
        description: 'Nu am putut sterge template-ul.',
      });
    }
  }

  if (isAgencyLoading || isTemplatesLoading) {
    return (
      <div className="space-y-6 bg-[#0F1E33] p-4 text-white">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-[420px]" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[290px] rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 bg-[#0F1E33] p-4 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-200">
              <FileText className="mr-2 h-4 w-4" />
              Contracte editabile cu variabile
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Documente si contracte</h1>
            <p className="max-w-3xl text-white/70">
              Contractele sunt acum template-uri document editabile. Agenția poate scrie sau modifica conținutul liber și poate insera variabile direct în text, exact ca într-un document Word simplificat.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            disabled={userProfile?.role !== 'admin'}
            className="bg-emerald-400 text-black hover:bg-emerald-300"
          >
            <FilePlus2 className="mr-2 h-4 w-4" />
            Creeaza template document
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sortedTemplates.length ? (
            sortedTemplates.map((template) => (
              <Card key={template.id} className="flex flex-col rounded-3xl border-none bg-[#152A47] text-white shadow-2xl">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <Badge className="bg-white/10 text-white hover:bg-white/10">{getCategoryLabel(template.category)}</Badge>
                    <Badge className={template.status === 'active' ? 'bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/15' : 'bg-amber-400/15 text-amber-200 hover:bg-amber-400/15'}>
                      {template.status === 'active' ? 'Activ' : 'Draft'}
                    </Badge>
                  </div>
                  <div>
                    <CardTitle className="text-xl">{template.name}</CardTitle>
                    <CardDescription className="mt-2 text-white/70">
                      {template.description || 'Template document editabil pentru generare contracte.'}
                    </CardDescription>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className="bg-white/10 text-white hover:bg-white/10">
                        {template.sourceFormat === 'docx' ? 'Importat din Word' : 'Creat in editor'}
                      </Badge>
                      {template.fileName ? (
                        <Badge className="bg-white/10 text-white hover:bg-white/10">{template.fileName}</Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#0d1d31] p-4">
                    <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-7 text-white/80">
                      {stripHtmlTags(template.content || '') || 'Acest template nu are inca text adaugat.'}
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <div className="grid w-full grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFillTemplate(template)}
                      disabled={!template.content?.trim()}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Completeaza
                    </Button>
                    <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                      <Link href={`/contracts/${template.id}/edit`}>
                        <PencilLine className="mr-2 h-4 w-4" />
                        Editeaza
                      </Link>
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={userProfile?.role !== 'admin'}
                    onClick={() => void handleDeleteTemplate(template.id)}
                    className="w-full border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Sterge
                  </Button>
                </CardFooter>
              </Card>
            ))
          ) : (
            <Card className="col-span-full rounded-3xl border border-dashed border-white/15 bg-[#152A47] text-white">
              <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
                <div className="rounded-full border border-white/10 bg-white/5 p-4">
                  <FileText className="h-7 w-7 text-emerald-300" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Nu ai încă niciun template document</h2>
                  <p className="max-w-2xl text-sm leading-7 text-white/70">
                    Creează primul template al agenției, scrie contractul direct în editor și inserează variabile precum <code>{'{{buyer.name}}'}</code> sau <code>{'{{property.address}}'}</code>.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CreateTemplateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateTemplate}
        isSubmitting={isCreating}
      />

      <FillContractDialog
        open={Boolean(fillTemplate)}
        onOpenChange={(open) => {
          if (!open) setFillTemplate(null);
        }}
        template={fillTemplate}
        contacts={contacts || []}
        properties={properties || []}
      />
    </>
  );
}
