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
  buildStructuredHeaderBlocks,
  createDefaultContractHtml,
  CONTRACT_PLACEHOLDERS,
  CONTRACT_TEMPLATE_CATEGORIES,
  getCategoryLabel,
  normalizeContractText,
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

const PLACEHOLDER_ORDER_BY_CATEGORY: Record<ContractTemplate['category'], string[]> = {
  collaboration: [
    'contract.number',
    'currentDate',
    'owner.name',
    'owner.address',
    'owner.personalNumericCode',
    'owner.identityDocumentSeries',
    'owner.identityDocumentNumber',
    'agent.name',
    'agent.phone',
    'property.commissionPercent',
    'property.address',
    'property.cadastralNumber',
    'property.price',
  ],
  exclusivity: [
    'contract.number',
    'currentDate',
    'owner.name',
    'owner.address',
    'owner.personalNumericCode',
    'owner.identityDocumentSeries',
    'owner.identityDocumentNumber',
    'agent.name',
    'agent.phone',
    'property.commissionPercent',
    'property.address',
    'property.cadastralNumber',
    'property.price',
  ],
  reservation: [
    'contract.number',
    'currentDate',
    'owner.name',
    'owner.address',
    'owner.personalNumericCode',
    'owner.identityDocumentSeries',
    'owner.identityDocumentNumber',
    'agent.name',
    'agent.phone',
    'buyer.name',
    'buyer.phone',
    'buyer.email',
    'property.address',
    'property.cadastralNumber',
    'property.price',
    'reservation.amount',
  ],
  custom: [
    'contract.number',
    'currentDate',
    'owner.name',
    'owner.address',
    'owner.personalNumericCode',
    'owner.identityDocumentSeries',
    'owner.identityDocumentNumber',
    'agent.name',
    'agent.phone',
    'property.commissionPercent',
    'property.address',
    'property.cadastralNumber',
    'property.price',
  ],
};

function ExportedPdfPreview({
  template,
  values,
  agencyName,
}: {
  template: ContractTemplate;
  values: Record<string, string>;
  agencyName?: string | null;
}) {
  const headerBlocks = useMemo(
    () => buildStructuredHeaderBlocks(template.category || 'reservation', values),
    [template.category, values]
  );
  const ensureNamedParagraphSeparator = (text: string) =>
    text.trimStart().startsWith(',') ? text : `, ${text.trimStart()}`;

  const bodyParagraphs = useMemo(() => {
    return stripHtmlTags(renderContractContent(template.content || '', values))
      .split(/\r?\n/)
      .map((item) => normalizeContractText(item))
      .filter(Boolean);
  }, [template.content, values]);

  const title = template.name || 'Contract';
  const contractNumber = normalizeContractText(String(values.contract_number || ''));
  const currentDate = normalizeContractText(String(values.currentDate || ''));
  const agencyDisplayName = normalizeContractText(String(values.agency_legalCompanyName || values.agency_name || agencyName || 'Agentie imobiliara'));
  const agencyPhone = normalizeContractText(String(values.agency_phone || ''));
  const agencyEmail = normalizeContractText(String(values.agency_email || ''));
  const headerLine = [agencyDisplayName, agencyPhone, agencyEmail].filter(Boolean).join('   •   ');

  return (
    <div className="relative mx-auto w-full max-w-[920px] min-h-[1300px] rounded-[28px] border border-slate-200 bg-white px-[7.5%] py-[7%] text-[#0f1720] shadow-[0_25px_70px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="select-none whitespace-nowrap text-[clamp(56px,6.3vw,96px)] font-semibold tracking-[0.08em] text-slate-300/[0.18] [transform:rotate(-32deg)]">
          {agencyDisplayName}
        </div>
      </div>
      <div className="border-b border-slate-200 pb-3 text-center text-[clamp(11px,0.95vw,13px)] font-medium text-slate-600">
        {headerLine}
      </div>
      <div className="text-center">
        <div className="mx-auto h-[2px] w-[220px] bg-[#2f6fde]" />
        <div className="py-3 text-[clamp(26px,2.4vw,32px)] font-bold tracking-[-0.03em] text-[#071326]">
          {agencyDisplayName}
        </div>
        <div className="mx-auto h-[2px] w-[220px] bg-[#2f6fde]" />
      </div>

      <div className="mt-8 text-center">
        <h1 className="whitespace-nowrap text-[clamp(22px,1.75vw,32px)] font-semibold tracking-[0.005em] text-[#bb1f2a]">
          {title}
        </h1>
        {(contractNumber || currentDate) ? (
          <div className="mt-0.5 text-[clamp(16px,1.3vw,20px)] text-[#2f6fde]">
            {[contractNumber ? `Contract nr. ${contractNumber}` : '', currentDate ? `Data ${currentDate}` : '']
              .filter(Boolean)
              .join(' | ')}
          </div>
        ) : null}
      </div>

      <div className="mt-10 space-y-4">
        {headerBlocks.map((block, index) => {
          if (block.kind === 'intro') {
            return (
              <p
                key={`intro-${index}`}
                className="inline-block bg-slate-100 px-3 py-1.5 text-[12px] leading-[1.7] text-[#1f2937]"
              >
                {block.text}
              </p>
            );
          }

          if (block.kind === 'connector') {
            return (
              <p key={`connector-${index}`} className="text-[12px] leading-[1.6] text-[#374151]">
                {block.text}
              </p>
            );
          }

          if (block.kind === 'party') {
            return (
              <div key={`party-${index}`} className="flex items-start gap-4">
                <div className="w-8 shrink-0 pt-0.5 text-right text-[clamp(18px,1.25vw,20px)] font-medium text-[#111827]">
                  {block.index}.
                </div>
                <p className="flex-1 text-[clamp(16px,1.22vw,19px)] leading-[1.82] text-[#111827]">
                  {block.text}
                </p>
              </div>
            );
          }

          if (block.kind === 'emphasis') {
            return (
              <p key={`emphasis-${index}`} className="text-[12px] font-semibold leading-[1.82] text-[#111827]">
                {block.text}
              </p>
            );
          }

          if (block.kind === 'namedParagraph') {
            return (
              <p key={`named-${index}`} className="text-[12px] leading-[1.82] text-[#111827]">
                <span className="font-semibold">{block.boldText}</span>
                {ensureNamedParagraphSeparator(block.text)}
              </p>
            );
          }

          return (
            <p key={`paragraph-${index}`} className="text-[12px] leading-[1.82] text-[#111827]">
              {block.text}
            </p>
          );
        })}
      </div>

      {bodyParagraphs.length ? (
        <div className="mt-10 border-t border-slate-200 pt-8">
          <div className="space-y-4">
            {bodyParagraphs.map((paragraph, index) => (
              <p
                key={`${paragraph}-${index}`}
                className="text-[clamp(15px,1.1vw,18px)] leading-[1.8] text-[#111827]"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8 border-t border-slate-200 pt-3 text-center text-[12px] font-medium text-slate-500">
        Pagina 1
      </div>
    </div>
  );
}

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
            Antetul contractului va fi generat automat cu tagurile standard. Dupa creare, agentia va edita doar corpul contractului in editorul vizual.
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
              Incarca documentul Word al agentiei, iar continutul lui va fi folosit ca baza pentru corpul contractului.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d1d31] p-4 text-sm leading-7 text-white/75">
            <p className="font-medium text-white">Continut initial pentru editor</p>
            <p className="mt-2">
              Template-ul va fi creat fie din documentul Word importat, fie dintr-un corp de contract pregatit automat. Antetul cu datele partilor, proprietatii si agentiei se adauga automat in pasul urmator.
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

  const visibleManualPlaceholders = useMemo(() => {
    const order = PLACEHOLDER_ORDER_BY_CATEGORY[template?.category || 'reservation'] || [];
    const lookup = new Map(CONTRACT_PLACEHOLDERS.filter((item) => item.key !== 'manual').map((item) => [item.key, item]));
    return order
      .map((key) => lookup.get(key))
      .filter((item) => item && !item.key.startsWith('agency.'))
      .filter((item): item is (typeof CONTRACT_PLACEHOLDERS)[number] => Boolean(item));
  }, [template?.category]);

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
      <DialogContent className="flex h-[94vh] flex-col overflow-hidden border-white/10 bg-[#081a2c] text-white w-[min(96vw,1820px)] max-w-none">
        <DialogHeader>
          <DialogTitle>Completeaza contractul</DialogTitle>
          <DialogDescription className="text-white/70">
            Selectezi datele din CRM, ajustezi eventuale valori manuale si generezi PDF-ul final din documentul template.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="min-h-0 space-y-6 overflow-y-auto pr-2">
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
                <CardTitle>Taguri din document</CardTitle>
                <CardDescription className="text-white/70">
                  Apar doar campurile folosite de acest tip de contract, in ordinea in care sunt afisate in document.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleManualPlaceholders.map((item) => {
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

          <Card className="flex min-h-0 flex-col rounded-3xl border-none bg-[#152A47] text-white shadow-2xl">
            <CardHeader>
              <CardTitle>Preview document completat</CardTitle>
              <CardDescription className="text-white/70">
                Asa va arata contractul dupa inlocuirea variabilelor.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col space-y-4">
              <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl border border-white/10 bg-[#0d1d31] p-5">
                <div className="mx-auto flex min-h-full w-full items-start justify-center">
                  <ExportedPdfPreview
                    template={template}
                    values={mergedValues}
                    agencyName={agency?.name || null}
                  />
                </div>
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
        headerMode: 'crm_prefilled',
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
              Antetul fiecarui contract este predefinit cu tagurile esentiale, iar agentia editeaza doar corpul documentului. La completare, agentul poate alege datele din CRM sau le poate suprascrie manual.
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
                      {stripHtmlTags(template.content || '') || 'Acest template nu are inca un corp de contract adaugat.'}
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <div className="grid w-full grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFillTemplate(template)}
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
                    Creează primul template al agenției și personalizează doar corpul contractului. Antetul cu datele din CRM este generat automat.
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
