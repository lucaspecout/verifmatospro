const sessionKey = "verifmatos-session";
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const userName = document.getElementById("userName");
const logoutBtn = document.getElementById("logoutBtn");
const navButtons = document.querySelectorAll(".nav-btn");
const routes = document.querySelectorAll(".route");

const users = [
  { id: 1, username: "admin", password: "admin", name: "Administrateur", role: "Admin" },
  { id: 2, username: "chef", password: "chef", name: "Chef de poste", role: "Chef" },
  { id: 3, username: "marie", password: "marie", name: "Marie Dupont", role: "Logistique" },
];

const postes = [
  {
    id: "ps-2024-01",
    name: "Festival d'été",
    date: "2024-07-12",
    location: "Parc municipal",
    status: "En préparation",
    team: 8,
  },
  {
    id: "ps-2024-02",
    name: "Match régional",
    date: "2024-06-02",
    location: "Stade nord",
    status: "Prêt",
    team: 5,
  },
];

const stockItems = [
  { id: 1, name: "Bandes élastiques", expected: 120, available: 112, status: "alert" },
  { id: 2, name: "Compresses stériles", expected: 200, available: 200, status: "ok" },
  { id: 3, name: "Masques O2", expected: 40, available: 32, status: "warn" },
  { id: 4, name: "Gants nitrile", expected: 300, available: 260, status: "ok" },
];

const userAdminList = [
  {
    id: 1,
    name: "Administrateur",
    role: "Admin",
    status: "Actif",
    lastLogin: "Aujourd'hui 09:10",
  },
  {
    id: 2,
    name: "Chef de poste",
    role: "Chef",
    status: "Actif",
    lastLogin: "Hier 18:40",
  },
  {
    id: 3,
    name: "Camille Leroy",
    role: "Secouriste",
    status: "Invité",
    lastLogin: "05/05/2024",
  },
];

const wizardSteps = [
  {
    title: "Informations générales",
    content: `
      <label>Nom du poste<input data-field="name" type="text" placeholder="Poste festival" required /></label>
      <label>Date<input data-field="date" type="date" required /></label>
      <label>Lieu<input data-field="location" type="text" placeholder="Parc municipal" required /></label>
    `,
  },
  {
    title: "Composition de l'équipe",
    content: `
      <label>Nombre de secouristes<input data-field="team" type="number" min="1" value="4" required /></label>
      <label>Responsable<input data-field="lead" type="text" placeholder="Nom du responsable" required /></label>
    `,
  },
  {
    title: "Validation",
    content: `
      <p>Vérifiez les informations et validez la création du poste.</p>
      <div class="summary-box" id="wizardSummary"></div>
    `,
  },
];

let currentUser = null;
let wizardIndex = 0;
const wizardState = {};

function setRoute(route) {
  routes.forEach((section) => {
    section.classList.toggle("active", section.id === route);
  });
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });
}

function setSession(user) {
  currentUser = user;
  localStorage.setItem(sessionKey, JSON.stringify({ id: user.id }));
  userName.textContent = `${user.name} · ${user.role}`;
  loginView.classList.remove("active");
  appView.classList.add("active");
}

function clearSession() {
  currentUser = null;
  localStorage.removeItem(sessionKey);
  appView.classList.remove("active");
  loginView.classList.add("active");
}

function restoreSession() {
  const stored = localStorage.getItem(sessionKey);
  if (!stored) return;
  const parsed = JSON.parse(stored);
  const user = users.find((entry) => entry.id === parsed.id);
  if (user) {
    setSession(user);
  } else {
    clearSession();
  }
}

function renderPostes() {
  const container = document.getElementById("posteList");
  container.innerHTML = "";
  if (postes.length === 0) {
    container.innerHTML = "<p class=\"muted\">Aucun poste créé pour le moment.</p>";
    return;
  }
  postes.forEach((poste) => {
    const card = document.createElement("div");
    card.className = "list-row";
    card.innerHTML = `
      <div>
        <strong>${poste.name}</strong>
        <p class="muted">${poste.date} · ${poste.location}</p>
      </div>
      <div class="row-meta">
        <span class="badge">${poste.status}</span>
        <span class="pill">${poste.team} pers.</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderUsers() {
  const container = document.getElementById("userList");
  container.innerHTML = "";
  userAdminList.forEach((user) => {
    const card = document.createElement("div");
    card.className = "list-row";
    card.innerHTML = `
      <div>
        <strong>${user.name}</strong>
        <p class="muted">${user.role} · Dernière connexion : ${user.lastLogin}</p>
      </div>
      <span class="badge ${user.status === "Actif" ? "badge-success" : "badge-muted"}">${user.status}</span>
    `;
    container.appendChild(card);
  });
}

function renderStock() {
  const container = document.getElementById("stockList");
  container.innerHTML = "";
  stockItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "list-row";
    const statusClass = item.status === "ok" ? "badge-success" : item.status === "warn" ? "badge-warning" : "badge-danger";
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <p class="muted">Attendu : ${item.expected} · Disponible : ${item.available}</p>
      </div>
      <span class="badge ${statusClass}">${item.status === "ok" ? "OK" : item.status === "warn" ? "Surveillance" : "Rupture"}</span>
    `;
    container.appendChild(row);
  });
}

function updateWizardSummary() {
  const summary = document.getElementById("wizardSummary");
  if (!summary) return;
  summary.innerHTML = `
    <p><strong>Poste :</strong> ${wizardState.name || "—"}</p>
    <p><strong>Date :</strong> ${wizardState.date || "—"}</p>
    <p><strong>Lieu :</strong> ${wizardState.location || "—"}</p>
    <p><strong>Équipe :</strong> ${wizardState.team || "—"} pers.</p>
    <p><strong>Responsable :</strong> ${wizardState.lead || "—"}</p>
  `;
}

function renderWizard() {
  const panel = document.getElementById("wizardPanel");
  const content = document.getElementById("wizardContent");
  const stepLabel = document.getElementById("wizardStep");
  const prevBtn = document.getElementById("wizardPrev");
  const nextBtn = document.getElementById("wizardNext");

  if (!panel) return;
  const step = wizardSteps[wizardIndex];
  stepLabel.textContent = `Étape ${wizardIndex + 1}/${wizardSteps.length}`;
  content.innerHTML = `<h4>${step.title}</h4>${step.content}`;
  prevBtn.disabled = wizardIndex === 0;
  nextBtn.textContent = wizardIndex === wizardSteps.length - 1 ? "Valider" : "Suivant";

  const inputs = content.querySelectorAll("[data-field]");
  inputs.forEach((input) => {
    const key = input.dataset.field;
    if (wizardState[key]) {
      input.value = wizardState[key];
    }
  });

  if (wizardIndex === wizardSteps.length - 1) {
    updateWizardSummary();
  }
}

function captureWizardInputs() {
  const content = document.getElementById("wizardContent");
  const inputs = content.querySelectorAll("[data-field]");
  inputs.forEach((input) => {
    wizardState[input.dataset.field] = input.value;
  });
}

function completeWizard() {
  const newPoste = {
    id: `ps-${Date.now()}`,
    name: wizardState.name || "Nouveau poste",
    date: wizardState.date || "À définir",
    location: wizardState.location || "À définir",
    status: "En préparation",
    team: Number(wizardState.team) || 0,
  };
  postes.unshift(newPoste);
  renderPostes();
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const formData = new FormData(loginForm);
  const username = formData.get("username").trim();
  const password = formData.get("password").trim();
  const user = users.find((entry) => entry.username === username && entry.password === password);

  if (!user) {
    loginError.textContent = "Identifiant ou mot de passe incorrect.";
    return;
  }

  setSession(user);
  renderPostes();
  renderUsers();
  renderStock();
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  loginForm.reset();
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => setRoute(button.dataset.route));
});

const wizardOpenBtn = document.getElementById("openWizard");
const wizardPanel = document.getElementById("wizardPanel");

wizardOpenBtn.addEventListener("click", () => {
  wizardPanel.classList.toggle("hidden");
  if (!wizardPanel.classList.contains("hidden")) {
    wizardIndex = 0;
    renderWizard();
  }
});

document.getElementById("wizardPrev").addEventListener("click", () => {
  captureWizardInputs();
  wizardIndex = Math.max(0, wizardIndex - 1);
  renderWizard();
});

document.getElementById("wizardNext").addEventListener("click", () => {
  captureWizardInputs();
  if (wizardIndex === wizardSteps.length - 1) {
    completeWizard();
    wizardPanel.classList.add("hidden");
    wizardIndex = 0;
    return;
  }
  wizardIndex = Math.min(wizardSteps.length - 1, wizardIndex + 1);
  renderWizard();
});

restoreSession();
if (currentUser) {
  renderPostes();
  renderUsers();
  renderStock();
}
