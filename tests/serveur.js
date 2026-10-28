/* Omni-Courses — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Petit serveur local, sans rien à installer (Node.js suffit).
   Il sert le dossier de l'application à l'adresse
   http://localhost:8000/omni-courses/ : la même forme d'adresse que
   sur GitHub Pages. Un service worker ne fonctionne qu'en http(s),
   jamais en ouvrant index.html directement (file://).
   Lancer :  node tests/serveur.js     (Ctrl+C pour arrêter) */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const RACINE_DEFAUT = path.resolve(__dirname, '..');   // le dossier de l'application
const PORT = Number(process.env.PORT) || 8000;
const PREFIXE = '/omni-courses/';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

function demarrerServeur(port = PORT, racine = RACINE_DEFAUT) {
  const RACINE = path.resolve(racine);
  const serveur = http.createServer((req, res) => {
    let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (chemin === '/' || chemin === '/omni-courses') { res.writeHead(302, { Location: PREFIXE }); return res.end(); }
    if (!chemin.startsWith(PREFIXE)) { res.writeHead(404); return res.end('Introuvable'); }
    chemin = chemin.slice(PREFIXE.length) || 'index.html';
    const fichier = path.resolve(RACINE, chemin);
    if (!fichier.startsWith(RACINE + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(fichier, (err, contenu) => {
      if (err) { res.writeHead(404); return res.end('Introuvable'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(contenu);
    });
  });
  return new Promise((ok) => serveur.listen(port, () => ok(serveur)));
}

module.exports = { demarrerServeur };

if (require.main === module) {
  demarrerServeur().then(() => console.log('Omni-Courses : ouvre http://localhost:' + PORT + PREFIXE + '  (Ctrl+C pour arrêter)'));
}
