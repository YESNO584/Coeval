// Ce que la page dit quand elle n'a rien à montrer.
//
// Une frise vide sans explication ressemble à une panne. Le socle se
// fabrique sur plusieurs nuits : la plupart des périodes n'y sont pas encore,
// et c'est une information, pas un incident. Ces trois fonctions existent
// pour que ce soit dit, précisément, plutôt que passé sous silence.

import * as socle from "./socle.js";

export function decrireSiecle(debut) {
  const fin = debut + 99;
  return debut < 0 ? `${-fin}–${-debut} av. J.-C.` : `${debut}–${fin}`;
}

// Nomme ce qui manque, puis ce qui existe. L'ordre compte : on répond
// d'abord à « pourquoi c'est vide », ensuite à « que puis-je regarder ».
export function expliquerLeVide(nonCouvertes) {
  const resume = socle.resume();
  const disponibles = resume === null || resume.siecles.length === 0
    ? "aucun siècle n'est encore fabriqué"
    : `siècles disponibles : ${resume.siecles.map(decrireSiecle).join(", ")}`;
  const quoi = nonCouvertes.length > 0
    ? `${nonCouvertes.join(", ")} : pas encore dans le socle pour cette période.`
    : "Le socle ne contient rien pour ces filtres.";
  return `${quoi} ${disponibles}.`;
}

export async function accueillir(annoncer, zoneDensite) {
  annoncer("Lecture du socle…");
  await socle.ouvrir();
  const resume = socle.resume();
  if (resume === null) {
    annoncer("Aucun socle n'est encore publié. Il se fabrique chaque nuit.", true);
    return;
  }
  const periodes = resume.siecles.map(decrireSiecle);
  const reste = resume.casesAFaire > 0
    ? ` · ${resume.casesAFaire} cases restent à fabriquer`
    : "";
  zoneDensite.textContent =
    `Socle du ${resume.fabriqueLe} · ${resume.total} entrées`
    + ` · siècles disponibles : ${periodes.join(", ")}${reste}`;
  annoncer("Posez vos filtres, puis cliquez sur Charger.");
}
