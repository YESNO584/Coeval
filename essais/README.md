# Les essais en navigateur

Ce que ce dossier contient ne se teste pas autrement. Le repère de fichier
qui survit au rechargement, la lecture et la réécriture du fichier de
contributions, la fusion affichée sur la frise : tout cela n'existe que dans
un navigateur, et une relecture de code ne le montre pas.

```
./essais/lancer.sh
```

Le script sert une copie du site avec le petit socle de `essais/socle/`,
puis pilote Chromium. Il n'appelle jamais Wikidata.

## Ce que l'essai vérifie, et pourquoi chaque point est là

| Vérification | Le défaut qu'elle a trouvé |
|---|---|
| Deux enregistrements de suite cumulent dans le même fichier | Le fichier n'en gardait qu'un : le registre était vidé après chaque enregistrement. Un essai qui n'enregistre qu'une fois ne pouvait pas le voir. |
| Le bouton « Enregistrer » répond au premier clic | Il ne répondait qu'au second : quitter le champ comptait une modification, ce qui reconstruisait le bandeau, et le bouton disparaissait entre l'appui et le relâchement. |
| La fenêtre d'accueil propose le dernier fichier | — |
| La correction est visible sur la frise après reprise | — |
| Changer de fichier avec du travail en cours demande confirmation | — |
| « Repartir de zéro » laisse le fichier intact sur le disque | — |

## Le sélecteur de fichiers

Il ne se pilote pas depuis un test : c'est une fenêtre du système. L'essai le
remplace par un vrai `FileSystemFileHandle` pris dans le magasin privé du
navigateur. Tout le reste — IndexedDB, la survie au rechargement, la lecture,
l'écriture — reste la mécanique réelle de Chromium.

Ce qui n'est donc **pas** couvert : la fenêtre du système elle-même, et la
demande d'autorisation que Chrome affiche à la réouverture d'un fichier
désigné à la main. Les deux se vérifient à la main.
