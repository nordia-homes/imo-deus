'use client';
const labels: Record<string, string> = { campaignName: 'Campanie', propertyId: 'Proprietate', status: 'Stare salvată', budgetAmount: 'Buget', budgetType: 'Tip buget', currency: 'Monedă', durationDays: 'Durată (zile)', headline: 'Titlu', primaryText: 'Text reclamă', mediaItems: 'Materiale', placements: 'Plasări', events: 'Evenimente păstrate', spend: 'Cheltuieli', leads: 'Leaduri', costPerLead: 'Cost per lead', updatedAt: 'Actualizare indicatori', configurationUpdatedAt: 'Actualizare configurație', period: 'Perioadă', locationLabel: 'Localizare', radiusKm: 'Rază (km)', readyLocally: 'Configurație locală validă', providerValidated: 'Verificat live la Meta', errors: 'Lipsuri', lastPublishError: 'Ultima eroare salvată', startsAt: 'Început (București)', endsAt: 'Sfârșit (București)', connected: 'Conectat în CRM', message: 'Mesaj', at: 'Moment', attempts: 'Încercări', lastAttemptAt: 'Ultima încercare', specialAdCategory: 'Categorie specială' };
function Detail({ value }: { value: unknown }) {
 if (value === null || value === undefined) return <span>Indisponibil</span>;
 if (typeof value === 'boolean') return <span>{value ? 'Da' : 'Nu'}</span>;
 if (Array.isArray(value)) return value.length ? <ol className="space-y-2">{value.map((item, i) => <li key={i}><Detail value={item} /></li>)}</ol> : <span>Nicio înregistrare</span>;
 if (typeof value === 'object') return <dl className="space-y-2">{Object.entries(value).filter(([key]) => !['mode','evidence','prompt','contextPropertyId'].includes(key)).map(([key, item]) => <div key={key} className="border-l pl-3"><dt className="font-medium">{labels[key] || key}</dt><dd className="whitespace-pre-wrap break-words"><Detail value={item} /></dd></div>)}</dl>;
 return <span>{String(value)}</span>;
}
export function MetaReviewDetails({ row, selection, busy, onPrompt }: { row: Record<string, unknown>; selection: boolean; busy: boolean; onPrompt: (prompt: string) => void }) {
 return <div className="mt-3 space-y-3 text-sm"><Detail value={row} />{selection && <button type="button" disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => onPrompt('Campanie Meta: ' + String(row.id))}>Selectează campania</button>}</div>;
}
