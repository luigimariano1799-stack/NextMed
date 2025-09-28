// Netlify Function: user-data
// Scopo: persistere nel cloud i dati dell'utente (settings, reports, errors) usando Netlify Blobs.
// Auth: richiede utente autenticato con Netlify Identity (JWT gestito da Netlify).

let blobsLib = null;
try {
  blobsLib = require('@netlify/blobs');
} catch (e) {
  // la libreria non è disponibile: mostriamo un errore guidato
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

exports.handler = async function(event, context){
  // Verifica Identity
  const user = context && context.clientContext && context.clientContext.user;
  if(!user){
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Unauthorized: login richiesto.' }) };
  }
  const bucketName = 'nextmed-users';
  // Normalizza chiave: preferisci email (minuscola) per stabilità cross-device/provider, fallback a sub
  const email = (user.email || '').trim().toLowerCase();
  const sub = user.sub || '';
  const emailKey = email ? `${email}.json` : null;
  const subKey = sub ? `${sub}.json` : null;

  if(!blobsLib){
    return {
      statusCode: 501,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        error: 'Blobs non configurati',
        hint: 'Aggiungi @netlify/blobs alle dipendenze e abilita Netlify Blobs sul sito. '
      })
    };
  }

  const { createClient } = blobsLib;
  let client;
  try {
    client = createClient(); // in ambiente Netlify non richiede token
  } catch(e){
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Impossibile inizializzare Netlify Blobs', details: String(e && e.message || e) }) };
  }

  const store = client.blobStore(bucketName);

  // Helpers
  async function getFirstExisting(keys){
    for(const k of keys){
      if(!k) continue;
      try{
        const res = await store.get(k, { type: 'json' });
        if(res != null) return { key: k, doc: res };
      }catch(_){ /* ignore and try next */ }
    }
    return { key: (emailKey || subKey), doc: { settings:{}, reports:[], errors:{} } };
  }
  async function writeDocFor(keyToWrite, doc){
    const k = keyToWrite || emailKey || subKey || 'unknown.json';
    await store.set(k, JSON.stringify(doc), { contentType: 'application/json' });
  }
  function asArray(a){ return Array.isArray(a) ? a : []; }
  function repKey(r){
    if(!r || typeof r !== 'object') return '';
    if(r.id) return String(r.id);
    const m = r.mode||'';
    const mat = r.materia||'';
    const arg = r.argomento||'';
    const tot = r.overall && r.overall.total || 0;
    const cor = r.overall && r.overall.correct || 0;
    const ts = r.ts || 0;
    return `${m}|${mat}|${arg}|${cor}/${tot}|${ts}`;
  }
  function mergeReports(currentArr, incomingArr){
    const cur = asArray(currentArr);
    const inc = asArray(incomingArr);
    const map = new Map();
    for(const r of cur){ const k = repKey(r); if(!k) continue; map.set(k, r); }
    for(const r of inc){
      const k = repKey(r); if(!k) continue;
      const prev = map.get(k);
      if(!prev) map.set(k, r);
      else {
        // se esistono entrambi, tieni quello con ts maggiore (più recente)
        map.set(k, (r.ts||0) >= (prev.ts||0) ? r : prev);
      }
    }
    const merged = Array.from(map.values());
    merged.sort((a,b)=> (b.ts||0) - (a.ts||0));
    return merged.slice(0,250);
  }

  const method = (event.httpMethod || '').toUpperCase();
  try{
    if(method === 'GET'){
      // Prefer emailKey; se assente cerca subKey (migrazione trasparente)
      const { doc } = await getFirstExisting([emailKey, subKey]);
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(doc) };
    }
    if(method === 'PUT' || method === 'POST'){
      const body = event.body ? JSON.parse(event.body) : {};
      // se parziale, merge superficiale per compat; leggi prima da emailKey poi da subKey
      const existing = await getFirstExisting([emailKey, subKey]);
      let current = existing.doc || { settings:{}, reports:[], errors:{} };
      // Merge report con union per evitare duplicati e non perdere elementi cross-device
      const reports = (body.reports !== undefined)
        ? mergeReports(current.reports, body.reports)
        : asArray(current.reports);
      const next = {
        settings: body.settings !== undefined ? body.settings : (current.settings||{}),
        reports,
        errors: body.errors !== undefined ? body.errors : (current.errors||{})
      };
      // Scrivi preferendo emailKey per unificazione cross-device
      await writeDocFor(emailKey || existing.key, next);
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
    }
    if(method === 'DELETE'){
      // Cancella/azzera il doc nella chiave principale (email se disponibile)
      await writeDocFor(emailKey || subKey, { settings:{}, reports:[], errors:{} });
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
    }
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }catch(e){
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Server error', details: String(e && e.message || e) }) };
  }
};
