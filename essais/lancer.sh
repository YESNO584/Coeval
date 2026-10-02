#!/usr/bin/env bash
# Lance l'essai d'édition dans un vrai navigateur.
#
# Pourquoi un navigateur, et pas un test en Python : ce qui est vérifié ici
# — le repère de fichier qui survit au rechargement, la lecture et la
# réécriture du fichier, la fusion affichée sur la frise — n'existe que dans
# le navigateur. Deux défauts réels ont été trouvés par cet essai et par
# aucune relecture de code : un fichier qui n'en cumulait pas deux, et un
# bouton « Enregistrer » qui disparaissait sous le curseur.
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(dirname "$ICI")"
PORT="${PORT:-8732}"
SITE="$(mktemp -d)"

cp "$RACINE/index.html" "$SITE/"
cp -r "$RACINE/css" "$RACINE/js" "$SITE/"
mkdir -p "$SITE/data"
cp "$ICI/socle/"*.json "$SITE/data/"

python3 -m http.server "$PORT" --directory "$SITE" >/dev/null 2>&1 &
SERVEUR=$!
trap 'kill $SERVEUR 2>/dev/null || true' EXIT
sleep 2

NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}" \
  PORT="$PORT" node "$ICI/edition.js"
