/* Omni-Courses — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-COURSES — app.js
   Le fonctionnement de l'application, écran par écran :
    1. État général et enregistrement
    2. Navigation entre les écrans
    3. Thème
    4. Petits messages
    5. Carte du budget (total, budget, barre)
    6. Liste des articles
    7. Fenêtre « Ajouter / modifier un article »
    8. Favoris
    9. Fenêtre du budget
   10. Retirer les cochés / recommencer la liste
   11. Sauvegarde : export et import
   12. Nouvelle version de l'application
   13. Démarrage
   ============================================================ */
'use strict';

/* ⚠️ Numéro affiché dans « À propos ». À augmenter avec la version du
   service worker (constante CACHE dans sw.js) à chaque modification. */
const VERSION = '1.1.0';


/* ---------- 1. État général et enregistrement ---------- */

let donnees = Stockage.chargerDonnees();
let reglages = Stockage.chargerReglages();

/* Enregistre les données dans le téléphone puis remet l'affichage à
   jour. Si le téléphone refuse d'enregistrer, un avertissement s'affiche. */
function enregistrer() {
  const ok = Stockage.enregistrerDonnees(donnees);
  $('#alerte-stockage').hidden = ok;
  toutAfficher();
}

function toutAfficher() {
  afficherListe();
  afficherFavoris();
  afficherReglagesBudget();
}

/* Après un nouvel affichage, l'élément qui avait le focus (pour la
   navigation au clavier ou avec un lecteur d'écran) a été remplacé :
   on redonne le focus à son remplaçant. */
function redonnerFocus(selecteur) {
  const el = $(selecteur);
  if (el) el.focus({ preventScroll: true });
}

function favoriParNom(nom) {
  const cle = normaliserNom(nom);
  return donnees.favoris.find((f) => normaliserNom(f.nom) === cle);
}


/* ---------- 2. Navigation entre les écrans ----------
   Les écrans sont des <section class="vue">. Un seul est visible.
   Le bouton « retour » du téléphone ramène à la liste, puis quitte. */

const VUES = ['liste', 'favoris', 'reglages', 'apropos'];
let vueActive = 'liste';

function vueDepuisAdresse() {
  const nom = location.hash.slice(1);
  return VUES.includes(nom) ? nom : 'liste';
}

function afficherVue(nom, donnerFocus = true) {
  vueActive = nom;
  $$('.vue').forEach((s) => { s.hidden = s.dataset.vue !== nom; });
  $$('.navigation a').forEach((a) => {
    if (a.dataset.aller === nom) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  // Le titre de l'écran reçoit le focus : un lecteur d'écran l'annonce
  if (donnerFocus) redonnerFocus('.vue[data-vue="' + nom + '"] h1');
}

function allerA(nom) {
  if (nom === vueActive) return;
  const etat = { omniCourses: true };
  if (vueActive === 'liste') {
    // Depuis la liste : on garde la liste dans l'historique (bouton retour)
    history.pushState(etat, '', '#' + nom);
  } else if (nom === 'liste' && history.state && history.state.omniCourses) {
    history.back();       // « popstate » affichera la liste
    return;
  } else {
    history.replaceState(history.state, '', nom === 'liste' ? location.pathname + location.search : '#' + nom);
  }
  afficherVue(nom);
}

window.addEventListener('popstate', () => afficherVue(vueDepuisAdresse()));

$$('.navigation a').forEach((lien) => {
  lien.addEventListener('click', (e) => {
    e.preventDefault();
    allerA(lien.dataset.aller);
  });
});


/* ---------- 3. Thème ----------
   « auto » suit le réglage clair / sombre du téléphone, même s'il
   change pendant que l'application est ouverte. */

const requeteSombre = window.matchMedia('(prefers-color-scheme: dark)');

function themeEffectif() {
  if (reglages.theme === 'auto') return requeteSombre.matches ? 'sombre' : 'clair';
  return reglages.theme;
}

function appliquerTheme() {
  document.documentElement.dataset.theme = themeEffectif();
  // La barre du haut d'Android prend la couleur du fond du thème
  const fond = getComputedStyle(document.documentElement).getPropertyValue('--fond').trim();
  const meta = $('meta[name="theme-color"]');
  if (meta && fond) meta.setAttribute('content', fond);
  $$('input[name="theme"]').forEach((radio) => { radio.checked = radio.value === reglages.theme; });
}

requeteSombre.addEventListener('change', () => {
  if (reglages.theme === 'auto') appliquerTheme();
});

const NOMS_THEMES = { auto: 'Automatique', clair: 'Clair', sombre: 'Sombre', omni: 'Omni-système' };

$$('input[name="theme"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    reglages.theme = radio.value;
    if (!Stockage.enregistrerReglages(reglages)) $('#alerte-stockage').hidden = false;
    appliquerTheme();
    annoncer('Thème ' + NOMS_THEMES[reglages.theme] + ' choisi.');
  });
});


/* ---------- 4. Petits messages ---------- */

/* Phrase lue par les lecteurs d'écran (invisible à l'œil) */
function annoncer(texte) {
  const zone = $('#annonce');
  zone.textContent = '';
  setTimeout(() => { zone.textContent = texte; }, 60);
}

/* Petit message visible quelques secondes en bas de l'écran.
   Il apparaît et disparaît sans mouvement. */
let minuterieMessage = null;
function messageBref(texte) {
  const boite = $('#message-bref');
  boite.textContent = texte;
  boite.hidden = false;
  clearTimeout(minuterieMessage);
  minuterieMessage = setTimeout(() => { boite.hidden = true; }, 4000);
}


/* ---------- 5. Carte du budget ----------
   Toujours visible en haut de la liste. Le budget est comparé au
   TOTAL de la liste (tout ce que tu prévois d'acheter). */

let dernierEtatBudget;   // pour n'annoncer un état qu'au moment où il change

function afficherCarteBudget() {
  const t = Calculs.totaux(donnees.articles);
  const budget = donnees.budgetCentimes;
  const e = Calculs.etatBudget(t.total, budget);
  const carte = $('#carte-budget');

  carte.dataset.etat = e ? e.etat : 'aucun';
  $('#cb-total').textContent = Euros.formater(t.total);
  $('#cb-budget').textContent = budget === null ? 'Définir' : Euros.formater(budget);
  $('#bouton-budget').setAttribute('aria-label', budget === null
    ? 'Définir un budget (aucun pour l\'instant)'
    : 'Modifier le budget, actuellement ' + Euros.formater(budget));
  $('#cb-coche').textContent = Euros.formater(t.coche);
  $('#cb-reste').textContent = Euros.formater(t.reste);

  const sansPrix = $('#cb-sans-prix');
  sansPrix.hidden = t.sansPrix === 0;
  sansPrix.textContent = t.sansPrix === 1
    ? '1 article sans prix (non compté dans les totaux)'
    : t.sansPrix + ' articles sans prix (non comptés dans les totaux)';

  const blocEtat = $('#cb-etat');
  const barre = $('#cb-barre');
  blocEtat.hidden = !e;
  barre.hidden = !e;
  if (!e) {
    dernierEtatBudget = 'aucun';
    return;
  }

  // Texte et icône de l'état : toujours les deux, en plus de la couleur
  let texte, nomIcone;
  if (e.etat === 'ok') {
    nomIcone = 'i-ok';
    texte = 'Dans le budget : il reste ' + Euros.formater(e.ecart);
  } else if (e.etat === 'attention') {
    nomIcone = 'i-attention';
    texte = e.ecart === 0
      ? 'Budget atteint : il ne reste plus rien'
      : 'Attention : ' + e.pourcentage + ' % du budget, il reste ' + Euros.formater(e.ecart);
  } else {
    nomIcone = 'i-depasse';
    texte = 'Budget dépassé de ' + Euros.formater(-e.ecart);
  }
  $('#cb-etat-icone').setAttribute('href', '#' + nomIcone);
  $('#cb-etat-texte').textContent = texte;

  // La barre : si le budget est dépassé, elle représente le total et
  // un trait montre où s'arrête le budget.
  const echelle = Math.max(t.total, budget);
  $('#cb-barre-coche').style.width = (t.coche * 100 / echelle) + '%';
  $('#cb-barre-reste').style.width = (t.reste * 100 / echelle) + '%';
  $('.cb-repere').style.left = (budget * 100 / echelle) + '%';
  barre.setAttribute('aria-label', 'Part du budget utilisée');
  barre.setAttribute('aria-valuemax', String(Math.max(100, e.pourcentage)));
  barre.setAttribute('aria-valuenow', String(e.pourcentage));
  barre.setAttribute('aria-valuetext', e.pourcentage + ' % : ' + Euros.formater(t.total) +
    ' sur un budget de ' + Euros.formater(budget) + ', dont ' + Euros.formater(t.coche) + ' déjà dans le panier');

  // On n'annonce l'état que lorsqu'il change (pas à chaque article)
  if (dernierEtatBudget !== undefined && dernierEtatBudget !== e.etat) annoncer(texte + '.');
  dernierEtatBudget = e.etat;
}


/* ---------- 6. Liste des articles ---------- */

/* Le petit texte sous le nom : « 2 × 1,20 € = 2,40 € » */
function detailArticle(a) {
  const detail = creer('span', { class: 'article-detail' });
  if (a.prixCentimes === null) {
    detail.append((a.quantite === 1 ? '' : 'Quantité : ' + Quantite.formater(a.quantite) + ' · ') + 'prix non renseigné');
  } else if (a.quantite === 1) {
    detail.append(creer('span', { class: 'mono' }, Euros.formater(a.prixCentimes)));
  } else {
    detail.append(Quantite.formater(a.quantite) + ' × ' + Euros.formater(a.prixCentimes) + ' = ',
      creer('span', { class: 'mono' }, Euros.formater(Calculs.totalLigne(a))));
  }
  return detail;
}

function ligneArticle(a) {
  const estFavori = !!favoriParNom(a.nom);
  const idCase = 'coche-' + a.id;
  return creer('li', { class: 'article' + (a.coche ? ' coche' : ''), 'data-id': a.id },
    creer('label', { class: 'article-coche', for: idCase },
      creer('input', { type: 'checkbox', id: idCase, 'data-id': a.id, checked: a.coche }),
      creer('span', { class: 'article-texte' },
        creer('span', { class: 'article-nom' }, a.nom),
        detailArticle(a))),
    creer('button', {
      type: 'button', class: 'article-bouton', 'data-action': 'favori-article', 'data-id': a.id,
      'aria-pressed': String(estFavori), 'aria-label': 'Favori : ' + a.nom
    }, icone(estFavori ? 'i-etoile-pleine' : 'i-etoile')),
    creer('button', {
      type: 'button', class: 'article-bouton', 'data-action': 'modifier-article', 'data-id': a.id,
      'aria-label': 'Modifier ' + a.nom
    }, icone('i-crayon'))
  );
}

function afficherListe() {
  afficherCarteBudget();

  const aAcheter = donnees.articles.filter((a) => !a.coche);
  const panier = donnees.articles.filter((a) => a.coche);

  $('#liste-a-acheter').replaceChildren(...aAcheter.map(ligneArticle));
  $('#liste-panier').replaceChildren(...panier.map(ligneArticle));

  $('#titre-a-acheter').textContent = 'À acheter (' + aAcheter.length + ')';
  $('#titre-panier').textContent = 'Dans le panier (' + panier.length + ')';
  $('#titre-panier').hidden = panier.length === 0;
  $('#liste-panier').hidden = panier.length === 0;
  $('#liste-vide').hidden = donnees.articles.length > 0;

  $('#bouton-retirer-coches').disabled = panier.length === 0;
  $('#bouton-recommencer').disabled = donnees.articles.length === 0 && donnees.budgetCentimes === null;
}

/* Cocher / décocher un article */
$('main').addEventListener('change', (e) => {
  const caseACocher = e.target.closest('.article input[type="checkbox"]');
  if (!caseACocher) return;
  const article = donnees.articles.find((a) => a.id === caseACocher.dataset.id);
  if (!article) return;
  article.coche = caseACocher.checked;
  enregistrer();
  redonnerFocus('#coche-' + CSS.escape(article.id));
});

/* Étoile d'un article : l'ajouter aux favoris (avec son prix) ou l'en retirer */
function basculerFavoriArticle(id) {
  const article = donnees.articles.find((a) => a.id === id);
  if (!article) return;
  const favori = favoriParNom(article.nom);
  if (favori) {
    donnees.favoris = donnees.favoris.filter((f) => f !== favori);
    messageBref('«\u00a0' + article.nom + '\u00a0» retiré des favoris');
  } else if (donnees.favoris.length >= LIMITES.favoris) {
    messageBref('Tu as déjà ' + LIMITES.favoris + ' favoris : retires-en un d\'abord.');
    return;
  } else {
    donnees.favoris.push({ id: nouvelId(), nom: article.nom, prixCentimes: article.prixCentimes });
    messageBref('«\u00a0' + article.nom + '\u00a0» ajouté aux favoris');
  }
  enregistrer();
  redonnerFocus('[data-action="favori-article"][data-id="' + CSS.escape(id) + '"]');
}


/* ---------- 7. Fenêtre « Ajouter / modifier un article » ---------- */

const dlgArticle = $('#dialogue-article');
let articleEnCours = null;   // l'identifiant de l'article modifié, ou null pour un ajout

/* Affiche (ou efface) le message d'erreur sous un champ */
function erreurChamp(champ, message) {
  const zone = $('#' + champ.id + '-erreur');
  zone.textContent = message || '';
  zone.hidden = !message;
  if (message) champ.setAttribute('aria-invalid', 'true');
  else champ.removeAttribute('aria-invalid');
}

function effacerErreurs(dialogue) {
  $$('input[type="text"]', dialogue).forEach((c) => erreurChamp(c, ''));
}

/* Remet un bouton « Supprimer » dans son état normal (un seul appui fait) */
function desarmer(bouton, texte) {
  bouton.classList.remove('arme');
  bouton.textContent = texte;
}

function ouvrirArticle(id = null) {
  const article = id ? donnees.articles.find((a) => a.id === id) : null;
  articleEnCours = article ? article.id : null;
  effacerErreurs(dlgArticle);

  $('#titre-dialogue-article').textContent = article ? 'Modifier l\'article' : 'Ajouter un article';
  $('#article-nom').value = article ? article.nom : '';
  $('#article-quantite').value = Quantite.formater(article ? article.quantite : 1);
  $('#article-prix').value = article ? Euros.versChamp(article.prixCentimes) : '';
  $('#article-favori').checked = article ? !!favoriParNom(article.nom) : false;
  $('#article-valider').textContent = article ? 'Enregistrer' : 'Ajouter';
  $('#article-continuer').hidden = !!article;
  $('#article-supprimer').hidden = !article;
  desarmer($('#article-supprimer'), 'Supprimer cet article');

  dlgArticle.showModal();
  $('#article-nom').focus();
}

/* Le favori suit l'article (nom et prix) quand la case est cochée */
function synchroniserFavori(ancienNom, nom, prix, veutFavori) {
  const ancien = ancienNom ? favoriParNom(ancienNom) : undefined;
  const nouveau = favoriParNom(nom);
  if (veutFavori) {
    const favori = ancien || nouveau;
    if (favori) {
      favori.nom = nom;
      if (prix !== null) favori.prixCentimes = prix;   // on n'efface jamais un prix connu
      if (ancien && nouveau && ancien !== nouveau) {
        donnees.favoris = donnees.favoris.filter((f) => f !== nouveau);   // pas de doublon
      }
    } else if (donnees.favoris.length < LIMITES.favoris) {
      donnees.favoris.push({ id: nouvelId(), nom, prixCentimes: prix });
    }
  } else {
    donnees.favoris = donnees.favoris.filter((f) => f !== ancien && f !== nouveau);
  }
}

/* Vérifie les trois champs. Rend les valeurs, ou null s'il y a une erreur
   (le message s'affiche sous le champ concerné, qui reçoit le focus). */
function lireChampsArticle() {
  const champNom = $('#article-nom');
  const champQuantite = $('#article-quantite');
  const champPrix = $('#article-prix');
  const nom = nettoyerNom(champNom.value);
  const quantite = Quantite.lire(champQuantite.value);
  const prix = Euros.lire(champPrix.value);

  erreurChamp(champNom, nom ? '' : 'Indique le nom de l\'article.');
  erreurChamp(champQuantite, quantite.ok ? '' : quantite.message);
  erreurChamp(champPrix, prix.ok ? '' : prix.message);

  const premierEnErreur = [champNom, champQuantite, champPrix].find((c) => c.getAttribute('aria-invalid'));
  if (premierEnErreur) {
    premierEnErreur.focus();
    return null;
  }
  return { nom, quantite: quantite.valeur, prixCentimes: prix.valeur };
}

dlgArticle.addEventListener('submit', (e) => {
  e.preventDefault();
  const action = e.submitter ? e.submitter.value : 'valider';
  const valeurs = lireChampsArticle();
  if (!valeurs) return;
  const veutFavori = $('#article-favori').checked;

  if (articleEnCours) {
    // Modification
    const article = donnees.articles.find((a) => a.id === articleEnCours);
    if (!article) { dlgArticle.close(); return; }
    const ancienNom = article.nom;
    Object.assign(article, valeurs);
    synchroniserFavori(ancienNom, article.nom, article.prixCentimes, veutFavori);
    enregistrer();
    dlgArticle.close();
    messageBref('«\u00a0' + article.nom + '\u00a0» modifié');
    return;
  }

  // Ajout
  if (donnees.articles.length >= LIMITES.articles) {
    erreurChamp($('#article-nom'), 'Ta liste est pleine (' + LIMITES.articles + ' articles au maximum).');
    return;
  }
  donnees.articles.push({ id: nouvelId(), ...valeurs, coche: false });
  synchroniserFavori(null, valeurs.nom, valeurs.prixCentimes, veutFavori);
  enregistrer();
  messageBref('«\u00a0' + valeurs.nom + '\u00a0» ajouté à la liste');

  if (action === 'continuer') {
    // La fenêtre reste ouverte, vide, pour l'article suivant
    $('#article-nom').value = '';
    $('#article-quantite').value = '1';
    $('#article-prix').value = '';
    $('#article-favori').checked = false;
    $('#article-nom').focus();
  } else {
    dlgArticle.close();
  }
});

/* La touche « Entrée / Suivant » du clavier passe au champ suivant ;
   sur le prix, elle valide. */
$('#article-nom').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#article-quantite').focus(); $('#article-quantite').select(); }
});
$('#article-quantite').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#article-prix').focus(); }
});

/* Boutons − et + de la quantité */
function changerQuantite(sens) {
  const champ = $('#article-quantite');
  const lu = Quantite.lire(champ.value);
  let q = lu.ok ? lu.valeur : 1;
  if (sens > 0) q = Math.min(LIMITES.quantiteMax, q + 1);
  else if (q > 1) q = Math.max(1, q - 1);
  q = Math.round(q * 1000) / 1000;
  champ.value = Quantite.formater(q);
  erreurChamp(champ, '');
}

function supprimerArticle(bouton) {
  if (!bouton.classList.contains('arme')) {
    // Premier appui : on demande confirmation en changeant le bouton
    bouton.classList.add('arme');
    bouton.textContent = 'Confirmer la suppression';
    annoncer('Appuie encore une fois pour confirmer la suppression.');
    return;
  }
  const article = donnees.articles.find((a) => a.id === articleEnCours);
  donnees.articles = donnees.articles.filter((a) => a.id !== articleEnCours);
  enregistrer();
  dlgArticle.close();
  if (article) messageBref('«\u00a0' + article.nom + '\u00a0» supprimé de la liste');
}


/* ---------- 8. Favoris ---------- */

const dlgFavori = $('#dialogue-favori');
let favoriEnCours = null;

/* L'article de la liste (pas encore coché) qui correspond à un favori */
function articleDuFavori(favori) {
  const cle = normaliserNom(favori.nom);
  return donnees.articles.find((a) => !a.coche && normaliserNom(a.nom) === cle);
}

function afficherFavoris() {
  const tries = [...donnees.favoris].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
  $('#liste-favoris').replaceChildren(...tries.map((f) => {
    const dansListe = articleDuFavori(f);
    let detail = f.prixCentimes === null ? 'Sans prix' : Euros.formater(f.prixCentimes);
    if (dansListe) detail += ' · déjà dans la liste (× ' + Quantite.formater(dansListe.quantite) + ')';
    return creer('li', { class: 'favori' },
      creer('button', { type: 'button', class: 'favori-ajouter', 'data-action': 'ajouter-favori', 'data-id': f.id },
        creer('span', { class: 'favori-plus' }, icone('i-plus')),
        creer('span', { class: 'favori-texte' },
          creer('span', { class: 'annonce' }, 'Ajouter à la liste : '),
          creer('span', { class: 'favori-nom' }, f.nom),
          creer('span', { class: 'favori-detail' }, detail))),
      creer('button', {
        type: 'button', class: 'article-bouton', 'data-action': 'modifier-favori', 'data-id': f.id,
        'aria-label': 'Modifier le favori ' + f.nom
      }, icone('i-crayon')));
  }));
  $('#favoris-vide').hidden = donnees.favoris.length > 0;
}

/* Met un favori dans la liste (sans enregistrer : c'est à l'appelant de
   le faire). S'il y est déjà (et pas encore coché), sa quantité augmente
   de 1 au lieu de faire un doublon.
   Rend { ok, message } : ok vaut false si la liste est pleine. */
function placerDansLaListe(favori) {
  const existant = articleDuFavori(favori);
  if (existant) {
    existant.quantite = Math.min(LIMITES.quantiteMax, Math.round((existant.quantite + 1) * 1000) / 1000);
    return { ok: true, message: '«\u00a0' + existant.nom + '\u00a0» : quantité passée à ' + Quantite.formater(existant.quantite) };
  }
  if (donnees.articles.length >= LIMITES.articles) {
    return { ok: false, message: 'Ta liste est pleine (' + LIMITES.articles + ' articles au maximum).' };
  }
  donnees.articles.push({ id: nouvelId(), nom: favori.nom, quantite: 1, prixCentimes: favori.prixCentimes, coche: false });
  return { ok: true, message: '«\u00a0' + favori.nom + '\u00a0» ajouté à la liste' };
}

/* Le bouton + d'un favori : il rejoint la liste en un geste */
function ajouterFavoriALaListe(id) {
  const favori = donnees.favoris.find((f) => f.id === id);
  if (!favori) return;
  const resultat = placerDansLaListe(favori);
  messageBref(resultat.message);
  if (!resultat.ok) return;
  enregistrer();
  redonnerFocus('[data-action="ajouter-favori"][data-id="' + CSS.escape(id) + '"]');
}

function ouvrirFavori(id = null) {
  const favori = id ? donnees.favoris.find((f) => f.id === id) : null;
  favoriEnCours = favori ? favori.id : null;
  effacerErreurs(dlgFavori);
  $('#titre-dialogue-favori').textContent = favori ? 'Modifier le favori' : 'Nouveau favori';
  $('#favori-nom').value = favori ? favori.nom : '';
  $('#favori-prix').value = favori ? Euros.versChamp(favori.prixCentimes) : '';
  $('#favori-supprimer').hidden = !favori;
  desarmer($('#favori-supprimer'), 'Supprimer ce favori');
  dlgFavori.showModal();
  $('#favori-nom').focus();
}

$('#favori-nom').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#favori-prix').focus(); }
});

dlgFavori.addEventListener('submit', (e) => {
  e.preventDefault();
  // « valider » (Enregistrer) ou « ajouter-liste » (Enregistrer et ajouter à la liste)
  const action = e.submitter ? e.submitter.value : 'valider';
  const champNom = $('#favori-nom');
  const champPrix = $('#favori-prix');
  const nom = nettoyerNom(champNom.value);
  const prix = Euros.lire(champPrix.value);
  const doublon = nom && donnees.favoris.find((f) => f.id !== favoriEnCours && normaliserNom(f.nom) === normaliserNom(nom));

  erreurChamp(champNom, !nom ? 'Indique le nom du favori.' : (doublon ? 'Ce favori existe déjà.' : ''));
  erreurChamp(champPrix, prix.ok ? '' : prix.message);
  if (!nom || doublon) { champNom.focus(); return; }
  if (!prix.ok) { champPrix.focus(); return; }

  let favori = favoriEnCours ? donnees.favoris.find((f) => f.id === favoriEnCours) : null;
  if (favori) {
    favori.nom = nom;
    favori.prixCentimes = prix.valeur;
  } else {
    if (donnees.favoris.length >= LIMITES.favoris) {
      erreurChamp(champNom, 'Tu as déjà ' + LIMITES.favoris + ' favoris : retires-en un d\'abord.');
      return;
    }
    favori = { id: nouvelId(), nom, prixCentimes: prix.valeur };
    donnees.favoris.push(favori);
  }

  let message = 'Favori «\u00a0' + nom + '\u00a0» enregistré';
  if (action === 'ajouter-liste') {
    // Le favori part aussi dans la liste de courses : rien à retaper
    const resultat = placerDansLaListe(favori);
    message = resultat.ok
      ? message + ' et ' + (resultat.message.includes('quantité') ? 'quantité augmentée dans la liste' : 'ajouté à la liste')
      : message + '. ' + resultat.message;
  }
  enregistrer();
  dlgFavori.close();
  messageBref(message);
});

function supprimerFavori(bouton) {
  if (!bouton.classList.contains('arme')) {
    bouton.classList.add('arme');
    bouton.textContent = 'Confirmer la suppression';
    annoncer('Appuie encore une fois pour confirmer la suppression.');
    return;
  }
  const favori = donnees.favoris.find((f) => f.id === favoriEnCours);
  donnees.favoris = donnees.favoris.filter((f) => f.id !== favoriEnCours);
  enregistrer();
  dlgFavori.close();
  if (favori) messageBref('Favori «\u00a0' + favori.nom + '\u00a0» supprimé');
}


/* ---------- 9. Fenêtre du budget ----------
   Le budget est facultatif et modifiable à tout moment. Le dépasser
   n'empêche jamais d'ajouter un article : c'est un simple avertissement. */

const dlgBudget = $('#dialogue-budget');

function afficherReglagesBudget() {
  $('#reglages-budget').textContent = donnees.budgetCentimes === null
    ? 'Aucun budget défini.'
    : 'Budget actuel : ' + Euros.formater(donnees.budgetCentimes) + '.';
}

function ouvrirBudget() {
  effacerErreurs(dlgBudget);
  $('#budget-montant').value = Euros.versChamp(donnees.budgetCentimes);
  $('#budget-retirer').hidden = donnees.budgetCentimes === null;
  dlgBudget.showModal();
  $('#budget-montant').focus();
}

function changerBudget(nouveau) {
  donnees.budgetCentimes = nouveau;
  enregistrer();
  dlgBudget.close();
  messageBref(nouveau === null ? 'Budget retiré' : 'Budget enregistré : ' + Euros.formater(nouveau));
}

dlgBudget.addEventListener('submit', (e) => {
  e.preventDefault();
  const champ = $('#budget-montant');
  const lu = Euros.lire(champ.value, LIMITES.budgetMax);
  let message = lu.ok ? '' : lu.message;
  if (lu.ok && lu.valeur === 0) message = 'Le budget doit être plus grand que zéro (ou laisse le champ vide).';
  erreurChamp(champ, message);
  if (message) { champ.focus(); return; }
  changerBudget(lu.valeur);
});


/* ---------- 10. Retirer les cochés / recommencer la liste ----------
   Une seule fenêtre pour les deux. Quand la liste repart de zéro (ou
   qu'on recommence avec les mêmes articles) et qu'un budget existe,
   elle demande si l'on garde le même budget. */

const dlgVider = $('#dialogue-vider');
let modeVider = 'recommencer';   // ou « coches »

function ouvrirVider(mode) {
  modeVider = mode;
  const t = Calculs.totaux(donnees.articles);
  const budget = donnees.budgetCentimes;
  let demanderBudget;

  if (mode === 'coches') {
    if (t.nbCoches === 0) return;
    $('#titre-dialogue-vider').textContent = 'Retirer les articles cochés';
    $('#texte-dialogue-vider').textContent = (t.nbCoches === 1
      ? 'L\'article coché (déjà dans le panier) va être retiré'
      : 'Les ' + t.nbCoches + ' articles cochés (déjà dans le panier) vont être retirés') + ' de la liste.';
    $('#vider-choix-articles').hidden = true;
    $('#vider-valider').textContent = 'Retirer';
    // Tout était coché : la liste va être vide, donc on parle du budget
    demanderBudget = budget !== null && t.nbCoches === t.nb;
  } else {
    $('#titre-dialogue-vider').textContent = 'Recommencer la liste';
    $('#texte-dialogue-vider').textContent = t.nb > 0
      ? 'Ta liste contient ' + pluriel(t.nb, 'article') + '.'
      : 'Ta liste est déjà vide.';
    $('#vider-choix-articles').hidden = t.nb === 0;
    $('#vider-valider').textContent = 'Recommencer';
    demanderBudget = budget !== null;
  }

  $('#vider-choix-budget').hidden = !demanderBudget;
  if (budget !== null) $('#vider-garder-texte').textContent = 'Oui, garder le budget de ' + Euros.formater(budget);
  // Choix proposés par défaut : tout effacer, garder le budget
  $('input[name="vider-articles"][value="effacer"]').checked = true;
  $('input[name="vider-budget"][value="garder"]').checked = true;

  dlgVider.showModal();
}

dlgVider.addEventListener('submit', (e) => {
  e.preventDefault();
  let message;
  if (modeVider === 'coches') {
    donnees.articles = donnees.articles.filter((a) => !a.coche);
    message = 'Articles cochés retirés';
  } else if ($('input[name="vider-articles"]:checked').value === 'decocher') {
    donnees.articles.forEach((a) => { a.coche = false; });
    message = 'Liste recommencée : tous les articles sont décochés';
  } else {
    donnees.articles = [];
    message = 'Liste vidée';
  }
  if (!$('#vider-choix-budget').hidden && $('input[name="vider-budget"]:checked').value === 'retirer') {
    donnees.budgetCentimes = null;
    message += ', budget retiré';
  } else if (donnees.budgetCentimes !== null) {
    message += ', budget gardé';
  }
  enregistrer();
  dlgVider.close();
  messageBref(message);
});


/* ---------- 11. Sauvegarde : export et import ---------- */

const dlgImport = $('#dialogue-import');
let importEnAttente = null;

function messageSauvegarde(texte, estErreur) {
  const ok = $('#message-sauvegarde');
  const erreur = $('#erreur-sauvegarde');
  ok.hidden = estErreur || !texte;
  erreur.hidden = !estErreur;
  (estErreur ? erreur : ok).textContent = texte;
}

function exporter() {
  const nom = Sauvegarde.nomFichier();
  try {
    Sauvegarde.telecharger(Sauvegarde.construire(donnees, reglages, VERSION), nom);
    messageSauvegarde('Fichier «\u00a0' + nom + '\u00a0» créé. Sur Android, il se trouve dans le dossier «\u00a0Téléchargements\u00a0».', false);
  } catch (e) {
    messageSauvegarde('L\'export n\'a pas fonctionné. Réessaie dans un instant.', true);
  }
}

$('#fichier-import').addEventListener('change', (e) => {
  const fichier = e.target.files && e.target.files[0];
  if (!fichier) return;
  Sauvegarde.lireFichier(fichier).then((resultat) => {
    e.target.value = '';   // pour pouvoir choisir le même fichier une 2e fois
    if (!resultat.ok) {
      messageSauvegarde(resultat.message + ' Tes données actuelles n\'ont pas été modifiées.', true);
      return;
    }
    messageSauvegarde('', false);
    importEnAttente = resultat;

    // Résumé de ce que contient le fichier, avant de confirmer
    const d = resultat.donnees;
    const nbCoches = d.articles.filter((a) => a.coche).length;
    const lignes = [];
    if (resultat.exporteLe) lignes.push('Sauvegarde du ' + resultat.exporteLe.toLocaleDateString('fr-FR', { dateStyle: 'long' }));
    lignes.push(pluriel(d.articles.length, 'article') + (nbCoches ? ' (dont ' + nbCoches + ' coché' + (nbCoches > 1 ? 's' : '') + ')' : ''));
    lignes.push(d.budgetCentimes === null ? 'Pas de budget' : 'Budget : ' + Euros.formater(d.budgetCentimes));
    lignes.push(pluriel(d.favoris.length, 'favori'));
    if (resultat.reglages) lignes.push('Thème : ' + NOMS_THEMES[resultat.reglages.theme]);
    $('#import-resume').replaceChildren(...lignes.map((l) => creer('li', {}, l)));
    dlgImport.showModal();
  });
});

dlgImport.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!importEnAttente) { dlgImport.close(); return; }
  donnees = importEnAttente.donnees;
  if (importEnAttente.reglages) {
    reglages = importEnAttente.reglages;
    Stockage.enregistrerReglages(reglages);
    appliquerTheme();
  }
  importEnAttente = null;
  dernierEtatBudget = undefined;
  enregistrer();
  dlgImport.close();
  messageSauvegarde('Sauvegarde importée : ta liste, ton budget, tes favoris et ton thème sont à jour.', false);
});

dlgImport.addEventListener('close', () => { importEnAttente = null; });


/* ---------- Tous les boutons à « data-action » ----------
   Un seul écouteur pour toute la page : on regarde quel bouton a été
   touché grâce à son attribut data-action. */

document.addEventListener('click', (e) => {
  const bouton = e.target.closest('[data-action]');
  if (!bouton || bouton.disabled) return;
  const id = bouton.dataset.id;
  switch (bouton.dataset.action) {
    case 'ajouter-article':  ouvrirArticle(); break;
    case 'modifier-article': ouvrirArticle(id); break;
    case 'favori-article':   basculerFavoriArticle(id); break;
    case 'quantite-moins':   changerQuantite(-1); break;
    case 'quantite-plus':    changerQuantite(1); break;
    case 'supprimer-article':supprimerArticle(bouton); break;
    case 'ajouter-favori':   ajouterFavoriALaListe(id); break;
    case 'modifier-favori':  ouvrirFavori(id); break;
    case 'nouveau-favori':   ouvrirFavori(); break;
    case 'supprimer-favori': supprimerFavori(bouton); break;
    case 'budget':           ouvrirBudget(); break;
    case 'retirer-budget':   changerBudget(null); break;
    case 'retirer-coches':   ouvrirVider('coches'); break;
    case 'recommencer':      ouvrirVider('recommencer'); break;
    case 'exporter':         exporter(); break;
    case 'importer':         $('#fichier-import').click(); break;
    case 'fermer':           bouton.closest('dialog').close(); break;
    case 'mettre-a-jour':    MiseAJour.appliquer(bouton); break;
    case 'plus-tard':        MiseAJour.repousser(); break;
  }
});


/* ---------- Si l'application est ouverte deux fois ----------
   (deux onglets, par exemple) : l'autre fenêtre reste à jour. */
window.addEventListener('storage', (e) => {
  if (e.key === CLES.donnees) {
    donnees = Stockage.chargerDonnees();
    toutAfficher();
  } else if (e.key === CLES.reglages) {
    reglages = Stockage.chargerReglages();
    appliquerTheme();
  }
});


/* ---------- 12. Nouvelle version de l'application ----------
   Une nouvelle version ne s'installe jamais par surprise : un bandeau
   propose « Mettre à jour ». Tes données ne sont jamais touchées par une
   mise à jour : elles sont dans le stockage du téléphone, pas dans les
   fichiers de l'application. */

const MiseAJour = {
  inscription: null,
  demandee: false,
  repoussee: false,

  surveiller(inscription) {
    this.inscription = inscription;
    this.majBandeau();   // une version attendait peut-être déjà
    inscription.addEventListener('updatefound', () => {
      const nouveau = inscription.installing;
      if (!nouveau) return;
      nouveau.addEventListener('statechange', () => {
        if (nouveau.state === 'installed') this.majBandeau();
      });
    });
    // À chaque retour dans l'application, on regarde s'il y a du nouveau
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') inscription.update().catch(() => {});
    });
  },

  prete() {
    // Sans « controller », c'est la toute première installation : rien à proposer
    return !!(this.inscription && this.inscription.waiting && navigator.serviceWorker.controller);
  },

  majBandeau() {
    $('#bandeau-mise-a-jour').hidden = !this.prete() || this.repoussee;
  },

  appliquer(bouton) {
    if (!this.prete()) return;
    this.demandee = true;
    bouton.disabled = true;
    bouton.textContent = 'Mise à jour…';
    this.inscription.waiting.postMessage({ type: 'activer' });
  },

  repousser() {
    this.repoussee = true;
    this.majBandeau();
    messageBref('D\'accord. La mise à jour te sera reproposée à la prochaine ouverture.');
  }
};


/* ---------- 13. Démarrage ---------- */

function demarrer() {
  appliquerTheme();
  $('#numero-version').textContent = 'Version ' + VERSION;
  toutAfficher();
  afficherVue(vueDepuisAdresse(), false);

  if ('serviceWorker' in navigator) {
    // La nouvelle version a pris le relais après « Mettre à jour » : on recharge
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (MiseAJour.demandee) location.reload();
    });
    navigator.serviceWorker.register('./sw.js')
      .then((inscription) => MiseAJour.surveiller(inscription))
      .catch(() => { /* sans service worker, l'application marche quand même (en ligne) */ });
  }
}

demarrer();
