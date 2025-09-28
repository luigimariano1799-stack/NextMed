
/* qdb.js — loader domande da /data */
(function(){
  const QDB = { _manifest:null, _cache:{}, _initPromise:null };
  async function loadManifest(){
    if(QDB._manifest) return QDB._manifest;
    // Prova a caricare manifest via fetch (richiede server). Se fallisce,
    // cerca un manifest embedded in `window.PS_PREP_EMBEDDED_MANIFEST` come fallback
    try{
      const res = await fetch('data/manifest.json');
      if(!res.ok) throw new Error('HTTP '+res.status);
      QDB._manifest = await res.json();
      return QDB._manifest;
    }catch(err){
      console.warn('qdb: impossibile caricare data/manifest.json via fetch:', err);
      if(window.PS_PREP_EMBEDDED_MANIFEST){
        QDB._manifest = window.PS_PREP_EMBEDDED_MANIFEST;
        console.info('qdb: usando manifest embedded in window.PS_PREP_EMBEDDED_MANIFEST');
        return QDB._manifest;
      }
      // fallback vuoto per mantenere l'app funzionante (alcune funzionalità potrebbero non avere domande)
      QDB._manifest = { materie: {} };
      return QDB._manifest;
    }
  }
  async function loadMateria(name){
    await loadManifest();
    if(QDB._cache[name]) return QDB._cache[name];
    const mats = (QDB._manifest && QDB._manifest.materie) ? QDB._manifest.materie : {};
    const files = mats[name] || [];
    let all = [];
    if(files.length>0){
      for(const rel of files){
        const url = 'data/' + rel.replace(/^\/+/, '');
        try{
          const r = await fetch(url);
          if(!r.ok) throw new Error('HTTP '+r.status);
          const data = await r.json();
            // Supporta più formati JSON: array top-level oppure oggetto con proprietà
            // `domande` (IT) o `questions` (EN). Questo permette di aggiornare i file
            // senza doverli convertire manualmente al formato precedente.
            let arr = [];
            if(Array.isArray(data)) arr = data;
            else if(data && Array.isArray(data.domande)) arr = data.domande;
            else if(data && Array.isArray(data.questions)) arr = data.questions;
            else {
              console.warn('qdb: formato dati non riconosciuto per', url);
            }
            if(arr.length) all = all.concat(arr);
        }catch(e){ console.error('Errore nel caricamento', url, e); }
      }
    } else {
      // Se non ci sono file nel manifest (es. apertura via file://), prova il fallback embedded
      try{
        if(window.PS_PREP_EMBEDDED_DATA && Array.isArray(window.PS_PREP_EMBEDDED_DATA[name])){
          all = (window.PS_PREP_EMBEDDED_DATA[name] || []).slice();
          console.info('qdb: caricate domande da window.PS_PREP_EMBEDDED_DATA["'+name+'"]');
        }
      }catch(_){ /* ignore */ }
    }
    QDB._cache[name] = all; return all;
  }
  QDB.init = async function(){
    await loadManifest();
    const names = Object.keys(QDB._manifest?.materie || {});
    await Promise.all(names.map(loadMateria)); return true;
  };
  QDB.getMateria = async function(name){
    if(!QDB._manifest) await loadManifest();
    return await loadMateria(name);
  };
  
  // --- Estensioni banca locale ---
  const LOCAL_KEY = "psprep_bank_v1";
  function readLocal(){ try{ return JSON.parse(localStorage.getItem(LOCAL_KEY)||"[]"); } catch(_){ return []; } }
  function writeLocal(arr){ localStorage.setItem(LOCAL_KEY, JSON.stringify(arr||[])); }
  QDB.addLocal = async function(questions){
    if(!Array.isArray(questions)) return 0;
    const cur = readLocal();
    const merged = cur.concat(questions);
    writeLocal(merged);
    // invalida cache: ricrea per materie toccate
    const mats = new Set((questions||[]).map(q=>q.materia).filter(Boolean));
    for(const m of mats){ delete QDB._cache[m]; }
    return questions.length;
  };
  QDB.clearLocal = function(){ writeLocal([]); QDB._cache={}; };
  QDB.getLocal = function(){ return readLocal(); };
  QDB.getAllMaterie = async function(){
    await loadManifest();
    const remote = Object.keys(QDB._manifest?.materie || {});
    const local = Array.from(new Set(readLocal().map(q=>q.materia).filter(Boolean)));
    return Array.from(new Set(remote.concat(local)));
  };
  QDB.getArgomenti = async function(materia){
    const pool = await QDB.getMateria(materia);
    return Array.from(new Set(pool.map(q=>q.argomento).filter(Boolean))).sort();
  };
  // override getMateria per includere banca locale
  const _origGetMateria = QDB.getMateria;
  QDB.getMateria = async function(name){
    const remote = await _origGetMateria(name);
    const local = readLocal().filter(q=>q.materia===name);
    return remote.concat(local);
  };
  window.qdb = QDB;

})();
