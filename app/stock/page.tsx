import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const [catalog, vehicles, bags, compartments, stockEntries] = await Promise.all([
    prisma.itemCatalog.findMany({ orderBy: { name: 'asc' } }),
    prisma.vehicle.findMany({ orderBy: { name: 'asc' } }),
    prisma.bag.findMany({ orderBy: { name: 'asc' } }),
    prisma.compartment.findMany({ orderBy: { name: 'asc' } }),
    prisma.stockEntry.findMany({ include: { itemCatalog: true } })
  ]);

  return (
    <div className="grid gap-6">
      <section className="card">
        <h1 className="text-2xl font-bold">Stock & structure</h1>
        <p className="mt-2 text-sm text-slate-600">
          Catalogue matériel, structure véhicules/sacs et quantités théoriques.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold">Catalogue ({catalog.length})</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {catalog.slice(0, 8).map((item) => (
              <li key={item.id}>
                {item.name} — {item.category}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold">Structure</h2>
          <p className="mt-2 text-sm text-slate-600">
            {vehicles.length} véhicules, {bags.length} sacs, {compartments.length} compartiments.
          </p>
        </div>
      </section>
      <section className="card">
        <h2 className="text-lg font-semibold">Entrées de stock ({stockEntries.length})</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Matériel</th>
                <th>Localisation</th>
                <th>Qté</th>
              </tr>
            </thead>
            <tbody>
              {stockEntries.slice(0, 12).map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100">
                  <td className="py-2">{entry.itemCatalog.name}</td>
                  <td>{entry.locationType}</td>
                  <td>{entry.theoreticalQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
