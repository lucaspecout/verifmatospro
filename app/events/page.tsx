import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import EventForm from './EventForm';

export default async function EventsPage() {
  const session = await getSession();
  const where = session?.user.role === 'CHEF' ? { createdByUserId: session.user.id } : {};
  const [events, templates] = await Promise.all([
    prisma.event.findMany({ where, orderBy: { createdAt: 'desc' } }),
    prisma.template.findMany({ select: { id: true, name: true } })
  ]);

  return (
    <div className="grid gap-6">
      <EventForm templates={templates} />
      <div className="card">
        <h2 className="text-lg font-semibold">Événements</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Titre</th>
                <th>Statut</th>
                <th>Lien public</th>
                <th>Créé</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-slate-100">
                  <td className="py-2">{event.title}</td>
                  <td>{event.status}</td>
                  <td>
                    <Link className="text-brand-600" href={`/public/${event.publicSlug}`}>
                      {event.publicSlug}
                    </Link>
                  </td>
                  <td>{new Date(event.createdAt).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
