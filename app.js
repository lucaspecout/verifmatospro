const routes = document.querySelectorAll(".route");
const navButtons = document.querySelectorAll(".nav-btn");

const sampleMaterial = {
  name: "Sac Poste de Secours",
  type: "sac",
  children: [
    {
      name: "Compartiment principal",
      type: "compartiment",
      children: [
        {
          name: "Poche soins",
          type: "poche",
          children: [
            {
              name: "Bandes",
              type: "item",
              expected: 10,
              details: [
                { name: "Bande 5 cm", expected: 6 },
                { name: "Bande 10 cm", expected: 4 },
              ],
            },
            {
              name: "Compresses",
              type: "item",
              expected: 20,
            },
          ],
        },
        {
          name: "Poche latérale droite",
          type: "poche",
          children: [
            { name: "Gants", type: "item", expected: 30 },
            { name: "Masques", type: "item", expected: 15 },
          ],
        },
      ],
    },
    {
      name: "Sac oxygène",
      type: "sac",
      children: [
        {
          name: "Compartiment matériel",
          type: "compartiment",
          children: [
            { name: "Masque O2 adulte", type: "item", expected: 2 },
            { name: "Masque O2 enfant", type: "item", expected: 1 },
          ],
        },
      ],
    },
  ],
};

const stockItems = [
  { name: "Bandes", total: 120, status: "ok" },
  { name: "Compresses", total: 200, status: "ok" },
  { name: "Gants", total: 160, status: "warn" },
  { name: "Masques", total: 80, status: "problem" },
];

const posteWizardSteps = [
  {
    title: "Informations du poste",
    content: `
      <label>Nom du poste<input type="text" placeholder="Poste festival" /></label>
      <label>Date<input type="date" /></label>
      <label>Informations utiles<textarea rows="3" placeholder="Lieu, remarques..."></textarea></label>
    `,
  },
  {
    title: "Sacs utilisés",
    content: `
      <label><input type="checkbox" checked /> Sac Poste de Secours</label>
      <label><input type="checkbox" checked /> Sac oxygène</label>
      <label><input type="checkbox" /> Lot immobilisation</label>
    `,
  },
  {
    title: "Lien public",
    content: `
      <p>Générez le lien à transmettre aux secouristes.</p>
      <div class="badge">https://secours.app/poste/ps-2024</div>
    `,
  },
];

const liveProgressData = [
  {
    name: "Camille",
    bag: "Sac Poste de Secours",
    progress: 65,
    status: "warn",
  },
  {
    name: "Leo",
    bag: "Sac oxygène",
    progress: 100,
    status: "ok",
  },
  {
    name: "Nora",
    bag: "Lot immobilisation",
    progress: 30,
    status: "problem",
  },
];

const summaryData = [
  {
    title: "Sacs vérifiés",
    value: "2 / 3",
  },
  {
    title: "Problèmes détectés",
    value: "3 éléments",
  },
  {
    title: "Prêt pour le départ",
    value: "Partiel",
  },
];

const verificationItems = [
  {
    id: "bandes",
    label: "Bandes",
    expected: 10,
    actual: 10,
    status: "ok",
  },
  {
    id: "compresses",
    label: "Compresses",
    expected: 20,
    actual: 18,
    status: "warn",
  },
  {
    id: "gants",
    label: "Gants",
    expected: 30,
    actual: 25,
    status: "problem",
  },
];

function setRoute(route) {
  routes.forEach((section) => {
    section.classList.toggle("active", section.id === route);
  });
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });
  window.location.hash = route;
}

function renderTree(node, depth = 0) {
  const container = document.createElement("div");
  container.className = "tree-node";
  container.style.marginLeft = `${depth * 12}px`;

  const title = document.createElement("div");
  title.className = "node-title";
  title.textContent = node.name;
  container.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "node-meta";
  if (node.type === "item") {
    meta.textContent = `Item · Quantité attendue : ${node.expected}`;
  } else {
    meta.textContent = `Contenant : ${node.type}`;
  }
  container.appendChild(meta);

  if (node.details) {
    node.details.forEach((detail) => {
      const detailNode = document.createElement("div");
      detailNode.className = "node-meta";
      detailNode.textContent = `Sous-item : ${detail.name} (${detail.expected})`;
      container.appendChild(detailNode);
    });
  }

  if (node.children) {
    node.children.forEach((child) => {
      container.appendChild(renderTree(child, depth + 1));
    });
  }

  return container;
}

function renderStocks() {
  const container = document.getElementById("stockList");
  container.innerHTML = "";
  stockItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "stock-item";
    const label = document.createElement("span");
    label.textContent = item.name;
    const value = document.createElement("span");
    value.textContent = `${item.total} unités`;
    row.append(label, value);
    container.appendChild(row);
  });
}

function renderWizard() {
  const container = document.getElementById("posteWizard");
  let stepIndex = 0;

  const renderStep = () => {
    const step = posteWizardSteps[stepIndex];
    container.innerHTML = `
      <div class="wizard-step">
        <strong>${step.title}</strong>
        <div class="wizard-content">${step.content}</div>
        <div class="wizard-controls">
          <button class="secondary" ${stepIndex === 0 ? "disabled" : ""} data-action="prev">Retour</button>
          <button class="primary" data-action="next">${stepIndex === posteWizardSteps.length - 1 ? "Terminer" : "Suivant"}</button>
        </div>
      </div>
    `;

    container.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.action === "prev") {
          stepIndex = Math.max(0, stepIndex - 1);
        } else {
          stepIndex = Math.min(posteWizardSteps.length - 1, stepIndex + 1);
        }
        renderStep();
      });
    });
  };

  renderStep();
}

function statusLabel(status) {
  if (status === "ok") return { text: "OK", class: "status-ok" };
  if (status === "warn") return { text: "Incomplet", class: "status-warn" };
  return { text: "Problème", class: "status-problem" };
}

function renderLiveProgress() {
  const container = document.getElementById("liveProgress");
  container.innerHTML = "";
  liveProgressData.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "progress-card";
    const header = document.createElement("div");
    header.className = "progress-header";
    header.innerHTML = `<strong>${entry.name}</strong><span>${entry.bag}</span>`;
    const pill = document.createElement("span");
    const label = statusLabel(entry.status);
    pill.textContent = label.text;
    pill.className = `status-pill ${label.class}`;
    header.appendChild(pill);

    const bar = document.createElement("div");
    bar.className = "progress-bar";
    const barFill = document.createElement("div");
    barFill.style.width = `${entry.progress}%`;
    bar.appendChild(barFill);

    const footer = document.createElement("div");
    footer.textContent = `Progression : ${entry.progress}%`;

    card.append(header, bar, footer);
    container.appendChild(card);
  });
}

function renderSummary() {
  const container = document.getElementById("summary");
  container.innerHTML = "";
  summaryData.forEach((item) => {
    const row = document.createElement("div");
    row.className = "summary-item";
    row.innerHTML = `<strong>${item.title}</strong><p>${item.value}</p>`;
    container.appendChild(row);
  });
}

function updateGlobalProgress() {
  const total = verificationItems.length;
  const ok = verificationItems.filter((item) => item.status === "ok").length;
  const progress = Math.round((ok / total) * 100);
  const label = document.getElementById("globalProgress");
  const bar = document.getElementById("globalProgressBar");
  label.textContent = `${progress}%`;
  bar.style.width = `${progress}%`;
}

function renderVerification() {
  const container = document.getElementById("verificationView");
  container.innerHTML = "";
  const list = document.createElement("div");
  list.className = "verification-list";

  verificationItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "verification-item";
    const header = document.createElement("div");
    header.className = "item-header";
    header.innerHTML = `<strong>${item.label}</strong><span class="item-expected">Attendu : ${item.expected}</span>`;

    const controls = document.createElement("div");
    controls.className = "item-controls";
    const minus = document.createElement("button");
    minus.textContent = "–";
    const input = document.createElement("input");
    input.type = "number";
    input.min = 0;
    input.value = item.actual;
    const plus = document.createElement("button");
    plus.textContent = "+";
    controls.append(minus, input, plus);

    const actions = document.createElement("div");
    actions.className = "item-actions";
    const okBtn = document.createElement("button");
    okBtn.className = "secondary";
    okBtn.textContent = "OK";
    const warnBtn = document.createElement("button");
    warnBtn.className = "secondary";
    warnBtn.textContent = "Incomplet";
    const problemBtn = document.createElement("button");
    problemBtn.className = "secondary";
    problemBtn.textContent = "Problème";
    actions.append(okBtn, warnBtn, problemBtn);

    const status = document.createElement("span");
    const label = statusLabel(item.status);
    status.className = `status-pill ${label.class}`;
    status.textContent = label.text;

    const updateStatus = (newStatus) => {
      item.status = newStatus;
      const newLabel = statusLabel(newStatus);
      status.className = `status-pill ${newLabel.class}`;
      status.textContent = newLabel.text;
      updateGlobalProgress();
    };

    minus.addEventListener("click", () => {
      item.actual = Math.max(0, item.actual - 1);
      input.value = item.actual;
    });
    plus.addEventListener("click", () => {
      item.actual += 1;
      input.value = item.actual;
    });
    input.addEventListener("change", () => {
      item.actual = Number(input.value);
    });

    okBtn.addEventListener("click", () => updateStatus("ok"));
    warnBtn.addEventListener("click", () => updateStatus("warn"));
    problemBtn.addEventListener("click", () => updateStatus("problem"));

    row.append(header, controls, actions, status);
    list.appendChild(row);
  });

  container.appendChild(list);
  updateGlobalProgress();
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => setRoute(button.dataset.route));
});

const materialTree = document.getElementById("materialTree");
materialTree.appendChild(renderTree(sampleMaterial));
renderStocks();
renderWizard();
renderLiveProgress();
renderSummary();
renderVerification();

const nameForm = document.getElementById("nameForm");
nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameForm.querySelector("input").value.trim();
  const subtitle = document.getElementById("verificationSubtitle");
  if (name) {
    subtitle.textContent = `Bienvenue ${name}, la vérification peut commencer.`;
  }
});

const passwordForm = document.getElementById("passwordForm");
passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  alert("Mot de passe mis à jour (prototype). Pensez à le stocker côté serveur.");
});

const initialRoute = window.location.hash.replace("#", "") || "admin";
setRoute(initialRoute);
