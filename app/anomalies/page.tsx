import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AnomaliesPage() {
  const anomalies = await prisma.verificationLine.findMany({
    where: { status: 'MISSING' },
    include: {
      eventChecklistItem: {
        include: { section: { include: { event: true } } }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div className="grid gap-6">
      <section className="card">
        <h1 className="text-2xl font-bold">Anomalies</h1>
        <p className="mt-2 text-sm text-slate-600">
          Liste des éléments manquants issus des vérifications publiques.
        </p>
      </section>
      <section className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Événement</th>
                <th>Section</th>
                <th>Item</th>
                <th>Commentaire</th>
                <th>Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((line) => (
                <tr key={line.id} className="border-t border-slate-100">
                  <td className="py-2">{line.eventChecklistItem.section.event.title}</td>
                  <td>{line.eventChecklistItem.section.name}</td>
                  <td>{line.eventChecklistItem.label}</td>
                  <td>{line.comment}</td>
                  <td>{new Date(line.updatedAt).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
