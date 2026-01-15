# VerifMatos Pro

Application web mobile-first pour gérer le stock de matériel de secours et réaliser des vérifications en temps réel pour la Protection Civile de l’Isère.

## Fonctionnalités clés

- Gestion du stock global et par véhicule/sac/compartiment.
- Checklists d’événements personnalisables à partir de templates.
- Vérification publique en temps réel via lien public permanent.
- Suivi des anomalies (statut MANQUANT) pour le rôle Matériel/Logistique et Admin.
- Auth email/mot de passe avec changement de mot de passe forcé au premier login.

## Prérequis

- Docker + Docker Compose

## Démarrage rapide

```bash
docker compose up --build
```

L’application est disponible sur `http://localhost:3000`.

## Identifiants admin

- **Utilisateur**: `admin`
- **Mot de passe**: `admin`

Au premier login, un changement de mot de passe est obligatoire.

## Configuration

Copiez `.env.example` si besoin. Les variables importantes sont :

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`

## Créer un événement et partager un lien public

1. Connectez-vous avec un compte Admin ou Chef de poste.
2. Ouvrez **Événements** depuis le tableau de bord.
3. Créez un événement en choisissant un template ou une checklist vide.
4. Le lien public permanent est affiché dans la liste (format `/public/{slug}`).
5. Partagez ce lien aux secouristes pour la vérification en temps réel.

## Migrations & seed

Au démarrage via Docker, les commandes suivantes sont exécutées automatiquement :

- `prisma migrate deploy`
- `prisma db seed`

Le seed crée l’utilisateur admin et les 3 templates obligatoires.
