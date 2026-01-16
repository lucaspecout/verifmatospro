const path = require("path");
const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();

const {
  DB_HOST = "db",
  DB_PORT = "5432",
  DB_NAME = "verifmatos",
  DB_USER = "verifmatos",
  DB_PASSWORD = "verifmatos",
  SESSION_SECRET = "change_me",
  SESSION_NAME = "verifmatos.sid",
  SESSION_MAX_AGE_MS = "1800000",
  PORT = "3000",
} = process.env;

const pool = new Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 10000,
});

app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(session({
  name: SESSION_NAME,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: Number(SESSION_MAX_AGE_MS),
  },
}));

const publicDir = path.join(__dirname, ".");
app.use(express.static(publicDir, { extensions: ["html"] }));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

app.post("/api/login", authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Identifiants requis." });
  }
  try {
    const result = await pool.query(
      "SELECT id, username, password, name, role, must_change_password FROM users WHERE username = $1",
      [username]
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    }
    const user = result.rows[0];
    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    }
    await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      mustChangePassword: user.must_change_password,
    };
    return res.json({ user: req.session.user });
  } catch (error) {
    return res.status(500).json({ error: "Erreur serveur." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(SESSION_NAME);
    res.json({ ok: true });
  });
});

app.get("/api/session", (req, res) => {
  if (!req.session.user) {
    return res.status(204).send();
  }
  return res.json({ user: req.session.user });
});

app.get("/api/users", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, role, last_login, CASE WHEN last_login IS NULL THEN 'Invité' ELSE 'Actif' END AS status FROM users ORDER BY name"
    );
    res.json({ users: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.post("/api/users/password", requireAuth, async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
  }
  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password = $1, must_change_password = FALSE WHERE id = $2",
      [hashed, req.session.user.id]
    );
    req.session.user.mustChangePassword = false;
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "Erreur serveur." });
  }
});

app.get("/api/postes", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, date, location, status, team FROM postes ORDER BY date DESC"
    );
    res.json({ postes: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.post("/api/postes", requireAuth, async (req, res) => {
  const { name, date, location, status, team } = req.body || {};
  if (!name || !date || !location) {
    return res.status(400).json({ error: "Champs requis manquants." });
  }
  const poste = {
    id: `ps-${Date.now()}`,
    name,
    date,
    location,
    status: status || "En préparation",
    team: Number(team) || 0,
  };
  try {
    await pool.query(
      "INSERT INTO postes (id, name, date, location, status, team) VALUES ($1, $2, $3, $4, $5, $6)",
      [poste.id, poste.name, poste.date, poste.location, poste.status, poste.team]
    );
    res.status(201).json({ poste });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.get("/api/stock-items", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, expected, available, status FROM stock_items ORDER BY name"
    );
    res.json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  return res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(Number(PORT), () => {
  console.log(`Server listening on ${PORT}`);
});
