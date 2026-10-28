/* Omni-Courses — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-COURSES — outils.js
   Petits outils utilisés partout : lire et afficher des euros,
   des quantités, calculer les totaux et l'état du budget.

   ⚠️ Les prix sont TOUJOURS gardés en centimes (nombres entiers) :
   2,49 € est enregistré 249. Pourquoi ? Les ordinateurs calculent mal
   avec les virgules (0,1 + 0,2 donne 0,30000000000000004). Avec des
   centimes entiers, les totaux sont toujours justes.
   ============================================================ */
'use strict';

/* Raccourcis pour trouver des éléments de la page */
const $ = (selecteur, racine = document) => racine.querySelector(selecteur);
const $$ = (selecteur, racine = document) => Array.from(racine.querySelectorAll(selecteur));

/* Limites, pour garder des données raisonnables */
const LIMITES = Object.freeze({
  nom: 80,                  // caractères pour un nom d'article
  articles: 500,            // articles dans la liste
  favoris: 300,             // favoris
  prixMax: 9999999,         // 99 999,99 € pour un prix unitaire
  budgetMax: 99999999,      // 999 999,99 € pour le budget
  quantiteMax: 9999
});


/* ---------- 1. Les euros ---------- */

const Euros = {
  // Le format français : « 1 234,50 € » (virgule, espace avant €)
  format: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }),

  /* 249 → « 2,49 € » */
  formater(centimes) {
    return this.format.format((centimes || 0) / 100);
  },

  /* 249 → « 2,49 » (pour pré-remplir un champ de saisie) */
  versChamp(centimes) {
    if (centimes === null || centimes === undefined) return '';
    const euros = Math.floor(centimes / 100);
    const cts = String(centimes % 100).padStart(2, '0');
    return euros + ',' + cts;
  },

  /* Lit ce que la personne a tapé : « 2,49 », « 2.49 », « 2,5 € »…
     Rend { ok: true, valeur: centimes } ou { ok: false, message }.
     Un champ vide donne valeur: null (« pas de prix »). */
  lire(texte, max = LIMITES.prixMax) {
    const t = String(texte || '')
      .replace(/[\s  ]/g, '')   // espaces, même insécables
      .replace(/€/g, '');
    if (t === '') return { ok: true, valeur: null };
    if (t.startsWith('-')) return { ok: false, message: 'Le montant ne peut pas être négatif.' };
    if (/^\d+[.,]\d{3,}$/.test(t)) {
      return { ok: false, message: 'Deux chiffres après la virgule au maximum (exemple : 2,49).' };
    }
    if (!/^\d+([.,]\d{0,2})?$/.test(t) && !/^[.,]\d{1,2}$/.test(t)) {
      return { ok: false, message: 'Écris un montant en euros, par exemple 2,49.' };
    }
    const [entier, decimales = ''] = t.split(/[.,]/);
    const centimes = (parseInt(entier || '0', 10) * 100) + parseInt((decimales + '00').slice(0, 2), 10);
    if (centimes > max) {
      return { ok: false, message: 'Montant trop grand (' + this.formater(max) + ' au maximum).' };
    }
    return { ok: true, valeur: centimes };
  }
};


/* ---------- 2. Les quantités ----------
   Une quantité peut avoir des décimales (1,5 kg de pommes). */

const Quantite = {
  format: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }),

  /* 1.5 → « 1,5 » */
  formater(q) {
    return this.format.format(q);
  },

  /* Lit la quantité tapée. Rend { ok, valeur } ou { ok: false, message }. */
  lire(texte) {
    const t = String(texte || '').replace(/[\s  ]/g, '');
    if (t === '') return { ok: false, message: 'Indique une quantité (par exemple 1).' };
    if (!/^\d+([.,]\d{1,3})?$/.test(t)) {
      return { ok: false, message: 'Écris un nombre, par exemple 2 ou 1,5.' };
    }
    const valeur = Number(t.replace(',', '.'));
    if (valeur <= 0) return { ok: false, message: 'La quantité doit être plus grande que zéro.' };
    if (valeur > LIMITES.quantiteMax) {
      return { ok: false, message: 'Quantité trop grande (' + LIMITES.quantiteMax + ' au maximum).' };
    }
    return { ok: true, valeur };
  },

  /* Vrai si q est une quantité acceptable (utilisé pour vérifier les
     données enregistrées et les sauvegardes importées). */
  valide(q) {
    return typeof q === 'number' && Number.isFinite(q) && q > 0 && q <= LIMITES.quantiteMax &&
      Math.abs(Math.round(q * 1000) - q * 1000) < 1e-6;
  }
};


/* ---------- 3. Les calculs ---------- */

const Calculs = {
  /* Prix d'une ligne : prix unitaire × quantité, arrondi au centime.
     Un article sans prix compte pour 0. */
  totalLigne(article) {
    if (article.prixCentimes === null) return 0;
    return Math.round(article.prixCentimes * article.quantite);
  },

  /* Les trois totaux demandés :
     - total : toute la liste
     - coche : articles cochés (déjà dans le panier)
     - reste : ce qu'il reste à acheter */
  totaux(articles) {
    let total = 0, coche = 0, sansPrix = 0, nbCoches = 0;
    for (const a of articles) {
      const ligne = this.totalLigne(a);
      total += ligne;
      if (a.coche) { coche += ligne; nbCoches++; }
      if (a.prixCentimes === null) sansPrix++;
    }
    return { total, coche, reste: total - coche, sansPrix, nbCoches, nb: articles.length };
  },

  /* L'état du budget, comparé au TOTAL de la liste :
     - « ok »        : moins de 80 % du budget
     - « attention » : de 80 % à 100 % (budget atteint compris)
     - « depasse »   : plus de 100 %
     Les comparaisons se font en nombres entiers (total × 10 et
     budget × 8) : aucune erreur d'arrondi possible.
     Rend null quand aucun budget n'est défini. */
  etatBudget(total, budget) {
    if (budget === null || budget === undefined) return null;
    let etat = 'ok';
    if (total > budget) etat = 'depasse';
    else if (total * 10 >= budget * 8) etat = 'attention';
    return {
      etat,
      pourcentage: Math.floor((total * 100) / budget),
      ecart: budget - total        // positif : il reste ; négatif : dépassement
    };
  }
};


/* ---------- 4. Divers ---------- */

/* Pour comparer deux noms sans tenir compte des majuscules, des accents
   ni des espaces en trop : « Pâtes  » et « pates » sont le même article. */
function normaliserNom(nom) {
  return String(nom || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/* Nettoie un nom tapé : espaces en trop retirés, longueur limitée */
function nettoyerNom(nom) {
  return String(nom || '').replace(/\s+/g, ' ').trim().slice(0, LIMITES.nom);
}

/* Un identifiant unique pour chaque article et chaque favori */
function nouvelId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* La date du jour au format AAAA-MM-JJ (heure du téléphone) */
function dateDuJour(d = new Date()) {
  const deux = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate());
}

/* « 3 articles », « 1 article » */
function pluriel(n, singulier, plurielTexte) {
  return n + ' ' + (n > 1 ? (plurielTexte || singulier + 's') : singulier);
}

/* Fabrique un élément de page : creer('p', { class: 'x' }, 'texte')
   Le texte est toujours inséré comme du texte (jamais comme du code) :
   un nom d'article bizarre ne peut rien casser. */
function creer(balise, attributs = {}, ...enfants) {
  const el = document.createElement(balise);
  for (const [cle, valeur] of Object.entries(attributs)) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    el.setAttribute(cle, valeur === true ? '' : valeur);
  }
  for (const enfant of enfants) {
    if (enfant === null || enfant === undefined) continue;
    el.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
  return el;
}

/* Une petite icône du réservoir (voir le début d'index.html) */
function icone(nom) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'icone');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', '#' + nom);
  svg.append(use);
  return svg;
}
