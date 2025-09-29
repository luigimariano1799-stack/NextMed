# NextMed — istruzioni (italiano)

Questo progetto è una web app statica per esercitazioni e simulazioni per le Professioni Sanitarie.

Esecuzione locale (consigliata: server statico)

- Metodo rapido con Python 3 (funziona su macOS):

```bash
python3 -m http.server 8000
```

Apri poi `http://localhost:8000` nel browser.

- Se usi VS Code puoi installare l'estensione **Live Server** e avviare la cartella di lavoro.

Perché è consigliato un server

- Alcune funzionalità (caricamento dei file in `data/`) usano `fetch` e non funzionano correttamente aprendo `index.html` via `file://`.

Fallback per esecuzione via `file://`

- Il loader `assets/js/qdb.js` ora supporta due fallback:
  - un manifest remoto `data/manifest.json` (uso normale con server);
  - oppure dati embedded nella pagina: puoi inserire in `index.html` un oggetto `window.PS_PREP_EMBEDDED_MANIFEST` e `window.PS_PREP_EMBEDDED_DATA` per far partire l'app senza server.

Esempio minimo da inserire in `index.html` (prima dei script):

```html
<script>
  window.PS_PREP_EMBEDDED_MANIFEST = {
    materie: {
      "Biologia": []
    }
  };
  window.PS_PREP_EMBEDDED_DATA = {
    "Biologia": [
      {"id":"bio-1","materia":"Biologia","argomento":"Membrana","stem":"Qual è il principale componente della membrana?","options":[{"k":"A","t":"Lipidi","correct":true},{"k":"B","t":"Proteine"}],"solution":"La membrana è composta da un doppio strato fosfolipidico."}
    ]
  };
</script>
```

Se vuoi, posso aggiungere questo snippet direttamente in `index.html` (o generare un file `data/manifest.json` e alcuni `data/*.json`).

Miglioramenti possibili

- Spostare tutti i dati demo nei file `data/*.json` e tenere `app.js` solo come loader; aggiungere script di build per generare i manifest.
- Aggiungere validazione più stretta per i file importati nella banca domande.
- Fornire un piccolo script `npm`/`Makefile` per avviare e testare l'app.

Dimmi se vuoi che: 1) inserisca l'esempio embedded in `index.html`; 2) crei `data/manifest.json` + alcuni `data/*.json` di prova; o 3) aggiunga lo snippet e le istruzioni in italiano in `index.html` automaticamente.

---

Deploy su Netlify (fase 1: pubblico e gratuito)

1. Registra un account su https://www.netlify.com (gratuito per siti statici).
2. Crea un nuovo sito collegando il repository Git (GitHub/GitLab/Bitbucket) o caricando la cartella come zip.
3. Configura il deploy:
  - Build command: (lascia vuoto, app è statica)
  - Publish directory: `/` (root del progetto contenente `index.html`)
4. Avvia il deploy: Netlify pubblicherà il sito su un dominio `*.netlify.app` gratuito. In produzione il dominio ufficiale è `nextmed.studio` (collegato a Netlify).

Note tecniche:
- `data/manifest.json` e i file in `data/questions/` devono essere pubblicati così come sono; `qdb.js` farà fetch di questi file.
- Se preferisci non usare i file `data/` in questa fase, puoi lasciare lo snippet embed in `index.html` come fallback.

Roadmap per introdurre abbonamenti (fase 2)

Fase minima raccomandata per introdurre pagamenti a abbonamento:

1) Scegli provider di pagamenti: Stripe è la scelta più comune per le startup.
2) Crea un piano di prodotto: prezzi, periodo di prova, cosa sblocca (es. accesso a tutte le simulazioni, report storici estesi, banca domande premium).
3) Backend per gestione abbonamenti: puoi usare funzioni serverless su Netlify (cartella `netlify/functions/`) per comunicare con Stripe in modo sicuro.
  - Funzione 1: `create-checkout-session` (crea sessione Checkout con prezzo/sku)
  - Funzione 2: `webhook-stripe` (riceve gli eventi da Stripe e sblocca l'account)
4) Autenticazione utenti: per associare abbonamenti a utenti devi avere un sistema di utenti (minimo: email + token). Puoi partire con un sistema leggero basato su Netlify Identity o soluzioni esterne (Auth0, Clerk).
5) Proteggere risorse premium: lato frontend mostra/nascondi contenuti; lato server (funzioni) controlla l'accesso e risponde con dati premium solo se l'utente è abilitato.

Passi pratici che posso implementare ora
- Aggiungere i file `netlify.toml` e il minimal scaffolding per le funzioni (già creati in `netlify/functions/` come placeholder).
- Preparare uno script di deploy manuale e le istruzioni (git + push su GitHub → Netlify auto-deploy).
- Se vuoi, posso implementare le funzioni serverless complete per Stripe (richiede che tu fornisca le chiavi Stripe o le configuri tu dopo).

Se vuoi procedere ora, dimmi se preferisci:
- A: Caricare il progetto su GitHub (ti spiego i comandi git) e fare il collegamento a Netlify.
- B: Far generare a me i dati `data/*.json` (demo) e inserire `manifest.json` (già presente) così il sito è immediatamente completo per deploy.
- C: Implementare le funzioni Netlify + istruzioni per integrare Stripe (ti fornisco il codice, ma dovrai aggiungere le chiavi segrete su Netlify).

Indicami la scelta e procedo con gli step corrispondenti.
