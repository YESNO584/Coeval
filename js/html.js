// Fabrique d'éléments HTML.
//
// Cette fonction existait en trois exemplaires — app.js, detail.js, vues.js —
// plus une quatrième variante dans timeline.js. Trois copies d'une même règle
// finissent par diverger : celle qui décide comment un texte entre dans la
// page méritait d'être unique.
//
// Le texte passe par « textContent », jamais par « innerHTML ». Les noms
// affichés viennent de Wikidata, que n'importe qui peut modifier : un nom
// contenant du code s'exécuterait dans la page. La règle
// « no-inner-html-assignment » l'interdit ; cette fonction la rend facile à
// respecter.

export function creer(balise, classe, texte) {
  const element = document.createElement(balise);
  if (classe !== undefined) {
    element.className = classe;
  }
  if (texte !== undefined) {
    element.textContent = texte;
  }
  return element;
}
