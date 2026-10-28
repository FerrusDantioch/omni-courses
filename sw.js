/* Omni-Courses — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Service Worker d'Omni-Courses.
   Rôle : rendre l'application utilisable SANS connexion internet.
   À la première visite, tous les fichiers sont rangés dans le téléphone
   (le « cache »), puis servis depuis là, même hors ligne.
   Tes données (liste, budget, favoris) ne sont PAS dans ce cache : elles
   sont dans le stockage du téléphone (localStorage). Une mise à jour de
   l'application ne les touche donc jamais. */

/* ⚠️ À augmenter d'un cran (v1 → v2…) à CHAQUE modification d'un fichier
   de la liste FICHIERS ci-dessous. Sinon, les téléphones qui ont déjà
   ouvert l'application gardent l'ancienne version. */
const CACHE = 'omni-courses-v2';

/* Le début du nom de cache propre à Omni-Courses. Toutes les applications
   de ferrusdantioch.github.io partagent le même espace de caches : on ne
   touche JAMAIS aux caches des autres applications, seulement aux
   anciennes versions d'Omni-Courses. */
const PREFIXE = 'omni-courses-';

/* La liste des fichiers indispensables au fonctionnement hors ligne.
   Si on ajoute un fichier au projet, il faut aussi l'ajouter ici. */
const FICHIERS = [
  './',
  './index.html',
  './styles.css',
  './theme-initial.js',
  './outils.js',
  './stockage.js',
  './sauvegarde.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png',
  './oxanium.woff2',
  './literata.woff2',
  './jetbrains-mono.woff2'
];

/* Télécharge tous les fichiers et les range dans le cache.
   { cache: 'reload' } oblige à reprendre chaque fichier sur le serveur,
   sans passer par la mémoire temporaire du navigateur (GitHub Pages la
   garde 10 minutes). */
function remplirCache() {
  return caches.open(CACHE)
    .then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))));
}

/* Vérifie que tous les fichiers sont bien dans le cache, et le remplit à
   nouveau s'il en manque (d'anciennes versions d'autres applications du
   même site effacent parfois tous les caches qui ne sont pas les leurs). */
function verifierCache() {
  return caches.open(CACHE)
    .then((c) => Promise.all(FICHIERS.map((f) => c.match(f))))
    .then((trouves) => (trouves.some((r) => !r) ? remplirCache() : null))
    .catch(() => { /* hors ligne : on réessaiera à la prochaine ouverture */ });
}

/* 1. Installation : on range tout dans le cache.
      Volontairement, PAS de self.skipWaiting() ici : une nouvelle version
      attend que la personne touche « Mettre à jour » (voir l'étape 3). */
self.addEventListener('install', (e) => {
  e.waitUntil(remplirCache());
});

/* 2. Activation : on supprime les anciennes versions d'Omni-Courses,
      et uniquement elles (voir PREFIXE plus haut). */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(
        cles.filter((k) => k.startsWith(PREFIXE) && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* 3. La personne a touché « Mettre à jour » : cette version prend le
      relais. La page le remarque (« controllerchange ») et se recharge. */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'activer') self.skipWaiting();
});

/* 4. Interception des requêtes : on sert la copie rangée dans le
      téléphone (instantané, hors ligne). On ne va sur internet que pour
      un fichier absent de la copie. On ne remplace JAMAIS en arrière-plan
      un fichier déjà rangé : l'application ne change pas en douce.
      ignoreSearch : une adresse avec un « ? » trouve quand même sa page. */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Seulement les fichiers d'Omni-Courses (pas les liens vers d'autres sites)
  if (!e.request.url.startsWith(self.registration.scope)) return;

  // À chaque ouverture de l'application, on vérifie que le cache est complet
  if (e.request.mode === 'navigate') e.waitUntil(verifierCache());

  e.respondWith(
    caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((enCache) => {
      if (enCache) return enCache;
      // Une page de l'application demandée hors ligne : on sert l'accueil
      if (e.request.mode === 'navigate') {
        return fetch(e.request).catch(() => c.match('./index.html'));
      }
      return fetch(e.request).then((rep) => {
        if (rep && rep.status === 200 && rep.type === 'basic') c.put(e.request, rep.clone());
        return rep;
      });
    }))
  );
});
