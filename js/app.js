// App shell: loading the history, the top bar and page routing.

import { loadHistory, repairHistory, saveHistory } from './store.js?v=20261105224258';
import { loadLogoTable } from './logos.js?v=20261105224258';
import { renderSchool } from './school.js?v=20261105224258';
import { renderTournament } from './tournament.js?v=20261105224258';
import { ctx, app, esc } from './ui.js?v=20261105224258';
import { renderHome, renderChampions, renderSchools, renderCup, renderData } from './views.js?v=20261105224258';

const VIEWS = { home: 'Home', champions: 'Champions', tournament: 'Tournaments', schools: 'Schools', cup: 'All-Sports Cup', data: 'Data' };
const SUBVIEWS = { school: 'schools' };
const RENDER = { home: renderHome, champions: renderChampions, schools: renderSchools, school: () => renderSchool(routeParts()), tournament: () => renderTournament(routeParts()), cup: renderCup, data: renderData };

function currentView() { const v = location.hash.replace(/^#\/?/, '').split('/')[0]; return VIEWS[v] || SUBVIEWS[v] ? v : 'home'; }
// The route's parts after the page name, each decoded (a school name may hold any character).
function routeParts() { return location.hash.replace(/^#\/?/, '').split('/').slice(1).map(p => { try { return decodeURIComponent(p); } catch { return p; } }); }

function render() {
  const v = currentView();
  document.getElementById('nav').innerHTML = Object.entries(VIEWS).map(([k, label]) => `<a href="#/${k}" class="${k === v || SUBVIEWS[v] === k ? 'active' : ''}">${label}</a>`).join('');
  try { RENDER[v](); } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="empty">Something went wrong showing this page: ${esc(e.message)}</div>`;
  }
}

// Brackets are fitted to the window, so draw them again when it resizes.
let resizeTimer = null;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (currentView() === 'tournament') render(); }, 150); });

let lastView = null;
window.addEventListener('hashchange', () => { const v = currentView(); render(); if (v !== lastView) window.scrollTo(0, 0); lastView = v; });

async function boot() {
  ctx.render = render;
  ctx.history = await loadHistory();
  const removed = repairHistory(ctx.history);
  if (removed.length) {
    await saveHistory(ctx.history);
    ctx.notice = removed.map(r => `Your ${r.name} history had another sport's backup in it (${r.fileName}), so it was cleared. Upload your ${r.name} backup again, and ${r.fileName} too.`).join(' ');
  }
  render();
  // Logos load in the background; draw again once they're in.
  loadLogoTable().then(render).catch(() => {});
}
boot();
