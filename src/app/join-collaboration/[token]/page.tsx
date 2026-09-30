'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, reload, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth, useFirestore, useUser } from '@/firebase';

export default function JoinCollaborationPage() {
  const params = useParams(); const token = String(params?.token || ''); const router = useRouter(); const auth = useAuth(); const firestore = useFirestore(); const { user } = useUser();
  const [invite, setInvite] = useState<{ email: string; organizationName: string } | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', password: '' }); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch(`/api/collaboration/team?token=${encodeURIComponent(token)}`).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.message); setInvite(result); }).catch(error => setNotice(error.message)); }, [token]);
  async function register(event: React.FormEvent) {
    event.preventDefault(); if (!invite) return; setBusy(true); setNotice('');
    try { const credential = await createUserWithEmailAndPassword(auth, invite.email, form.password); await setDoc(doc(firestore, 'users', credential.user.uid), { name: form.name, phone: form.phone, email: invite.email, onboardingIntent: 'collaborator' }, { merge: true }); await sendEmailVerification(credential.user); setNotice('Verifică emailul, apoi revino și finalizează acceptarea invitației.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Contul nu a putut fi creat.'); }
    finally { setBusy(false); }
  }
  async function accept() {
    if (!user) return; setBusy(true); setNotice('');
    try { await reload(user); if (!user.emailVerified) throw new Error('Verifică emailul înainte de a continua.'); const response = await fetch('/api/collaboration/team', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken(true)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'accept', token, name: form.name || user.displayName || user.email, phone: form.phone }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); router.replace('/collaboration'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Invitația nu a putut fi acceptată.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-950 px-4 py-10 text-white"><div className="mx-auto max-w-lg space-y-5 rounded-3xl border border-white/10 bg-slate-900 p-7"><Link href="/" className="text-xl font-bold">ImoDeus.ai</Link><h1 className="text-2xl font-bold">Alătură-te echipei de colaborare</h1>{invite && <p className="text-slate-300">{invite.organizationName} te-a invitat pe adresa {invite.email}.</p>}<form onSubmit={register} className="space-y-3"><input required placeholder="Numele tău" className="w-full rounded-xl bg-white/10 p-3" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input required minLength={8} placeholder="Telefon profesional" className="w-full rounded-xl bg-white/10 p-3" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />{!user && <><input required minLength={8} type="password" placeholder="Parolă" className="w-full rounded-xl bg-white/10 p-3" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><button disabled={!invite || busy} className="w-full rounded-full bg-emerald-500 p-3 font-semibold text-slate-950">Creează contul</button></>}</form>{user ? <button disabled={busy || !invite} onClick={() => void accept()} className="w-full rounded-full bg-emerald-500 p-3 font-semibold text-slate-950">Acceptă invitația</button> : <Link href={`/login?next=/join-collaboration/${token}`} className="block text-center text-emerald-300">Am deja cont · Autentificare</Link>}{notice && <p role="status" className="text-sm text-amber-200">{notice}</p>}</div></main>;
}
