NextMed — istruzioni rapide per il deploy su Netlify

Opzioni rapide:

1) Drag & Drop (più semplice)
- Zippa la root del progetto (o trascina la cartella) e vai su https://app.netlify.com/drop
- Trascina la cartella del progetto e Netlify pubblicherà il sito statico.

2) Deploy da repository Git (consigliato per versioning)
- Crea un repository su GitHub e push del progetto.
- Collega il repository su Netlify (New site from Git) e scegli branch `main`.
- Netlify userà `netlify.toml` per le impostazioni di build (il progetto è statico, publish = ".").

3) Netlify CLI (per testing locale e deploy rapido)
- Installa il CLI:
  npm install -g netlify-cli
- Login:
  netlify login
- Per deploy rapido (produzione):
  netlify deploy --prod --dir=.
- Per deploy di prova (draft):
  netlify deploy --dir=.

Note:
- `netlify.toml` nel repo indica `publish = "."` perché il sito è già statico nella root.
- Se preferisci un dominio personalizzato, configuralo nella dashboard Netlify.
- Se usi funzioni serverless (cartella `netlify/functions`), Netlify le userà automaticamente.

Suggerimenti:
- Rimuovi file non necessari (.DS_Store, backup) prima del deploy per avere un pacchetto più piccolo.
- Se i file JSON vengono richiesti via fetch e vuoi evitare CORS, pubblicare su Netlify serve i file dallo stesso dominio.

Se vuoi, posso:
- Creare uno script `deploy.sh` che esegue il deploy con Netlify CLI.
- Eseguire io il deploy (se mi fornisci accesso Netlify o autorizzi il CLI sul tuo account).
