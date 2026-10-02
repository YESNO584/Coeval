# Le fichier de contributions

Contrat entre la page qui produit les corrections et le script qui les
intègre. **C'est la seule chose que les deux côtés doivent connaître.**

Figé en premier, et volontairement : tant qu'il bouge, ni la page ni le script
ne peuvent être écrits.

## Un fichier contient des changements, jamais une copie de la base

Si quelqu'un renvoyait la base entière modifiée, la fusion serait impossible :
sa copie est périmée dès la nuit suivante, et il faudrait comparer des
milliers de lignes pour retrouver les trois qu'il a touchées.

Le fichier est donc **une liste d'opérations**, dans l'ordre où elles ont été
faites.

**Et pas une copie de l'entité modifiée**, même réduite à l'entité touchée.
La raison tient en un exemple. Vous corrigez le nom de Laplace et enregistrez
l'entité entière. La nuit suivante, la fabrique corrige sa date de mort —
Wikidata en porte deux, à un jour près, et l'arbitrage a changé. Votre fichier
arrive une semaine plus tard : il contient votre nom corrigé **et l'ancienne
date de mort**, celle que vous aviez sous les yeux.

Rien, dans ce fichier, ne dit que vous vouliez changer l'un et pas l'autre.
Dans une copie d'entité, **chaque champ non modifié devient une affirmation
implicite « cette valeur est juste »** — que personne n'a prononcée. Avec une
liste de changements, un champ absent ne dit rien, et c'est exactement ce
qu'il faut.

## La forme

```json
{
  "format": "coeval-contributions",
  "version": 2,
  "editeur": "Coeval 0.1",
  "socle": { "fabriqueLe": "2026-09-20" },
  "operations": [
    {
      "numero": 1,
      "faitLe": "2026-10-02T05:12:33.000Z",
      "operation": "modification",
      "cible": { "type": "personne", "id": "Q9312" },
      "champs": {
        "nom": { "avant": "Emmanuel Kant", "apres": "Immanuel Kant" },
        "debut": { "avant": "1724", "apres": "1725" }
      },
      "pourquoi": "graphie allemande, celle de sa signature"
    }
  ]
}
```

### Une opération par entité, pas une par champ

Corriger quatre champs d'une personne donne **une** opération qui liste les
quatre, et non quatre opérations qui répètent la même cible.

Les retouches successives d'un même champ se rejoignent dans la même entrée :
on garde le `avant` de la **première** — la valeur du socle qu'on avait sous
les yeux — et le `apres` de la **dernière**. Reprendre le `avant` d'une
deuxième retouche reviendrait à comparer notre propre correction au socle, et
le contrôle de conflit ne vérifierait plus rien.

### La version 1 reste lisible

Elle écrivait une opération par champ, avec `champ`, `avant` et `apres` à la
racine. Le script de fusion et la page lisent les deux formes : un fichier
enregistré avant le 2026-10-02 porte du travail que personne ne refera.

```json
{ "operation": "modification", "cible": { "type": "personne", "id": "Q9312" },
  "champ": "nom", "avant": "Emmanuel Kant", "apres": "Immanuel Kant" }
```

### Les champs de l'en-tête

| Champ | À quoi il sert |
|---|---|
| `format` | Reconnaître le fichier. Toujours `coeval-contributions`. |
| `version` | **Le numéro de version de l'éditeur.** Sans lui, vous recevrez un jour un fichier d'une vieille version sans comprendre pourquoi la fusion échoue. Le script refuse — ou signale — ce qu'il ne sait pas lire. |
| `socle.fabriqueLe` | Sur quel socle la personne travaillait. Sert à comprendre un conflit. |

### Les trois opérations

| `operation` | Ce qu'elle dit | Ce qu'elle porte |
|---|---|---|
| `modification` | Ces champs doivent changer | `champs`, chacun avec `avant` (la valeur vue) et `apres` (la valeur proposée) |
| `ajout` | Cette entrée n'existe pas | `champs`, chacun avec `apres` seulement — il n'y a pas de valeur antérieure |
| `suppression` | Cette entrée ne devrait pas être là | `avant` à la racine : le nom de l'entrée. Pas de `champs` : c'est l'entrée entière qui est en cause |

### `avant` est le champ qui fait tout

Il porte **la valeur que le contributeur avait sous les yeux**. Sans lui, on ne
peut pas savoir si la correction vise une valeur toujours d'actualité ou une
valeur déjà remplacée par une nuit de fabrique.

C'est le seul moyen de détecter un conflit, et c'est pour cela qu'il est
obligatoire sur toute `modification`.

### Créer une entrée qui n'existe pas encore

Un contributeur ne peut pas inventer un identifiant Wikidata. Il utilise un
**identifiant provisoire** : `tmp-1`, `tmp-2`, numérotés dans le fichier.

```json
{
  "numero": 4,
  "operation": "ajout",
  "cible": { "type": "personne", "id": "tmp-1" },
  "champs": {
    "nom": { "apres": "Jeanne Dupont" },
    "debut": { "apres": "1881" }
  },
  "pourquoi": "aïeule, absente de Wikidata"
}
```

Tous les champs d'une entrée nouvelle tiennent dans la même opération.
**Le script de fusion remplace `tmp-1` par un identifiant définitif** au
moment de l'intégration.

### Les champs modifiables

| `champ` | Contenu attendu |
|---|---|
| `nom` | texte |
| `debut` / `fin` | une année entière, signe moins pour « avant J.-C. » |
| `detail` | texte — la fonction d'un souverain, la classe d'un événement |
| `pays` | liste de textes |
| `description` | texte libre, sans longueur imposée |

`notoriete` et `sourceUrl` ne sont pas modifiables : ils viennent de la source
et n'ont pas de sens hors d'elle.

## Ce que le script de fusion garantit

**Il ne modifie jamais rien tout seul.** Il lit, vérifie, et produit un
rapport : ce qu'il accepterait, ce qu'il refuse, et pourquoi. La décision
reste humaine.

Il refuse une opération quand :

- le format ou la version lui sont inconnus ;
- l'identifiant visé n'existe pas dans le socle (sauf `tmp-`) ;
- une année sort des bornes, ou n'est pas un nombre entier ;
- un texte dépasse une longueur raisonnable, ou contient des balises ;
- une `modification` n'a pas de `avant` sur l'un de ses champs ;
- l'opération ne porte aucun champ : elle ne dit rien ;
- la valeur `avant` ne correspond plus à ce que le socle contient — c'est un
  **conflit**, signalé comme tel et non écarté en silence. Le conflit nomme
  **chaque** champ dépassé : une opération peut en corriger quatre dont un
  seul est périmé.

**Le fichier vient de l'extérieur : il ne se croit jamais sur parole.** Le
socle alimente un site public ; une contribution mal intentionnée pourrait y
faire entrer n'importe quoi.

## Ce que devient une contribution acceptée

Elle n'écrase rien. **Elle devient une source**, au sens du modèle de données
(`.claude/plan/modele-donnees.md`, règle R3) : la valeur de Wikidata et la
valeur humaine cohabitent, et la correction humaine l'emporte à l'affichage.

C'est ce qui lui permet de survivre à la reconstruction de la nuit suivante.
Une correction qui modifierait directement une ligne importée disparaîtrait au
prochain passage, sans que personne s'en aperçoive.
