/* =============================================================
  APP.JS — versione completa (sostituisci il file intero)
  Blocchi:
  [1] Helpers, stato e impostazioni
  [2] Dati DEMO (lezioni/quiz)
  [3] Router e navigazione
  [4] Allenamento (3 modalità, timer circolare, picker iOS, errori)
  [5] Lezioni (3 livelli + pagina contenuto)
  [6] Simulazione (pool per materia, timer, risultati, errori)
  [7] Settings & Report
============================================================= */

/* [1] Helpers, stato e impostazioni */
const $  = (q)=>document.querySelector(q);
const $$ = (q)=>Array.from(document.querySelectorAll(q));
const shuffle = (arr)=>arr.map(v=>({v,r:Math.random()})).sort((a,b)=>a.r-b.r).map(o=>o.v);

function setActive(id){
  $$(".panel").forEach(p=>p.classList.remove("active"));
  const pane=$("#"+id); if(pane){ pane.classList.add("active"); }
  $$("#dock a").forEach(a=>a.classList.toggle("active", a.dataset.tab===id));
}

/* Global confirm modal helper — usa il modal inserito in index.html */
function showConfirmModal(opts){
  // opts: { title, message, okText, cancelText }
  return new Promise(resolve=>{
    try{
      const modal = document.getElementById('confirmModal');
      if(!modal) return resolve(window.confirm(opts.message)); // fallback
      modal.setAttribute('aria-hidden','false'); modal.style.display='flex';
      const t = modal.querySelector('#confirmTitle'); const m = modal.querySelector('#confirmMessage');
      const ok = modal.querySelector('#confirmOk'); const cancel = modal.querySelector('#confirmCancel');
      t.textContent = opts.title||'Conferma'; m.textContent = opts.message||'';
      ok.textContent = opts.okText||'Conferma'; cancel.textContent = opts.cancelText||'Annulla';
      const cleanup = (val)=>{
        modal.setAttribute('aria-hidden','true'); modal.style.display='none';
        ok.removeEventListener('click', onOk); cancel.removeEventListener('click', onCancel);
        modal.querySelector('.backdrop')?.removeEventListener('click', onCancel);
        resolve(val);
      };
      const onOk = ()=>cleanup(true);
      const onCancel = ()=>cleanup(false);
      ok.addEventListener('click', onOk); cancel.addEventListener('click', onCancel);
      modal.querySelector('.backdrop')?.addEventListener('click', onCancel);
    }catch(e){ console.warn('showConfirmModal fallback to native confirm', e); resolve(window.confirm(opts.message)); }
  });
}

// Cloud adapter (Netlify Functions + Identity). Elimina il salvataggio locale.
const CLOUD = {
  doc: { settings:{}, reports:[], errors:{} },
  loaded: false,
  async token(){
    try{ const u = window.netlifyIdentity && window.netlifyIdentity.currentUser(); return u ? await u.jwt() : null; }catch(_){ return null; }
  },
  isLoggedIn(){ return !!(window.netlifyIdentity && window.netlifyIdentity.currentUser()); },
  async load(){
    // Se non loggato, mantieni doc vuoto in memoria
    if(!this.isLoggedIn()){ this.loaded=true; return this.doc; }
    const t = await this.token();
    try{
      const r = await fetch('/.netlify/functions/user-data', { headers: t? { Authorization: 'Bearer '+t } : {} });
      if(r.ok){ this.doc = await r.json(); this.loaded = true; return this.doc; }
    }catch(_){/* ignore */}
    this.loaded = true; return this.doc;
  },
  async save(partial){
    // Merge in memoria
    if(partial && typeof partial === 'object'){
      if('settings' in partial) this.doc.settings = partial.settings || {};
      if('reports' in partial) this.doc.reports = Array.isArray(partial.reports) ? partial.reports : [];
      if('errors' in partial) this.doc.errors = partial.errors || {};
    }
    if(!this.isLoggedIn()) return { ok:true, offline:true };
    const t = await this.token();
    const r = await fetch('/.netlify/functions/user-data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(t? { Authorization: 'Bearer '+t } : {}) },
      body: JSON.stringify(partial||{})
    });
    return { ok: r.ok };
  },
  async clearAll(){
    this.doc = { settings:{}, reports:[], errors:{} };
    if(!this.isLoggedIn()) return { ok:true, offline:true };
    const t = await this.token();
    const r = await fetch('/.netlify/functions/user-data', { method: 'DELETE', headers: t? { Authorization: 'Bearer '+t } : {} });
    return { ok: r.ok };
  }
};

function getSettings(){
  const def={duration:100,right:1.5,wrong:0.4, theme:'dark', sounds:1, autoAdvance:0, warnTimer:5, profile:{}};
  try{ return { ...def, ...(CLOUD.doc.settings||{}) }; }catch(_){ return def; }
}
function saveSettingsObj(o){ CLOUD.save({ settings: o }); }

function getReports(){ return Array.isArray(CLOUD.doc.reports) ? CLOUD.doc.reports : []; }
function saveReport(entry){
  const arr = getReports().slice();
  arr.unshift({ ...entry, ts: Date.now() });
  CLOUD.save({ reports: arr.slice(0,250) });
}

/* Archivio errori (per materia) */
function getErrorsMap(){ try{return CLOUD.doc.errors || {}; }catch(_){ return {}; } }
function setErrorsMap(map){ CLOUD.save({ errors: map||{} }); }
function storeError(materia, qid){
  const map = getErrorsMap(); if(!map[materia]) map[materia]=[];
  if(!map[materia].includes(qid)) map[materia].unshift(qid);
  map[materia]=map[materia].slice(0,1000); setErrorsMap(map);
}
function clearErrorsMateria(m){ const map=getErrorsMap(); delete map[m]; setErrorsMap(map); }

/* end [1] */


/* [2] Dati DEMO (minimi per girare anche da file://) */
let LESSONS = [
  { materia:"Logica e Problem Solving", macro:"Proporzioni", micro:"Proporzioni veloci",
    html:`<p>Proporzione: <code>a:b = c:d</code>. Quarto proporzionale: <code>d=(b·c)/a</code>.</p>
    <p><b>Esempio:</b> 3 quaderni = 6€. Con 10€ → 5 quaderni.</p>`},
  { materia:"Comprensione e Cultura", macro:"Inferenze", micro:"Inferenze nel testo",
    html:`<p>L'inferenza è una conclusione <i>non esplicita</i> ma supportata dal testo. Diffida di assoluti (sempre/mai).</p>`},
  { materia:"Biologia", macro:"Membrana", micro:"Trasporto di membrana",
    html:`<h3>Struttura</h3><p>Membrana = <b>doppio strato fosfolipidico</b> + proteine. Fluida e selettiva.</p>
    <h3>Trasporti</h3><ul>
      <li>Diffusione semplice (O₂, CO₂);</li>
      <li>Diffusione facilitata (canali/carrier, es. glucosio);</li>
      <li>Osmosi (acqua verso ipertonica);</li>
      <li>Attivo (contro gradiente con ATP, es. pompa Na⁺/K⁺).</li>
    </ul>
    <h4>Esempio</h4><p>Eritrocita in ipotonica → entra acqua → lisi.</p>`},
  { materia:"Biologia", macro:"Genetica", micro:"Mendel e leggi di base",
    html:`<p><b>I legge</b>: segregazione. <b>II legge</b>: assortimento indipendente.</p>
    <p><b>Esempio:</b> Aa × aa → 50% Aa (dominante), 50% aa (recessivo).</p>`},
  { materia:"Chimica", macro:"Acido–base", micro:"Henderson–Hasselbalch",
    html:`<p>pH = pKa + log([A−]/[HA]). Se [A−]=[HA] ⇒ pH=pKa.</p>`},
  { materia:"Matematica", macro:"Equazioni", micro:"Lineari in un'incognita",
    html:`<p><code>ax+b=c</code> ⇒ <code>x=(c-b)/a</code>.</p>`},
  { materia:"Fisica", macro:"Ottica", micro:"Lenti sottili",
    html:`<p>Equazione: <code>1/f = 1/p + 1/q</code>.</p>`}
];

/* Lessons loader: prefer data/lessons.json, fallback to embedded example or demo LESSONS */
let LESSONS_DATA = LESSONS.slice();
async function loadLessons(){
  try{
    const r = await fetch('data/lessons.json');
    if(r.ok){ const json = await r.json(); if(Array.isArray(json) && json.length) { LESSONS_DATA = json; return; } }
  }catch(e){}
  try{
    const r2 = await fetch('data/lessons.example.json');
    if(r2.ok){ const j2 = await r2.json(); if(Array.isArray(j2) && j2.length){ LESSONS_DATA = j2; return; } }
  }catch(e){}
  // else keep embedded LESSONS
}

/* Order of subjects per ministerial decree (display/order) */
const MINISTERIAL_ORDER = [
  'Comprensione e Cultura',
  'Logica e Problem Solving',
  'Biologia',
  'Chimica',
  'Matematica',
  'Fisica'
];

/* QUESTIONS rimossi: si usano i file /data */
/* end [2] */


/* [3] Router e navigazione */
function handleHash(){
  const h=(location.hash||"#home").slice(1);
  const parts=h.split("/");
  if(parts[0]==="lezioni" && parts[1]==="materia" && parts[2]){ showMateria(decodeURIComponent(parts[2])); }
  else if(parts[0]==="lezioni" && parts[1]==="argomento" && parts[2] && parts[3]){ showArgomento(decodeURIComponent(parts[2]), decodeURIComponent(parts[3])); }
  else if(parts[0]==="lezione" && parts[1] && parts[2] && parts[3]){ showLezione(decodeURIComponent(parts[1]), decodeURIComponent(parts[2]), decodeURIComponent(parts[3])); }
  else if(parts[0]==="report" && parts[1]==="simulazioni") { setActive('report'); renderReportList('Simulazione'); }
  else if(parts[0]==="report" && parts[1]==="esercitazioni") { setActive('report'); renderReportList('Esercitazione'); }
  else { setActive(parts[0]||"home"); if(parts[0]==="report") renderReport(); if(parts[0]==="settings") loadSettingsUI(); if(parts[0]==="account") renderAccount(); }

  // Mostra la lista completa dei report con filtri
  function renderReportList(tipo){
  const arr = getReports();
    const el = $("#reportArea");
    const reports = tipo === 'Simulazione' ? arr.filter(r => r.mode === 'Simulazione') : arr.filter(r => r.mode !== 'Simulazione');

        // Filtri (Materia / Argomento) dedicati all'area report
        let filterHtml = `
          <div style="margin-bottom:16px;display:flex;gap:16px;flex-wrap:wrap;">
            <label>Materia <select id="repMateria" class="styled-select"></select></label>
            <label>Argomento <select id="repArgomento" class="styled-select"></select></label>
          </div>`;
    el.innerHTML = filterHtml + `<div id="reportListArea"></div>`;

    // Popola materie
    (async () => {
      const mats = [...new Set(reports.map(r => r.materia).filter(Boolean))];
      const msel = $("#repMateria");
      msel.innerHTML = `<option value="">Tutte</option>` + mats.map(m => `<option value="${m}">${m}</option>`).join("");
      msel.addEventListener("change", async () => {
        const mat = msel.value;
        const args = [...new Set(reports.filter(r => !mat || r.materia === mat).map(r => r.argomento).filter(Boolean))];
        const argSel = $("#repArgomento");
        argSel.innerHTML = `<option value="">Tutti</option>` + args.map(a => `<option>${a}</option>`).join("");
        render();
      });
      // Popola argomenti iniziali
      msel.dispatchEvent(new Event("change"));
    })();

    $("#repArgomento").addEventListener("change", render);

    function render() {
  const mat = $("#repMateria")?.value || "";
  const arg = $("#repArgomento")?.value || "";
      const filtered = reports.filter(r => (!mat || r.materia === mat) && (!arg || r.argomento === arg));
      $("#reportListArea").innerHTML = filtered.length
        ? filtered.map(r => {
            const date = new Date(r.ts).toLocaleString();
            const tipoR = r.mode === 'Esercitazione' ? (r.argomento ? 'Per argomento' : 'Per materia') : r.mode || '';
            const argR = r.argomento ? `<div class=\"kpi\">Argomento: ${r.argomento}</div>` : '';
            return `<div class=\"kpis fade-in\">\n            <div class=\"kpi\"><b>${r.mode}</b></div>\n            <div class=\"kpi\">Materia: ${r.materia || '-'} </div>\n            <div class=\"kpi\">Tipo: ${tipoR}</div>\n            ${argR}\n            <div class=\"kpi\">${r.overall?.correct || 0}/${r.overall?.total || 0} corrette</div>\n            <div class=\"kpi\">Errate: ${r.overall?.wrong || 0} • Bianche: ${r.overall?.blank || 0}</div>\n            <div class=\"kpi small\">${date}</div>\n          </div>`;
          }).join("")
        : `<div class=\"muted\">Nessun report trovato.</div>`;
    }
  }
}
window.addEventListener("hashchange", handleHash);
window.addEventListener("load", ()=>{ initFilters(); renderMaterie(); /* settings/UI aggiornati dopo CLOUD.load() */ handleHash(); });
// Ensure lessons and cloud are loaded before initial render
window.addEventListener("load", async ()=>{ await loadLessons(); await CLOUD.load(); renderMaterie(); initFilters(); loadSettingsUI(); applyTheme(); handleHash(); });

// --- Home page render ---
function renderHome(){
  const el = document.getElementById('home'); if(!el) return;
  // Mostra statistiche rapide: numero di domande per materia e ultimo report
  Promise.resolve().then(async ()=>{
    const mats = await qdb.getAllMaterie();
    const counts = {};
    for(const m of mats){ const pool = await qdb.getMateria(m); counts[m]= (pool||[]).length; }
    const stats = Object.keys(counts).map(m=>`${m}: ${counts[m]} domande`).join(' • ');
  const reports = getReports();
    const last = reports[0] ? `${reports[0].mode} — ${reports[0].overall.correct}/${reports[0].overall.total} corrette` : 'Nessun report disponibile';
    const node = document.getElementById('homeQuickStats'); if(node) node.innerHTML = `<div>${stats}</div><div style="margin-top:6px;">Ultimo risultato: ${last}</div>`;
  });
}

// bind per i bottoni presenti nella Home
document.addEventListener('click', (e)=>{
  const t = e.target;
  if(!t) return;
  if(t.id==='goToAllenamento'){ location.hash='allenamento'; }
  else if(t.id==='goToSimulazioni'){ location.hash='simulazioni'; }
  else if(t.id==='goToLezioni'){ location.hash='lezioni'; }
  else if(t.id==='backToHomeFromPractice' || t.id==='backToHomeFromSim' || t.id==='backToHomeFromLesson'){ location.hash='home'; }
});

// Intercetta click sul logo o bottoni di ritorno durante sessione attiva e chiede conferma con modal
document.addEventListener('click', (e)=>{
  const el = e.target.closest && e.target.closest('.logo, #backToTraining, #backToHomeFromPractice, #backToHomeFromSim, #backToHomeFromLesson');
  if(!el) return;
  // se non c'è una sessione attiva (allenamento non-chiuso o simulazione con timer), lascia procedere
  const practiceActive = (PRACTICE && !PRACTICE._closed);
  const simActive = (typeof SIM !== 'undefined' && SIM) && (typeof TIMER !== 'undefined' && TIMER);
  if(!practiceActive && !simActive) return;
  // prevenire comportamento di default
  e.preventDefault(); e.stopPropagation();
  // mostra il modal
  (async ()=>{
  const isSim = !!SIM;
  const ok = await showConfirmModal({ title: isSim ? "Termina simulazione" : "Termina allenamento", message: isSim ? "C'è una simulazione in corso. Vuoi terminarla e tornare alla Home?" : "Sei in una esercitazione. Vuoi terminarla e tornare alla Home?", okText: 'Termina', cancelText: 'Continua' });
    if(!ok) return; // l'utente continua
    // chiudi sessione attiva
    if(P_TIMER) { clearInterval(P_TIMER); P_TIMER=null; }
    if(TIMER) { clearInterval(TIMER); TIMER=null; }
    if(PRACTICE) { PRACTICE._closed = true; }
    if(SIM) { /* SIM state will be considered finished by finishSim */ }
    if(isSim) finishSim(); else finishPractice(false);
    // naviga a home
    location.hash='home'; setActive('home');
  })();
});
/* end [3] */


/* [4] Allenamento — pagina dedicata + timer affidabile + picker iOS */
let PRACTICE = null, P_TIMER = null, P_TIMELEFT = 0;

/* util: select */
function fillMateriaSelect(el){
  // Support both native <select> elements and custom <div class="custom-select"> components.
  const mats = [...new Set(LESSONS_DATA.map(l=>l.materia))];
  // sort according to ministerial order, then alphabetically
  mats.sort((a,b)=>{ const ia=MINISTERIAL_ORDER.indexOf(a), ib=MINISTERIAL_ORDER.indexOf(b); if(ia!==-1||ib!==-1){ return (ia===-1?99:ia) - (ib===-1?99:ib); } return a.localeCompare(b); });

  if(!el) return;
  // Native select
  if(el.tagName && el.tagName.toLowerCase()==='select'){
    el.innerHTML="";
    mats.forEach(m=>{
      const o=document.createElement("option"); o.value=m; o.textContent=m; el.appendChild(o);
    });
    return;
  }

  // Custom select (div.custom-select)
  if(el.classList && el.classList.contains('custom-select')){
    // build markup: selected label + options container
    el.innerHTML = '';
    el.tabIndex = 0;
    el.setAttribute('role','combobox');
    el.setAttribute('aria-expanded','false');
    const label = document.createElement('div'); label.className = 'cs-selected'; label.tabIndex = 0;
    const opts = document.createElement('div'); opts.className = 'cs-options'; opts.setAttribute('role','listbox'); opts.style.display = 'none';
    // Populate options
    mats.forEach(m=>{
      const d = document.createElement('div'); d.className = 'cs-option'; d.tabIndex = 0; d.dataset.value = m; d.textContent = m;
      opts.appendChild(d);
    });
    el.appendChild(label); el.appendChild(opts);

    // helper to set value
    const setValue = (v)=>{
      const opt = Array.from(opts.children).find(ch=>ch.dataset.value===v);
      if(opt){
        label.textContent = opt.textContent;
        el.value = v; // expose property for existing code
        el.dataset.value = v;
        el.setAttribute('aria-expanded','false');
        opts.style.display = 'none';
        // mark selected
        Array.from(opts.children).forEach(ch=>ch.classList.toggle('selected', ch===opt));
        el.dispatchEvent(new Event('change'));
      }
    };

    // default to first
    if(mats.length>0){ setValue(mats[0]); }

    // open/close
    const toggle = ()=>{
      const open = el.getAttribute('aria-expanded')==='true';
      el.setAttribute('aria-expanded', String(!open));
      opts.style.display = open ? 'none' : 'block';
    };

    label.addEventListener('click', (e)=>{ e.stopPropagation(); toggle(); });
    // click option
    opts.addEventListener('click', (e)=>{ const t = e.target.closest('.cs-option'); if(!t) return; setValue(t.dataset.value); });

    // keyboard support: Enter toggles, arrows navigate, Enter on option selects
    el.addEventListener('keydown', (e)=>{
      const open = el.getAttribute('aria-expanded')==='true';
      if(e.key==='Enter'){ e.preventDefault(); if(open){ const focused = document.activeElement; if(focused && focused.classList && focused.classList.contains('cs-option')){ setValue(focused.dataset.value); } else { toggle(); } } else { toggle(); } }
      else if(e.key==='ArrowDown' || e.key==='ArrowUp'){
        e.preventDefault(); const items = Array.from(opts.children); if(items.length===0) return;
        let idx = items.findIndex(it=>it.classList.contains('focus'));
        if(idx===-1) idx = items.findIndex(it=>it.classList.contains('selected'));
        if(e.key==='ArrowDown') idx = Math.min(items.length-1, (idx===-1?0:idx+1));
        else idx = Math.max(0, (idx===-1?items.length-1:idx-1));
        items.forEach(it=>it.classList.remove('focus'));
        const target = items[idx]; if(target){ target.classList.add('focus'); target.focus(); }
        if(el.getAttribute('aria-expanded')!=='true'){ el.setAttribute('aria-expanded','true'); opts.style.display='block'; }
      }
      else if(e.key==='Escape'){ el.setAttribute('aria-expanded','false'); opts.style.display='none'; }
    });
  }
}
function fillArgomentoSelect(materia, el){
  const args = [...new Set(LESSONS_DATA.filter(l=>l.materia===materia).map(l=>l.macro))];
  if(!el) return;
  // Native select
  if(el.tagName && el.tagName.toLowerCase()==='select'){
    el.innerHTML = '';
    args.forEach(a=>{ const o=document.createElement('option'); o.value=a; o.textContent=a; el.appendChild(o); });
    return;
  }

  // Custom select
  if(el.classList && el.classList.contains('custom-select')){
    // ensure structure
    if(!el.querySelector('.cs-selected')){
      el.innerHTML=''; el.tabIndex=0; el.setAttribute('role','combobox'); el.setAttribute('aria-expanded','false');
      const l = document.createElement('div'); l.className='cs-selected'; l.tabIndex=0;
      const ocont = document.createElement('div'); ocont.className='cs-options'; ocont.style.display='none';
      el.appendChild(l); el.appendChild(ocont);
    }
    const ocont = el.querySelector('.cs-options'); ocont.innerHTML='';
    args.forEach(a=>{ const d=document.createElement('div'); d.className='cs-option'; d.tabIndex=0; d.dataset.value=a; d.textContent=a; ocont.appendChild(d); });

    // select default (first)
    if(args.length>0){ const first = ocont.querySelector('.cs-option'); if(first){ el.querySelector('.cs-selected').textContent = first.textContent; el.value = first.dataset.value; el.dataset.value = first.dataset.value; el.dispatchEvent(new Event('change')); } }

    // click handler (attach once)
    if(!ocont.dataset.handlerAttached){
      ocont.addEventListener('click', (e)=>{ const t = e.target.closest('.cs-option'); if(!t) return; const parent = el; parent.querySelector('.cs-selected').textContent = t.textContent; parent.value = t.dataset.value; parent.dataset.value = t.dataset.value; parent.setAttribute('aria-expanded','false'); ocont.style.display='none'; parent.dispatchEvent(new Event('change')); });
      ocont.dataset.handlerAttached = '1';
    }
    return;
  }
}

/* inizializza il pannello allenamento */
function initFilters(){
  // Initialize materia selects (native <select> or custom divs)
  const quick = $("#quickMateria"); const topic = $("#topicMateria"); const errors = $("#errorsMateria");
  fillMateriaSelect(quick);
  fillMateriaSelect(topic);
  fillMateriaSelect(errors);
  // populate argomento based on topicMateria value
  const topicVal = (topic && topic.value) ? topic.value : (topic && topic.dataset && topic.dataset.value ? topic.dataset.value : '');
  fillArgomentoSelect(topicVal, $("#topicArgomento"));
  // listen for changes on topicMateria (works for native select and custom-select since we dispatch change)
  if(topic) topic.addEventListener("change", ()=>{
    const v = topic.value || topic.dataset.value || '';
    fillArgomentoSelect(v, $("#topicArgomento"));
  });
}

/* popup iOS */
function openNumberPicker(options){
  return new Promise(resolve=>{
    const opts = Object.assign({ title:"Seleziona", min:1, max:100, step:1, value:10, unit:"" }, options||{});
    const wrap = document.createElement("div");
    wrap.className = "modal show";
    wrap.innerHTML = `
      <div class="backdrop"></div>
      <div class="sheet">
        <div class="title">${opts.title}: <span id="npVal">${opts.value}</span> ${opts.unit}</div>
        <div class="row">
          <button class="step" id="npMinus">−</button>
          <input id="npRange" type="range" min="${opts.min}" max="${opts.max}" step="${opts.step}" value="${opts.value}">
          <button class="step" id="npPlus">+</button>
        </div>
        <div class="actions">
          <button class="btn" id="npCancel" type="button">Annulla</button>
          <button class="btn primary" id="npOk" type="button">Conferma</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const range=$("#npRange"), val=$("#npVal");
    const setVal = (v)=>{ v=Math.max(opts.min,Math.min(opts.max,v)); range.value=v; val.textContent=v; };
    $("#npMinus").addEventListener("click", ()=>setVal(parseInt(range.value,10)-opts.step));
    $("#npPlus").addEventListener("click", ()=>setVal(parseInt(range.value,10)+opts.step));
    range.addEventListener("input", ()=>setVal(parseInt(range.value,10)));
    const close=()=>wrap.remove();
    $("#npCancel").addEventListener("click", async ()=>{ close(); resolve(null); });
    $("#npOk").addEventListener("click", async ()=>{ const v=parseInt(range.value,10); close(); resolve(v); });
    $(".modal .backdrop").addEventListener("click", async ()=>{ close(); resolve(null); });
  });
}

/* timer circolare affidabile: chiude sempre allo 0 */
function startPracticeTimer(mins){
  if(P_TIMER) clearInterval(P_TIMER);
  P_TIMER=null;

  const widget = $("#pTimerWidget");
  const text   = $("#pTimerText");
  const arc    = $("#pTimerProgress");

  const m = typeof mins === "string" ? parseFloat(mins.replace(",", ".")) : mins;
  if(!m || m <= 0){ widget.style.display = "none"; return; }
  widget.style.display = "flex";

  const R=44, CIRC=2*Math.PI*R;
  arc.style.strokeDasharray = String(CIRC);

  const total = Math.max(1, Math.round(m*60));
  P_TIMELEFT = total;

  if(!PRACTICE) PRACTICE = {};
  PRACTICE._closed = false;

  const fmt = (s)=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const shutdown = ()=>{
    if(PRACTICE?._closed) return;
    PRACTICE._closed = true;
    if(P_TIMER) clearInterval(P_TIMER);
    P_TIMER=null;
    finishPractice(true);
  };

  const tick = ()=>{
    text.textContent = fmt(P_TIMELEFT);
    const ratio = Math.max(0,P_TIMELEFT)/total;
    arc.style.strokeDashoffset = String(CIRC*(1-ratio));
    widget.classList.toggle("low", P_TIMELEFT<=60);

    if(P_TIMELEFT<=0){ shutdown(); return; }
    P_TIMELEFT--;
  };

  tick();
  P_TIMER = setInterval(tick, 1000);
}

/* rendering delle opzioni (senza lettere A,B,...) */
function renderOptions(q){
  return shuffle(q.options.map(o=>({...o})))
    .map(o=>`<div class="opt" data-key="${o.k}" data-correct="${o.correct===true}">${o.t}</div>`).join("");
}

/* stato selezioni per i picker */
let quickCount = 12, quickMinutes = 20, topicCount = 12;
$("#quickCountBtn")?.addEventListener("click", async ()=>{
  const v = await openNumberPicker({ title:"Numero di quesiti", min:5, max:50, step:1, value:quickCount });
  if(v){ quickCount=v; $("#quickCountBtn").dataset.value=v; $("#quickCountBtn").textContent=v; }
});
$("#quickMinutesBtn")?.addEventListener("click", async ()=>{
  const v = await openNumberPicker({ title:"Durata", min:5, max:200, step:5, value:quickMinutes, unit:"minuti" });
  if(v){ quickMinutes=v; $("#quickMinutesBtn").dataset.value=v; $("#quickMinutesBtn").textContent=v; }
});
$("#topicCountBtn")?.addEventListener("click", async ()=>{
  const v = await openNumberPicker({ title:"Numero di quesiti", min:5, max:50, step:1, value:topicCount });
  if(v){ topicCount=v; $("#topicCountBtn").dataset.value=v; $("#topicCountBtn").textContent=v; }
});

/* area pratica */
function getPracticeArea(){ return $("#pRunArea"); }

/* avvio modalità */
$("#startQuick")?.addEventListener("click", async ()=>{
  const materia=$("#quickMateria").value;
  const pool = await qdb.getMateria(materia);
  if(!pool || pool.length===0){ alert('Nessuna domanda caricata per questa materia. Aggiungile in /data/questions e aggiorna data/manifest.json'); return; }
  const items=shuffle(pool).slice(0, Math.min(quickCount, pool.length));
  PRACTICE={mode:"rapida", items, idx:0, correct:0, wrong:0, blank:0, materia, argomento:null, _closed:false};
  location.hash="practice-run"; setActive("practice-run");
  $("#pMode").textContent="Rapida"; $("#pMateria").textContent=materia;
  getPracticeArea().innerHTML=""; startPracticeTimer(quickMinutes); nextPractice(); if(!document.getElementById("pToggleSol")){ const b=document.createElement("button"); b.id="pToggleSol"; b.className="btn"; b.style.marginLeft="8px"; b.textContent="Mostra soluzione"; b.addEventListener("click", practiceToggleSolution); document.querySelector("#pControls")?.appendChild(b);}
});

$("#startByTopic")?.addEventListener("click", async ()=>{
  const materia=$("#topicMateria").value, arg=$("#topicArgomento").value;
  const pool = (await qdb.getMateria(materia)).filter(q=>q.argomento===arg || q.argomento?.startsWith(arg));
  const items=shuffle(pool).slice(0, Math.min(topicCount, pool.length));
  PRACTICE={mode:"argomento", items, idx:0, correct:0, wrong:0, blank:0, materia, argomento:arg, _closed:false};
  location.hash="practice-run"; setActive("practice-run");
  $("#pMode").textContent="Per argomento"; $("#pMateria").textContent=`${materia} • ${arg}`;
  getPracticeArea().innerHTML=""; startPracticeTimer(0); nextPractice(); // senza timer
});

$("#startErrors")?.addEventListener("click", async ()=>{
  const materia=$("#errorsMateria").value;
  const map=getErrorsMap(); const ids=(map[materia]||[]);
  // If user selected a specific materia, keep only its IDs; otherwise collect all IDs across materias
  let targetIds = ids.slice();
  // Additionally, ensure we include error IDs saved for other materias (e.g. from simulazione)
  // We'll build a lookup by scanning all available question pools (remote + local)
  try{
    const allMaterie = await qdb.getAllMaterie();
    const idMap = {};
    for(const m of allMaterie){
      const pool = await qdb.getMateria(m);
      for(const q of pool){ if(q && q.id) idMap[q.id] = q; }
    }
    // If there are ids for other materias in the global map, merge them in (avoid duplicates)
    const globalMap = getErrorsMap();
    Object.keys(globalMap).forEach(m=>{
      if(m===materia) return; // already included
      (globalMap[m]||[]).forEach(id=>{ if(!targetIds.includes(id)) targetIds.push(id); });
    });

    // Resolve targetIds to question objects using idMap
    var items = targetIds.map(id=>idMap[id]).filter(Boolean);
  }catch(e){
    // fallback to original behavior if something fails
    const base = await qdb.getMateria(materia); var items = ids.map(id=>base.find(q=>q.id===id)).filter(Boolean);
  }
  PRACTICE={mode:"errori", items:shuffle(items), idx:0, correct:0, wrong:0, blank:0, materia, argomento:null, _closed:false};
  location.hash="practice-run"; setActive("practice-run");
  $("#pMode").textContent="Errori"; $("#pMateria").textContent=materia;
  if(items.length===0){ getPracticeArea().innerHTML="<p>Nessun errore salvato per questa materia.</p>"; startPracticeTimer(0); return; }
  getPracticeArea().innerHTML=""; startPracticeTimer(0); nextPractice(); // senza timer
});

/* ritorno a Esercitazioni */
$("#backToTraining")?.addEventListener("click", async ()=>{
  if(P_TIMER) clearInterval(P_TIMER); P_TIMER=null;
  if(PRACTICE) PRACTICE._closed=true;
  location.hash="allenamento"; setActive("allenamento");
});

/* Termina allenamento (pulsante rosso) */
$("#endPractice")?.addEventListener("click", async ()=>{
  if(!PRACTICE) return alert('Nessuna sessione attiva.');
  const ok = await showConfirmModal({ title: 'Termina allenamento', message: 'Sei sicuro di terminare l\'allenamento? Verrà mostrato il riepilogo.', okText: 'Termina', cancelText: 'Annulla' });
  if(!ok) return;
  // segna come chiusa e mostra riepilogo
  if(P_TIMER) clearInterval(P_TIMER); P_TIMER=null;
  if(PRACTICE) PRACTICE._closed=true;
  finishPractice(false);
});

/* flusso pratica condiviso */
function nextPractice(){
  const st=PRACTICE, el=getPracticeArea();
  if(!st || st.items.length===0){ el.innerHTML="<p>Nessuna domanda disponibile.</p>"; return; }
  if(st.idx>=st.items.length){ return finishPractice(false); }

  const q=st.items[st.idx];
  el.innerHTML=`<p class="small">${st.mode.toUpperCase()} • ${st.idx+1}/${st.items.length} • Difficoltà ${q.difficulty}</p>
    <p class="question">${q.stem}</p>
    <div class="options" id="opts">${renderOptions(q)}</div>
    <div class="btnrow">
      <button id="skipQ" class="btn" type="button">Salta</button>
      <button id="pToggleSol" class="btn" type="button" style="margin-left:8px;">Mostra soluzione</button>
    </div>`;

  // Gestione toggle soluzione
  let solutionShown = false;
  let chosen = null;
  const toggleBtn = document.getElementById('pToggleSol');
  toggleBtn.addEventListener('click', ()=>{
    solutionShown = !solutionShown;
    toggleBtn.textContent = solutionShown ? 'Nascondi soluzione' : 'Mostra soluzione';
    const okKey = q.options.find(o=>o.correct)?.k;
    $$('#opts .opt').forEach(opt=>{
      if(solutionShown && opt.dataset.key === okKey) opt.classList.add('correct');
      else opt.classList.remove('correct');
    });
  });
  $$('#opts .opt').forEach(opt=>{
    opt.addEventListener('click', ()=>{
      $$('#opts .opt').forEach(x=>x.classList.remove('selected'));
      opt.classList.add('selected');
      chosen=opt.dataset.key;
      // Dopo la selezione, mostra solo il pulsante Avanti
      const btnrow = el.querySelector('.btnrow');
      if(!btnrow.querySelector('#nextQ')){
        const nextBtn = document.createElement('button');
        nextBtn.id = 'nextQ'; nextBtn.className = 'btn primary'; nextBtn.textContent = 'Avanti';
        nextBtn.style.marginLeft = '8px';
        nextBtn.addEventListener('click', async ()=>{
          if(chosen===q.options.find(o=>o.correct)?.k){ st.correct++; }
          else { st.wrong++; storeError(q.materia, q.id); }
          st.idx++; nextPractice();
        });
        btnrow.appendChild(nextBtn);
      }
      // Rimuovi il pulsante conferma e la spiegazione se presenti
      const confBtn = btnrow.querySelector('#submitQ');
      if(confBtn) confBtn.remove();
      const solDiv = el.querySelector('#solution');
      if(solDiv) solDiv.remove();
    });
  });

  $("#skipQ").addEventListener("click", async ()=>{ st.blank++; st.idx++; nextPractice(); });

  // Add an inline "Termina allenamento" button aligned with Conferma/Salta
  try{
    const btnRow = el.querySelector('.btnrow');
    if(btnRow){
      // remove existing inline if present
      const existing = btnRow.querySelector('#endPracticeInline'); if(existing) existing.remove();
      const endBtn = document.createElement('button');
      endBtn.id = 'endPracticeInline'; endBtn.className = 'btn danger'; endBtn.type='button'; endBtn.textContent = 'Termina allenamento';
      endBtn.style.marginLeft = 'auto';
      endBtn.addEventListener('click', ()=>{
        if(!PRACTICE) return alert('Nessuna sessione attiva.');
        showConfirmModal({ title: 'Termina allenamento', message: 'Sei sicuro di terminare l\'allenamento? Verrà mostrato il riepilogo.', okText: 'Termina', cancelText: 'Annulla' }).then(ok=>{
          if(!ok) return; if(P_TIMER) clearInterval(P_TIMER); P_TIMER=null; if(PRACTICE) PRACTICE._closed = true; finishPractice(false);
        });
      });
      btnRow.appendChild(endBtn);
    }
  }catch(e){ console.warn('Errore aggiungendo endPracticeInline', e); }
}

function finishPractice(timeup){
  if(P_TIMER) clearInterval(P_TIMER); P_TIMER=null;
  const st=PRACTICE, el=getPracticeArea(); if(!st) return;
  const total=st.items.length;
  el.innerHTML = `<h2>Fine esercitazione</h2>
    <div class="kpis">
      <div class="kpi">Corrette: ${st.correct}/${total}</div>
      <div class="kpi">Errate: ${st.wrong}</div>
      <div class="kpi">Bianche: ${st.blank}</div>
      ${timeup?'<div class="kpi">Tempo scaduto</div>':''}
    </div>
    <div class="btnrow">
      <button id="againPractice" class="btn primary" type="button">Rifai</button>
      <button id="backFromResult" class="btn" type="button">Chiudi</button>
    </div>`;
  // Salva il report dell'esercitazione
  saveReport({
    mode: "Esercitazione",
    overall: { correct: st.correct, wrong: st.wrong, blank: st.blank, total },
    materia: st.materia || '',
    argomento: st.argomento || '',
    ts: Date.now()
  });
  // Rimuovi eventuale pulsante soluzione se presente
  const oldBtn = document.getElementById('pToggleSol');
  if(oldBtn) oldBtn.remove();
  $("#againPractice").addEventListener("click", async ()=>{
    if(st.mode==="rapida") $("#startQuick").click();
    else if(st.mode==="argomento") $("#startByTopic").click();
    else $("#startErrors").click();
  });
  $("#backFromResult").addEventListener("click", ()=>$("#backToTraining").click());
}
/* end [4] */


/* [5] Lezioni (navigazione 3 livelli + contenuto) */
function renderMaterie(){
  const cont=$("#lessonMaterie"); if(!cont) return; cont.innerHTML="";
  const mats=[...new Set(LESSONS_DATA.map(l=>l.materia))];
  mats.sort((a,b)=>{ const ia=MINISTERIAL_ORDER.indexOf(a), ib=MINISTERIAL_ORDER.indexOf(b); if(ia!==-1||ib!==-1){ return (ia===-1?99:ia) - (ib===-1?99:ib); } return a.localeCompare(b); });
  mats.forEach(m=>{ const li=document.createElement("li"); li.innerHTML=`<div class="lesson-title">${m}</div><div class="small">Tocca per entrare</div>`;
    li.addEventListener("click", async ()=>{ location.hash=`lezioni/materia/${encodeURIComponent(m)}`; showMateria(m); });
    cont.appendChild(li);
  });
}
$("#backToMaterie")?.addEventListener("click", async ()=>{ location.hash="lezioni"; setActive("lezioni"); });

function showMateria(materia){
  setActive("lezioni-materia"); $("#materiaTitle").textContent=materia;
  const list=$("#macroList"); list.innerHTML="";
  const macros=[...new Set(LESSONS_DATA.filter(l=>l.materia===materia).map(l=>l.macro))];
  macros.forEach(mac=>{ const li=document.createElement("li"); li.innerHTML=`<div class="lesson-title">${mac}</div><div class="small">${materia}</div>`;
    li.addEventListener("click", async ()=>{ location.hash=`lezioni/argomento/${encodeURIComponent(materia)}/${encodeURIComponent(mac)}`; showArgomento(materia, mac); });
    list.appendChild(li);
  });
}

/* [7] Google Identity (client-side integration) */
// Nota: per usare Google Sign-In devi registrare un OAuth client ID su Google Cloud Console
// e inserire il clientId nella UI (campo data-client_id nel div #g_id_onload) oppure
// impostarlo dinamicamente chiamando initGoogleSignIn(clientId).
function decodeJwtPayload(token){ try{ const parts=token.split('.'); return JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'))); }catch(e){return null;} }

function initGoogleSignIn(clientId){
  if(!clientId) return console.warn('Google clientId mancante');
  // imposta l'attributo data-client_id per lo snippet onload nel DOM
  const onload = document.getElementById('g_id_onload'); if(onload) onload.dataset.client_id = clientId;
  // render bottone
  if(window.google && window.google.accounts && window.google.accounts.id){
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: false
    });
    window.google.accounts.id.renderButton(
      document.getElementById('googleSignBtn'),
      { theme: 'outline', size: 'large', width: '250' }
    );
    window.google.accounts.id.prompt();
  } else {
    // script non ancora caricato: tenta in un secondo
    setTimeout(()=>initGoogleSignIn(clientId), 500);
  }
}

function handleCredentialResponse(resp){
  if(!resp || !resp.credential){ console.warn('Google response senza credential'); return; }
  const payload = decodeJwtPayload(resp.credential);
  if(!payload) return console.warn('Impossibile decodificare JWT');
  // salva profilo nelle impostazioni locali
  const s = getSettings(); s.profile = s.profile || {};
  s.profile.name = payload.given_name || payload.name || s.profile.name || '';
  s.profile.surname = payload.family_name || s.profile.surname || '';
  s.profile.email = payload.email || s.profile.email || '';
  s.profile.google_sub = payload.sub;
  saveSettingsObj(s);
  loadSettingsUI();
  // mostra bottone disconnect
  const disc = document.getElementById('googleDisconnect'); if(disc) disc.style.display='inline-block';
}

function disconnectGoogle(){
  // revoca lato client (opzionale) e rimuovi profilo locale
  const s = getSettings(); if(s && s.profile){ delete s.profile.google_sub; delete s.profile.email; delete s.profile.name; delete s.profile.surname; saveSettingsObj(s); }
  loadSettingsUI();
  // se la libreria è disponibile chiediamo il revoke al token (richiede lato server per revoca completa)
  try{ if(window.google && window.google.accounts && window.google.accounts.id) window.google.accounts.id.disableAutoSelect(); }catch(e){}
}

// hook UI: collega il pulsante di disconnect
document.addEventListener('click', (e)=>{
  const t = e.target;
  if(!t) return;
  if(t.id==='googleDisconnect'){ disconnectGoogle(); }
});

/* end Google Identity */
$("#backToMacro")?.addEventListener("click", async ()=>{ const materia=$("#materiaTitle").textContent; location.hash=`lezioni/materia/${encodeURIComponent(materia)}`; showMateria(materia); });
$("#backToMicro")?.addEventListener("click", async ()=>{ const meta=$("#lessonMeta").dataset; location.hash=`lezioni/argomento/${encodeURIComponent(meta.materia)}/${encodeURIComponent(meta.macro)}`; showArgomento(meta.materia, meta.macro); });

function showArgomento(materia, macro){
  setActive("lezioni-argomento"); $("#macroTitle").textContent=`${materia} • ${macro}`;
  const list=$("#microList"); list.innerHTML="";
  LESSONS_DATA.filter(l=>l.materia===materia && l.macro===macro).forEach(ls=>{ const li=document.createElement("li"); li.innerHTML=`<div class="lesson-title">${ls.micro}</div><div class="small">Apri lezione</div>`;
    li.addEventListener("click", async ()=>{ location.hash=`lezione/${encodeURIComponent(materia)}/${encodeURIComponent(macro)}/${encodeURIComponent(ls.micro)}`; showLezione(materia, macro, ls.micro); });
    list.appendChild(li);
  });
}
function showLezione(materia, macro, micro){
  setActive("lezione-dettaglio");
  const ls=LESSONS_DATA.find(x=>x.materia===materia && x.macro===macro && x.micro===micro);
  $("#lessonTitle").textContent=ls?ls.micro:micro;
  $("#lessonMeta").textContent=`${materia} • ${macro}`;
  $("#lessonMeta").dataset.materia=materia; $("#lessonMeta").dataset.macro=macro;
  $("#lessonBody").innerHTML=ls?.html||"<p>Contenuto non trovato.</p>";
}
/* end [5] */


/* [6] Simulazione */
// Ordine e quote: riflette la ripartizione ufficiale (bando 2025)
// Totale 60 quesiti in 100 minuti: Comprensione 4, Logica 5, Biologia 23, Chimica 15, Fisica+Matematica 13
const SIM_ORDER=[
  { key:"CC", label:"Comprensione & Cultura", materias:["Comprensione e Cultura"], quota:4 },
  { key:"LOG", label:"Logica e Problem Solving", materias:["Logica e Problem Solving"], quota:5 },
  { key:"BIO", label:"Biologia", materias:["Biologia"], quota:23 },
  { key:"CHM", label:"Chimica", materias:["Chimica"], quota:15 },
  { key:"FM", label:"Fisica e Matematica", materias:["Fisica","Matematica"], quota:13 }
];
let SIM=null, TIMER=null, TIMELEFT=0;

/* tracker UI */
function buildSegbar(){
  const sb=$("#segbar"); if(!sb) return; sb.innerHTML="";
  SIM_ORDER.forEach(seg=>{
    const div=document.createElement("div"); div.className="seg"; div.dataset.key=seg.key;
    div.innerHTML=`<div class="label">${seg.label}</div><div class="fill" id="fill_${seg.key}"></div>`;
    div.addEventListener("click", async ()=>{ if(!SIM) return; goToSubject(seg.key); });
    sb.appendChild(div);
  });
  const btns=$("#subjBtns"); btns.innerHTML="";
  SIM_ORDER.forEach(seg=>{
    const b=document.createElement("a"); b.href="javascript:void(0)"; b.className="pill"; b.textContent=seg.label; b.dataset.key=seg.key;
    b.addEventListener("click", async ()=>{ if(!SIM) return; goToSubject(seg.key); });
    btns.appendChild(b);
  });
}
function updateSegbar(){
  SIM_ORDER.forEach(seg=>{
    const fill=$("#fill_"+seg.key); if(!fill) return;
    const S=SIM.subjects[seg.key]; const total=S.items.length; const done=S.idx;
    const pct= total? (done/total)*100:0; fill.style.width=pct+"%";
    fill.parentElement.classList.toggle("active", SIM.current===seg.key);
  });
  $$("#subjBtns .pill").forEach(p=>p.classList.toggle("active", p.dataset.key===SIM.current));
  $("#simSubjLabel").textContent = SIM_ORDER.find(x=>x.key===SIM.current)?.label || "-";
}

/* pool domande */
function makeSimPool(){
  const subjects={};
  SIM_ORDER.forEach(seg=>{
    const pool=QUESTIONS.filter(q=> seg.materias.includes(q.materia));
    const items=shuffle(pool).slice(0, Math.min(seg.quota, pool.length));
    subjects[seg.key] = {label: seg.label, items, idx:0, correct:0, wrong:0, blank:0};
  });
  return subjects;
}

/* timer simulazione (numerico) + chiusura automatica */
function startTimer(seconds){
  TIMELEFT=seconds; const el=$("#timer"); if(TIMER) clearInterval(TIMER);
  const tick=()=>{
    const m=String(Math.floor(TIMELEFT/60)).padStart(2,"0");
    const s=String(TIMELEFT%60).padStart(2,"0");
    el.textContent=`${m}:${s}`;
    // controlla avviso timer residuo
    checkWarnTimer();
    if(TIMELEFT<=0){ clearInterval(TIMER); finishSim(); }
    TIMELEFT--;
  };
  tick(); TIMER=setInterval(tick, 1000);
}

/* punteggio simulazione */
function scoreSim(){
  const s=getSettings();
  let totalQ=0, C=0,W=0,B=0;
  const perSubject=[];
  SIM.order.forEach(k=>{
    const S=SIM.subjects[k];
    const sub = {label:S.label, correct:S.correct, wrong:S.wrong, blank:S.blank, total:S.items.length};
    perSubject.push(sub);
    totalQ += sub.total; C+=sub.correct; W+=sub.wrong; B+=sub.blank;
  });
  const score = C*s.right - W*s.wrong;
  return { perSubject, overall:{correct:C, wrong:W, blank:B, total:totalQ, score} };
}

/* fine simulazione */
function finishSim(){
  const el=$("#simArea");
  const res=scoreSim();
  const per = res.perSubject.map(s=>`<div class="kpi">${s.label}: C ${s.correct} • E ${s.wrong} • B ${s.blank} / ${s.total}</div>`).join("");
  el.innerHTML = `<h2>Risultati</h2>
    <div class="kpis">${per}</div>
    <div class="kpis"><div class="kpi"><b>Totale:</b> ${res.overall.correct}/${res.overall.total} corrette</div>
         <div class="kpi">Errate: ${res.overall.wrong}</div>
         <div class="kpi">Bianche: ${res.overall.blank}</div>
         <div class="kpi"><b>Punteggio:</b> ${res.overall.score.toFixed(2)}</div></div>`;
  // aggiungi un pulsante per tornare al menu principale delle simulazioni
  const btnWrap = document.createElement('div'); btnWrap.style.marginTop = '12px'; btnWrap.style.textAlign = 'right';
  const toSimBtn = document.createElement('button'); toSimBtn.id = 'simSummaryToSimBtn'; toSimBtn.className = 'btn'; toSimBtn.textContent = 'Torna a Simulazioni';
  toSimBtn.addEventListener('click', ()=>{ location.hash='simulazioni'; });
  btnWrap.appendChild(toSimBtn); el.appendChild(btnWrap);
  // assicurati di fermare il timer
  if(TIMER) clearInterval(TIMER);
  TIMER = null;
  // nascondi il bottone flottante
  // floating end button removed — inline .endSimBtn handles termination
  saveReport({mode:"Simulazione", overall:res.overall});
}

// Termina simulazione prematuramente (bottone UI)
document.addEventListener('click', (e)=>{
  const t = (e.target.closest && e.target.closest('.endSimBtn'));
  if(!t) return;
  (async ()=>{
    const ok = await showConfirmModal({ title: 'Termina simulazione', message: 'Vuoi davvero concludere la simulazione adesso?', okText: 'Termina', cancelText: 'Continua' });
    if(ok){ if(TIMER) clearInterval(TIMER); TIMER=null; finishSim(); }
  })();
});

/* rendering domanda simulazione (senza lettere) */
function renderSimQuestion(q){
  const opts=shuffle(q.options.map(o=>({...o}))).map(o=>`<div class="opt" data-key="${o.k}" data-correct="${o.correct===true}">${o.t}</div>`).join("");
  return `<p class="question">${q.stem}</p><div class="options" id="simOpts">${opts}</div>
    <div class="btnrow" style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;gap:8px;">
        <button id="confirmSIM" class="btn primary" type="button">Conferma</button>
        <button id="skipSIM" class="btn" type="button">Salta</button>
      </div>
      <div>
        <button class="btn endSimBtn" type="button" style="background:#e55353;color:#fff;border:0;">Termina simulazione</button>
      </div>
    </div>`;
}

/* flusso simulazione */
function nextSim(){
  const el=$("#simArea"); updateSegbar();
  const subj=SIM.subjects[SIM.current];
  if(subj.idx>=subj.items.length){
    const nextKey = SIM.order.find(k=>SIM.subjects[k].idx < SIM.subjects[k].items.length);
    if(nextKey){ SIM.current=nextKey; return nextSim(); }
    return finishSim();
  }
  const q=subj.items[subj.idx];
  el.innerHTML = `<p class="small">${subj.label} — Q ${subj.idx+1}/${subj.items.length}</p>` + renderSimQuestion(q);
  let chosen=null;
  $("#simOpts").addEventListener("click", (e)=>{ const c=e.target.closest(".opt"); if(!c) return; $$("#simOpts .opt").forEach(x=>x.classList.remove("selected")); c.classList.add("selected"); chosen=c.dataset.key; });
  $("#confirmSIM").addEventListener("click", async ()=>{
    if(!chosen){ alert("Seleziona una risposta"); return; }
    const okKey=q.options.find(o=>o.correct)?.k;
    if(chosen===okKey) subj.correct++; 
    else { subj.wrong++; storeError(q.materia, q.id); }
    subj.idx++; nextSim();
    // auto-advance: se impostato, provo a chiamare nextSim di nuovo quando previsto
    scheduleAutoAdvance(()=>{ /* nextSim è già stata chiamata: qui non serve altro */ });
  });
  $("#skipSIM").addEventListener("click", async ()=>{ subj.blank++; subj.idx++; nextSim(); });
}
function goToSubject(key){ if(!SIM) return; SIM.current=key; nextSim(); }
$("#startSim")?.addEventListener("click", async ()=>{
  // durata default da bando (in minuti)
  const setts = getSettings();
  setts.duration = SIM_RULES_2025.duration;
  saveSettingsObj(setts);

  // Carica le domande per materia
  const poolByMateria = {};
  const materie = await qdb.getAllMaterie();
  for(const m of materie){ poolByMateria[m] = await qdb.getMateria(m); }

  // Helper: prende n domande da un array (mischia e limita)
  function takeFromArray(arr, n){
    const copy = (arr||[]).slice();
    for(let i=copy.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
    return copy.slice(0, Math.min(n, copy.length));
  }

  // Costruisci subjects object rispettando la quota definita in SIM_ORDER
  const subjects = {};
  SIM_ORDER.forEach(seg=>{
    // unisci pool per tutte le materie indicate in seg.materias
    let combined = [];
    seg.materias.forEach(m=>{ combined = combined.concat(poolByMateria[m]||[]); });
    // se combinazione vuota e si richiede "Fisica e Matematica", prova a unire le due
    if(combined.length===0 && seg.materias.length===1 && seg.materias[0]==="Fisica e Matematica"){
      combined = (poolByMateria["Fisica"]||[]).concat(poolByMateria["Matematica"]||[]);
    }
    const items = takeFromArray(combined, seg.quota || 0);
    subjects[seg.key] = { label: seg.label, items, idx:0, correct:0, wrong:0, blank:0 };
  });

  // Verifica che ci sia almeno qualche domanda
  const totalQuestions = Object.values(subjects).reduce((s,o)=>s+ (o.items?.length||0), 0);
  if(totalQuestions===0){ alert("Nessuna domanda disponibile per la simulazione."); return; }

  // Inizializza SIM nello shape usato dalle altre funzioni
  const order = SIM_ORDER.map(s=>s.key);
  SIM = { order, subjects, current: order[0], start: Date.now(), duration: setts.duration };

  // Prepara UI e timer
  buildSegbar(); updateSegbar();
  location.hash = "sim-run"; setActive("sim-run");
  // avvia timer simulazione in secondi
  startTimer(setts.duration * 60);
  // mostra il bottone flottante per terminare la simulazione
  // floating end button removed — inline .endSimBtn handles termination
  nextSim();
});
/* end [6] */


/* [7] Settings & Report */
function loadSettingsUI(){
  const s=getSettings();
  $("#settDuration").classList.add("styled-select");
  $("#settScoreRight").classList.add("styled-select");
  $("#settScoreWrong").classList.add("styled-select");
  $("#settTheme").classList.add("styled-select");
  $("#settSounds").classList.add("styled-select");
  $("#settAutoAdvance").classList.add("styled-select");
  $("#settWarnTimer").classList.add("styled-select");
  
  $("#settDuration").value=s.duration;
  $("#settScoreRight").value=s.right;
  $("#settScoreWrong").value=s.wrong;
  $("#settTheme").value = s.theme || 'auto';
  $("#settSounds").value = (s.sounds===0||s.sounds==='0')? '0' : '1';
  $("#settAutoAdvance").value = s.autoAdvance || 0;
  $("#settWarnTimer").value = s.warnTimer || 5;
  // profile fields
  const prof = (s.profile||{});
  $("#profileName").value = prof.name || '';
  $("#profileSurname").value = prof.surname || '';
  $("#profileEmail").value = prof.email || '';
  $("#profileCloud").value = prof.cloud ? '1' : '0';
}

$("#saveSettings")?.addEventListener("click", async ()=>{
  const s={
    duration: parseInt($("#settDuration").value||"100",10),
    right: parseFloat($("#settScoreRight").value||"1.5"),
    wrong: parseFloat($("#settScoreWrong").value||"0.4"),
    theme: $("#settTheme").value || 'auto',
    sounds: parseInt($("#settSounds").value||'1',10),
    autoAdvance: parseInt($("#settAutoAdvance").value||'0',10),
    warnTimer: parseInt($("#settWarnTimer").value||'5',10)
  };
  saveSettingsObj(s); alert("Impostazioni salvate");
});

// Export impostazioni
$("#exportSettings")?.addEventListener('click', ()=>{
  const s = getSettings(); const blob = new Blob([JSON.stringify(s, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nextmed-settings.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});

// Import impostazioni
$("#importSettings")?.addEventListener('click', ()=>$("#importSettingsFile").click());
$("#importSettingsFile")?.addEventListener('change', async (ev)=>{
  const f = ev.target.files && ev.target.files[0]; if(!f) return; const text = await f.text();
  try{ const obj = JSON.parse(text); saveSettingsObj(obj); loadSettingsUI(); alert('Import impostazioni riuscito.'); }
  catch(e){ alert('Errore import: '+e.message); }
  finally{ ev.target.value = ''; }
});

// Reset impostazioni (torna ai default)
$("#resetSettings")?.addEventListener('click', async ()=>{
  if(!confirm('Ripristinare le impostazioni predefinite?')) return;
  // Solo reset delle impostazioni lasciando intatti report/errori
  const current = { ...CLOUD.doc };
  current.settings = {};
  await CLOUD.save({ settings: {} });
  loadSettingsUI(); alert('Impostazioni ripristinate.');
});

// Save profile
$("#saveProfile")?.addEventListener('click', ()=>{
  const s = getSettings();
  s.profile = s.profile || {};
  s.profile.name = $("#profileName").value || '';
  s.profile.surname = $("#profileSurname").value || '';
  s.profile.email = $("#profileEmail").value || '';
  s.profile.cloud = $("#profileCloud").value==='1';
  saveSettingsObj(s); alert('Profilo salvato localmente.');
});

// Applica tema (chiamata anche dopo loadSettingsUI)
function applyTheme(){
  const s = getSettings();
  const root = document.documentElement;
  root.classList.remove('theme-light','theme-dark');
  if(s.theme==='light'){ root.classList.add('theme-light'); }
  else if(s.theme==='dark'){ root.classList.add('theme-dark'); }
  else { /* auto: non forziamo nulla */ }
}
// Iniziale
applyTheme();

// riascolta salvataggio impostazioni per riapplicare tema
$("#saveSettings")?.addEventListener('click', ()=>{ setTimeout(()=>applyTheme(), 80); });

/* Pagina Account */
function renderAccount(){
  // Profilo
  const s = getSettings(); const prof = s.profile||{};
  const name = [prof.name||'', prof.surname||''].filter(Boolean).join(' ').trim() || 'Ospite';
  const email = prof.email || '';
  const accName = document.getElementById('accName'); if(accName) accName.textContent = name;
  const accEmail = document.getElementById('accEmail'); if(accEmail) accEmail.textContent = email || '—';
  // Avatar (se presente in prof.avatar)
  const headerIcon = document.getElementById('headerProfileIcon');
  const accAvatar = document.querySelector('#accAvatar img');
  if(prof.avatar){ if(accAvatar) accAvatar.src = prof.avatar; if(headerIcon) headerIcon.src = prof.avatar; }

  // KPI rapidi: numero report, ultime corrette, errori salvati
  const reports = getReports();
  const totalReports = reports.length;
  const last = reports[0] || null;
  const errMap = getErrorsMap(); const totalErrors = Object.values(errMap).reduce((s,a)=>s + (Array.isArray(a)?a.length:0), 0);
  const accStats = document.getElementById('accStats');
  if(accStats){
    accStats.innerHTML = `
      <div class="kpi"><b>Report totali</b><div>${totalReports}</div></div>
      <div class="kpi"><b>Errori salvati</b><div>${totalErrors}</div></div>
      <div class="kpi"><b>Ultimo risultato</b><div>${last? `${last.overall?.correct||0}/${last.overall?.total||0}` : '—'}</div></div>
    `;
  }

  // Attività recente — vista strutturata con filtri e tabella
  const list = document.getElementById('accReports');
  if(list){
    if(!reports.length){ list.innerHTML = '<div class="muted">Nessuna attività recente.</div>'; }
    else {
      const distinctMaterie = [...new Set(reports.map(r=>r.materia).filter(Boolean))].sort();
      list.innerHTML = `
        <div class="filters" style="margin-bottom:12px; display:flex; gap:12px; flex-wrap:wrap; align-items:end;">
          <label>Tipo
            <select id="accFilterTipo" class="styled-select">
              <option value="">Tutti</option>
              <option value="Esercitazione">Esercitazione</option>
              <option value="Simulazione">Simulazione</option>
            </select>
          </label>
          <label>Materia
            <select id="accFilterMateria" class="styled-select">
              <option value="">Tutte</option>
              ${distinctMaterie.map(m=>`<option>${m}</option>`).join('')}
            </select>
          </label>
          <label style="flex:1">Cerca
            <input id="accFilterSearch" type="search" placeholder="Materia, argomento..." />
          </label>
        </div>
        <div id="accCount" class="small muted" style="margin:4px 2px 8px;">&nbsp;</div>
        <div id="accTable" style="border:1px solid var(--border); border-radius:8px; overflow:hidden;">
          <div class="row head" style="display:grid; grid-template-columns: 1.2fr 1fr 1fr 2fr .8fr; gap:8px; padding:8px; font-weight:600; border-bottom:1px solid var(--border);">
            <div>Data</div>
            <div>Tipo</div>
            <div>Materia</div>
            <div>Argomento</div>
            <div>Esito</div>
          </div>
          <div id="accTableBody"></div>
        </div>
        <div style="margin-top:8px; text-align:center;">
          <button id="accMoreBtn" class="btn">Mostra altri</button>
        </div>
      `;

      const selTipo = document.getElementById('accFilterTipo');
      const selMat = document.getElementById('accFilterMateria');
      const inpQ = document.getElementById('accFilterSearch');
      const tbody = document.getElementById('accTableBody');
      const moreBtn = document.getElementById('accMoreBtn');
      const countEl = document.getElementById('accCount');

      let limit = 10;
      const sorted = reports.slice().sort((a,b)=> (b.ts||0) - (a.ts||0));

      function fmtTipo(r){
        if(r.mode === 'Esercitazione') return r.argomento ? 'Per argomento' : 'Per materia';
        return r.mode || '';
      }
      function getFiltered(){
        const tipo = selTipo.value;
        const mat = selMat.value;
        const q = (inpQ.value||'').toLowerCase().trim();
        return sorted.filter(r =>
          (!tipo || r.mode === tipo) &&
          (!mat || r.materia === mat) &&
          (!q || `${r.materia||''} ${r.argomento||''}`.toLowerCase().includes(q))
        );
      }
      function renderRows(){
        const data = getFiltered();
        const shown = data.slice(0, limit);
        tbody.innerHTML = shown.map(r=>{
          const date = new Date(r.ts).toLocaleString();
          const tipo = fmtTipo(r);
          const esito = `${r.overall?.correct||0}/${r.overall?.total||0}`;
          const arg = r.argomento || '—';
          const mat = r.materia || '—';
          return `
            <div class="row" style="display:grid; grid-template-columns: 1.2fr 1fr 1fr 2fr .8fr; gap:8px; padding:10px 8px; border-bottom:1px solid var(--border);">
              <div class="small">${date}</div>
              <div>${tipo}</div>
              <div>${mat}</div>
              <div>${arg}</div>
              <div>${esito}</div>
            </div>`;
        }).join('');
        countEl.textContent = `${Math.min(limit, data.length)} di ${data.length}`;
        moreBtn.style.display = data.length > limit ? '' : 'none';
      }

      selTipo.addEventListener('change', ()=>{ limit = 10; renderRows(); });
      selMat.addEventListener('change', ()=>{ limit = 10; renderRows(); });
      inpQ.addEventListener('input', ()=>{ limit = 10; renderRows(); });
      moreBtn.addEventListener('click', ()=>{ limit += 10; renderRows(); });

      renderRows();
    }
  }

  // Azioni
  document.getElementById('accGoToReports')?.addEventListener('click', ()=>{ location.hash='report'; setActive('report'); renderReport(); });
  document.getElementById('accEditProfile')?.addEventListener('click', ()=>{ location.hash='settings'; setActive('settings'); loadSettingsUI(); });
  document.getElementById('accExport')?.addEventListener('click', ()=>{
    const data = {
      settings: getSettings(),
      reports: getReports(),
      errors: getErrorsMap(),
      bankLocal: (typeof qdb?.getLocal==='function') ? qdb.getLocal() : []
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nextmed-backup.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });
  document.getElementById('accClear')?.addEventListener('click', async ()=>{
    const ok = await showConfirmModal({ title:'Cancella dati cloud', message:'Questa azione rimuove impostazioni, report ed errori salvati nel cloud per il tuo account. Procedere?', okText:'Sì, cancella', cancelText:'Annulla' });
    if(!ok) return;
    try{
      await CLOUD.clearAll();
    }finally{
      loadSettingsUI(); renderAccount(); alert('Dati cloud azzerati.');
    }
  });

  // Cambia immagine profilo: click sull'avatar apre file picker
  const fileInput = document.getElementById('accAvatarFile');
  document.getElementById('accAvatar')?.addEventListener('click', ()=>{ fileInput?.click(); });
  fileInput?.addEventListener('change', async (ev)=>{
    const file = ev.target.files && ev.target.files[0]; if(!file) return;
    try{
      const dataUrl = await new Promise((res, rej)=>{ const r = new FileReader(); r.onload = ()=>res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      const st = getSettings(); st.profile = st.profile || {}; st.profile.avatar = String(dataUrl);
      saveSettingsObj(st);
      if(accAvatar) accAvatar.src = st.profile.avatar;
      if(headerIcon) headerIcon.src = st.profile.avatar;
    }catch(e){ alert('Impossibile caricare l\'immagine: '+ (e?.message||e)); }
    finally{ ev.target.value = ''; }
  });
}

function renderReport(){
  const arr = getReports();
  const el = $("#reportArea");
  if(arr.length===0){ el.innerHTML = "<p>Ancora nessun dato…</p>"; return; }

  // Aggrega per materia quando disponibile (perSubject) oppure per materia dei report
  const agg = {};
  arr.forEach(r=>{
    if(r && r.perSubject && typeof r.perSubject === 'object'){
      Object.entries(r.perSubject).forEach(([mat, s])=>{
        if(!agg[mat]) agg[mat] = { correct:0, wrong:0, blank:0, total:0 };
        agg[mat].correct += (s.correct||0);
        agg[mat].wrong += (s.wrong||0);
        agg[mat].blank += (s.blank||0);
        agg[mat].total += (s.total||0);
      });
    } else if(r && r.materia && r.overall){
      const mat = r.materia;
      if(!agg[mat]) agg[mat] = { correct:0, wrong:0, blank:0, total:0 };
      agg[mat].correct += (r.overall.correct||0);
      agg[mat].wrong += (r.overall.wrong||0);
      agg[mat].blank += (r.overall.blank||0);
      agg[mat].total += (r.overall.total||0);
    }
  });

  // Grafico per materia: mostra sempre tutte le materie ministeriali (anche a zero)
  let chartsHtml = '';
  const baseOrder = Array.isArray(MINISTERIAL_ORDER) ? MINISTERIAL_ORDER.slice() : [];
  // Assicura chiavi presenti per tutte le materie con valori a zero
  baseOrder.forEach(mat=>{ if(!agg[mat]) agg[mat] = { correct:0, wrong:0, blank:0, total:0 }; });
  // Eventuali materie extra (es. "Fisica e Matematica") vengono aggiunte in coda
  const extras = Object.keys(agg).filter(k => !baseOrder.includes(k));
  const subjects = baseOrder.concat(extras);
  chartsHtml = `<div class="report-charts">` + subjects.map(mat=>{
    const s = agg[mat] || { correct:0, total:0 };
    const pct = s.total ? Math.round((s.correct/s.total)*100) : 0;
    return `<div class="subject-row">
        <div class="subject-label">${mat}</div>
        <div class="subject-bar-wrap"><div class="subject-bar" style="width:${pct}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div></div>
        <div class="subject-numbers">${s.correct}/${s.total} (${pct}%)</div>
      </div>`;
  }).join('') + `</div>`;

  // Separa report per tipo
  const simReports = arr.filter(r => r.mode === 'Simulazione');
  const exReports = arr.filter(r => r.mode !== 'Simulazione');
  const simHtml = simReports.length ? simReports.slice(0,5).map(r=>{
    const date=new Date(r.ts).toLocaleString();
    return `<div class="kpis fade-in">
      <div class="kpi"><b>Simulazione</b></div>
      <div class="kpi">${r.overall?.correct||0}/${r.overall?.total||0} corrette</div>
      <div class="kpi">Errate: ${r.overall?.wrong||0} • Bianche: ${r.overall?.blank||0}</div>
      <div class="kpi small">${date}</div>
    </div>`;
  }).join("") : '<div class="muted">Nessuna simulazione registrata.</div>';
  const exHtml = exReports.length ? exReports.slice(0,5).map(r=>{
    const date = new Date(r.ts).toLocaleString();
    let tipo = r.mode === 'Esercitazione' ? (r.argomento ? 'Per argomento' : 'Per materia') : (r.mode||'');
    let arg = r.argomento ? `<div class=\"kpi\">Argomento: ${r.argomento}</div>` : '';
    return `<div class=\"kpis fade-in\">\n      <div class=\"kpi\"><b>Esercitazione</b></div>\n      <div class=\"kpi\">Materia: ${r.materia||'-'}</div>\n      <div class=\"kpi\">Tipo: ${tipo}</div>\n      ${arg}\n      <div class=\"kpi\">${r.overall?.correct||0}/${r.overall?.total||0} corrette</div>\n      <div class=\"kpi\">Errate: ${r.overall?.wrong||0} • Bianche: ${r.overall?.blank||0}</div>\n      <div class=\"kpi small\">${date}</div>\n    </div>`;
  }).join("") : '<div class="muted">Nessuna esercitazione registrata.</div>';

  el.innerHTML = `
    <div class="card glass"><h2>Statistiche per materia</h2>${chartsHtml}</div>
    <div class="report-columns">
      <div class="report-col">
        <h3>Simulazioni</h3>
        <div class="report-list">${simHtml}</div>
        <button id="showAllSimReports" class="btn small" style="margin-top:10px;">Vedi tutte</button>
      </div>
      <div class="report-col">
        <h3>Esercitazioni</h3>
        <div class="report-list">${exHtml}</div>
        <button id="showAllExReports" class="btn small" style="margin-top:10px;">Vedi tutte</button>
      </div>
    </div>
    <style>
      .report-columns { display: flex; gap: 32px; flex-wrap: wrap; margin-top: 18px; }
      .report-col { flex: 1 1 320px; min-width: 260px; }
      .report-list { display: flex; flex-direction: column; gap: 16px; }
      .kpis.fade-in { background: var(--card); border-radius: 10px; box-shadow: 0 2px 8px #0001; padding: 16px 18px; margin-bottom: 0; }
      .kpi { margin-bottom: 4px; }
      .report-col h3 { margin-bottom: 10px; font-size: 1.15em; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
      @media (max-width: 900px) { .report-columns { flex-direction: column; gap: 18px; } }
    </style>
  `;
  document.getElementById('showAllSimReports')?.addEventListener('click', ()=>{ location.hash = 'report/simulazioni'; });
  document.getElementById('showAllExReports')?.addEventListener('click', ()=>{ location.hash = 'report/esercitazioni'; });
}
/* end [7] */


/* ===== [Banca domande] ===== */
async function initBank(){
  // Materie (remote + local)
  const mats = await qdb.getAllMaterie();
  const msel = $("#bankMateria");
  msel.innerHTML = mats.map(m=>`<option value="${m}">${m}</option>`).join("");
  msel.addEventListener("change", async ()=>{
    const args = await qdb.getArgomenti(msel.value);
    $("#bankArgomento").innerHTML = `<option value="">Tutti</option>` + args.map(a=>`<option>${a}</option>`).join("");
  });
  msel.dispatchEvent(new Event("change"));

  async function render(){
    const materia = $("#bankMateria").value;
    const arg = $("#bankArgomento").value;
    const q = ($("#bankQuery").value||"").toLowerCase().trim();
    const mind = parseInt($("#bankDiff").value||"1",10);
    const pool = await qdb.getMateria(materia);
    const filtered = pool.filter(it=>
      (!arg || it.argomento===arg) &&
      ((it.difficulty||1) >= mind) &&
      (!q || (it.stem||"").toLowerCase().includes(q))
    );
    $("#bankStats").textContent = `${filtered.length} domande su ${pool.length} (materia: ${materia})`;
    $("#bankList").innerHTML = filtered.slice(0,500).map(it=>`
      <div class="card" style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <strong>${it.id||""}</strong>
          <span class="pill">${it.materia||""}</span>
        </div>
        <div class="small muted">${it.argomento||""} • diff ${it.difficulty||1} • tempo ${it.time||60}s</div>
        <p style="margin:.5em 0 0">${it.stem||""}</p>
        ${Array.isArray(it.options)?`<ul style="margin:.5em 0 0">${it.options.map(o=>`<li>${o.k}) ${o.t}${o.correct?' ✅':''}</li>`).join("")}</ul>`:""}
        ${it.solution?`<details style="margin-top:.4em"><summary>Spiegazione</summary><div class="small">${it.solution}</div></details>`:""}
      </div>
    `).join("");
  }
  $("#bankRefresh").addEventListener("click", render);
  $("#bankQuery").addEventListener("input", render);
  $("#bankDiff").addEventListener("change", render);
  $("#bankArgomento").addEventListener("change", render);
  $("#bankMateria").addEventListener("change", render);
  render();

  // Import JSON (merge in localStorage)
  $("#bankImport").addEventListener("click", ()=>$("#bankFile").click());
  $("#bankFile").addEventListener("change", async (ev)=>{
    const file = ev.target.files[0]; if(!file) return;
    const text = await file.text();
    try{
      const arr = JSON.parse(text);
      if(!Array.isArray(arr)) throw new Error("Il file non contiene un array JSON.");
      const n = await qdb.addLocal(arr);
      alert(`Import riuscito: ${n} domande aggiunte nella banca locale.`);
      msel.dispatchEvent(new Event("change")); // refresh argomenti
      render();
    }catch(e){
      alert("Errore import: "+e.message);
    }finally{
      ev.target.value = "";
    }
  });

  // Export JSON (solo locale)
  $("#bankExport").addEventListener("click", ()=>{
    const data = JSON.stringify(qdb.getLocal(), null, 2);
    const blob = new Blob([data], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
  a.download = "nextmed-banca-locale.json";
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  });

  // Clear
  $("#bankClear").addEventListener("click", ()=>{
    if(confirm("Sicuro di voler svuotare la banca locale?")){ qdb.clearLocal(); render(); }
  });
}

// Hook di inizializzazione quando si entra nella tab
window.addEventListener("hashchange", ()=>{ if(location.hash==="#banca") initBank(); });
if(location.hash==="#banca") initBank();

/* ===== [Fine banca domande] ===== */


/* --- Patch: toggle Mostra soluzione (allenamento) --- */
function practiceToggleSolution(){
  const area = getPracticeArea();
  const show = !area.classList.contains("show-sol");
  area.classList.toggle("show-sol", show);
  // evidenzia tutte le opzioni corrette presenti in pagina
  area.querySelectorAll(".opt").forEach(el=>el.classList.remove("correct-hint"));
  if(show){
    area.querySelectorAll(".qblock").forEach(bl=>{
      bl.querySelectorAll(".opt").forEach(op=>{
        try{
          const data = op.dataset;
          if(data.correct==="true"){ op.classList.add("correct-hint"); }
        }catch(_){}
      });
    });
  }
  const btn = document.getElementById("pToggleSol");
  if(btn) btn.textContent = show ? "Nascondi soluzione" : "Mostra soluzione";
}

/* Regole ufficiali (bando 2025): 60 quesiti in 100 minuti
   Ripartizione: Lettura 4, Logica 5, Biologia 23, Chimica 15, Fisica 0, Matematica 0, Fisica e Matematica 13 */
const SIM_RULES_2025 = {
  duration: 100,
  perMateria: {
    "Comprensione e Cultura": 4,
    "Logica e Problem Solving": 5,
    "Biologia": 23,
    "Chimica": 15,
    "Fisica": 0,
    "Matematica": 0,
    "Fisica e Matematica": 13
  }
};

// [Identity] Integrazione Netlify Identity + Google
(function(){
  const appNS = (window.app = window.app || {});

  function openLoginOverlay(){
    const ov = document.getElementById('login-overlay');
    if(ov){ ov.style.display = 'flex'; }
  }
  function closeLoginOverlay(){
    const ov = document.getElementById('login-overlay');
    if(ov){ ov.style.display = 'none'; }
  }
  appNS.openLoginOverlay = openLoginOverlay;
  appNS.closeLoginOverlay = closeLoginOverlay;

  function mapIdentityUserToProfile(user){
    const s = getSettings(); s.profile = s.profile || {};
    if(user){
      const data = user.user_metadata || {};
      s.profile.name = data.full_name || data.name || s.profile.name || 'Utente';
      s.profile.email = user.email || s.profile.email || '';
      // provider Google
      const prov = Array.isArray(user.providers) ? user.providers.find(p=>p.provider==='google') : null;
      if(prov){ s.profile.google_sub = prov.sub || s.profile.google_sub; }
    } else {
      delete s.profile.name; delete s.profile.email; delete s.profile.google_sub;
    }
    saveSettingsObj(s);
    try{ loadSettingsUI(); renderAccount(); }catch(_){ /* no-op */ }
  }

  function bootstrapIdentity(){
    // Netlify Identity
    if(window.netlifyIdentity){
      const id = window.netlifyIdentity;
      id.on('init', async user => { mapIdentityUserToProfile(user); await CLOUD.load(); loadSettingsUI(); renderAccount(); });
      id.on('login', async user => { mapIdentityUserToProfile(user); await CLOUD.load(); loadSettingsUI(); renderAccount(); closeLoginOverlay(); });
      id.on('logout', async () => { mapIdentityUserToProfile(null); await CLOUD.load(); loadSettingsUI(); renderAccount(); });
      id.on('error', (e)=>{ console.warn('Identity error', e); });
      // Inizializza e verifica stato
      id.init();

      // Bottone email login
      const emailBtn = document.getElementById('btnEmailLogin');
      if(emailBtn){ emailBtn.addEventListener('click', ()=> id.open()); }
    } else {
      console.warn('Netlify Identity widget non presente');
    }

    // Google Sign-In: se già integrato altrove, possiamo inizializzarlo qui se serve clientId
    // Se hai già impostato il clientId via markup #g_id_onload o vuoi usare initGoogleSignIn(clientId)
    // lascia questo stub come hook di avvio.
  }

  appNS.bootstrapIdentity = bootstrapIdentity;
})();
