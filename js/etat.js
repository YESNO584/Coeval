// Le cadre d'état : ce que la page dit pendant qu'elle travaille, et quand
// quelque chose ne va pas.
//
// **Il ne s'affiche que quand il a quelque chose d'utile à dire** : une
// attente en cours, ou un problème. Le reste — « 5 entrées entre -63 et 80 »,
// « posez vos filtres », « reparti de zéro » — est du bruit, que la frise et
// le repère de fichier montrent déjà. Un cadre toujours présent finit par ne
// plus être lu, y compris le jour où il porte une vraie alerte.
//
// L'attente, elle, se voit : une roue qui tourne à côté du texte de l'étape.
// Une page immobile pendant vingt secondes ressemble à une panne.

import { creer } from "./html.js";

let zone = null;

export function installer(element) {
  zone = element;
}

export function annoncer(texte, enPanne, occupe) {
  zone.replaceChildren();
  const aMontrer = occupe === true || enPanne === true;
  zone.hidden = !aMontrer;
  if (!aMontrer) {
    return;
  }
  if (occupe === true) {
    zone.append(creer("span", "roue"));
  }
  zone.append(creer("span", "texte-etat", texte));
  zone.dataset.panne = enPanne === true ? "oui" : "non";
  zone.dataset.occupe = occupe === true ? "oui" : "non";
}

// L'attente est finie. Le dernier message d'étape a été écrit pendant que la
// roue tournait : il part avec elle. Seule une alerte reste à l'écran — c'est
// la seule chose qu'il reste à lire une fois le chargement terminé.
export function finDAttente() {
  zone.dataset.occupe = "non";
  if (zone.dataset.panne === "oui") {
    const roue = zone.querySelector(".roue");
    if (roue !== null) {
      roue.remove();
    }
    return;
  }
  zone.replaceChildren();
  zone.hidden = true;
}
