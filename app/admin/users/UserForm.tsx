'use client';

import { useState } from 'react';

export default function UserForm() {
  const [message, setMessage] = useState('');

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    const formData = new FormData(event.currentTarget);
    const payload = {
      email: formData.get('email'),
      role: formData.get('role'),
      isActive: formData.get('isActive') === 'on'
    };
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Utilisateur créé. Mot de passe temporaire: ${data.tempPassword}`);
      event.currentTarget.reset();
      window.location.reload();
    } else {
      setMessage(data.message ?? 'Erreur');
    }
  };

  return (
    <form onSubmit={onSubmit} className="card grid gap-4">
      <h2 className="text-lg font-semibold">Créer un utilisateur</h2>
      <label className="grid gap-2">
        <span className="label">Email</span>
        <input name="email" type="email" className="input" required />
      </label>
      <label className="grid gap-2">
        <span className="label">Rôle</span>
        <select name="role" className="input" defaultValue="CHEF">
          <option value="ADMIN">ADMIN</option>
          <option value="CHEF">CHEF</option>
          <option value="MATERIEL">MATERIEL</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isActive" type="checkbox" defaultChecked />
        Actif
      </label>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      <button className="btn btn-primary" type="submit">
        Créer
      </button>
    </form>
  );
}
