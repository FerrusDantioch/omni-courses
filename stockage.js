/* Omni-Courses — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-COURSES — stockage.js
   Tout ce qui est enregistré dans le téléphone (localStorage).
   Aucun compte, aucun serveur : rien ne quitte l'appareil.

   Pourquoi localStorage (et pas IndexedDB) ? Les données d'une liste
   de courses sont petites (quelques kilo-octets). localStorage est
   bien plus simple, se lit instantanément et suffit largement.

   ⚠️ Toutes les applications de ferrusdantioch.github.io partagent le
   même localStorage. Chaque clé commence donc par « omnicourses_ »
   pour ne jamais se mélanger avec celles des autres applications.

   Forme des données :
   donnees = {
     version: 1,
     articles: [{ id, nom, quantite, prixCentimes (ou null), coche }],
     budgetCentimes: nombre ou null (pas de budget),
     favoris: [{ id, nom, prixCentimes (ou null) }]
   }
   reglages = { theme: 'auto' | 'clair' | 'sombre' | 'omni' }
   ============================================================ */
'use strict';

const CLES = Object.freeze({
  donnees:  'omnicourses_donnees',
  reglages: 'omnicourses_reglages'
});

const THEMES = ['auto', 'clair', 'sombre', 'omni'];

/* Le numéro de format des données. Si un jour la forme change, on
   l'augmente et on ajoute une conversion dans Valider.donnees. */
const VERSION_DONNEES = 1;

function donneesVides() {
  return { version: VERSION_DONNEES, articles: [], budgetCentimes: null, favoris: [] };
}

function reglagesDefaut() {
  return { theme: 'auto' };
}


/* ---------- Vérifications ----------
   Chaque fonction rend null si tout va bien, ou une phrase qui explique
   le problème. Elles servent deux fois : au démarrage (pour ignorer une
   donnée abîmée) et à l'import d'une sauvegarde (pour la refuser avec
   un message clair). */

const Valider = {
  nom(nom) {
    if (typeof nom !== 'string' || nettoyerNom(nom) === '') return 'le nom est vide ou manquant';
    if (nom.length > LIMITES.nom) return 'le nom est trop long (' + LIMITES.nom + ' caractères au maximum)';
    return null;
  },

  prix(prix) {
    if (prix === null) return null;
    if (!Number.isInteger(prix) || prix < 0 || prix > LIMITES.prixMax) return 'le prix n\'est pas valide';
    return null;
  },

  article(a) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return 'ce n\'est pas un article';
    return this.nom(a.nom) ||
      (Quantite.valide(a.quantite) ? null : 'la quantité n\'est pas valide (nombre entre 0 et ' + LIMITES.quantiteMax + ')') ||
      this.prix(a.prixCentimes) ||
      (typeof a.coche === 'boolean' ? null : 'l\'indication «\u00a0coché\u00a0» n\'est pas valide');
  },

  favori(f) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) return 'ce n\'est pas un favori';
    return this.nom(f.nom) || this.prix(f.prixCentimes);
  },

  budget(b) {
    if (b === null) return null;
    if (!Number.isInteger(b) || b <= 0 || b > LIMITES.budgetMax) {
      return 'le budget doit être un montant en centimes, plus grand que zéro et au plus ' + Euros.formater(LIMITES.budgetMax);
    }
    return null;
  },

  theme(t) {
    return THEMES.includes(t) ? null : 'le thème «\u00a0' + String(t) + '\u00a0» n\'existe pas';
  },

  /* Vérifie un objet « donnees » complet.
     - strict = true (import) : la moindre erreur refuse tout, avec un
       message qui dit où est le problème.
     - strict = false (démarrage) : on garde tout ce qui est valide et on
       ignore le reste, pour ne jamais bloquer l'application.
     Rend { ok: true, donnees } ou { ok: false, message }. */
  donnees(d, strict) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      return strict ? { ok: false, message: 'Les données sont absentes.' } : { ok: true, donnees: donneesVides() };
    }
    const propre = donneesVides();

    // Articles
    if (!Array.isArray(d.articles)) {
      if (strict) return { ok: false, message: 'La liste des articles est absente.' };
    } else {
      if (strict && d.articles.length > LIMITES.articles) {
        return { ok: false, message: 'Trop d\'articles (' + LIMITES.articles + ' au maximum).' };
      }
      for (let i = 0; i < d.articles.length && propre.articles.length < LIMITES.articles; i++) {
        const a = d.articles[i];
        const erreur = this.article(a);
        if (erreur) {
          if (strict) return { ok: false, message: 'Article n°' + (i + 1) + ' : ' + erreur + '.' };
          continue;
        }
        propre.articles.push({
          // Un identifiant neuf à l'import : jamais de doublon possible
          id: (!strict && typeof a.id === 'string' && a.id) ? a.id : nouvelId(),
          nom: nettoyerNom(a.nom),
          quantite: a.quantite,
          prixCentimes: a.prixCentimes,
          coche: a.coche
        });
      }
    }

    // Budget (absent = pas de budget)
    const budget = d.budgetCentimes === undefined ? null : d.budgetCentimes;
    const erreurBudget = this.budget(budget);
    if (erreurBudget) {
      if (strict) return { ok: false, message: 'Budget : ' + erreurBudget + '.' };
    } else {
      propre.budgetCentimes = budget;
    }

    // Favoris (un seul favori par nom)
    if (!Array.isArray(d.favoris)) {
      if (strict) return { ok: false, message: 'La liste des favoris est absente.' };
    } else {
      if (strict && d.favoris.length > LIMITES.favoris) {
        return { ok: false, message: 'Trop de favoris (' + LIMITES.favoris + ' au maximum).' };
      }
      const dejaVus = new Set();
      for (let i = 0; i < d.favoris.length && propre.favoris.length < LIMITES.favoris; i++) {
        const f = d.favoris[i];
        const erreur = this.favori(f);
        if (erreur) {
          if (strict) return { ok: false, message: 'Favori n°' + (i + 1) + ' : ' + erreur + '.' };
          continue;
        }
        const cle = normaliserNom(f.nom);
        if (dejaVus.has(cle)) continue;
        dejaVus.add(cle);
        propre.favoris.push({
          id: (!strict && typeof f.id === 'string' && f.id) ? f.id : nouvelId(),
          nom: nettoyerNom(f.nom),
          prixCentimes: f.prixCentimes
        });
      }
    }

    return { ok: true, donnees: propre };
  }
};


/* ---------- Lire et écrire sans jamais planter ----------
   localStorage peut refuser (navigation privée, mémoire pleine) :
   l'application doit continuer de marcher quand même. */

const Stockage = {
  lire(cle) {
    try {
      const texte = localStorage.getItem(cle);
      return texte === null ? null : JSON.parse(texte);
    } catch (e) {
      return null;
    }
  },

  /* Rend true si c'est bien enregistré, false sinon */
  ecrire(cle, valeur) {
    try {
      localStorage.setItem(cle, JSON.stringify(valeur));
      return true;
    } catch (e) {
      return false;
    }
  },

  chargerDonnees() {
    return Valider.donnees(this.lire(CLES.donnees), false).donnees;
  },

  enregistrerDonnees(donnees) {
    return this.ecrire(CLES.donnees, donnees);
  },

  chargerReglages() {
    const r = this.lire(CLES.reglages) || {};
    const propre = reglagesDefaut();
    if (!Valider.theme(r.theme)) propre.theme = r.theme;
    return propre;
  },

  enregistrerReglages(reglages) {
    return this.ecrire(CLES.reglages, reglages);
  }
};
