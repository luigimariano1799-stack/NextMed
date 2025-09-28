# NextMed — build desktop (v1)

Questo pacchetto è pronto per essere **aperto direttamente** con `index.html` (nessun server richiesto).  
La logica è identica alla demo: allenamento, lezioni gerarchiche, simulazioni con timer e risultati.

## Struttura
```
NextMed/
  index.html
  assets/
    css/style.css
    js/app.js
  data/
    lessons.example.json
    questions.example.json
```

## Blocchi numerati (sistema di patch)
- Ogni file è suddiviso in **blocchi** con etichette tra parentesi: `[5.2]`, `[6.4]`, ecc.
- Quando vuoi una modifica, puoi dirmi: _«sostituisci il blocco **[6.3] Timer** in `app.js` con questo codice»_.
- Io ti rispondo con un blocco da incollare, e tu lo sostituisci **da tag a tag**.

Suggerimento: in editor (VS Code), usa `Cerca` → incolla `/* [6.3]` per saltare direttamente al blocco.

## Dati
Per evitare problemi da `file://`, i dati demo sono **inline** in `app.js`.  
Nella cartella `data/` trovi i JSON **solo come esempio** per future versioni con server locale.

## Suggerimenti per lo sviluppo
- Se vuoi caricare JSON reali, lancia un server statico (es. estensione **Live Server** di VS Code).
- Per debug su mobile, apri `index.html` in Safari (iOS) o Chrome (Android).

Buon lavoro! 💪

# NextMed — istruzioni rapide per Git / GitHub

Se non vedi il progetto in GitHub Desktop controlla se la cartella è un repository Git.

Terminale: verifica presenza .git
- macOS / Linux:
  ls -la .git
- Windows (PowerShell):
  Test-Path .git

Se .git non esiste -> inizializza e fai il primo commit:
- git init
- git add .
- git commit -m "Initial commit"
- git branch -M main

Config utente (se necessario):
- git config --global user.name "Tuo Nome"
- git config --global user.email "tuo@email"

Collega il repo remoto (crea prima il repo su github.com):
- git remote add origin git@github.com:TUO_UTENTE/NOME_REPO.git
  oppure (HTTPS)
- git remote add origin https://github.com/TUO_UTENTE/NOME_REPO.git

Pusha il ramo principale:
- git push -u origin main

Usare GitHub Desktop:
- File → Add Local Repository → seleziona la cartella NextMed (se .git esiste apparirà).
- Se non hai inizializzato: Repository → Create New Repository → scegli la cartella NextMed → Create.
- Dopo aver aggiunto/creato, usa "Publish repository" per caricare su GitHub (richiede login).

Problemi comuni:
- Permessi SSH: se usi URL ssh e il push fallisce, usa HTTPS o configura le chiavi SSH.
- Branch non visibile: assicurati di usare "main" o il nome del branch corrente.
- File non tracciati: `git status` mostra file non ancora aggiunti.

Se vuoi, passo successivo: posso generare la GitHub Action per deploy su Pages o guidarti passo-passo via terminale.

# NextMed — Collegare a GitHub e Netlify

Nota: non posso eseguire comandi sul tuo PC. Qui trovi script e istruzioni per automatizzare il collegamento.

Prerequisiti locali:
- git installato e configurato (git config --global user.name / user.email)
- GitHub CLI (gh) installata e autenticata (gh auth login)
- (opzionale per Netlify) netlify CLI installata e NETLIFY_AUTH_TOKEN impostato o eseguire netlify login

Passi rapidi (automatico):
1. Rendi eseguibile lo script:
   chmod +x scripts/auto-setup.sh

2. Esegui (crea repo GitHub e pusha):
   ./scripts/auto-setup.sh NOME_REPO public

3. Per collegare anche a Netlify (richiede netlify-cli e NETLIFY_AUTH_TOKEN opzionale):
   ./scripts/auto-setup.sh NOME_REPO public --netlify NOME_SITO

Cosa fa lo script:
- inizializza git se manca, crea primo commit
- crea il repository su GitHub (via gh) e imposta origin
- pusha il branch `main`
- opzionalmente prova a creare/collegare un sito Netlify (richiede netlify CLI e token per automazione)

Collegamento Netlify via interfaccia (alternativa)
- Vai su https://app.netlify.com -> New site -> Import from GitHub
- Seleziona il repository creato, configura il "build command" (nessuno per sito statico) e la "publish directory" -> `/`
- Dopo il collegamento Netlify farà deploy automatici ad ogni push su branch configurato.

Netlify config minimale (in repo):
- file `netlify.toml` presente per impostare publish dir e headers.

Se qualcosa fallisce copia l'output/errore qui e ti aiuto a risolvere.
