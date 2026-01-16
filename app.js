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
const userName = document.getElementById("userName");
const logoutBtn = document.getElementById("logoutBtn");
const navButtons = document.querySelectorAll(".nav-btn");
const routes = document.querySelectorAll(".route");
const passwordModal = document.getElementById("passwordModal");
const passwordForm = document.getElementById("passwordForm");
const passwordError = document.getElementById("passwordError");

let currentUser = null;
let failedAttempts = 0;
let lockoutUntil = null;
let lockoutTimerId = null;
let wizardIndex = 0;
const wizardState = {};

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

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) {
    return null;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || "Une erreur est survenue.";
    throw new Error(message);
  }
  return data;
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
  if (user.mustChangePassword) {
    openPasswordModal();
  }
}

function clearSession() {
  currentUser = null;
  localStorage.removeItem(sessionKey);
  appView.classList.remove("active");
  loginView.classList.add("active");
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

function renderPostes(postes) {
  const container = document.getElementById("posteList");
  container.innerHTML = "";
  if (!postes || postes.length === 0) {
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

function renderUsers(users) {
  const container = document.getElementById("userList");
  container.innerHTML = "";
  users.forEach((user) => {
    const card = document.createElement("div");
    const statusClass = user.status === "Actif" ? "text-bg-success" : "text-bg-secondary";
    const lastLogin = user.last_login
      ? new Date(user.last_login).toLocaleString("fr-FR")
      : "—";
    card.className =
      "list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2";
    card.innerHTML = `
      <div>
        <strong>${user.name}</strong>
        <p class="text-muted mb-0">${user.role} · Dernière connexion : ${lastLogin}</p>
      </div>
      <span class="badge rounded-pill ${statusClass}">${user.status}</span>
    `;
    container.appendChild(card);
  });
}

function renderStock(items) {
  const container = document.getElementById("stockList");
  container.innerHTML = "";
  items.forEach((item) => {
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

async function completeWizard() {
  const payload = {
    name: wizardState.name || "Nouveau poste",
    date: wizardState.date || new Date().toISOString().slice(0, 10),
    location: wizardState.location || "À définir",
    status: "En préparation",
    team: Number(wizardState.team) || 0,
  };
  const response = await apiRequest("/api/postes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.poste;
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
  sessionStorage.setItem(lockoutKey, JSON.stringify({ failedAttempts, lockoutUntil }));
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

async function loadAppData() {
  const [postes, users, stock] = await Promise.all([
    apiRequest("/api/postes"),
    apiRequest("/api/users"),
    apiRequest("/api/stock-items"),
  ]);
  renderPostes(postes.postes);
  renderUsers(users.users);
  renderStock(stock.items);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  if (lockoutUntil && Date.now() < lockoutUntil) {
    updateLoginLockoutMessage();
    return;
  }
  const formData = new FormData(loginForm);
  const username = formData.get("username").trim();
  const password = formData.get("password").trim();

  try {
    const data = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    failedAttempts = 0;
    lockoutUntil = null;
    saveLockoutState();
    clearLockoutTimer();
    setSession(data.user);
    await loadAppData();
  } catch (error) {
    failedAttempts += 1;
    saveLockoutState();
    if (failedAttempts >= maxLoginAttempts) {
      setLockout(lockoutDurationMs);
      return;
    }
    loginError.textContent = error.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await apiRequest("/api/logout", { method: "POST" }).catch(() => null);
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

document.getElementById("wizardNext").addEventListener("click", async () => {
  captureWizardInputs();
  if (wizardIndex === wizardSteps.length - 1) {
    try {
      await completeWizard();
      wizardPanel.classList.add("hidden");
      wizardIndex = 0;
      await loadAppData();
    } catch (error) {
      alert(error.message);
    }
    return;
  }
  wizardIndex = Math.min(wizardSteps.length - 1, wizardIndex + 1);
  renderWizard();
});

passwordForm.addEventListener("submit", async (event) => {
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

  try {
    await apiRequest("/api/users/password", {
      method: "POST",
      body: JSON.stringify({ newPassword }),
    });
    currentUser.mustChangePassword = false;
    closePasswordModal();
  } catch (error) {
    passwordError.textContent = error.message;
  }
});

async function bootstrap() {
  loadLockoutState();
  ensureLoginReady();
  try {
    const data = await apiRequest("/api/session");
    if (data?.user) {
      setSession(data.user);
      await loadAppData();
    }
  } catch (error) {
    clearSession();
  }
}

bootstrap();
