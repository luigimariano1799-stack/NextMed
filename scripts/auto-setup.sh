#!/usr/bin/env bash
# Usage: ./scripts/auto-setup.sh REPO_NAME [public|private] [--netlify SITE_NAME]
# Example: ./scripts/auto-setup.sh NextMed public --netlify nextmed-site

set -e

REPO_NAME="$1"
VISIBILITY="${2:-public}"
NETLIFY_FLAG=""
NETLIFY_SITE=""

# parse optional args
shift 2 || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --netlify) NETLIFY_FLAG=1; NETLIFY_SITE="$2"; shift 2;;
    *) echo "Arg non riconosciuto: $1"; shift;;
  esac
done

if [ -z "$REPO_NAME" ]; then
  echo "Usage: $0 REPO_NAME [public|private] [--netlify SITE_NAME]"
  exit 1
fi

BASEDIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BASEDIR"

if ! command -v gh >/dev/null 2>&1; then
  echo "Errore: gh CLI non trovato. Installa e autentica: https://cli.github.com/"
  exit 2
fi

echo "Controllo git locale..."
if [ ! -d ".git" ]; then
  echo "Inizializzo repository git locale..."
  git init
  git add .
  git commit -m "Initial commit"
else
  echo "Repository git locale già presente."
fi

git branch -M main || true

# Create remote repo (non-interactive)
echo "Creo o uso repository remoto su GitHub: $REPO_NAME ($VISIBILITY)"
if gh repo view "$REPO_NAME" >/dev/null 2>&1; then
  echo "Repository remoto esistente. Imposto remote origin se assente."
  if ! git remote get-url origin >/dev/null 2>&1; then
    REMOTE_URL=$(gh repo view "$REPO_NAME" --json sshUrl --jq .sshUrl)
    git remote add origin "$REMOTE_URL"
  fi
else
  gh repo create "$REPO_NAME" --"$VISIBILITY" --source=. --remote=origin --push --confirm
fi

echo "Pusho main su origin..."
git push -u origin main

# Optional Netlify linkage
if [ -n "$NETLIFY_FLAG" ]; then
  if ! command -v netlify >/dev/null 2>&1; then
    echo "netlify CLI non trovato. Per collegare a Netlify installa: npm i -g netlify-cli"
    echo "Puoi anche collegare il sito via UI su app.netlify.com"
    exit 0
  fi

  echo "Collegamento Netlify richiesto (site name: ${NETLIFY_SITE:-<auto>})..."
  # If NETLIFY_AUTH_TOKEN is present, try non-interactive site creation
  if [ -n "$NETLIFY_AUTH_TOKEN" ] && [ -n "$NETLIFY_SITE" ]; then
    echo "Usando NETLIFY_AUTH_TOKEN e nome sito per creare site non-interattivamente..."
    SITE_JSON=$(NETLIFY_AUTH_TOKEN="$NETLIFY_AUTH_TOKEN" netlify sites:create --name "$NETLIFY_SITE" --json --dir="." 2>/dev/null || true)
    if [ -n "$SITE_JSON" ]; then
      SITE_ID=$(echo "$SITE_JSON" | awk -F'"id":"|","' '{print $2}')
      echo "Sito creato: id=$SITE_ID"
      netlify link --id "$SITE_ID" || true
      echo "Trigger deploy iniziale (prod)..."
      netlify deploy --dir="." --prod || true
    else
      echo "Creazione sito automatica fallita; tenta 'netlify init' o crea il sito via app.netlify.com manualmente."
    fi
  else
    echo "Per automazione Netlify imposta NETLIFY_AUTH_TOKEN e fornisci --netlify SITE_NAME."
    echo "In alternativa esegui 'netlify init' o collega il repo da app.netlify.com -> New site -> Import from GitHub."
    echo "Esempio manuale:"
    echo "  netlify init    # interattivo"
    echo "  netlify deploy --dir=. --prod   # deploy dopo link"
  fi
fi

echo "Operazione completata. Controlla il repository remoto su GitHub e, se richiesto, la dashboard Netlify."
