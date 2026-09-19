#!/usr/bin/env python3
"""Accès à Wikidata pour la fabrique du socle.

Trois contraintes mesurées le 2026-09-18 commandent ce fichier :

- le service coupe à 60 secondes. Une fenêtre trop large échoue ; la même
  requête rend 400 lignes en 4,9 s sur vingt ans et met 19,6 s sur un siècle,
  après avoir échoué au premier essai ;
- deux requêtes simultanées suffisent à déclencher une limitation de débit.
  Ce module est volontairement séquentiel : aucun parallélisme, jamais ;
- une réponse est une piste, pas un fait. Toute erreur est remontée telle
  quelle, jamais avalée.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request

SERVICE = "https://query.wikidata.org/sparql"
IDENTIFICATION = "Coeval/0.1 (https://github.com/YESNO584/Coeval; fabrique du socle)"
DELAI_MAX_S = 70
# Au-delà, une fenêtre encore divisible est jugée trop large : couper coûte
# moins cher qu'attendre le refus du service.
DELAI_DECOUPE_S = 30
TENTATIVES = 3
ATTENTE_S = [15, 60]
# Une seconde entre deux requêtes suffit à se faire limiter sur une longue
# série : constaté le 2026-09-19 après une heure d'interrogations soutenues,
# le service renvoie 429 et ralentit même les requêtes triviales, qui passent
# de 0,8 s à 5 s. Le budget de Wikidata se compte en temps de calcul, pas en
# nombre d'appels : une requête lourde consomme autant que dix légères.
PAUSE_ENTRE_REQUETES_S = 2.0
# Après un 429, on attend franchement. Reprendre trop tôt prolonge la
# punition au lieu de l'abréger.
ATTENTE_APRES_429_S = 120

_derniere_requete = 0.0
_echeance = None


class ServiceIndisponible(RuntimeError):
    """Le service n'a pas répondu, ou a répondu une erreur."""


class TempsEcoule(ServiceIndisponible):
    """Le temps accordé à cette case est épuisé.

    Une case qui s'acharne prend la place de dix autres. Mesuré le
    2026-09-19 sur la première fabrique complète : huit cases seulement en
    deux heures, parce qu'une case en échec se redécoupe en vingt fenêtres
    de cinq ans, chacune réessayée. Mieux vaut l'abandonner et y revenir la
    nuit suivante — le cache garde tout le reste.
    """


def accorder(secondes):
    """Fixe le temps accordé à partir de maintenant. None lève la limite."""
    global _echeance
    _echeance = None if secondes is None else time.monotonic() + secondes


def _verifier_le_temps():
    if _echeance is not None and time.monotonic() > _echeance:
        raise TempsEcoule("temps accordé à cette case épuisé")


class DebitLimite(ServiceIndisponible):
    """Le service nous demande de ralentir (429). Ce n'est pas une panne, et
    surtout ce n'est pas un signe que la requête est trop large : la découper
    n'y changerait rien, il faut attendre."""


def _patienter():
    """Une seconde au moins entre deux requêtes. Ce n'est pas de la politesse
    décorative : le service limite le débit, et se faire bloquer coûte plus
    cher que d'attendre."""
    global _derniere_requete
    ecart = time.monotonic() - _derniere_requete
    if ecart < PAUSE_ENTRE_REQUETES_S:
        time.sleep(PAUSE_ENTRE_REQUETES_S - ecart)
    _derniere_requete = time.monotonic()


def _envoyer(requete, delai=None):
    _verifier_le_temps()
    _patienter()
    url = SERVICE + "?" + urllib.parse.urlencode({"query": requete})
    demande = urllib.request.Request(url, headers={
        "Accept": "application/sparql-results+json",
        "User-Agent": IDENTIFICATION,
    })
    try:
        with urllib.request.urlopen(demande, timeout=delai or DELAI_MAX_S) as reponse:
            return json.loads(reponse.read().decode("utf-8"))["results"]["bindings"]
    except urllib.error.HTTPError as erreur:
        if erreur.code == 429:
            attente = erreur.headers.get("Retry-After")
            raise DebitLimite(attente if attente else str(ATTENTE_APRES_429_S))
        raise


def interroger(requete, tentatives=TENTATIVES, delai=DELAI_MAX_S):
    """Envoie une requête, avec plusieurs tentatives espacées.

    « tentatives=1 » sert au découpage : une fenêtre trop large échoue de
    façon reproductible, et réessayer trois fois ne fait qu'attendre quatre
    minutes avant de couper. Les tentatives servent aux pannes passagères,
    pas à une requête trop grosse.
    """
    derniere = None
    for essai in range(tentatives):
        try:
            return _envoyer(requete, delai)
        except TempsEcoule:
            raise
        except DebitLimite as souci:
            # Le service demande d'attendre : on attend, et cette tentative
            # ne compte pas. Insister ferait durer la limitation.
            derniere = souci
            try:
                attente = int(str(souci))
            except ValueError:
                attente = ATTENTE_APRES_429_S
            time.sleep(min(max(attente, 30), 300))
        except Exception as souci:  # réseau, délai, JSON illisible
            derniere = souci
            if essai + 1 < tentatives:
                time.sleep(ATTENTE_S[min(essai, len(ATTENTE_S) - 1)])
    raise ServiceIndisponible(f"après {tentatives} tentative(s) : {derniere}")


def par_tranches(fabriquer, debut, fin, largeur_minimale=5):
    """Récupère une fenêtre en la coupant en deux tant que le service refuse.

    Une fenêtre large tient sur les périodes creuses et échoue sur les
    périodes denses. Plutôt que de choisir une largeur unique — trop petite
    partout, ou trop grande quelque part —, on part large et on coupe à
    l'échec. La fabrique s'adapte ainsi d'elle-même à la densité réelle.
    """
    dernier = fin - debut <= largeur_minimale
    try:
        # Tant qu'on peut encore couper : une seule tentative, et un délai
        # court. L'échec est alors une information — « trop large » — et non
        # une panne à retenter.
        if dernier:
            return interroger(fabriquer(debut, fin))
        return interroger(fabriquer(debut, fin), 1, DELAI_DECOUPE_S)
    except (DebitLimite, TempsEcoule):
        # Découper ne sert à rien quand c'est le débit qui est limité, ni
        # quand le temps est épuisé : on remonte pour que l'appelant
        # s'arrête proprement.
        raise
    except ServiceIndisponible:
        if dernier:
            raise
        milieu = debut + (fin - debut) // 2
        gauche = par_tranches(fabriquer, debut, milieu, largeur_minimale)
        droite = par_tranches(fabriquer, milieu, fin, largeur_minimale)
        return gauche + droite


def par_lots(fabriquer, identifiants, taille):
    """Interroge une liste fermée d'identifiants, lot par lot.

    Mesuré : demander la notoriété ou le pays dans la requête principale
    coûte 66 s et 13,2 s ; sur une liste fermée, 0,76 s et 1,1 s.
    """
    lignes = []
    for depart in range(0, len(identifiants), taille):
        lot = identifiants[depart:depart + taille]
        lignes.extend(interroger(fabriquer(lot)))
    return lignes
