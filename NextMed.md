# NextMed

Sito statico single-page per esercitazioni e simulazioni (apri `index.html` o servi staticamente).

Collegare il progetto a GitHub (comandi minimi):

1. Inizializza il repo locale (nella cartella NextMed):
   git init
   git add .
   git commit -m "Initial commit"

2. Crea il repository su GitHub (via web) e poi collega il remote (esempio):
   git remote add origin git@github.com:TUO_UTENTE/NomeRepo.git

3. Pusha il branch principale:
   git branch -M main
   git push -u origin main

4. Il workflow GitHub Actions incluso pubblicherà automaticamente una branch `gh-pages`
   con i file della root ad ogni push su `main` (se abilitato).

Abilitare GitHub Pages (opzionale):
- Vai su Settings -> Pages e scegli la branch `gh-pages` come sorgente (o lascia che GitHub lo gestisca automaticamente dopo il primo deploy).

Note:
- Nessuna build necessaria: il sito è statico.
- Se preferisci non usare Pages automatico, puoi semplicemente usare la branch `main` e servire i file.
