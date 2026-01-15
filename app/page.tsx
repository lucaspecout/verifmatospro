import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="grid gap-6">
      <section className="card">
        <h1 className="text-2xl font-bold text-slate-900">Gestion du stock & vérifications terrain</h1>
        <p className="mt-2 text-slate-600">
          VerifMatos Pro centralise le matériel, les checklists de postes de secours et les vérifications en temps réel.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/login" className="btn btn-primary">
            Se connecter
          </Link>
          <Link href="/public/demo" className="btn btn-outline">
            Voir une vérification publique
          </Link>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: 'Stock structuré', desc: 'Véhicules, sacs, compartiments et stock global.' },
          { title: 'Postes de secours', desc: 'Checklists personnalisables par événement.' },
          { title: 'Temps réel', desc: 'Vérification collaborative avec alertes manquantes.' }
        ].map((card) => (
          <div key={card.title} className="card">
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
