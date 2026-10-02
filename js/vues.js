// Le passage entre la frise et le panneau de détail, et la règle qui
// l'encadre.
//
// **La règle : tant qu'une modification n'est pas enregistrée, on ne revient
// pas à la frise.** Deux issues seulement — enregistrer le fichier, ou
// abandonner ses modifications. C'est volontairement strict : un travail
// perdu parce qu'on a cliqué à côté est pire qu'un geste de plus.
//
// Ce que cette règle ne peut pas faire, et il faut le savoir : elle ne
// protège que l'intérieur de la page. Aucune page web ne peut empêcher de
// fermer un onglet. Le navigateur affichera son propre avertissement, que
// l'on peut ignorer.

import * as contributions from "./contributions.js";
import * as fichierDeTravail from "./fichier.js";
import { creer } from "./html.js";

export function installerAvertissementDeFermeture() {
  window.addEventListener("beforeunload", (evenement) => {
    if (contributions.nombre() > 0) {
      evenement.preventDefault();
      evenement.returnValue = "";
    }
  });
}

// Le bandeau qui barre le retour. Il ne se contente pas de refuser : il
// propose les deux seules issues, et dit combien de travail est en jeu.
//
// **Il ne se reconstruit pas à chaque modification**, et c'est tout sauf un
// détail de style. Il le faisait, et le bouton « Enregistrer » était alors
// inutilisable : cliquer dessus après avoir tapé dans un champ fait d'abord
// quitter ce champ, ce qui compte une modification, ce qui reconstruisait le
// bandeau — le bouton disparaissait sous le curseur entre l'appui et le
// relâchement, et le clic n'arrivait nulle part. Il fallait cliquer deux
// fois. Trouvé le 2026-10-02 par un essai en navigateur, invisible à la
// lecture du code.
export function barrerLeRetour(zone, surEnregistrer, surAbandonner) {
  const combien = contributions.nombre();
  if (combien === 0) {
    zone.replaceChildren();
    zone.hidden = true;
    return;
  }
  zone.hidden = false;

  const nom = fichierDeTravail.fichierChoisi();
  const ou = nom === null
    ? "Vous choisirez où l'enregistrer."
    : `Il sera écrit dans ${nom}.`;
  const pluriel = combien > 1 ? "s" : "";
  const message = `${combien} modification${pluriel} non enregistrée${pluriel}. ${ou}`;

  // Déjà en place : on ne change que le texte, et les boutons restent les
  // mêmes objets. C'est ce qui rend le clic possible.
  const existant = zone.querySelector(".message-retour");
  if (existant !== null) {
    existant.textContent = message;
    return;
  }
  zone.append(creer("p", "message-retour", message));

  const enregistrer = creer("button", "bouton-principal", "Enregistrer et revenir");
  enregistrer.type = "button";
  enregistrer.addEventListener("click", surEnregistrer);

  const abandonner = creer("button", "bouton-danger", "Abandonner mes modifications");
  abandonner.type = "button";
  abandonner.addEventListener("click", surAbandonner);

  const boutons = creer("div", "boutons-retour");
  boutons.append(enregistrer, abandonner);
  if (fichierDeTravail.reecritureDisponible() && nom !== null) {
    const ailleurs = creer("button", "bouton-discret", "Enregistrer ailleurs…");
    ailleurs.type = "button";
    ailleurs.addEventListener("click", () => surEnregistrer(true));
    boutons.append(ailleurs);
  }
  zone.append(boutons);
}
