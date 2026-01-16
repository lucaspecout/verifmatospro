# Gestion du matériel de secours (prototype)

Ce dépôt contient un prototype web mobile-first pour organiser le matériel de secours et préparer les vérifications terrain, avec une API Node.js connectée à PostgreSQL.

## Démarrage rapide

```bash
docker compose up --build
```

Ouvrir ensuite `http://localhost:7000`.

## Conteneurs et sécurité

Le `docker-compose.yml` démarre deux conteneurs principaux :

- **app** : serveur Node.js (API + fichiers statiques).
- **db** : PostgreSQL, initialisé avec les tables et données de démonstration.

Le service **db-bootstrap** met à jour le mot de passe administrateur au démarrage.

### Base de données

- Base : `verifmatos`
- Utilisateur : `verifmatos`
- Mot de passe : `verifmatos`

### Compte admin et changement de mot de passe au démarrage

Un compte `admin` est créé dans la table `users`. Le service `db-bootstrap` se connecte à la base et remplace ce mot de passe au démarrage via la variable `ADMIN_PASSWORD` (par défaut `change_me`). Vous pouvez la modifier dans `docker-compose.yml` ou via un override.

Les mots de passe sont stockés sous forme de hash bcrypt.

### Variables d'environnement principales (app)

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `SESSION_SECRET` : secret de session (à changer en production).
- `SESSION_MAX_AGE_MS` : durée de session (par défaut 30 minutes).

## Ce que couvre le prototype

- Parcours administrateur : gestion des comptes, organisation du matériel, stocks.
- Parcours chef de poste : assistant de création, sélection des sacs, suivi en direct.
- Parcours secouriste : accès mobile, saisie rapide, progression globale.

> Ce prototype est un socle UX. Les actions sensibles (authentification, stockage, synchronisation temps réel) passent désormais par l'API.
