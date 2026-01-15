import { prisma } from '@/lib/prisma';
import UserForm from './UserForm';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="grid gap-6">
      <UserForm />
      <div className="card">
        <h2 className="text-lg font-semibold">Utilisateurs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Email</th>
                <th>Rôle</th>
                <th>Actif</th>
                <th>Force MDP</th>
                <th>Créé</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="py-2">{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.isActive ? 'Oui' : 'Non'}</td>
                  <td>{user.forcePasswordChange ? 'Oui' : 'Non'}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
