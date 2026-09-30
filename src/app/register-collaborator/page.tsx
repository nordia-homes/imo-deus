'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, reload, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth, useFirestore, useUser } from '@/firebase';

export default function RegisterCollaboratorPage() {
  const auth = useAuth(); const firestore = useFirestore(); const { user } = useUser(); const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', organizationName: '', organizationType: 'agency', companyTaxId: '' });
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  useEffect(() => { if (!user) return; void getDoc(doc(firestore, 'users', user.uid)).then(snap => { if (snap.data()?.accountType === 'collaborator_only') router.replace('/collaboration'); else if (snap.data()?.agencyId) router.replace('/dashboard'); }); }, [firestore, router, user]);
  async function register(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const credential = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await setDoc(doc(firestore, 'users', credential.user.uid), { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), onboardingIntent: 'collaborator' }, { merge: true });
      await sendEmailVerification(credential.user);
      setNotice('Ți-am trimis un email de verificare. Deschide linkul, apoi revino și apasă „Finalizează activarea”.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Contul nu a putut fi creat.'); }
    finally { setBusy(false); }
  }
  async function activate() {
    if (!user) return;
    setBusy(true); setNotice('');
    try {
      await reload(user);
      if (!user.emailVerified) throw new Error('Adresa de email nu este încă verificată.');
      const token = await user.getIdToken(true);
      const response = await fetch('/api/collaboration/onboarding', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Activarea a eșuat.');
      router.replace('/collaboration');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Activarea nu a putut fi finalizată.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-950 px-4 py-10 text-white"><div className="mx-auto max-w-lg space-y-6 rounded-3xl border border-white/10 bg-slate-900 p-7"><Link href="/" className="text-xl font-bold">ImoDeus.ai</Link><div><h1 className="text-3xl font-bold">Cont de colaborator</h1><p className="mt-2 text-slate-300">Accesezi proprietățile deschise colaborării fără să folosești CRM-ul ImoDeus.</p></div><form onSubmit={register} className="space-y-3">{([['name','Numele tău'],['email','Email'],['password','Parolă'],['phone','Telefon profesional'],['organizationName','Agenția sau numele PFA'],['companyTaxId','CUI (opțional)']] as const).map(([key,label]) => <label key={key} className="block text-sm">{label}<input required={key !== 'companyTaxId'} type={key === 'email' ? 'email' : key === 'password' ? 'password' : 'text'} minLength={key === 'password' ? 8 : undefined} className="mt-1 w-full rounded-xl bg-white/10 p-3" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}<label className="block text-sm">Tip organizație<select className="mt-1 w-full rounded-xl bg-white/10 p-3" value={form.organizationType} onChange={e => setForm({ ...form, organizationType: e.target.value })}><option value="agency" className="text-slate-950">Agenție</option><option value="independent" className="text-slate-950">Agent independent / PFA</option></select></label><button disabled={busy || !!user} className="w-full rounded-full bg-emerald-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">Creează contul</button></form>{user && <button disabled={busy} onClick={() => void activate()} className="w-full rounded-full border border-emerald-400 px-5 py-3 font-semibold">Finalizează activarea</button>}{notice && <p role="status" className="text-sm text-emerald-200">{notice}</p>}<p className="text-sm text-slate-400">Ai deja cont? <Link href="/login" className="text-emerald-300">Autentifică-te</Link></p></div></main>;
}
