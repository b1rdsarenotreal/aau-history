// App shell: loading the history, the top bar and page routing.

import { loadHistory, repairHistory, saveHistory } from './store.js?v=20261104004329';
import { loadLogoTable } from './logos.js?v=20261104004329';
import { ctx, app, esc } from './ui.js?v=20261104004329';
import { renderHome, renderChampions, renderSchools, renderSchool, renderCup, renderData } from './views.js?v=20261104004329';

const VIEWS = { home: 'Home', champions: 'Champions', schools: 'Schools', cup: 'All-Sports Cup', data: 'Data' };
const SUBVIEWS = { school: 'schools' };
const RENDER = { home: renderHome, champions: renderChampions, schools: renderSchools, school: () => renderSchool(routeArg()), cup: renderCup, data: renderData };

function currentView() { const v = location.hash.replace(/^#\/?/, '').split('/')[0]; return VIEWS[v] || SUBVIEWS[v] ? v : 'home'; }
function routeArg() { return decodeURIComponent(location.hash.replace(/^#\/?/, '').split('/').slice(1).join('/')); }

function render() {
  const v = currentView();
  document.getElementById('nav').innerHTML = Object.entries(VIEWS).map(([k, label]) => `<a href="#/${k}" class="${k === v || SUBVIEWS[v] === k ? 'active' : ''}">${label}</a>`).join('');
  try { RENDER[v](); } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="empty">Something went wrong showing this page: ${esc(e.message)}</div>`;
  }
}

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
