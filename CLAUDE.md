# Omni-Courses — notes pour Claude

PWA de liste de courses (prix, budget, favoris, sauvegarde), en **HTML/CSS/JS
pur, sans dépendance ni compilation**. Application de l'Omni-système, modelée
sur Omni-Time. L'auteur est novice en programmation : garder les commentaires
en français simple, sans jargon, et lui répondre en français.

Écrans : Liste (carte du budget collée en haut), Favoris, Réglages (thème,
budget, sauvegarde), À propos. Navigation en bas ; bouton « Ajouter » flottant.

## ⚠️ Contraintes à préserver

- **Le vrai nom de l'auteur n'apparaît nulle part.** Seul le pseudonyme
  **Ferrus Dantioch** est utilisé.
- **Licence : Creative Commons BY-NC-ND 4.0.** `LICENSE` est une copie exacte de
  celle des autres applications. Chaque fichier de code commence par la même
  mention de trois lignes (pas `manifest.json` : le JSON n'accepte pas les
  commentaires).
- **Thème Omni-système : valeurs du portfolio, à l'identique** (#14111d,
  #1d1929, #332c47, #e9e4f2, #a59cbb, #a777ff, #d6c2ff ; Oxanium / Literata /
  JetBrains Mono). Sombre et Clair : gamme Bleu-gris de Cap / Omni-Time. Thème
  par défaut : « auto » (suit `prefers-color-scheme`), à la demande de l'auteur.
- **Budget** : comparé au **total de la liste** (pas aux seuls cochés). États :
  `ok` < 80 % ≤ `attention` ≤ 100 % < `depasse`. Toujours icône + texte, jamais
  la couleur seule ; jamais de blocage, de son ni d'animation. Le total des
  cochés est affiché dans la carte (demande explicite de l'auteur).
- **Montants en centimes entiers** partout (`prixCentimes`, `budgetCentimes`).
  Saisie avec `Euros.lire` (virgule ou point), affichage avec `Euros.formater`.
- **Aucun appel réseau** : CSP `connect-src 'self'` dans `index.html`, pas de
  script en ligne (d'où `theme-initial.js`). Pas de `confirm()`/`alert()` natifs.
- **Tutoiement** dans l'application, vouvoiement dans le README.
- **Tous les fichiers de l'application à la racine** (envoi depuis téléphone).

## Même adresse que les autres applications

`ferrusdantioch.github.io` est partagé : clés localStorage préfixées
`omnicourses_`, `sw.js` ne supprime que les caches `omni-courses-…` et
revérifie son cache à chaque ouverture. `manifest.json` : `"id": "/omni-courses/"`
(jamais `./`, ne plus le changer).

## Données (localStorage)

- `omnicourses_donnees` : `{ version: 1, articles: [{ id, nom, quantite,
  prixCentimes|null, coche }], budgetCentimes|null, favoris: [{ id, nom,
  prixCentimes|null }] }`.
- `omnicourses_reglages` : `{ theme: 'auto'|'clair'|'sombre'|'omni' }`.
- `Valider.donnees(d, strict)` (stockage.js) sert au démarrage (souple : ignore
  ce qui est abîmé) et à l'import (strict : refuse avec un message précis).
  Tout nouveau champ doit y être ajouté, sinon il est perdu.
- Fichier de sauvegarde : `{ application: 'Omni-Courses', format: 1, exporteLe,
  versionApplication, donnees, reglages }` (voir `sauvegarde.js`).

## ⚠️ Avant de pousser : incrémenter la version

Après toute modification d'un fichier mis en cache, incrémenter `CACHE` en haut
de `sw.js` (`omni-courses-vN` → `vN+1`) et `VERSION` en haut d'`app.js`. Un
fichier ajouté va aussi dans `FICHIERS` de `sw.js` (et le test 10 compte 15
fichiers : l'ajuster). Une nouvelle version attend « Mettre à jour » : pas de
`skipWaiting()` à l'installation.

## Tests

`node tests/tester.js` (Playwright + Chromium) : 140 vérifications, dont
contrastes WCAG dans les 3 thèmes × 3 états du budget, hors ligne, mise à jour
simulée sans perte de données. `node tests/serveur.js` sert l'application à
http://localhost:8000/omni-courses/ (même forme d'adresse que GitHub Pages).

Déploiement : GitHub Pages, branche `main`, racine →
https://ferrusdantioch.github.io/omni-courses/
