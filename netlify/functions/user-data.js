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
  const userId = user.sub || user.email || 'unknown';
  const bucketName = 'nextmed-users';
  const key = `${userId}.json`;

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
  async function readDoc(){
    try {
      const res = await store.get(key, { type: 'json' });
      if(res == null) return { settings:{}, reports:[], errors:{} };
      return res;
    } catch(e){
      // se il blob non esiste o altro errore: inizializza doc vuoto
      return { settings:{}, reports:[], errors:{} };
    }
  }
  async function writeDoc(doc){
    await store.set(key, JSON.stringify(doc), { contentType: 'application/json' });
  }

  const method = (event.httpMethod || '').toUpperCase();
  try{
    if(method === 'GET'){
      const doc = await readDoc();
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(doc) };
    }
    if(method === 'PUT' || method === 'POST'){
      const body = event.body ? JSON.parse(event.body) : {};
      // se parziale, merge superficiale per compat
      let current = await readDoc();
      const next = {
        settings: body.settings !== undefined ? body.settings : (current.settings||{}),
        reports: body.reports !== undefined ? body.reports : (current.reports||[]),
        errors: body.errors !== undefined ? body.errors : (current.errors||{})
      };
      await writeDoc(next);
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
    }
    if(method === 'DELETE'){
      await writeDoc({ settings:{}, reports:[], errors:{} });
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
    }
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }catch(e){
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Server error', details: String(e && e.message || e) }) };
  }
};
