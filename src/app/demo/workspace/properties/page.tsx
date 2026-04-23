'use client';

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Property } from "@/lib/types";
import { useDemoSession } from "@/components/demo/DemoSessionProvider";
import { createDemoEntityId, formatDemoCurrency } from "@/components/demo/demo-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type PropertyFormState = {
  id: string;
  title: string;
  location: string;
  address: string;
  price: string;
  rooms: string;
  bathrooms: string;
  squareFootage: string;
  status: NonNullable<Property["status"]>;
  description: string;
};

const DEFAULT_PROPERTY_FORM: PropertyFormState = {
  id: "",
  title: "",
  location: "Bucuresti",
  address: "",
  price: "",
  rooms: "2",
  bathrooms: "1",
  squareFootage: "60",
  status: "Activ",
  description: "",
};

export default function DemoPropertiesPage() {
  const { state, saveProperty, deleteProperty } = useDemoSession();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<PropertyFormState>(DEFAULT_PROPERTY_FORM);

  const properties = useMemo(() => [...(state?.properties || [])], [state?.properties]);

  const openCreate = () => {
    setForm(DEFAULT_PROPERTY_FORM);
    setIsOpen(true);
  };

  const openEdit = (property: Property) => {
    setForm({
      id: property.id,
      title: property.title,
      location: property.location,
      address: property.address,
      price: String(property.price),
      rooms: String(property.rooms),
      bathrooms: String(property.bathrooms),
      squareFootage: String(property.squareFootage),
      status: property.status || "Activ",
      description: property.description || "",
    });
    setIsOpen(true);
  };

  const handleSave = () => {
    const nextProperty: Property = {
      id: form.id || createDemoEntityId("demo-property"),
      title: form.title.trim() || "Proprietate demo",
      location: form.location.trim() || "Bucuresti",
      address: form.address.trim() || form.location.trim() || "Bucuresti",
      price: Number(form.price) || 0,
      rooms: Number(form.rooms) || 2,
      bathrooms: Number(form.bathrooms) || 1,
      squareFootage: Number(form.squareFootage) || 60,
      images: [
        {
          url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
          alt: "Proprietate demo",
        },
      ],
      description: form.description.trim() || undefined,
      propertyType: "Apartament",
      transactionType: "Vanzare",
      status: form.status,
      createdAt: new Date().toISOString(),
      city: "Bucuresti",
      zone: form.location.trim() || "Bucuresti",
      agentId: state?.agents[0]?.id || null,
      agentName: state?.agents[0]?.name || null,
    };

    saveProperty(nextProperty);
    setIsOpen(false);
  };

  if (!state) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="rounded-[24px] border border-[var(--app-surface-border)] bg-white/72 px-5 py-4 shadow-[var(--agentfinder-soft-shadow)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Inventar demo</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Proprietatile din demo pot fi editate local pentru a simula onboardingul sau pitch-ul catre o agentie.
          </p>
        </div>
        <Button type="button" className="rounded-full border-0 bg-[var(--agentfinder-primary-button)] text-white shadow-[var(--agentfinder-primary-button-shadow)] hover:bg-[var(--agentfinder-primary-button-hover)]" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Proprietate noua
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {properties.map((property) => (
          <Card key={property.id} className="rounded-[28px] border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg)] shadow-[var(--agentfinder-card-shadow)]">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-xl text-slate-950">{property.title}</CardTitle>
                  <p className="mt-2 text-sm text-slate-600">{property.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="icon" variant="outline" className="rounded-full bg-white/80" onClick={() => openEdit(property)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" className="rounded-full bg-white/80" onClick={() => deleteProperty(property.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-[var(--app-surface-border)] bg-white/82 text-slate-700">{property.status || "Activ"}</Badge>
                <Badge variant="outline" className="border-[var(--app-surface-border)] bg-white/82 text-slate-700">{property.propertyType}</Badge>
                <Badge variant="outline" className="border-[var(--app-surface-border)] bg-white/82 text-slate-700">{property.location}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-[18px] bg-white/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Pret</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{formatDemoCurrency(property.price)}</p>
                </div>
                <div className="rounded-[18px] bg-white/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Camere</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{property.rooms}</p>
                </div>
                <div className="rounded-[18px] bg-white/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Bai</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{property.bathrooms}</p>
                </div>
                <div className="rounded-[18px] bg-white/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">MP</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{property.squareFootage}</p>
                </div>
              </div>
              <div className="rounded-[18px] bg-white/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Descriere</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{property.description || "Proprietate demo fara descriere suplimentara."}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="rounded-[28px] border border-[var(--app-surface-border)] bg-white">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editeaza proprietate demo" : "Proprietate noua in demo"}</DialogTitle>
            <DialogDescription>Modificarile sunt locale si nu afecteaza inventarul real al aplicatiei.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input placeholder="Titlu" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
            <Input placeholder="Locatie" value={form.location} onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))} />
            <Input placeholder="Adresa" value={form.address} onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))} />
            <Input placeholder="Pret" value={form.price} onChange={(e) => setForm((current) => ({ ...current, price: e.target.value }))} />
            <Input placeholder="Camere" value={form.rooms} onChange={(e) => setForm((current) => ({ ...current, rooms: e.target.value }))} />
            <Input placeholder="Bai" value={form.bathrooms} onChange={(e) => setForm((current) => ({ ...current, bathrooms: e.target.value }))} />
            <Input placeholder="Suprafata utila" value={form.squareFootage} onChange={(e) => setForm((current) => ({ ...current, squareFootage: e.target.value }))} />
            <Input placeholder="Status" value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as NonNullable<Property["status"]> }))} />
          </div>
          <Textarea placeholder="Descriere" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Anuleaza</Button>
            <Button type="button" onClick={handleSave}>Salveaza local</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
