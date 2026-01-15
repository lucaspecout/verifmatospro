import Link from 'next/link';
import { getSession } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="card">
        <p>Veuillez vous connecter.</p>
        <Link href="/login" className="btn btn-primary mt-4">
          Connexion
        </Link>
      </div>
    );
  }

  const role = session.user.role;
  const shortcuts = [
    role === 'ADMIN'
      ? { title: 'Comptes', href: '/admin/users', desc: 'Gérer les utilisateurs.' }
      : null,
    ['ADMIN', 'MATERIEL'].includes(role)
      ? { title: 'Stock', href: '/stock', desc: 'Catalogue, véhicules, sacs.' }
      : null,
    ['ADMIN', 'MATERIEL'].includes(role)
      ? { title: 'Templates', href: '/templates', desc: 'Fiches standardisées.' }
      : null,
    ['ADMIN', 'CHEF'].includes(role)
      ? { title: 'Événements', href: '/events', desc: 'Postes de secours.' }
      : null,
    ['ADMIN', 'MATERIEL'].includes(role)
      ? { title: 'Anomalies', href: '/anomalies', desc: 'Suivi des manquants.' }
      : null
  ].filter(Boolean) as { title: string; href: string; desc: string }[];

  return (
    <div className="grid gap-6">
      <section className="card">
        <h1 className="text-2xl font-bold">Bonjour {session.user.email}</h1>
        <p className="mt-2 text-sm text-slate-600">Rôle: {role}</p>
        <div className="mt-4">
          <form action="/api/auth/logout" method="post">
            <button className="btn btn-outline" type="submit">
              Déconnexion
            </button>
          </form>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        {shortcuts.map((item) => (
          <Link key={item.href} href={item.href} className="card hover:border-brand-300">
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
