import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#050806] px-6 py-16 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-[32px] border border-emerald-500/20 bg-[linear-gradient(160deg,rgba(7,20,14,0.98),rgba(3,8,6,0.98))] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <span className="inline-flex w-fit rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
          Custom Next.js 404
        </span>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Pagina ceruta nu exista in aplicatie.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/70">
            Daca vezi acest ecran live, inseamna ca requestul ajunge pana in
            Next.js si 404-ul este generat de aplicatie, nu de Firebase App
            Hosting.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
          Diagnostic marker: <span className="font-semibold text-emerald-200">IMO-DEUS-NEXT-NOT-FOUND</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-50"
          >
            Mergi la homepage
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15"
          >
            Mergi la dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
