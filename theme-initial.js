/* Omni-Courses — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* Ce tout petit fichier est lu AVANT l'affichage de la page.
   Il pose tout de suite les bonnes couleurs : sans lui, l'écran
   s'allumerait une fraction de seconde avec un autre thème (un éclair
   désagréable, surtout dans le noir). app.js refait la même chose
   ensuite, et suit les changements de réglage du téléphone. */
(function () {
  var choix = 'auto';
  try {
    var r = JSON.parse(localStorage.getItem('omnicourses_reglages')) || {};
    if (['auto', 'clair', 'sombre', 'omni'].indexOf(r.theme) >= 0) choix = r.theme;
  } catch (e) { /* rien d'enregistré, ou stockage refusé : thème automatique */ }
  if (choix === 'auto') {
    choix = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair';
  }
  document.documentElement.dataset.theme = choix;
})();
