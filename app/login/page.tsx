'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      email: formData.get('email'),
      password: formData.get('password')
    };

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      if (data.forcePasswordChange) {
        router.push('/change-password');
        return;
      }
      router.push('/dashboard');
    } else {
      const data = await res.json();
      setError(data.message ?? 'Identifiants invalides');
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <h1 className="text-2xl font-bold">Connexion</h1>
        <p className="mt-2 text-sm text-slate-600">Accès réservé aux membres autorisés.</p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="label">Email</span>
            <input name="email" type="text" className="input" required />
          </label>
          <label className="grid gap-2">
            <span className="label">Mot de passe</span>
            <input name="password" type="password" className="input" required />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
