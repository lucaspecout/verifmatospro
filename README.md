# Gestion du matériel de secours (prototype)

Ce dépôt contient un prototype web mobile-first pour organiser le matériel de secours et préparer les vérifications terrain.

## Démarrage rapide

```bash
docker compose up --build
```

Ouvrir ensuite `http://localhost:8080`.

## Ce que couvre le prototype

- Parcours administrateur : gestion des comptes, organisation du matériel, stocks.
- Parcours chef de poste : assistant de création, sélection des sacs, suivi en direct.
- Parcours secouriste : accès mobile, saisie rapide, progression globale.

> Ce prototype est un socle UX. Les actions sensibles (authentification, stockage, synchronisation temps réel) sont simulées côté navigateur.
