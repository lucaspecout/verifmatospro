(() => {
  const overview = document.getElementById('service-overview');
  const badges = document.querySelectorAll('[data-service-id]');
  if (!overview && !badges.length) return;
  function badge(item) {
    const span = document.createElement('span');
    span.className = `service-badge ${item.out_of_service ? 'service-down' : 'service-up'}`;
    const dot = document.createElement('span');
    dot.className = 'service-dot';
    dot.setAttribute('aria-hidden', 'true');
    span.append(dot, item.out_of_service ? 'Hors service' : 'En service');
    return span;
  }
  function note(item) {
    const p = document.createElement('p');
    p.className = 'service-note';
    p.textContent = item.service_note || (item.out_of_service ? 'Motif non renseigné' : '');
    return p;
  }
  async function refresh() {
    try {
      const response = await fetch('/api/materials/service-status', {cache: 'no-store'});
      if (!response.ok) throw new Error('refresh');
      const {materials} = await response.json();
      document.dispatchEvent(new CustomEvent('material-service-updated', {detail: materials}));
      for (const dot of document.querySelectorAll('[data-service-dot-id]')) {
        const item = materials.find(item => String(item.id) === dot.dataset.serviceDotId);
        if (!item) continue;
        const label = item.out_of_service ? 'Hors service' : 'En service';
        dot.classList.toggle('service-down', item.out_of_service);
        dot.classList.toggle('service-up', !item.out_of_service);
        dot.setAttribute('aria-label', label);
        dot.title = label;
      }
      for (const target of badges) {
        const item = materials.find(item => String(item.id) === target.dataset.serviceId);
        if (item) target.replaceChildren(badge(item), note(item));
      }
      const count = document.getElementById('service-ready-count');
      if (count) count.textContent = materials.filter(item => item.node_type === 'container' && !item.out_of_service).length;
      if (overview) {
        const rows = materials.filter(item => item.out_of_service).map(item => {
          const row = document.createElement('div');
          row.className = 'service-summary';
          const name = document.createElement('strong');
          name.textContent = item.name;
          row.append(badge(item), ' ', name, note(item));
          return row;
        });
        overview.replaceChildren(...(rows.length ? rows : ['Aucun matériel hors service.']));
        document.getElementById('service-refresh-state').textContent = '';
      }
    } catch {
      const state = document.getElementById('service-refresh-state');
      if (state) state.textContent = 'Actualisation indisponible : les derniers statuts affichés peuvent avoir changé.';
    } finally {
      window.setTimeout(refresh, 5000);
    }
  }
  refresh();
})();
