'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Facebook, Heart, Instagram, MessageCircle, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { Connection } from '@/lib/communications/model';
import type { SocialPostRecord } from './SocialPostHistory';
import './social-post-interactions.css';

type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
type Comment = { id: string; text?: string; message?: string; username?: string; from?: { name?: string }; timestamp?: string; created_time?: string };
type Diagnostic = { conclusion: string; tokenValid: boolean | null; tokenType: string | null; appMatches: boolean | null; expectedPageId: string | null; tokenPageId: string | null; missingScopes: string[] | null; postInAccountList: boolean | null; accountListError: string | null; directPostReadable: boolean };
type Metrics = { comments: number | null; likes: number | null; shares: number | null; permalink?: string; error?: string };
type Row = { key: string; post: SocialPostRecord; connectionId: string; account?: Connection; channel: string };
const count = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const format = (value?: number | null) => value == null ? '—' : new Intl.NumberFormat('ro-RO').format(value);
const date = (value?: string) => value ? new Date(value).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }) : '';

export default function SocialPostInteractions({ posts, connections, api }: { posts: SocialPostRecord[]; connections: Connection[]; api: Api }) {
  const rows = useMemo<Row[]>(() => posts.flatMap(post => Object.entries(post.destinations || {}).filter(([, destination]) => destination.status === 'published').map(([connectionId, destination]) => {
    const account = connections.find(item => item.id === connectionId);
    return { key: post.id + ':' + connectionId, post, connectionId, account, channel: destination.channel || account?.channel || 'messenger' };
  })), [posts, connections]);
  const signature = rows.map(row => row.key).join('|');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [metrics, setMetrics] = useState<Record<string, Metrics>>({});
  const [metricsBusy, setMetricsBusy] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [replies, setReplies] = useState<Record<string, Comment[]>>({});
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [liked, setLiked] = useState<string[]>([]);
  useEffect(() => {
    if (!rows.length) return;
    let cancelled = false; let cursor = 0;
    setMetricsBusy(true);
    async function worker() {
      while (cursor < rows.length && !cancelled) {
        const row = rows[cursor++];
        try {
          const result = await api('posts/' + row.post.id + '/insights?connectionId=' + encodeURIComponent(row.connectionId));
          if (!cancelled) setMetrics(current => ({ ...current, [row.key]: {
            comments: count(result.comments_count ?? result.comments?.summary?.total_count),
            likes: count(result.like_count ?? result.likes?.summary?.total_count),
            shares: count(result.shares?.count), permalink: result.permalink || result.permalink_url,
          } }));
        } catch (cause) {
          if (!cancelled) setMetrics(current => ({ ...current, [row.key]: { comments: null, likes: null, shares: null, error: cause instanceof Error ? cause.message : 'Date indisponibile' } }));
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(4, rows.length) }, () => worker())).finally(() => { if (!cancelled) setMetricsBusy(false); });
    return () => { cancelled = true; };
  // The published destination IDs remain stable while the post list refreshes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, refreshIndex, api]);
  async function openComments(row: Row) {
    setSelected(row); setComments([]); setReplies({}); setDraft(''); setReplyTo(null); setError(''); setDiagnostic(null); setBusy(true);
    try { const result = await api('posts/' + row.post.id + '/comments?connectionId=' + encodeURIComponent(row.connectionId)); setComments(result.data || []); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Comentariile nu au putut fi încărcate.');
      try {
        const result = await api('posts/' + row.post.id + '/diagnostics?connectionId=' + encodeURIComponent(row.connectionId));
        setDiagnostic(result as Diagnostic);
      } catch { /* Keep the original Meta error visible when diagnostics are unavailable. */ }
    }
    finally { setBusy(false); }
  }
  async function loadReplies(commentId: string, row: Row) {
    const result = await api('posts/' + row.post.id + '/comments/' + commentId + '/replies?connectionId=' + encodeURIComponent(row.connectionId));
    setReplies(current => ({ ...current, [commentId]: result.data || [] }));
  }
  async function showReplies(commentId: string) {
    if (!selected) return;
    setBusy(true); setError('');
    try { await loadReplies(commentId, selected); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Răspunsurile nu au putut fi încărcate.'); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!selected || !draft.trim()) return;
    setBusy(true); setError('');
    try {
      const target = replyTo;
      await api('posts/' + selected.post.id + '/comments' + (target ? '/' + target + '/replies' : ''), 'POST', { connectionId: selected.connectionId, text: draft.trim() });
      if (target) await loadReplies(target, selected);
      else { const result = await api('posts/' + selected.post.id + '/comments?connectionId=' + encodeURIComponent(selected.connectionId)); setComments(result.data || []); }
      setDraft(''); setReplyTo(null); setRefreshIndex(index => index + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Comentariul nu a putut fi trimis.'); }
    finally { setBusy(false); }
  }
  async function like(commentId: string) {
    if (!selected || liked.includes(commentId)) return;
    setBusy(true); setError('');
    try { await api('posts/' + selected.post.id + '/comments/' + commentId + '/like', 'POST', { connectionId: selected.connectionId }); setLiked(current => [...current, commentId]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Aprecierea nu a putut fi trimisă.'); }
    finally { setBusy(false); }
  }
  return <section className="tt-panel mi-interactions">
    <div className="mi-interactions-heading"><div><h2>Comentarii și interacțiuni</h2><p>Statistici pentru fiecare cont pe care s-a publicat postarea.</p></div><Button variant="outline" disabled={metricsBusy} onClick={() => setRefreshIndex(index => index + 1)}><RefreshCw size={15} className={metricsBusy ? 'animate-spin' : ''} />Actualizează</Button></div>
    {!rows.length ? <p className="mi-interactions-empty">Comentariile și interacțiunile vor apărea după publicarea unei postări.</p> : <div className="mi-interactions-scroll"><table className="mi-interactions-table"><thead><tr><th>Postare</th><th>Cont</th><th>Comentarii</th><th>Aprecieri</th><th>Distribuiri</th><th>Acțiuni</th></tr></thead><tbody>{rows.map(row => {
      const data = metrics[row.key];
      return <tr key={row.key}><td><div className="mi-interactions-property"><span className="mi-interactions-thumb">{row.post.images?.[0] && <Image src={row.post.images[0]} alt="" width={48} height={42} unoptimized />}</span><span><strong>{row.post.propertyTitle || 'Proprietate'}</strong><small>{date(row.post.destinations[row.connectionId]?.publishedAt)}</small></span></div></td><td><span className={'mi-history-channel mi-history-channel--' + row.channel}>{row.channel === 'instagram' ? <Instagram size={14} /> : <Facebook size={14} />}{row.account?.name || (row.channel === 'instagram' ? 'Instagram' : 'Facebook')}</span></td><td title={data?.error}>{format(data?.comments)}</td><td title={data?.error}>{format(data?.likes)}</td><td title={row.channel === 'instagram' ? 'Instagram nu oferă numărul distribuirilor aici.' : data?.error}>{format(data?.shares)}</td><td><div className="mi-interactions-actions"><button type="button" onClick={() => void openComments(row)}><MessageCircle size={15} />Comentarii</button>{data?.permalink && /^https:\/\/(www\.)?(facebook|instagram)\.com\//.test(data.permalink) && <a href={data.permalink} target="_blank" rel="noopener noreferrer">Vezi postarea</a>}</div></td></tr>;
    })}</tbody></table></div>}
    {Object.values(metrics).some(value => value.error) && <p role="status" className="mi-interactions-warning">{Object.values(metrics).find(value => value.error)?.error}</p>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="mi-comments-modal"><DialogHeader><DialogTitle>Comentarii · {selected?.account?.name || (selected?.channel === 'instagram' ? 'Instagram' : 'Facebook')}</DialogTitle></DialogHeader><p className="mi-comments-context">{selected?.post.propertyTitle || 'Postare'} · {format(selected ? metrics[selected.key]?.comments : null)} comentarii</p>
      {error && <p role="alert" className="mi-comments-error">{error}</p>}
      {diagnostic && <div role="status" className="mi-comments-diagnostic"><strong>Verificarea accesului Meta</strong><p>{diagnostic.conclusion}</p><small>Token: {diagnostic.tokenValid === null ? 'neverificat' : diagnostic.tokenValid ? 'valid' : 'invalid'}{diagnostic.tokenType ? ' · ' + diagnostic.tokenType : ''} · Aplicația: {diagnostic.appMatches === null ? 'neverificată' : diagnostic.appMatches ? 'corectă' : 'diferită'} · Pagina: {diagnostic.tokenPageId || 'necunoscută'} / {diagnostic.expectedPageId || 'necunoscută'} · Permisiuni lipsă din token: {diagnostic.missingScopes?.join(', ') || 'niciuna identificată'} · Postare în lista contului: {diagnostic.accountListError ? 'eroare' : diagnostic.postInAccountList === null ? 'neverificat' : diagnostic.postInAccountList ? 'da' : 'nu în primele 100'} · ID accesibil direct: {diagnostic.directPostReadable ? 'da' : 'nu'}</small></div>}
      <div className="mi-comments-list">{!comments.length && !error && <p className="mi-comments-empty">{busy ? 'Se încarcă…' : 'Nu există comentarii disponibile pentru această postare.'}</p>}{comments.map(comment => <article key={comment.id} className="mi-comment"><div className="mi-comment-avatar">{(comment.username || comment.from?.name || 'U').slice(0, 1).toUpperCase()}</div><div className="mi-comment-body"><div className="mi-comment-top"><strong>{comment.username || comment.from?.name || 'Utilizator'}</strong><time>{date(comment.timestamp || comment.created_time)}</time></div><p>{comment.text || comment.message || 'Comentariu fără text'}</p><div className="mi-comment-actions"><button type="button" disabled={busy} onClick={() => { setReplyTo(comment.id); setDraft(''); }}>Răspunde</button><button type="button" disabled={busy} onClick={() => void showReplies(comment.id)}>{replies[comment.id] ? 'Actualizează răspunsurile' : 'Vezi răspunsurile'}</button>{selected?.channel !== 'instagram' && <button type="button" disabled={busy || liked.includes(comment.id)} onClick={() => void like(comment.id)}><Heart size={13} />{liked.includes(comment.id) ? 'Apreciat' : 'Apreciază'}</button>}</div>{replies[comment.id]?.map(reply => <div className="mi-comment-reply" key={reply.id}><strong>{reply.username || reply.from?.name || 'Utilizator'}</strong><p>{reply.text || reply.message}</p></div>)}</div></article>)}</div>
      <div className="mi-comments-compose"><label htmlFor="mi-comment-draft">{replyTo ? 'Răspuns public la comentariu' : 'Comentariu public la postare'}</label>{replyTo && <button type="button" onClick={() => { setReplyTo(null); setDraft(''); }}>Anulează răspunsul</button>}<Textarea id="mi-comment-draft" value={draft} maxLength={2000} onChange={event => setDraft(event.target.value)} placeholder={replyTo ? 'Scrie răspunsul…' : 'Scrie un comentariu…'} /><Button disabled={busy || !draft.trim()} onClick={() => void submit()}><Send size={15} />{replyTo ? 'Trimite răspunsul' : 'Publică comentariul'}</Button></div>{comments.length >= 50 && <small className="mi-comments-limit">Sunt afișate primele 50 de comentarii disponibile.</small>}
    </DialogContent></Dialog>
  </section>;
}
