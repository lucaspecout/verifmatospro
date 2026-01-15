'use client';

import { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type ChecklistItem = {
  id: string;
  label: string;
  expectedQuantity: number;
  unit: string | null;
  status: 'PENDING' | 'OK' | 'MISSING';
  comment: string | null;
  sectionName: string;
};

type PublicChecklist = {
  eventTitle: string;
  sections: { name: string; items: ChecklistItem[] }[];
};

let socket: Socket | null = null;

export default function PublicChecklistPage({ params }: { params: { slug: string } }) {
  const [data, setData] = useState<PublicChecklist | null>(null);
  const [filterPending, setFilterPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const slug = params.slug;

  const totalItems = useMemo(() =>
    data?.sections.reduce((count, section) => count + section.items.length, 0) ?? 0,
  [data]);
  const doneItems = useMemo(() =>
    data?.sections.reduce(
      (count, section) => count + section.items.filter((item) => item.status !== 'PENDING').length,
      0
    ) ?? 0,
  [data]);

  const loadData = async () => {
    setLoading(true);
    const res = await fetch(`/api/public/${slug}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [slug]);

  useEffect(() => {
    const initSocket = async () => {
      await fetch('/api/socket');
      if (!socket) {
        socket = io({ path: '/api/socket/io' });
        socket.emit('join', slug);
        socket.on('line-updated', () => {
          void loadData();
        });
      }
    };
    void initSocket();
    return () => {
      socket?.off('line-updated');
    };
  }, [slug]);

  const updateLine = async (lineId: string, status: 'OK' | 'MISSING', comment?: string) => {
    const res = await fetch(`/api/public/${slug}/line`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineId, status, comment })
    });
    if (res.ok) {
      void loadData();
    } else {
      const data = await res.json();
      alert(data.message ?? 'Erreur');
    }
  };

  if (loading) {
    return <div className="card">Chargement...</div>;
  }

  if (!data) {
    return <div className="card">Checklist introuvable.</div>;
  }

  return (
    <div className="grid gap-6">
      <section className="card">
        <h1 className="text-2xl font-bold">{data.eventTitle}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <div>
            Progression: {doneItems}/{totalItems}
          </div>
          <div className="h-2 w-48 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600"
              style={{ width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%` }}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filterPending}
              onChange={(event) => setFilterPending(event.target.checked)}
            />
            Reste à vérifier
          </label>
        </div>
      </section>
      {data.sections.map((section) => (
        <section key={section.name} className="card">
          <details open>
            <summary className="cursor-pointer text-lg font-semibold">{section.name}</summary>
            <div className="mt-4 grid gap-4">
              {section.items
                .filter((item) => (filterPending ? item.status === 'PENDING' : true))
                .map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.label}</p>
                        <p className="text-sm text-slate-600">
                          Qté attendue: {item.expectedQuantity} {item.unit ?? ''}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.status === 'OK'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === 'MISSING'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => updateLine(item.id, 'OK')}
                      >
                        OK
                      </button>
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={() => {
                          const comment = prompt('Commentaire obligatoire si manquant :');
                          if (!comment) {
                            alert('Commentaire requis.');
                            return;
                          }
                          void updateLine(item.id, 'MISSING', comment);
                        }}
                      >
                        MANQUANT
                      </button>
                    </div>
                    {item.comment ? (
                      <p className="mt-2 text-sm text-red-600">Commentaire: {item.comment}</p>
                    ) : null}
                  </div>
                ))}
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
