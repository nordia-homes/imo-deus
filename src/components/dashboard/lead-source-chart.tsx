"use client";
import type { BuyerSourceData } from '@/lib/types';
import { CardDescription } from "../ui/card";

export function LeadSourceChart({ data }: { data: BuyerSourceData[] }) {
  if (!data || data.length === 0) {
      return (
          <div className="flex h-[220px] w-full items-center justify-center rounded-3xl border border-white/10 bg-white/5">
              <CardDescription>Nu sunt date despre sursa lead-urilor.</CardDescription>
          </div>
      )
  }

  const total = data.reduce((sum, item) => sum + item.count, 0);
  const sorted = [...data].sort((left, right) => right.count - left.count).slice(0, 6);

  return (
    <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-4 pt-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Top sursă</p>
          <p className="mt-2 text-2xl font-semibold text-white">{sorted[0]?.source || 'Necunoscută'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Lead-uri</p>
          <p className="mt-2 text-lg font-medium text-primary">{total.toLocaleString('ro-RO')}</p>
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((item, index) => {
          const share = total > 0 ? (item.count / total) * 100 : 0;
          return (
            <div key={`${item.source}-${index}`} className="space-y-2 rounded-2xl border border-white/8 bg-[#10243D] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{item.source}</p>
                  <p className="text-xs text-white/45">{share.toFixed(1)}% din lead-urile ne-arhivate</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold text-white">{item.count}</p>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">lead-uri</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(share, 4)}%`, backgroundColor: item.fill }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
