/* Omni-Courses — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   Tests automatiques d'Omni-Courses.
   Ils ouvrent l'application dans un vrai navigateur (Chromium,
   piloté par Playwright), font les gestes d'une personne (ajouter,
   cocher, définir un budget, exporter, importer, couper internet…)
   et vérifient le résultat. Rien n'est envoyé sur internet.

   Lancer (Playwright doit être installé) :  node tests/tester.js
   Ces tests ne servent qu'au développement : l'application n'en a
   pas besoin pour fonctionner.
   ============================================================ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const { demarrerServeur } = require('./serveur.js');

const PORT = 8765;
const ADRESSE = 'http://localhost:' + PORT + '/omni-courses/';
const RACINE = path.resolve(__dirname, '..');
// Numéros de version actuels, lus directement dans les fichiers
const CACHE_ACTUEL = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8').match(/const CACHE = '(omni-courses-v(\d+))'/);
const VERSION_ACTUELLE = fs.readFileSync(path.join(RACINE, 'app.js'), 'utf8').match(/const VERSION = '([\d.]+)'/)[1];
const CACHE_SUIVANT = 'omni-courses-v' + (Number(CACHE_ACTUEL[2]) + 1);
const VERSION_SUIVANTE = VERSION_ACTUELLE.replace(/\d+$/, (n) => String(Number(n) + 1));
const TELEPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

let reussis = 0;
const echecs = [];
function verifier(condition, libelle, detail) {
  if (condition) { reussis++; console.log('  ✓ ' + libelle); }
  else { echecs.push(libelle + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); console.log('  ✗ ' + libelle + (detail !== undefined ? '  (obtenu : ' + JSON.stringify(detail) + ')' : '')); }
}
async function section(titre, fn) {
  console.log('\n■ ' + titre);
  try { await fn(); } catch (e) { echecs.push(titre + ' : ' + e.message); console.log('  ✗ ERREUR : ' + e.stack); }
}

/* Texte d'un élément, espaces normalisés (« 2,49 € » a une espace fine) */
const texte = (p, sel) => p.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim());
const visible = (p, sel) => p.$eval(sel, (el) => !el.closest('[hidden]') && el.getClientRects().length > 0);

let navigateur;
const externes = [];     // requêtes vers un autre site (il ne doit y en avoir aucune)
const erreursConsole = [];

async function nouvellePage(options = {}) {
  const ctx = await navigateur.newContext({ ...TELEPHONE, acceptDownloads: true, ...options });
  ctx.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('http://localhost:') && !u.startsWith('blob:') && !u.startsWith('data:')) externes.push(u);
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erreursConsole.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') erreursConsole.push(m.text()); });
  await p.goto(options.adresse || ADRESSE);
  return { ctx, p };
}

async function ajouterArticle(p, nom, quantite, prix, favori = false) {
  await p.click('[data-action="ajouter-article"]');
  await p.fill('#article-nom', nom);
  await p.fill('#article-quantite', quantite);
  await p.fill('#article-prix', prix);
  if (favori) await p.check('#article-favori');
  await p.click('#article-valider');
}

async function definirBudget(p, montant) {
  await p.click('#bouton-budget');
  await p.fill('#budget-montant', montant);
  await p.click('#dialogue-budget button[value="valider"]');
}

async function carte(p) {
  return p.evaluate(() => {
    const t = (s) => document.querySelector(s).textContent.replace(/\s+/g, ' ').trim();
    const c = document.querySelector('#carte-budget');
    return {
      etat: c.dataset.etat,
      total: t('#cb-total'), budget: t('#cb-budget'), coche: t('#cb-coche'), reste: t('#cb-reste'),
      texteEtat: document.querySelector('#cb-etat').hidden ? null : t('#cb-etat-texte'),
      icone: document.querySelector('#cb-etat-icone').getAttribute('href'),
      barreVisible: !document.querySelector('#cb-barre').hidden,
      largeurCoche: document.querySelector('#cb-barre-coche').style.width,
      largeurReste: document.querySelector('#cb-barre-reste').style.width
    };
  });
}

/* Remplit les données directement (plus rapide pour certains tests) */
async function poserDonnees(p, donnees, reglages) {
  await p.evaluate(([d, r]) => {
    localStorage.setItem('omnicourses_donnees', JSON.stringify(d));
    if (r) localStorage.setItem('omnicourses_reglages', JSON.stringify(r));
  }, [donnees, reglages]);
  await p.reload();
}
const article = (nom, quantite, prixCentimes, coche = false) => ({ id: nom, nom, quantite, prixCentimes, coche });

/* Mesure le contraste de tout le texte visible (norme WCAG : 4,5 pour 1) */
const MESURER_CONTRASTES = () => {
  const lire = (c) => {
    let m = c.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (m) return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a: m[4] === undefined ? 1 : +m[4] };
    m = c.match(/^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    return null;
  };
  const lum = (c) => [c.r, c.g, c.b].map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const fondDe = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = lire(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return lire(getComputedStyle(document.body).backgroundColor);
  };
  const resultats = [];
  const tous = document.querySelectorAll('body *');
  for (const el of tous) {
    if (el.closest('.annonce, .sprites, [hidden]') || el.closest('button:disabled')) continue;
    const aTexte = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!aTexte || el.getClientRects().length === 0) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden') continue;
    const couleur = lire(st.color);
    const fond = fondDe(el);
    const l1 = lum(couleur), l2 = lum(fond);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    resultats.push({ texte: el.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100 });
  }
  return resultats;
};


(async () => {
  const serveur = await demarrerServeur(PORT);
  navigateur = await chromium.launch();

  /* ---------------------------------------------------------- */
  await section('1. Liste de courses : ajouter, modifier, cocher, supprimer', async () => {
    const { ctx, p } = await nouvellePage();
    verifier(await visible(p, '#liste-vide'), 'Liste vide au premier lancement, avec un message d\'aide');

    await ajouterArticle(p, 'Lait', '2', '1,15');
    await ajouterArticle(p, 'Pommes', '1,5', '2.99');
    await ajouterArticle(p, 'Sel', '1', '');
    const c = await carte(p);
    verifier(c.total === '6,79 €', 'Total : 2 × 1,15 + 1,5 × 2,99 (4,485 arrondi à 4,49) = 6,79 €', c.total);
    verifier(await texte(p, '#cb-sans-prix') === '1 article sans prix (non compté dans les totaux)', 'Article sans prix signalé');
    verifier(await texte(p, '.article:has-text("Lait") .article-detail') === '2 × 1,15 € = 2,30 €', 'Détail de ligne « 2 × 1,15 € = 2,30 € »');

    // Saisies invalides : message clair, rien n'est ajouté
    await p.click('[data-action="ajouter-article"]');
    await p.fill('#article-nom', 'Beurre');
    await p.fill('#article-prix', 'abc');
    await p.click('#article-valider');
    verifier(await visible(p, '#article-prix-erreur'), 'Prix « abc » refusé avec un message', await texte(p, '#article-prix-erreur'));
    await p.fill('#article-prix', '2,499');
    await p.click('#article-valider');
    verifier((await texte(p, '#article-prix-erreur')).includes('Deux chiffres'), 'Prix « 2,499 » refusé (deux décimales maximum)');
    await p.fill('#article-prix', '-2');
    await p.click('#article-valider');
    verifier((await texte(p, '#article-prix-erreur')).includes('négatif'), 'Prix négatif refusé');
    await p.fill('#article-prix', '2');
    await p.fill('#article-quantite', '0');
    await p.click('#article-valider');
    verifier(await visible(p, '#article-quantite-erreur'), 'Quantité 0 refusée');
    await p.fill('#article-nom', '   ');
    await p.fill('#article-quantite', '1');
    await p.click('#article-valider');
    verifier(await visible(p, '#article-nom-erreur'), 'Nom vide refusé');
    await p.click('#dialogue-article [data-action="fermer"]');
    verifier((await p.$$('.article')).length === 3, 'Toujours 3 articles après les saisies refusées');

    // « Ajouter et en saisir un autre »
    await p.click('[data-action="ajouter-article"]');
    await p.fill('#article-nom', 'Œufs');
    await p.click('[data-action="quantite-plus"]');
    await p.click('[data-action="quantite-plus"]');
    await p.fill('#article-prix', '3');
    await p.click('#article-continuer');
    verifier(await p.$eval('#dialogue-article', (d) => d.open) && await p.inputValue('#article-nom') === '', '« Ajouter et en saisir un autre » garde la fenêtre ouverte et vide');
    await p.click('#dialogue-article [data-action="fermer"]');
    verifier(await texte(p, '.article:has-text("Œufs") .article-detail') === '3 × 3,00 € = 9,00 €', 'Boutons + de la quantité (1 → 3)');

    // Cocher : l'article passe dans « Dans le panier », total coché visible
    await p.click('.article:has-text("Lait") .article-coche');
    let c2 = await carte(p);
    verifier(c2.coche === '2,30 €' && c2.reste === '13,49 €' && c2.total === '15,79 €', 'Cocher : total coché 2,30 €, reste 13,49 €, total 15,79 €', c2);
    verifier(await p.$eval('#liste-panier', (ul) => ul.textContent.includes('Lait')), 'L\'article coché est rangé dans « Dans le panier »');
    verifier(await p.$eval('.article.coche .article-nom', (el) => getComputedStyle(el).textDecorationLine) === 'line-through', 'Article coché barré (pas seulement une couleur)');

    // Modifier
    await p.click('.article:has-text("Pommes") [data-action="modifier-article"]');
    verifier(await p.inputValue('#article-prix') === '2,99' && await p.inputValue('#article-quantite') === '1,5', 'La fenêtre de modification est pré-remplie (virgule française)');
    await p.fill('#article-quantite', '2');
    await p.click('#article-valider');
    verifier(await texte(p, '.article:has-text("Pommes") .article-detail') === '2 × 2,99 € = 5,98 €', 'Modification de la quantité');

    // Supprimer : deux appuis
    await p.click('.article:has-text("Sel") [data-action="modifier-article"]');
    await p.click('#article-supprimer');
    verifier(await p.$eval('#dialogue-article', (d) => d.open) && await texte(p, '#article-supprimer') === 'Confirmer la suppression', 'Premier appui sur « Supprimer » : demande de confirmation');
    await p.click('#article-supprimer');
    verifier(!(await p.$('.article:has-text("Sel")')), 'Deuxième appui : article supprimé');

    // Persistance après rechargement
    await p.reload();
    verifier((await p.$$('.article')).length === 3 && (await carte(p)).coche === '2,30 €', 'Tout est retrouvé après fermeture / réouverture');

    // Retirer les articles cochés (liste pas entièrement cochée : pas de question de budget)
    await definirBudget(p, '50');
    await p.click('#bouton-retirer-coches');
    verifier(await p.$eval('#vider-choix-budget', (f) => f.hidden), 'Retirer les cochés (il reste des articles) : pas de question sur le budget');
    await p.click('#vider-valider');
    verifier(!(await p.$('.article:has-text("Lait")')) && (await p.$$('.article')).length === 2, 'Articles cochés retirés, les autres restent');
    await ctx.close();
  });

  /* ---------------------------------------------------------- */
  await section('2. Budget', async () => {
    const { ctx, p } = await nouvellePage();
    await poserDonnees(p, { version: 1, budgetCentimes: null, favoris: [], articles: [article('Riz', 1, 500)] });

    let c = await carte(p);
    verifier(c.etat === 'aucun' && c.texteEtat === null && !c.barreVisible && c.budget === 'Définir', 'Aucun budget : pas d\'état ni de barre, bouton « Définir »', c);
    verifier(c.total === '5,00 €' && c.coche === '0,00 €', 'Aucun budget : les totaux restent affichés');

    // Valeurs refusées
    for (const mauvais of ['0', '-5', 'abc', '12,345', '1000000']) {
      await p.click('#bouton-budget');
      await p.fill('#budget-montant', mauvais);
      await p.click('#dialogue-budget button[value="valider"]');
      const ouvert = await p.$eval('#dialogue-budget', (d) => d.open);
      verifier(ouvert && await visible(p, '#budget-montant-erreur'), 'Budget « ' + mauvais + ' » refusé : ' + (await texte(p, '#budget-montant-erreur')));
      await p.click('#dialogue-budget [data-action="fermer"]');
    }

    // Normal (< 80 %)
    await definirBudget(p, '10');
    c = await carte(p);
    verifier(c.etat === 'ok' && c.icone === '#i-ok' && c.texteEtat === 'Dans le budget : il reste 5,00 €', 'Normal (50 %) : icône ✓ et texte « Dans le budget : il reste 5,00 € »', c);
    verifier(c.largeurReste === '50%' && c.largeurCoche === '0%', 'Barre de progression à 50 %', c);

    // 79,9 % → encore normal ; 80 % → attention
    await poserDonnees(p, { version: 1, budgetCentimes: 1000, favoris: [], articles: [article('A', 1, 799)] });
    verifier((await carte(p)).etat === 'ok', '79,9 % du budget : encore normal');
    await poserDonnees(p, { version: 1, budgetCentimes: 1000, favoris: [], articles: [article('A', 1, 800)] });
    c = await carte(p);
    verifier(c.etat === 'attention' && c.icone === '#i-attention' && c.texteEtat === 'Attention : 80 % du budget, il reste 2,00 €', 'Attention à 80 % : icône ⚠ et texte', c);

    // Budget atteint (100 %)
    await poserDonnees(p, { version: 1, budgetCentimes: 1000, favoris: [], articles: [article('A', 1, 600, true), article('B', 2, 200)] });
    c = await carte(p);
    verifier(c.etat === 'attention' && c.texteEtat === 'Budget atteint : il ne reste plus rien', 'Budget atteint (100 %) : état « attention », texte « Budget atteint »', c);
    verifier(c.largeurCoche === '60%' && c.largeurReste === '40%', 'Barre : 60 % cochés (plein) + 40 % reste (hachuré)', c);

    // Dépassé, et l'ajout n'est jamais bloqué
    await ajouterArticle(p, 'Chocolat', '1', '2,50');
    c = await carte(p);
    verifier((await p.$$('.article')).length === 3, 'Dépassement : l\'article est quand même ajouté (jamais bloqué)');
    verifier(c.etat === 'depasse' && c.icone === '#i-depasse' && c.texteEtat === 'Budget dépassé de 2,50 €', 'Dépassé : icône ✕ et texte « Budget dépassé de 2,50 € »', c);
    verifier(await p.$eval('.cb-repere', (r) => getComputedStyle(r).display === 'block' && r.style.left.startsWith('80')), 'Dépassé : un trait marque où s\'arrête le budget sur la barre');
    await ajouterArticle(p, 'Biscuits', '1', '1');
    verifier((await p.$$('.article')).length === 4, 'Encore un ajout possible au-delà du budget');
    verifier(await p.$eval('#annonce', (a) => a.textContent).then((t) => t === '' || t.includes('dépassé')), 'Changement d\'état annoncé discrètement (lecteur d\'écran), sans alerte');

    // Modification du budget : l'état suit
    await definirBudget(p, '15');
    c = await carte(p);
    verifier(c.etat === 'attention' && c.budget === '15,00 €' && c.texteEtat === 'Attention : 90 % du budget, il reste 1,50 €',
      'Budget modifié à 15 € (total 13,50 €) : passe de « dépassé » à « attention » (90 %)', c);
    await definirBudget(p, '30,5');
    c = await carte(p);
    verifier(c.etat === 'ok' && c.budget === '30,50 €' && c.texteEtat === 'Dans le budget : il reste 17,00 €', 'Budget modifié à 30,50 € : normal, il reste 17,00 €', c);
    await p.click('#bouton-budget');
    verifier(await p.inputValue('#budget-montant') === '30,50', 'La fenêtre du budget est pré-remplie');
    await p.click('#budget-retirer');
    verifier((await carte(p)).etat === 'aucun', '« Retirer le budget » : retour à l\'état sans budget');

    // Réglages : budget affiché et modifiable aussi
    await definirBudget(p, '25');
    await p.click('[data-aller="reglages"]');
    verifier(await texte(p, '#reglages-budget') === 'Budget actuel : 25,00 €.', 'Le budget apparaît aussi dans les Réglages');
    await p.click('[data-aller="liste"]');

    // Recommencer : la question du budget
    await p.click('#bouton-recommencer');
    verifier(!(await p.$eval('#vider-choix-budget', (f) => f.hidden)) && (await texte(p, '#vider-garder-texte')).includes('25,00 €'), 'Recommencer : « Garder le même budget ? » est demandé (avec le montant)');
    await p.click('#vider-valider');   // choix par défaut : tout effacer, garder le budget
    c = await carte(p);
    verifier((await p.$$('.article')).length === 0 && c.budget === '25,00 €' && c.etat === 'ok', 'Liste vidée en gardant le budget', c);

    await poserDonnees(p, { version: 1, budgetCentimes: 2500, favoris: [], articles: [article('A', 1, 300, true), article('B', 1, 200, true)] });
    await p.click('#bouton-retirer-coches');
    verifier(!(await p.$eval('#vider-choix-budget', (f) => f.hidden)), 'Retirer les cochés quand tout est coché (la liste se vide) : la question du budget est posée');
    await p.check('input[name="vider-budget"][value="retirer"]');
    await p.click('#vider-valider');
    verifier((await carte(p)).etat === 'aucun' && (await p.$$('.article')).length === 0, 'Liste vidée et budget retiré sur demande');

    await poserDonnees(p, { version: 1, budgetCentimes: 2500, favoris: [], articles: [article('A', 1, 300, true), article('B', 1, 200, false)] });
    await p.click('#bouton-recommencer');
    await p.check('input[name="vider-articles"][value="decocher"]');
    await p.click('#vider-valider');
    verifier((await p.$$('.article')).length === 2 && (await p.$$('.article.coche')).length === 0 && (await carte(p)).budget === '25,00 €',
      'Recommencer avec les mêmes articles : tout est décoché, budget gardé');

    // Un budget de 0,01 € et des montants énormes ne cassent rien
    await poserDonnees(p, { version: 1, budgetCentimes: 1, favoris: [], articles: [article('A', 9999, 9999999)] });
    c = await carte(p);
    verifier(c.etat === 'depasse' && c.total === '999 899 900,01 €', 'Montants extrêmes (9999 × 99 999,99 €) calculés au centime près', c.total);
    await ctx.close();
  });

  /* ---------------------------------------------------------- */
  await section('3. Favoris', async () => {
    const { ctx, p } = await nouvellePage();
    await ajouterArticle(p, 'Lait', '1', '1,15', true);
    await p.click('[data-aller="favoris"]');
    verifier(await texte(p, '.favori-nom') === 'Lait' && (await texte(p, '.favori-detail')).startsWith('1,15 €'), 'Case « Dans mes favoris » : favori créé avec son prix');

    await p.click('[data-action="ajouter-favori"]');
    verifier(await texte(p, '.favori-detail') === '1,15 € · déjà dans la liste (× 2)', 'Un geste sur un favori déjà dans la liste : quantité + 1 (pas de doublon)', await texte(p, '.favori-detail'));

    await p.click('[data-action="nouveau-favori"]');
    await p.fill('#favori-nom', 'Café');
    await p.fill('#favori-prix', '4,20');
    await p.click('#favori-valider');
    await p.click('[data-action="nouveau-favori"]');
    await p.fill('#favori-nom', 'cafe ');
    await p.click('#favori-valider');
    verifier(await visible(p, '#favori-nom-erreur'), 'Doublon de favori refusé (« cafe » = « Café »)');
    await p.click('#dialogue-favori [data-action="fermer"]');

    await p.click('.favori:has-text("Café") [data-action="ajouter-favori"]');
    verifier(await texte(p, '#message-bref') === '« Café » ajouté à la liste', 'Un seul geste : « Café » ajouté à la liste');
    await p.click('[data-aller="liste"]');
    verifier(await texte(p, '.article:has-text("Café") .article-detail') === '4,20 €', 'L\'article ajouté depuis un favori a son prix');

    // Étoile depuis la liste
    await ajouterArticle(p, 'Pain', '1', '2,10');
    await p.click('.article:has-text("Pain") [data-action="favori-article"]');
    verifier(await p.$eval('.article:has-text("Pain") [data-action="favori-article"]', (b) => b.getAttribute('aria-pressed')) === 'true', 'Étoile touchée depuis la liste : « Pain » devient favori');
    await p.click('.article:has-text("Pain") [data-action="favori-article"]');
    verifier(await p.$eval('.article:has-text("Pain") [data-action="favori-article"]', (b) => b.getAttribute('aria-pressed')) === 'false', 'Deuxième appui : retiré des favoris');

    // Modifier / supprimer un favori
    await p.click('[data-aller="favoris"]');
    await p.click('.favori:has-text("Café") [data-action="modifier-favori"]');
    await p.fill('#favori-prix', '4,50');
    await p.click('#favori-valider');
    verifier((await texte(p, '.favori:has-text("Café") .favori-detail')).startsWith('4,50 €'), 'Prix d\'un favori modifié');
    await p.click('.favori:has-text("Café") [data-action="modifier-favori"]');
    await p.click('#favori-supprimer');
    await p.click('#favori-supprimer');
    verifier(!(await p.$('.favori:has-text("Café")')), 'Favori supprimé (deux appuis)');

    // « Enregistrer et ajouter à la liste » : un seul formulaire, rien à retaper
    await p.click('[data-action="nouveau-favori"]');
    await p.fill('#favori-nom', 'Beurre doux');
    await p.fill('#favori-prix', '2,35');
    await p.click('#favori-ajouter-liste');
    verifier(await texte(p, '#message-bref') === 'Favori « Beurre doux » enregistré et ajouté à la liste', 'Nouveau favori : « Enregistrer et ajouter à la liste » (message)', await texte(p, '#message-bref'));
    verifier((await texte(p, '.favori:has-text("Beurre doux") .favori-detail')) === '2,35 € · déjà dans la liste (× 1)', 'Le favori est créé ET mis dans la liste avec son prix');
    await p.click('[data-aller="liste"]');
    verifier(await texte(p, '.article:has-text("Beurre doux") .article-detail') === '2,35 €' &&
      await p.$eval('.article:has-text("Beurre doux") [data-action="favori-article"]', (b) => b.getAttribute('aria-pressed')) === 'true',
      'Dans la liste : l\'article a son prix et son étoile de favori');
    await p.click('[data-aller="favoris"]');
    await p.click('.favori:has-text("Beurre doux") [data-action="modifier-favori"]');
    await p.click('#favori-ajouter-liste');
    verifier((await texte(p, '.favori:has-text("Beurre doux") .favori-detail')).endsWith('(× 2)') &&
      (await texte(p, '#message-bref')).includes('quantité augmentée dans la liste'),
      'Déjà dans la liste : la quantité augmente au lieu de créer un doublon');
    await p.click('.favori:has-text("Beurre doux") [data-action="modifier-favori"]');
    await p.fill('#favori-prix', 'abc');
    await p.click('#favori-ajouter-liste');
    verifier(await p.$eval('#dialogue-favori', (d) => d.open) && await visible(p, '#favori-prix-erreur'), 'Prix invalide : refusé, rien n\'est ajouté');
    await p.click('#dialogue-favori [data-action="fermer"]');
    verifier((await texte(p, '.favori:has-text("Beurre doux") .favori-detail')).endsWith('(× 2)'), 'Après « Annuler » : liste inchangée');
    await ctx.close();
  });

  /* ---------------------------------------------------------- */
  let fichierExporte;
  await section('4. Sauvegarde : export', async () => {
    const { ctx, p } = await nouvellePage();
    await poserDonnees(p, {
      version: 1, budgetCentimes: 4250,
      favoris: [{ id: 'f', nom: 'Lait', prixCentimes: 115 }],
      articles: [article('Lait', 2, 115, true), article('Pâtes « fraîches »', 1.5, null)]
    }, { theme: 'omni' });
    await p.click('[data-aller="reglages"]');
    const [telechargement] = await Promise.all([p.waitForEvent('download'), p.click('[data-action="exporter"]')]);
    const nom = telechargement.suggestedFilename();
    const aujourdhui = new Date();
    const date = aujourdhui.getFullYear() + '-' + String(aujourdhui.getMonth() + 1).padStart(2, '0') + '-' + String(aujourdhui.getDate()).padStart(2, '0');
    verifier(nom === 'omni-courses-sauvegarde-' + date + '.json', 'Nom du fichier avec la date : ' + nom);
    fichierExporte = fs.readFileSync(await telechargement.path(), 'utf8');
    const json = JSON.parse(fichierExporte);
    verifier(json.application === 'Omni-Courses' && json.format === 1, 'Fichier identifié (application, format)');
    verifier(json.donnees.budgetCentimes === 4250, 'Le budget est dans le fichier (4250 centimes = 42,50 €)');
    verifier(json.donnees.articles.length === 2 && json.donnees.articles[1].nom === 'Pâtes « fraîches »' && json.donnees.articles[1].prixCentimes === null, 'Articles exportés (accents, guillemets, prix absent)');
    verifier(json.donnees.favoris.length === 1 && json.reglages.theme === 'omni', 'Favoris et thème exportés');
    verifier(await visible(p, '#message-sauvegarde') && (await texte(p, '#message-sauvegarde')).includes('Téléchargements'), 'Message de confirmation (dossier Téléchargements)');
    await ctx.close();
  });

  /* ---------------------------------------------------------- */
  await section('5. Sauvegarde : import', async () => {
    const { ctx, p } = await nouvellePage();
    const actuelles = { version: 1, budgetCentimes: 999, favoris: [], articles: [article('Ancien', 1, 100)] };
    await poserDonnees(p, actuelles, { theme: 'clair' });
    await p.click('[data-aller="reglages"]');
    const importer = (contenu, nom = 'sauvegarde.json') => p.setInputFiles('#fichier-import', {
      name: nom, mimeType: 'application/json', buffer: Buffer.from(typeof contenu === 'string' ? contenu : JSON.stringify(contenu))
    });
    const base = JSON.parse(fichierExporte);
    const variante = (modif) => { const v = JSON.parse(fichierExporte); modif(v); return v; };

    // Fichiers invalides : message clair, rien ne change
    const mauvais = [
      ['texte qui n\'est pas du JSON', 'ceci n\'est pas une sauvegarde', 'illisible'],
      ['fichier vide', '', 'vide'],
      ['JSON d\'une autre application', { application: 'Autre', format: 1 }, 'n\'est pas une sauvegarde d\'Omni-Courses'],
      ['format plus récent', variante((v) => { v.format = 2; }), 'version plus récente'],
      ['budget négatif', variante((v) => { v.donnees.budgetCentimes = -500; }), 'Budget'],
      ['budget à zéro', variante((v) => { v.donnees.budgetCentimes = 0; }), 'Budget'],
      ['budget écrit en texte', variante((v) => { v.donnees.budgetCentimes = '42,50'; }), 'Budget'],
      ['budget à virgule (pas en centimes)', variante((v) => { v.donnees.budgetCentimes = 42.5; }), 'Budget'],
      ['budget trop grand', variante((v) => { v.donnees.budgetCentimes = 1e12; }), 'Budget'],
      ['prix d\'article invalide', variante((v) => { v.donnees.articles[0].prixCentimes = 'cher'; }), 'Article n°1'],
      ['quantité négative', variante((v) => { v.donnees.articles[1].quantite = -1; }), 'Article n°2'],
      ['article sans nom', variante((v) => { v.donnees.articles[0].nom = ''; }), 'Article n°1'],
      ['liste d\'articles absente', variante((v) => { delete v.donnees.articles; }), 'articles'],
      ['favori invalide', variante((v) => { v.donnees.favoris[0].prixCentimes = -3; }), 'Favori n°1'],
      ['thème inconnu', variante((v) => { v.reglages.theme = 'rose'; }), 'thème']
    ];
    for (const [libelle, contenu, attendu] of mauvais) {
      await importer(contenu);
      await p.waitForFunction(() => !document.querySelector('#erreur-sauvegarde').hidden);
      const message = await texte(p, '#erreur-sauvegarde');
      const ouvert = await p.$eval('#dialogue-import', (d) => d.open);
      verifier(message.includes(attendu) && !ouvert, 'Refusé – ' + libelle + ' : « ' + message + ' »');
      await p.evaluate(() => { document.querySelector('#erreur-sauvegarde').hidden = true; });
    }
    const intactes = await p.evaluate(() => JSON.parse(localStorage.getItem('omnicourses_donnees')));
    verifier(intactes.budgetCentimes === 999 && intactes.articles[0].nom === 'Ancien', 'Après tous ces refus, les données actuelles sont intactes');

    // Fichier valide : confirmation, puis « Annuler »
    await importer(base, 'omni-courses-sauvegarde.json');
    await p.waitForFunction(() => document.querySelector('#dialogue-import').open);
    const resume = await p.$$eval('#import-resume li', (li) => li.map((l) => l.textContent.replace(/\s+/g, ' ')));
    verifier(resume.includes('Budget : 42,50 €') && resume.includes('2 articles (dont 1 coché)') && resume.includes('1 favori') && resume.includes('Thème : Omni-système'),
      'Avant d\'écraser : résumé du fichier (articles, budget, favoris, thème)', resume);
    await p.click('#dialogue-import [data-action="fermer"]');
    verifier((await p.evaluate(() => JSON.parse(localStorage.getItem('omnicourses_donnees')))).budgetCentimes === 999, '« Annuler » : rien n\'est remplacé');

    // Fichier valide : confirmer
    await importer(base);
    await p.waitForFunction(() => document.querySelector('#dialogue-import').open);
    await p.click('#dialogue-import button[value="valider"]');
    await p.click('[data-aller="liste"]');
    const c = await carte(p);
    verifier(c.budget === '42,50 €' && c.total === '2,30 €' && c.coche === '2,30 €', 'Import confirmé : budget 42,50 € et totaux restaurés', c);
    verifier(await p.evaluate(() => document.documentElement.dataset.theme) === 'omni', 'Import confirmé : thème Omni-système restauré');
    verifier(await texte(p, '.article:has-text("Pâtes") .article-nom') === 'Pâtes « fraîches »', 'Noms avec accents et guillemets restaurés à l\'identique');

    // Budget absent du fichier = pas de budget ; budget null accepté
    await p.click('[data-aller="reglages"]');
    await importer(variante((v) => { v.donnees.budgetCentimes = null; }));
    await p.waitForFunction(() => document.querySelector('#dialogue-import').open);
    verifier((await p.$$eval('#import-resume li', (li) => li.map((l) => l.textContent))).includes('Pas de budget'), 'Sauvegarde sans budget acceptée (« Pas de budget »)');
    await p.click('#dialogue-import button[value="valider"]');
    verifier((await carte(p)).etat === 'aucun', 'Import d\'une sauvegarde sans budget : le budget est retiré');

    // Aller-retour complet : export puis import → identique
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-action="exporter"]')]);
    const reexport = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    verifier(JSON.stringify(reexport.donnees.articles) === JSON.stringify(base.donnees.articles), 'Aller-retour export → import → export : articles identiques');
    await ctx.close();
  });

  /* ---------------------------------------------------------- */
  await section('6. Thèmes', async () => {
    const { ctx, p } = await nouvellePage({ colorScheme: 'light' });
    const fond = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    verifier(await p.evaluate(() => document.documentElement.dataset.theme) === 'clair', 'Par défaut « Automatique » : téléphone en clair → thème Clair');
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.waitForTimeout(100);
    verifier(await p.evaluate(() => document.documentElement.dataset.theme) === 'sombre', 'Le téléphone passe en sombre → l\'application suit, sans recharger');

    await p.click('[data-aller="reglages"]');
    const attendus = { clair: 'rgb(238, 240, 242)', sombre: 'rgb(22, 27, 33)', omni: 'rgb(20, 17, 29)' };
    for (const theme of ['clair', 'sombre', 'omni']) {
      await p.check('input[name="theme"][value="' + theme + '"]');
      verifier(await p.evaluate(() => document.documentElement.dataset.theme) === theme && await fond() === attendus[theme], 'Thème ' + theme + ' appliqué (fond ' + attendus[theme] + ')');
    }
    verifier(await p.$eval('meta[name="theme-color"]', (m) => m.content) === '#14111d', 'Barre Android aux couleurs du thème Omni (#14111d)');
    verifier(await p.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily).then((f) => f.includes('Oxanium')), 'Thème Omni : polices du portfolio (Oxanium)');
    await p.emulateMedia({ colorScheme: 'light' });
    await p.reload();
    verifier(await p.evaluate(() => document.documentElement.dataset.theme) === 'omni', 'Choix mémorisé après réouverture (et non remplacé par le réglage du téléphone)');
    await ctx.close();
  });

  /* ---------------------------------------------------------- */
  await section('7. Contrastes (norme WCAG AA : 4,5 pour 1) dans les 3 thèmes', async () => {
    const { ctx, p } = await nouvellePage();
    for (const theme of ['clair', 'sombre', 'omni']) {
      for (const [libelle, budget, articles] of [
        ['normal', 5000, [article('Lait', 2, 115, true), article('Sel', 1, null)]],
        ['attention', 1000, [article('A', 1, 900)]],
        ['dépassé', 1000, [article('A', 1, 1500, true)]]
      ]) {
        await poserDonnees(p, { version: 1, budgetCentimes: budget, favoris: [{ id: 'f', nom: 'Lait', prixCentimes: 115 }], articles }, { theme });
        const mesures = [];
        for (const vue of ['liste', 'favoris', 'reglages', 'apropos']) {
          await p.evaluate((v) => { location.hash = v === 'liste' ? '' : v; }, vue);
          await p.waitForTimeout(30);
          mesures.push(...await p.evaluate(MESURER_CONTRASTES));
        }
        // Une fenêtre ouverte, avec un message d'erreur
        await p.evaluate(() => { location.hash = ''; });
        await p.click('#bouton-budget');
        await p.fill('#budget-montant', 'x');
        await p.click('#dialogue-budget button[value="valider"]');
        mesures.push(...await p.evaluate(MESURER_CONTRASTES));
        await p.click('#dialogue-budget [data-action="fermer"]');
        const faibles = mesures.filter((m) => m.ratio < 4.5);
        const mini = Math.min(...mesures.map((m) => m.ratio));
        verifier(faibles.length === 0, 'Thème ' + theme + ', budget ' + libelle + ' : ' + mesures.length + ' textes mesurés, contraste minimal ' + mini.toFixed(2), faibles.slice(0, 5));
      }
    }
    await ctx.close();
  });

  /* ---------------------------------------------------------- */
  await section('8. Téléphone : pas de défilement horizontal, grandes zones à toucher', async () => {
    const { ctx, p } = await nouvellePage({ viewport: { width: 320, height: 640 } });
    const long = 'Supercalifragilisticexpialidocious-sans-espace-du-tout-pour-voir-ce-qui-se-passe';
    await poserDonnees(p, { version: 1, budgetCentimes: 99999999, favoris: [{ id: 'f', nom: long.slice(0, 80), prixCentimes: 9999999 }],
      articles: [article(long.slice(0, 80), 9999, 9999999), article('Lait', 1.255, 115, true)] }, { theme: 'omni' });
    for (const vue of ['liste', 'favoris', 'reglages', 'apropos']) {
      await p.evaluate((v) => { location.hash = v === 'liste' ? '' : v; }, vue);
      await p.waitForTimeout(30);
      const largeur = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      verifier(largeur[0] <= largeur[1], 'Écran « ' + vue + ' » à 320 px de large : aucun défilement horizontal', largeur);
      const petits = await p.evaluate(() => [...document.querySelectorAll('button, a.bouton, .navigation a, .article-coche, .option, input[type="text"]')]
        .filter((el) => el.getClientRects().length && !el.closest('[hidden]'))
        .map((el) => { const r = el.getBoundingClientRect(); return { el: el.textContent.trim().slice(0, 30) || el.getAttribute('aria-label'), h: Math.round(r.height), w: Math.round(r.width) }; })
        .filter((t) => t.h < 44 || t.w < 44));
      verifier(petits.length === 0, 'Écran « ' + vue + ' » : toutes les zones à toucher font au moins 44 × 44 px', petits);
    }
    await p.evaluate(() => { location.hash = ''; });
    await p.click('[data-action="ajouter-article"]');
    const dialogue = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth, document.querySelector('#dialogue-article').scrollWidth <= document.querySelector('#dialogue-article').clientWidth]);
    verifier(dialogue[0] <= dialogue[1] && dialogue[2], 'Fenêtre d\'ajout à 320 px : rien ne dépasse', dialogue);
    await ctx.close();
  });

  /* ---------------------------------------------------------- */
  await section('9. Animations : « réduire les animations » respecté', async () => {
    const a = await nouvellePage({ reducedMotion: 'no-preference' });
    const normal = await a.p.$eval('.cb-barre-coche', (el) => getComputedStyle(el).transitionDuration);
    await a.ctx.close();
    const b = await nouvellePage({ reducedMotion: 'reduce' });
    const reduit = await b.p.$eval('.cb-barre-coche', (el) => getComputedStyle(el).transitionDuration);
    const animations = await b.p.evaluate(() => [...document.styleSheets].flatMap((s) => [...s.cssRules]).filter((r) => r.type === CSSRule.KEYFRAMES_RULE).length);
    await b.ctx.close();
    verifier(normal === '0.3s' && reduit === '0s', 'Transition douce de 0,3 s, supprimée avec « réduire les animations »', [normal, reduit]);
    verifier(animations === 0, 'Aucune animation (@keyframes) dans l\'application : pas de clignotement');
    const code = ['app.js', 'outils.js', 'stockage.js', 'sauvegarde.js'].map((f) => fs.readFileSync(path.join(RACINE, f), 'utf8')).join('\n');
    verifier(!/AudioContext|new Audio|vibrate|alert\(|confirm\(/.test(code), 'Aucun son, aucune vibration, aucune alerte système dans le code');
  });

  /* ---------------------------------------------------------- */
  await section('10. Installation (manifeste, icônes) et hors ligne', async () => {
    const { ctx, p } = await nouvellePage();
    const manifeste = await p.evaluate(() => fetch('./manifest.json').then((r) => r.json()));
    verifier(manifeste.id === '/omni-courses/' && manifeste.display === 'standalone' && manifeste.start_url && manifeste.short_name === 'Omni-Courses', 'Manifeste : nom, id, adresse de départ, affichage plein écran');
    for (const icone of manifeste.icons) {
      const taille = await p.evaluate((src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => ok('erreur'); i.src = src; }), icone.src);
      verifier(taille === icone.sizes, 'Icône ' + icone.src + ' (' + icone.purpose + ') : ' + taille);
    }
    verifier(manifeste.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'), 'Une icône « maskable » 512 px est présente');

    // Le service worker prend le contrôle, puis on coupe internet
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload();
    verifier(await p.evaluate(() => !!navigator.serviceWorker.controller), 'Service worker actif');
    const fichiersEnCache = await p.evaluate((nom) => caches.open(nom).then((c) => c.keys()).then((k) => k.length), CACHE_ACTUEL[1]);
    verifier(fichiersEnCache === 15, 'Les 15 fichiers de l\'application sont rangés dans le téléphone', fichiersEnCache);
    await poserDonnees(p, { version: 1, budgetCentimes: 2000, favoris: [], articles: [article('Lait', 1, 115)] }, { theme: 'omni' });

    await ctx.setOffline(true);
    verifier(await p.evaluate(() => navigator.onLine) === false, 'Internet coupé (vérifié)');
    await p.reload();
    verifier(await texte(p, 'h1') === 'Omni-Courses' && (await carte(p)).total === '1,15 €', 'Hors ligne : l\'application s\'ouvre avec ses données');
    await ajouterArticle(p, 'Pain', '1', '2,10');
    verifier((await carte(p)).total === '3,25 €', 'Hors ligne : ajout d\'un article et calcul du total');
    await p.evaluate(() => document.fonts.ready);
    const polices = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
    verifier(polices.includes('Oxanium') && polices.includes('Literata') && polices.includes('JetBrains Mono'), 'Hors ligne : polices du thème Omni chargées depuis le téléphone', polices);
    const p2 = await ctx.newPage();
    await p2.goto(ADRESSE + 'index.html?source=raccourci#favoris');
    verifier(await p2.$eval('#titre-favoris', (h) => !h.closest('[hidden]')), 'Hors ligne : ouverture par le raccourci « Favoris » (adresse avec « ? » et « # »)');
    await p2.click('[data-aller="reglages"]');
    const [dl] = await Promise.all([p2.waitForEvent('download'), p2.click('[data-action="exporter"]')]);
    verifier(JSON.parse(fs.readFileSync(await dl.path(), 'utf8')).donnees.articles.length === 2, 'Hors ligne : l\'export fonctionne');
    await ctx.close();
  });

  /* ---------------------------------------------------------- */
  await section('11. Mise à jour de l\'application sans perte de données', async () => {
    // Copie de l'application dans un dossier temporaire : on y simule une nouvelle version
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-courses-maj-'));
    for (const f of fs.readdirSync(RACINE)) {
      if (!f.startsWith('.') && f !== 'tests' && fs.statSync(path.join(RACINE, f)).isFile()) fs.copyFileSync(path.join(RACINE, f), path.join(dossier, f));
    }
    const serveur2 = await demarrerServeur(PORT + 1, dossier);
    const adresse2 = 'http://localhost:' + (PORT + 1) + '/omni-courses/';
    const { ctx, p } = await nouvellePage({ adresse: adresse2 });
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload();
    await p.evaluate(() => caches.open('autre-application-v1'));   // le cache d'une autre application du site
    await poserDonnees(p, { version: 1, budgetCentimes: 3000, favoris: [{ id: 'f', nom: 'Lait', prixCentimes: 115 }], articles: [article('Lait', 2, 115, true)] }, { theme: 'omni' });

    // Nouvelle version publiée
    const sw = path.join(dossier, 'sw.js');
    fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace("'" + CACHE_ACTUEL[1] + "'", "'" + CACHE_SUIVANT + "'"));
    const app = path.join(dossier, 'app.js');
    fs.writeFileSync(app, fs.readFileSync(app, 'utf8').replace("const VERSION = '" + VERSION_ACTUELLE + "'", "const VERSION = '" + VERSION_SUIVANTE + "'"));
    await p.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await p.waitForSelector('#bandeau-mise-a-jour:not([hidden])', { timeout: 10000 });
    verifier(true, 'Nouvelle version détectée : le bandeau « Mettre à jour » s\'affiche (rien ne change par surprise)');
    verifier((await texte(p, '#numero-version').catch(() => '')) === 'Version ' + VERSION_ACTUELLE, 'Tant qu\'on n\'a pas appuyé, l\'ancienne version reste');
    await Promise.all([p.waitForEvent('load'), p.click('[data-action="mettre-a-jour"]')]);
    await p.click('[data-aller="apropos"]');
    verifier(await texte(p, '#numero-version') === 'Version ' + VERSION_SUIVANTE, 'Après « Mettre à jour » : version ' + VERSION_SUIVANTE);
    await p.click('[data-aller="liste"]');
    const c = await carte(p);
    verifier(c.total === '2,30 €' && c.budget === '30,00 €' && c.coche === '2,30 €' && await p.evaluate(() => document.documentElement.dataset.theme) === 'omni',
      'Liste, budget, cochés et thème conservés après la mise à jour', c);
    const caches = await p.evaluate(() => caches.keys());
    verifier(caches.includes(CACHE_SUIVANT) && !caches.includes(CACHE_ACTUEL[1]) && caches.includes('autre-application-v1'),
      'Ancien cache supprimé, celui des autres applications du site laissé intact', caches);
    await ctx.close();
    serveur2.close();
    fs.rmSync(dossier, { recursive: true, force: true });
  });

  /* ---------------------------------------------------------- */
  await section('12. Confidentialité et erreurs', async () => {
    verifier(externes.length === 0, 'Aucune requête vers internet pendant tous les tests', externes.slice(0, 5));
    // Même si du code essayait d'envoyer quelque chose, la règle de sécurité de la page l'en empêche
    const { ctx, p } = await nouvellePage();
    const envoi = await p.evaluate(() => fetch('https://example.com/', { method: 'POST', body: 'test' }).then(() => 'envoyé', () => 'bloqué'));
    await ctx.close();
    erreursConsole.splice(0, erreursConsole.length, ...erreursConsole.filter((e) => !e.includes('example.com')));
    verifier(envoi === 'bloqué', 'Une tentative d\'envoi vers internet est bloquée par la règle de sécurité de la page');
    verifier(erreursConsole.length === 0, 'Aucune erreur JavaScript pendant tous les tests', erreursConsole.slice(0, 5));
  });

  await navigateur.close();
  serveur.close();

  console.log('\n────────────────────────────────────────');
  console.log('Vérifications réussies : ' + reussis);
  console.log('Échecs : ' + echecs.length);
  echecs.forEach((e) => console.log('  - ' + e));
  process.exit(echecs.length ? 1 : 0);
})();
