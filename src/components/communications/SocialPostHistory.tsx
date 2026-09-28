'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { CalendarDays, ChevronDown, ChevronUp, Facebook, Image as ImageIcon, Instagram, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Connection } from '@/lib/communications/model';
import './social-post-history.css';

export type SocialPostRecord = {
  id: string; propertyId: string; propertyTitle?: string; text: string; images?: string[];
  status: string; createdAt?: string; scheduledAt: string; error?: string;
  destinations: Record<string, { channel?: string; status: string; externalId?: string; publishedAt?: string; error?: string }>;
};
type Props = { posts: SocialPostRecord[]; connections: Connection[]; refreshing: boolean; lastUpdated: Date | null; refresh: () => void; publishDraft: (id: string) => void; cancel: (id: string) => void; busy: boolean };
const labels: Record<string, string> = { draft: 'Draft', queued: 'În coadă', processing: 'În procesare', published: 'Publicată', needs_review: 'Necesită verificare', cancelled: 'Anulată', failed: 'Eșuată', unknown: 'Rezultat neconfirmat', blocked: 'Blocată' };
const pretty = (status: string) => labels[status] || status;
const date = (value?: string) => value ? new Date(value).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'medium', timeStyle: 'short' }) : '—';
function channelName(id: string, channel: string | undefined, connections: Connection[]) {
  const connection = connections.find(item => item.id === id);
  return { name: connection?.name || (channel === 'instagram' ? 'Instagram' : 'Facebook'), channel: connection?.channel || channel };
}
export default function SocialPostHistory({ posts, connections, refreshing, lastUpdated, refresh, publishDraft, cancel, busy }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const counts = useMemo(() => ({
    published: posts.filter(post => post.status === 'published').length,
    waiting: posts.filter(post => ['queued', 'processing'].includes(post.status)).length,
    attention: posts.filter(post => ['needs_review', 'failed', 'unknown'].includes(post.status)).length,
  }), [posts]);
  return <section className="tt-panel mi-history">
    <div className="mi-history-heading"><div><span className="tt-eyebrow">CALENDAR ȘI ISTORIC</span><h2>Postările agenției</h2><p>Statusul se actualizează automat la fiecare 15 secunde cât timp această pagină este deschisă.</p></div><Button variant="outline" disabled={refreshing} onClick={refresh}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />Actualizează</Button></div>
    <div className="mi-history-summary"><span><strong>{posts.length}</strong> Total</span><span><strong>{counts.published}</strong> Publicate</span><span><strong>{counts.waiting}</strong> În curs</span><span><strong>{counts.attention}</strong> Necesită atenție</span>{lastUpdated && <small>Verificat la {lastUpdated.toLocaleTimeString('ro-RO')}</small>}</div>
    {!posts.length ? <div className="mi-history-empty"><CalendarDays size={24} /><strong>Încă nu există postări.</strong><span>Postările create în studio vor apărea aici.</span></div> : <div className="mi-history-scroll"><table className="mi-history-table"><thead><tr><th>Proprietate</th><th>Conturi</th><th>Fotografii</th><th>Programare</th><th>Status</th><th>Detalii</th></tr></thead><tbody>{posts.map(post => {
      const destinations = Object.entries(post.destinations || {});
      const open = expanded === post.id;
      return <FragmentRow key={post.id} post={post} destinations={destinations} connections={connections} open={open} toggle={() => setExpanded(open ? null : post.id)} busy={busy} publishDraft={publishDraft} cancel={cancel} />;
    })}</tbody></table></div>}
  </section>;
}
function FragmentRow({ post, destinations, connections, open, toggle, busy, publishDraft, cancel }: { post: SocialPostRecord; destinations: Array<[string, SocialPostRecord['destinations'][string]]>; connections: Connection[]; open: boolean; toggle: () => void; busy: boolean; publishDraft: (id: string) => void; cancel: (id: string) => void }) {
  return <><tr className="mi-history-row"><td><div className="mi-history-property"><span className="mi-history-thumb">{post.images?.[0] ? <Image src={post.images[0]} alt="" width={58} height={48} unoptimized /> : <ImageIcon size={20} />}</span><span><strong>{post.propertyTitle || 'Proprietate'}</strong><small>{post.text.replace(/\s+/g, ' ').slice(0, 105)}{post.text.length > 105 ? '…' : ''}</small></span></div></td><td><div className="mi-history-channels">{destinations.map(([id, destination]) => { const account = channelName(id, destination.channel, connections); return <span key={id} title={account.name} className={'mi-history-channel mi-history-channel--' + account.channel}>{account.channel === 'instagram' ? <Instagram size={14} /> : <Facebook size={14} />}{account.name}</span>; })}</div></td><td>{post.images?.length || 0}</td><td><span className="mi-history-date">{date(post.scheduledAt)}</span></td><td><span className={'mi-history-status mi-history-status--' + post.status}>{pretty(post.status)}</span></td><td><button type="button" className="mi-history-details-button" onClick={toggle} aria-expanded={open}>{open ? 'Închide' : 'Vezi'}{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button></td></tr>
    {open && <tr className="mi-history-detail-row"><td colSpan={6}><div className="mi-history-details"><div><h3>Textul postării</h3><p className="mi-history-fulltext">{post.text}</p><small>Creată: {date(post.createdAt)} · Programată: {date(post.scheduledAt)}</small></div><div><h3>Publicare pe conturi</h3>{destinations.map(([id, destination]) => { const account = channelName(id, destination.channel, connections); return <div key={id} className="mi-history-destination"><span>{account.channel === 'instagram' ? <Instagram size={15} /> : <Facebook size={15} />}<strong>{account.name}</strong></span><span className={'mi-history-status mi-history-status--' + destination.status}>{pretty(destination.status)}</span>{destination.publishedAt && <small>Publicată: {date(destination.publishedAt)}</small>}{destination.externalId && <small>ID Meta: {destination.externalId}</small>}{destination.error && <small className="mi-history-error">{destination.error}</small>}</div>; })}{post.error && <p className="mi-history-error">{post.error}</p>}<div className="mi-history-actions">{post.status === 'draft' && <Button size="sm" disabled={busy} onClick={() => publishDraft(post.id)}>Publică draftul</Button>}{['draft', 'queued'].includes(post.status) && <Button size="sm" variant="outline" disabled={busy} onClick={() => cancel(post.id)}>Anulează</Button>}</div></div></div></td></tr>}
  </>;
}
