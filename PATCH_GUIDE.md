# Guida patch a blocchi

Esempio di richiesta:
> Cambia il **timer** per mostrare anche i millesimi.

Io rispondo con:
```
/* [6.3] Timer */
function startTimer(seconds){
  // nuovo codice...
}
/* end [6.3] */
```
Tu sostituisci **dalla riga con** `/* [6.3] Timer */` **alla riga con** `/* end [6.3] */`.

## Indice rapido dei blocchi principali
- **index.html**
  - [1] Head & meta
  - [2] Liquid background
  - [3] Header
  - [4] Dock
  - [5.1] Allenamento
  - [5.2] Lezioni (materie)
  - [5.3] Lezioni (macro)
  - [5.4] Lezioni (micro)
  - [5.5] Lezione dettaglio
  - [5.6] Simulazioni (landing)
  - [5.7] Simulazione in corso
  - [5.8] Report
  - [5.9] Impostazioni
  - [6] Footer
  - [7] Script principali

- **assets/css/style.css**
  - [1] Variabili
  - [2] Liquid background
  - [3] Header
  - [4] Dock
  - [5] Layout + componenti
  - [6] Filtri
  - [7] Opzioni (card risposta)
  - [8] Liste lezioni
  - [9] Simulazione
  - [10] Animazioni

- **assets/js/app.js**
  - [1] Helpers, stato e impostazioni
  - [2] Dati demo
  - [3] Router e navigazione
  - [4] Allenamento
  - [5] Lezioni
  - [6] Simulazione
    - [6.1] UI tracker
    - [6.2] Pool domande
    - [6.3] Timer
    - [6.4] Punteggio
    - [6.5] Fine simulazione
    - [6.6] Rendering domanda
    - [6.7] Flusso simulazione
  - [7] Settings & Report
