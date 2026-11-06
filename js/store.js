// The combined history lives in this browser (IndexedDB, with a localStorage
// fallback): { dynasties: { sportId: extract }, updated }. Uploading a
// backup again replaces that sport's seasons with the new ones and keeps any
// older seasons the new file no longer has. Download/Restore move it.

import { sportWord, sportFamily } from './sports.js?v=20261105222751';
const DB = 'aau-history', STORE = 'kv', KEY = 'aau-history';

function idb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const emptyHistory = () => ({ dynasties: {}, updated: null });

export async function loadHistory() {
  try {
    const db = await idb();
    const v = await new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    if (v) return v;
  } catch { /* fall through */ }
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') || emptyHistory(); } catch { return emptyHistory(); }
}

export async function saveHistory(h) {
  h.updated = new Date().toISOString();
  try {
    const db = await idb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(h, KEY);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    return;
  } catch { /* fall through */ }
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* quota */ }
}

// Add (or refresh) one dynasty's history. Seasons in the new extract win;
// seasons only in the old one are kept. Returns { added, updated, kept }.
export function mergeDynasty(h, ext, meta = {}) {
  const id = ext.sport.id, old = h.dynasties[id];
  const years = { ...(old?.years || {}) };
  let added = 0, updated = 0;
  for (const [y, s] of Object.entries(ext.years)) { years[y] ? updated++ : added++; years[y] = s; }
  const kept = old ? Object.keys(old.years).filter(y => !(y in ext.years)).length : 0;
  h.dynasties[id] = {
    ...ext, years,
    schools: { ...(old?.schools || {}), ...ext.schools },
    conferences: { ...(old?.conferences || {}), ...ext.conferences },
    uploadedAt: new Date().toISOString(), fileName: meta.fileName || old?.fileName || '',
  };
  return { added, updated, kept };
}

// A backup filed under the wrong sport (an older AAU History took
// untagged women's basketball for volleyball): an entry whose file name names
// another sport is removed, so both backups can be uploaded again. Returns
// what was removed.
export function repairHistory(h) {
  const removed = [];
  for (const [id, d] of Object.entries(h?.dynasties || {})) {
    const fam = sportFamily(d.sport), named = sportWord(d.fileName);
    if (fam && named && named !== fam) { removed.push({ name: d.sport.name, fileName: d.fileName }); delete h.dynasties[id]; }
  }
  return removed;
}

export function exportHistory(h) {
  const blob = new Blob([JSON.stringify(h)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `AAU-History-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const isHistoryBackup = d => !!(d && d.dynasties && typeof d.dynasties === 'object' && !d.seasons);
