const sessionKey = "verifmatos-session";
const lockoutKey = "verifmatos-lockout";
const sessionDurationMs = 30 * 60 * 1000;
const maxLoginAttempts = 3;
const lockoutDurationMs = 30 * 1000;
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginSubmitBtn = loginForm?.querySelector("button[type=\"submit\"]");
const demoAccounts = document.getElementById("demoAccounts");
const userName = document.getElementById("userName");
const logoutBtn = document.getElementById("logoutBtn");
const navButtons = document.querySelectorAll(".nav-btn");
const routes = document.querySelectorAll(".route");
const passwordModal = document.getElementById("passwordModal");
const passwordForm = document.getElementById("passwordForm");
const passwordError = document.getElementById("passwordError");

const users = [
  { id: 1, username: "admin", password: "admin", name: "Administrateur", role: "Admin" },
  { id: 2, username: "chef", password: "chef", name: "Chef de poste", role: "Chef" },
  { id: 3, username: "marie", password: "marie", name: "Marie Dupont", role: "Logistique" },
];

const passwordStoreKey = "verifmatos-passwords";
let passwordStore = {};

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
      <div>
        <label class="form-label">Nom du poste</label>
        <input data-field="name" class="form-control" type="text" placeholder="Poste festival" required />
      </div>
      <div>
        <label class="form-label">Date</label>
        <input data-field="date" class="form-control" type="date" required />
      </div>
      <div>
        <label class="form-label">Lieu</label>
        <input data-field="location" class="form-control" type="text" placeholder="Parc municipal" required />
      </div>
    `,
  },
  {
    title: "Composition de l'équipe",
    content: `
      <div>
        <label class="form-label">Nombre de secouristes</label>
        <input data-field="team" class="form-control" type="number" min="1" value="4" required />
      </div>
      <div>
        <label class="form-label">Responsable</label>
        <input data-field="lead" class="form-control" type="text" placeholder="Nom du responsable" required />
      </div>
    `,
  },
  {
    title: "Validation",
    content: `
      <p class="text-muted">Vérifiez les informations et validez la création du poste.</p>
      <div class="list-group" id="wizardSummary"></div>
    `,
  },
];

let currentUser = null;
let failedAttempts = 0;
let lockoutUntil = null;
let lockoutTimerId = null;
let wizardIndex = 0;
const wizardState = {};

function loadPasswordStore() {
  const stored = localStorage.getItem(passwordStoreKey);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch (error) {
    return {};
  }
}

function savePasswordStore() {
  localStorage.setItem(passwordStoreKey, JSON.stringify(passwordStore));
}

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let result = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

function initUserPasswords() {
  passwordStore = loadPasswordStore();
  let hasChanges = false;
  users.forEach((user) => {
    if (!passwordStore[user.username]) {
      passwordStore[user.username] = {
        password: generatePassword(),
        mustChange: true,
      };
      hasChanges = true;
    }
    user.password = passwordStore[user.username].password;
    user.mustChange = passwordStore[user.username].mustChange;
  });
  if (hasChanges) {
    savePasswordStore();
  }
}

function renderDemoAccounts() {
  if (!demoAccounts) return;
  demoAccounts.innerHTML = "";
  users.forEach((user) => {
    const badge = document.createElement("span");
    badge.className = "badge rounded-pill text-bg-light border";
    badge.textContent = `${user.username} / ${user.password}`;
    demoAccounts.appendChild(badge);
  });
}

function openPasswordModal() {
  if (!passwordModal) return;
  passwordError.textContent = "";
  passwordForm.reset();
  passwordModal.classList.remove("hidden");
}

function closePasswordModal() {
  if (!passwordModal) return;
  passwordModal.classList.add("hidden");
}

function updateUserPassword(user, newPassword) {
  user.password = newPassword;
  user.mustChange = false;
  passwordStore[user.username] = {
    password: newPassword,
    mustChange: false,
  };
  savePasswordStore();
  renderDemoAccounts();
}

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
  const now = Date.now();
  localStorage.setItem(
    sessionKey,
    JSON.stringify({ id: user.id, issuedAt: now, expiresAt: now + sessionDurationMs })
  );
  userName.textContent = `${user.name} · ${user.role}`;
  loginView.classList.remove("active");
  appView.classList.add("active");
  if (user.mustChange) {
    openPasswordModal();
  }
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
  if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
    clearSession();
    return;
  }
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
    container.innerHTML = "<p class=\"text-muted\">Aucun poste créé pour le moment.</p>";
    return;
  }
  postes.forEach((poste) => {
    const card = document.createElement("div");
    const statusClass = poste.status === "Prêt" ? "text-bg-success" : "text-bg-warning";
    card.className =
      "list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2";
    card.innerHTML = `
      <div>
        <strong>${poste.name}</strong>
        <p class="text-muted mb-0">${poste.date} · ${poste.location}</p>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <span class="badge rounded-pill ${statusClass}">${poste.status}</span>
        <span class="badge rounded-pill text-bg-light border">${poste.team} pers.</span>
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
    const statusClass = user.status === "Actif" ? "text-bg-success" : "text-bg-secondary";
    card.className =
      "list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2";
    card.innerHTML = `
      <div>
        <strong>${user.name}</strong>
        <p class="text-muted mb-0">${user.role} · Dernière connexion : ${user.lastLogin}</p>
      </div>
      <span class="badge rounded-pill ${statusClass}">${user.status}</span>
    `;
    container.appendChild(card);
  });
}

function renderStock() {
  const container = document.getElementById("stockList");
  container.innerHTML = "";
  stockItems.forEach((item) => {
    const row = document.createElement("div");
    row.className =
      "list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2";
    const statusClass =
      item.status === "ok"
        ? "text-bg-success"
        : item.status === "warn"
          ? "text-bg-warning"
          : "text-bg-danger";
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <p class="text-muted mb-0">Attendu : ${item.expected} · Disponible : ${item.available}</p>
      </div>
      <span class="badge rounded-pill ${statusClass}">${
        item.status === "ok" ? "OK" : item.status === "warn" ? "Surveillance" : "Rupture"
      }</span>
    `;
    container.appendChild(row);
  });
}

function updateWizardSummary() {
  const summary = document.getElementById("wizardSummary");
  if (!summary) return;
  summary.innerHTML = `
    <div class="list-group-item d-flex justify-content-between"><strong>Poste</strong><span>${wizardState.name || "—"}</span></div>
    <div class="list-group-item d-flex justify-content-between"><strong>Date</strong><span>${wizardState.date || "—"}</span></div>
    <div class="list-group-item d-flex justify-content-between"><strong>Lieu</strong><span>${wizardState.location || "—"}</span></div>
    <div class="list-group-item d-flex justify-content-between"><strong>Équipe</strong><span>${wizardState.team || "—"} pers.</span></div>
    <div class="list-group-item d-flex justify-content-between"><strong>Responsable</strong><span>${wizardState.lead || "—"}</span></div>
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

function loadLockoutState() {
  const stored = sessionStorage.getItem(lockoutKey);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    failedAttempts = parsed.failedAttempts || 0;
    lockoutUntil = parsed.lockoutUntil || null;
  } catch (error) {
    failedAttempts = 0;
    lockoutUntil = null;
  }
}

function saveLockoutState() {
  sessionStorage.setItem(
    lockoutKey,
    JSON.stringify({ failedAttempts, lockoutUntil })
  );
}

function clearLockoutTimer() {
  if (lockoutTimerId) {
    clearInterval(lockoutTimerId);
    lockoutTimerId = null;
  }
}

function updateLoginLockoutMessage() {
  if (!loginError) return;
  if (lockoutUntil && Date.now() < lockoutUntil) {
    const seconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
    loginError.textContent = `Trop de tentatives. Réessayez dans ${seconds}s.`;
  }
}

function startLockoutCountdown() {
  clearLockoutTimer();
  lockoutTimerId = setInterval(() => {
    if (!lockoutUntil) {
      clearLockoutTimer();
      return;
    }
    if (Date.now() >= lockoutUntil) {
      lockoutUntil = null;
      failedAttempts = 0;
      saveLockoutState();
      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = false;
      }
      if (loginError) {
        loginError.textContent = "";
      }
      clearLockoutTimer();
      return;
    }
    updateLoginLockoutMessage();
  }, 1000);
}

function setLockout(durationMs) {
  lockoutUntil = Date.now() + durationMs;
  saveLockoutState();
  if (loginSubmitBtn) {
    loginSubmitBtn.disabled = true;
  }
  updateLoginLockoutMessage();
  startLockoutCountdown();
}

function ensureLoginReady() {
  if (!loginSubmitBtn) return;
  if (lockoutUntil && Date.now() >= lockoutUntil) {
    lockoutUntil = null;
    failedAttempts = 0;
    saveLockoutState();
    clearLockoutTimer();
    loginError.textContent = "";
  }
  if (lockoutUntil && Date.now() < lockoutUntil) {
    loginSubmitBtn.disabled = true;
    updateLoginLockoutMessage();
    if (!lockoutTimerId) {
      startLockoutCountdown();
    }
    return;
  }
  loginSubmitBtn.disabled = false;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginError.textContent = "";
  if (lockoutUntil && Date.now() < lockoutUntil) {
    updateLoginLockoutMessage();
    return;
  }
  const formData = new FormData(loginForm);
  const username = formData.get("username").trim();
  const password = formData.get("password").trim();
  const user = users.find((entry) => entry.username === username && entry.password === password);

  if (!user) {
    failedAttempts += 1;
    saveLockoutState();
    if (failedAttempts >= maxLoginAttempts) {
      setLockout(lockoutDurationMs);
      return;
    }
    loginError.textContent = "Identifiant ou mot de passe incorrect.";
    return;
  }

  failedAttempts = 0;
  lockoutUntil = null;
  saveLockoutState();
  clearLockoutTimer();
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

passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentUser) return;
  passwordError.textContent = "";
  const formData = new FormData(passwordForm);
  const newPassword = formData.get("newPassword").trim();
  const confirmPassword = formData.get("confirmPassword").trim();

  if (!newPassword || newPassword.length < 8) {
    passwordError.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
    return;
  }

  if (newPassword !== confirmPassword) {
    passwordError.textContent = "Les mots de passe ne correspondent pas.";
    return;
  }

  if (newPassword === currentUser.password) {
    passwordError.textContent = "Choisissez un mot de passe différent du mot de passe temporaire.";
    return;
  }

  updateUserPassword(currentUser, newPassword);
  closePasswordModal();
});

initUserPasswords();
renderDemoAccounts();
loadLockoutState();
ensureLoginReady();
restoreSession();
if (currentUser) {
  renderPostes();
  renderUsers();
  renderStock();
}
