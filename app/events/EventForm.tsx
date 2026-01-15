'use client';

import { useState } from 'react';

type Template = { id: string; name: string };

export default function EventForm({ templates }: { templates: Template[] }) {
  const [message, setMessage] = useState('');

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    const formData = new FormData(event.currentTarget);
    const payload = {
      title: formData.get('title'),
      description: formData.get('description'),
      templateId: formData.get('templateId') || null
    };
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      setMessage('Événement créé.');
      window.location.reload();
    } else {
      setMessage(data.message ?? 'Erreur');
    }
  };

  return (
    <form onSubmit={onSubmit} className="card grid gap-4">
      <h2 className="text-lg font-semibold">Créer un événement</h2>
      <label className="grid gap-2">
        <span className="label">Titre</span>
        <input name="title" className="input" required />
      </label>
      <label className="grid gap-2">
        <span className="label">Description</span>
        <textarea name="description" className="input" rows={3} />
      </label>
      <label className="grid gap-2">
        <span className="label">Template</span>
        <select name="templateId" className="input" defaultValue="">
          <option value="">Checklist vide</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      <button className="btn btn-primary" type="submit">
        Créer
      </button>
    </form>
  );
}
