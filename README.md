# Gestion du matériel de secours (prototype)

Ce dépôt contient un prototype web mobile-first pour organiser le matériel de secours et préparer les vérifications terrain.

## Démarrage rapide

```bash
docker compose up --build
```

Ouvrir ensuite `http://localhost:7000`.

## Conteneur base de données

Le `docker-compose.yml` démarre un conteneur Postgres qui initialise les tables et données de démonstration.

- Base : `verifmatos`
- Utilisateur : `verifmatos`
- Mot de passe : `verifmatos`

### Compte admin et changement de mot de passe au démarrage

Un compte `admin` est créé dans la table `users` avec un mot de passe par défaut. Le service `db-bootstrap` se connecte à la base et remplace ce mot de passe au démarrage via la variable `ADMIN_PASSWORD` (par défaut `change_me`). Vous pouvez la modifier dans `docker-compose.yml` ou via un override.

## Ce que couvre le prototype

- Parcours administrateur : gestion des comptes, organisation du matériel, stocks.
- Parcours chef de poste : assistant de création, sélection des sacs, suivi en direct.
- Parcours secouriste : accès mobile, saisie rapide, progression globale.

> Ce prototype est un socle UX. Les actions sensibles (authentification, stockage, synchronisation temps réel) sont simulées côté navigateur.
