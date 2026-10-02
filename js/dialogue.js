// Une fenêtre qui pose une question et attend la réponse.
//
// Elle sert à deux endroits : à l'ouverture, pour proposer de reprendre le
// dernier fichier, et avant de changer de fichier quand du travail n'est pas
// enregistré. Un seul mécanisme pour les deux, parce que la règle est la
// même — on ne continue pas sans une réponse explicite.
//
// L'élément « dialog » du navigateur fait le travail : il bloque le reste de
// la page, place le focus dedans et se ferme à l'Échap. Le refaire à la main
// reviendrait à le refaire mal.

import { creer } from "./html.js";

// Rend la valeur du bouton cliqué. L'Échap et le clic en dehors rendent
// 'valeurParDefaut' — jamais rien d'irréversible.
export function demander({ titre, texte, choix, valeurParDefaut }) {
  const fenetre = document.createElement("dialog");
  fenetre.className = "dialogue";

  fenetre.append(creer("h2", "titre-dialogue", titre));
  for (const paragraphe of Array.isArray(texte) ? texte : [texte]) {
    fenetre.append(creer("p", "texte-dialogue", paragraphe));
  }

  const boutons = creer("div", "boutons-dialogue");
  let repondu = null;
  for (const option of choix) {
    const bouton = creer("button", option.classe || "bouton-discret", option.libelle);
    bouton.type = "button";
    bouton.addEventListener("click", () => {
      repondu = option.valeur;
      fenetre.close();
    });
    boutons.append(bouton);
  }
  fenetre.append(boutons);
  document.body.append(fenetre);

  return new Promise((resoudre) => {
    fenetre.addEventListener("close", () => {
      fenetre.remove();
      resoudre(repondu === null ? valeurParDefaut : repondu);
    });
    fenetre.showModal();
  });
}
