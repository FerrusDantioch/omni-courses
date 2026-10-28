/* Omni-Courses — © 2026 Ferrus Dantioch
   Licence : Creative Commons BY-NC-ND 4.0 (texte complet dans le fichier LICENSE)
   https://creativecommons.org/licenses/by-nc-nd/4.0/ */

/* ============================================================
   OMNI-COURSES — sauvegarde.js
   Export (fichier .json téléchargé) et import (lecture et
   vérification d'un fichier choisi sur le téléphone).
   Rien ne passe par internet : le fichier est fabriqué et lu
   directement sur le téléphone.

   Forme du fichier :
   {
     "application": "Omni-Courses",
     "format": 1,
     "exporteLe": "2026-10-28T20:15:00.000Z",
     "versionApplication": "1.0.0",
     "donnees": { "articles": [...], "budgetCentimes": 5000, "favoris": [...] },
     "reglages": { "theme": "auto" }
   }
   Les prix et le budget sont en centimes (5000 = 50,00 €).
   ============================================================ */
'use strict';

const NOM_APPLICATION = 'Omni-Courses';
const FORMAT_SAUVEGARDE = 1;
const TAILLE_MAX_IMPORT = 2 * 1024 * 1024;   // 2 Mo : bien plus qu'une vraie sauvegarde

const Sauvegarde = {
  /* Fabrique le contenu du fichier à partir des données actuelles */
  construire(donnees, reglages, versionApplication) {
    return {
      application: NOM_APPLICATION,
      format: FORMAT_SAUVEGARDE,
      exporteLe: new Date().toISOString(),
      versionApplication,
      donnees: {
        // On ne garde que les champs utiles, dans un ordre lisible
        articles: donnees.articles.map((a) => ({
          nom: a.nom, quantite: a.quantite, prixCentimes: a.prixCentimes, coche: a.coche
        })),
        budgetCentimes: donnees.budgetCentimes,
        favoris: donnees.favoris.map((f) => ({ nom: f.nom, prixCentimes: f.prixCentimes }))
      },
      reglages: { theme: reglages.theme }
    };
  },

  /* « omni-courses-sauvegarde-2026-10-28.json » */
  nomFichier(date = new Date()) {
    return 'omni-courses-sauvegarde-' + dateDuJour(date) + '.json';
  },

  /* Lance le téléchargement du fichier. Sur Android, il arrive dans le
     dossier « Téléchargements » et Chrome affiche une notification. */
  telecharger(contenu, nomFichier) {
    const texte = JSON.stringify(contenu, null, 2);
    const blob = new Blob([texte], { type: 'application/json' });
    const adresse = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = adresse;
    lien.download = nomFichier;
    lien.hidden = true;
    document.body.append(lien);
    lien.click();
    lien.remove();
    // On libère la mémoire un peu plus tard (le téléchargement a démarré)
    setTimeout(() => URL.revokeObjectURL(adresse), 10000);
  },

  /* Lit un fichier choisi et vérifie tout.
     Rend une promesse de { ok: true, donnees, reglages, exporteLe }
     ou de { ok: false, message } avec un message clair en français. */
  lireFichier(fichier) {
    if (!fichier) return Promise.resolve({ ok: false, message: 'Aucun fichier choisi.' });
    if (fichier.size === 0) {
      return Promise.resolve({ ok: false, message: 'Ce fichier est vide : ce n\'est pas une sauvegarde d\'Omni-Courses.' });
    }
    if (fichier.size > TAILLE_MAX_IMPORT) {
      return Promise.resolve({ ok: false, message: 'Ce fichier est bien trop gros pour être une sauvegarde d\'Omni-Courses.' });
    }
    return fichier.text()
      .then((texte) => this.verifierTexte(texte))
      .catch(() => ({ ok: false, message: 'Impossible de lire ce fichier. Réessaie, ou choisis un autre fichier.' }));
  },

  /* Vérifie le texte d'une sauvegarde (séparé pour pouvoir le tester) */
  verifierTexte(texte) {
    let objet;
    try {
      objet = JSON.parse(String(texte).replace(/^﻿/, ''));
    } catch (e) {
      return { ok: false, message: 'Ce fichier est illisible : ce n\'est pas une sauvegarde au format JSON, ou il est abîmé.' };
    }
    return this.verifierObjet(objet);
  },

  verifierObjet(objet) {
    const refus = (message) => ({ ok: false, message });

    if (!objet || typeof objet !== 'object' || Array.isArray(objet) || objet.application !== NOM_APPLICATION) {
      return refus('Ce fichier n\'est pas une sauvegarde d\'Omni-Courses.');
    }
    if (!Number.isInteger(objet.format) || objet.format < 1) {
      return refus('Cette sauvegarde est abîmée : son numéro de format est manquant.');
    }
    if (objet.format > FORMAT_SAUVEGARDE) {
      return refus('Cette sauvegarde vient d\'une version plus récente d\'Omni-Courses. Mets l\'application à jour, puis réessaie.');
    }

    const resultat = Valider.donnees(objet.donnees, true);
    if (!resultat.ok) return refus('Cette sauvegarde contient une erreur. ' + resultat.message);

    // Réglages : facultatifs (sinon on garde le thème actuel)
    let reglages = null;
    if (objet.reglages !== undefined) {
      if (!objet.reglages || typeof objet.reglages !== 'object' || Array.isArray(objet.reglages)) {
        return refus('Cette sauvegarde contient une erreur. Les réglages ne sont pas valides.');
      }
      const erreurTheme = Valider.theme(objet.reglages.theme);
      if (erreurTheme) return refus('Cette sauvegarde contient une erreur. Réglages : ' + erreurTheme + '.');
      reglages = { theme: objet.reglages.theme };
    }

    const date = new Date(objet.exporteLe);
    return {
      ok: true,
      donnees: resultat.donnees,
      reglages,
      exporteLe: Number.isNaN(date.getTime()) ? null : date
    };
  }
};
