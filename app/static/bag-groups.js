(() => {
  const form = document.getElementById('bag-group-create-form');
  if (!form) return;
  const reference = document.getElementById('bag-group-reference');
  const notice = document.getElementById('bag-group-reference-notice');
  const members = [...form.querySelectorAll('input[name="member_ids"]')];
  function update() {
    members.forEach(input => {
      input.disabled = input.value === reference.value;
      if (input.disabled) input.checked = false;
    });
    reference.setCustomValidity('');
    const name = reference.selectedOptions[0]?.textContent;
    notice.textContent = reference.value
      ? `L’inventaire de « ${name} » remplacera entièrement celui des autres sacs sélectionnés : objets, quantités et sous-contenants.`
      : 'L’inventaire du premier sac choisi remplacera entièrement celui des autres sacs sélectionnés : objets, quantités et sous-contenants.';
  }
  reference.addEventListener('change', update);
  members.forEach(input => input.addEventListener('change', () => reference.setCustomValidity('')));
  form.addEventListener('submit', event => {
    if (!members.some(input => input.checked && !input.disabled)) {
      event.preventDefault();
      reference.setCustomValidity('Sélectionnez au moins un autre sac pour former le groupe.');
      reference.reportValidity();
    }
  });
  update();
})();
