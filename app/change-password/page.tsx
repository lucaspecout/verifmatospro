'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const formData = new FormData(event.currentTarget);
    const payload = {
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword')
    };

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setSuccess('Mot de passe mis à jour.');
      router.push('/dashboard');
    } else {
      const data = await res.json();
      setError(data.message ?? 'Erreur lors de la mise à jour.');
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <h1 className="text-2xl font-bold">Changement de mot de passe</h1>
        <p className="mt-2 text-sm text-slate-600">
          Merci de définir un nouveau mot de passe pour continuer.
        </p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="label">Mot de passe actuel</span>
            <input name="currentPassword" type="password" className="input" required />
          </label>
          <label className="grid gap-2">
            <span className="label">Nouveau mot de passe</span>
            <input name="newPassword" type="password" className="input" required minLength={8} />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          <button className="btn btn-primary" type="submit">
            Mettre à jour
          </button>
        </form>
      </div>
    </div>
  );
}
