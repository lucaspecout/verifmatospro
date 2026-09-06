(() => {
  const form = document.getElementById('event-schedule-form');
  if (!form) return;
  const output = document.getElementById('schedule-availability');
  let timer;
  let revision = 0;
  async function check() {
    const current = ++revision;
    output.textContent = 'Vérification en cours…';
    const params = new URLSearchParams(new FormData(form));
    try {
      const response = await fetch(`${form.dataset.availabilityUrl}?${params}`, {cache: 'no-store'});
      if (!response.ok) throw new Error('availability');
      const result = await response.json();
      if (current !== revision) return;
      const rows = result.items.map(item => {
        const row = document.createElement('p');
        const badge = document.createElement('span');
        badge.className = `service-badge ${item.available ? 'service-up' : 'service-down'}`;
        const dot = document.createElement('span');
        dot.className = 'service-dot';
        dot.setAttribute('aria-hidden', 'true');
        badge.append(dot, item.name);
        row.append(badge, ` — ${item.detail}`);
        return row;
      });
      for (const error of result.errors) {
        const row = document.createElement('p');
        row.className = 'error';
        row.textContent = error;
        rows.push(row);
      }
      if (result.available) {
        const message = document.createElement('p');
        message.textContent = 'Le nouveau créneau est disponible pour les réservations existantes.';
        rows.push(message);
      }
      output.replaceChildren(...rows);
    } catch {
      if (current === revision) output.textContent = 'Vérification indisponible. Réessayez. La disponibilité sera aussi contrôlée lors de l’enregistrement.';
    }
  }
  form.addEventListener('input', () => {
    ++revision;
    clearTimeout(timer);
    output.textContent = 'Vérification en cours…';
    timer = setTimeout(check, 300);
  });
  document.getElementById('check-schedule').addEventListener('click', () => { clearTimeout(timer); check(); });
})();
