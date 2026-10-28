# Omni-Courses

**Omni-Courses** est une liste de courses qui fonctionne entièrement sur votre
téléphone : pas de serveur, pas de compte, pas de publicité, et elle marche
sans internet. Votre liste, votre budget et vos favoris restent chez vous.

**Adresse de l'application (une fois publiée) :**
https://ferrusdantioch.github.io/omni-courses/

Application de l'Omni-système, conçue par Ferrus Dantioch.

---

## Sommaire

1. [Ce que fait Omni-Courses](#1-ce-que-fait-omni-courses)
2. [Quelques mots à connaître](#2-quelques-mots-à-connaître)
3. [Tester sur votre ordinateur](#3-tester-sur-votre-ordinateur)
4. [Publier sur GitHub Pages](#4-publier-sur-github-pages)
5. [Installer l'application sur Android](#5-installer-lapplication-sur-android)
6. [Sauvegarder et restaurer vos données](#6-sauvegarder-et-restaurer-vos-données)
7. [Publier une nouvelle version](#7-publier-une-nouvelle-version)
8. [Organisation des fichiers](#8-organisation-des-fichiers)
9. [Tests automatiques](#9-tests-automatiques)
10. [Confidentialité](#10-confidentialité)
11. [Droits et licence](#11-droits-et-licence)

---

## 1. Ce que fait Omni-Courses

- **Liste de courses** : ajouter, modifier, supprimer un article, choisir sa
  quantité (décimales acceptées : 1,5 kg), cocher un article quand il est dans
  le panier. Les articles cochés se rangent dans « Dans le panier ».
- **Prix** : chaque article peut avoir un prix unitaire (facultatif). La carte
  du haut affiche le **total de la liste**, le **total des articles cochés**
  (déjà dans le panier) et le **reste à acheter**, en euros, avec la virgule
  française (« 2,49 € »).
- **Budget maximum** (facultatif, modifiable à tout moment) : la carte du haut,
  toujours visible, compare le total de la liste au budget, avec une barre de
  progression et trois états qui ont chacun **une icône et un texte**, pas
  seulement une couleur :
  - ✓ **Dans le budget** : moins de 80 % du budget ;
  - ⚠ **Attention** : de 80 % à 100 % (« Budget atteint » à 100 % pile) ;
  - ✕ **Budget dépassé** : au-delà de 100 %, avec le montant du dépassement.

  Le dépassement ne bloque jamais l'ajout d'un article : c'est un simple
  avertissement, sans son ni animation.
- **Retirer les articles cochés** et **Recommencer la liste** (tout effacer, ou
  garder les articles et tout décocher). Quand la liste repart de zéro et qu'un
  budget existe, l'application demande si vous gardez le même budget.
- **Favoris** : des articles avec leur prix, ajoutés à la liste **en un seul
  geste** (bouton +). Touchez l'étoile ☆ à côté d'un article pour en faire un
  favori. En créant ou modifiant un favori, le bouton **« Enregistrer et ajouter
  à la liste »** le met aussi directement dans la liste : rien à saisir deux fois.
- **Sauvegarde** : export de toutes les données (liste, budget, favoris, thème)
  dans un fichier `omni-courses-sauvegarde-AAAA-MM-JJ.json`, et import avec
  vérification complète et confirmation avant de remplacer quoi que ce soit.
- **Trois thèmes** : Clair, Sombre et Omni-système (les couleurs et polices du
  portfolio). Par défaut, « Automatique » suit le réglage clair ou sombre du
  téléphone. Le choix est mémorisé.
- **À propos** : version, auteur, lien vers le portfolio, licence et adresse
  pour vos retours.
- **Accessible** : grandes zones à toucher, contrastes vérifiés (au moins 4,5
  pour 1 dans les trois thèmes), utilisable au lecteur d'écran, et le réglage
  « Réduire les animations » du téléphone est respecté.

---

## 2. Quelques mots à connaître

- **PWA** (application web progressive) : un site qui s'installe comme une
  application et fonctionne sans internet.
- **Service worker** (`sw.js`) : le petit programme qui range les fichiers de
  l'application dans le téléphone, pour qu'elle marche hors ligne.
- **localStorage** : la mémoire du navigateur, sur le téléphone, où sont
  gardées vos données.
- **Dépôt GitHub** : le dossier en ligne qui contient le code.
- **Branche** : une version du code dans le dépôt. La principale s'appelle `main`.
- **GitHub Pages** : le service gratuit de GitHub qui publie le dépôt à une
  adresse internet.

---

## 3. Tester sur votre ordinateur

L'application doit être ouverte par une adresse `http://…` : un double-clic
sur `index.html` ne suffit pas (le mode hors ligne ne marcherait pas).

**Avec Python** (souvent déjà installé sur Mac et Linux ; sur Windows :
python.org) :

1. Ouvrez un terminal dans le dossier **qui contient** le dossier `omni-courses`.
2. Tapez : `python3 -m http.server 8000` (sur Windows : `python -m http.server 8000`).
3. Ouvrez dans le navigateur : http://localhost:8000/omni-courses/
4. Pour arrêter : Ctrl + C dans le terminal.

**Avec Node.js** (si vous l'avez) : dans le dossier `omni-courses`, tapez
`node tests/serveur.js`, puis ouvrez http://localhost:8000/omni-courses/

Pour voir l'application comme sur un téléphone : dans Chrome, touche F12, puis
l'icône de téléphone en haut à gauche du panneau.

---

## 4. Publier sur GitHub Pages

Tout est prêt : il n'y a rien à compiler ni à installer. GitHub Pages publie
les fichiers tels quels.

1. Sur https://github.com/FerrusDantioch/omni-courses, vérifiez que le code est
   sur la branche `main` (si le travail est sur une autre branche, fusionnez-la
   dans `main` avec une « Pull request » → « Merge »).
2. Ouvrez l'onglet **Settings** (Paramètres) du dépôt, puis **Pages** dans le
   menu de gauche.
3. Dans **Build and deployment** → **Source**, choisissez **Deploy from a branch**.
4. Dans **Branch**, choisissez **main** et le dossier **/ (root)**, puis **Save**.
5. Attendez 1 à 2 minutes : l'application est en ligne à
   https://ferrusdantioch.github.io/omni-courses/

Le fichier `.nojekyll` (vide) indique à GitHub de publier les fichiers sans les
transformer.

---

## 5. Installer l'application sur Android

1. Ouvrez https://ferrusdantioch.github.io/omni-courses/ dans **Chrome**.
2. Touchez le menu **⋮** (en haut à droite), puis **Ajouter à l'écran
   d'accueil** ou **Installer l'application**, et confirmez.
3. L'icône Omni-Courses (un panier violet) apparaît sur l'écran d'accueil.
   L'application s'ouvre en plein écran et fonctionne sans internet.

> **Limite connue de Chrome Android.** Toutes les applications de
> `ferrusdantioch.github.io` partagent la même adresse. Si une autre de ces
> applications est déjà installée, Chrome peut afficher « Cette appli est déjà
> installée ». Ce n'est pas un défaut d'Omni-Courses : installez-la depuis
> **Brave**, ou choisissez **Créer un raccourci** dans Chrome.

---

## 6. Sauvegarder et restaurer vos données

Vos données sont uniquement sur votre téléphone. Si vous effacez les données
du navigateur ou changez de téléphone, elles sont perdues… sauf si vous les avez
exportées.

- **Exporter** : Réglages → **Exporter mes données**. Le fichier
  `omni-courses-sauvegarde-AAAA-MM-JJ.json` arrive dans le dossier
  **Téléchargements** du téléphone.
- **Importer** : Réglages → **Importer une sauvegarde**, puis choisissez le
  fichier. L'application vérifie tout le fichier (articles, prix, quantités,
  **budget**, favoris, thème). S'il y a un problème, un message clair l'explique
  et rien n'est modifié. Sinon, un résumé s'affiche et l'application demande
  confirmation avant de remplacer vos données.

Dans le fichier, les prix et le budget sont écrits en **centimes**
(`4250` = 42,50 €) : c'est voulu, cela évite toute erreur d'arrondi.

---

## 7. Publier une nouvelle version

Une mise à jour ne fait **jamais** perdre de données : elles sont dans la
mémoire du téléphone, pas dans les fichiers de l'application.

Après toute modification d'un fichier de l'application :

1. Dans `sw.js`, augmentez le numéro : `const CACHE = 'omni-courses-v1';` →
   `'omni-courses-v2'`.
2. Dans `app.js`, augmentez la version affichée : `const VERSION = '1.0.0';` →
   `'1.0.1'`.
3. Si vous avez **ajouté** un fichier, ajoutez son nom dans la liste `FICHIERS`
   de `sw.js`.
4. Envoyez les fichiers sur GitHub (branche `main`).

Sur le téléphone, un bandeau « Une nouvelle version d'Omni-Courses est prête »
s'affiche alors en haut de la liste. Rien ne change tant qu'on n'a pas touché
**Mettre à jour**.

---

## 8. Organisation des fichiers

Tous les fichiers de l'application sont à la racine, sans sous-dossier.

| Fichier | Rôle |
|---|---|
| `index.html` | Les écrans (Liste, Favoris, Réglages, À propos) et les fenêtres |
| `styles.css` | La mise en page et les trois thèmes |
| `theme-initial.js` | Pose le thème avant l'affichage (évite un éclair de couleur) |
| `outils.js` | Lecture et affichage des euros et des quantités, calcul des totaux et de l'état du budget |
| `stockage.js` | Enregistrement des données dans le téléphone et vérifications |
| `sauvegarde.js` | Export et import du fichier de sauvegarde |
| `app.js` | Le fonctionnement de l'application, écran par écran |
| `sw.js` | Le service worker : fonctionnement hors ligne et mises à jour |
| `manifest.json` | La carte d'identité de l'application (nom, icônes) pour l'installation |
| `icon-192.png`, `icon-512.png`, `maskable-512.png` | Les icônes (la « maskable » s'adapte aux formes d'icônes d'Android) |
| `oxanium.woff2`, `literata.woff2`, `jetbrains-mono.woff2` | Les polices du thème Omni-système, incluses pour marcher hors ligne |
| `POLICES-OFL.txt` | La licence des polices |
| `LICENSE` | La licence du code |
| `tests/` | Les tests automatiques et le petit serveur local (inutiles au fonctionnement) |
| `.nojekyll` | Demande à GitHub Pages de publier les fichiers tels quels |

---

## 9. Tests automatiques

Le dossier `tests/` contient 146 vérifications qui pilotent un vrai navigateur
(liste, prix, budget dans tous ses états, favoris, export, import de fichiers
valides et invalides, trois thèmes, contrastes, hors ligne, mise à jour sans
perte de données). Ils nécessitent Node.js et Playwright :

```bash
npm install playwright        # une seule fois
npx playwright install chromium
node tests/tester.js
```

---

## 10. Confidentialité

- Aucun compte, aucun serveur, aucun traceur, aucune publicité.
- Aucune donnée n'est envoyée sur internet : une règle de sécurité de la page
  (Content-Security-Policy) interdit même toute connexion vers un autre site.
- Les données sont gardées dans le stockage du navigateur du téléphone, sous des
  noms qui commencent par `omnicourses_`.
- Le lien « Envoyer un retour » ouvre seulement votre application de messagerie :
  rien ne part sans votre action.

---

## 11. Droits et licence

**Code : © 2026 Ferrus Dantioch — Creative Commons BY-NC-ND 4.0**
([résumé de la licence en français](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr)).
En clair : le partage est autorisé, à l'identique et en citant l'auteur ;
l'usage commercial est interdit ; la modification et les œuvres dérivées sont
interdites. Le logiciel est fourni « en l'état », sans aucune garantie. Texte
complet dans le fichier [LICENSE](LICENSE) : le texte officiel en anglais, suivi
de la traduction française officielle publiée par Creative Commons.

Le nom, le logo et les textes de l'Omni-système sont la création de Ferrus
Dantioch.

**Polices** Oxanium, Literata et JetBrains Mono : SIL Open Font License 1.1
(fichier [POLICES-OFL.txt](POLICES-OFL.txt)).

Application réalisée avec l'aide de Claude, l'intelligence artificielle
d'Anthropic. L'idée, les fonctions et l'apparence sont de Ferrus Dantioch.
L'application elle-même n'utilise aucune intelligence artificielle.

**Retours :** omni-systeme.choking513@passmail.net
