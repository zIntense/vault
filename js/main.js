import { api, authEvents } from './api.js';
import { clear, dialMark, formatTime, h, icon, roleLabel, toast } from './dom.js';
import { mountLogin } from './views/login.js';
import * as catalog from './views/catalog.js';
import * as adminFiles from './views/admin-files.js';
import * as adminCategories from './views/admin-categories.js';
import * as adminSecurity from './views/admin-security.js';

if (window.top !== window.self) {
  document.body.replaceChildren();
  throw new Error('VAULT no puede mostrarse dentro de otro sitio.');
}

const root = document.getElementById('app');

let session = null; 
let disposeView = null;
let mainEl = null;
let navLinks = [];

const ROUTES = {
  '#/catalogo': { view: catalog, nav: 'catalogo' },
  '#/admin/archivos': { view: adminFiles, nav: 'admin', admin: true },
  '#/admin/categorias': { view: adminCategories, nav: 'admin', admin: true },
  '#/admin/seguridad': { view: adminSecurity, nav: 'admin', admin: true },
};

function stopView() {
  if (disposeView) {
    try {
      disposeView();
    } catch {
    }
    disposeView = null;
  }
}

function showLogin(notice = null) {
  stopView();
  session = null;
  mainEl = null;
  history.replaceState(null, '', location.pathname + location.search);
  mountLogin(root, { notice, onLogin: startApp });
}

function startApp(me) {
  session = me;
  buildShell();
  renderRoute();
}

function buildShell() {
  const isAdmin = session.role === 'admin';
  navLinks = [
    ['catalogo', h('a', { class: 'nav-link', href: '#/catalogo' }, icon('grid', 16), 'Catálogo')],
  ];
  if (isAdmin) navLinks.push(['admin', h('a', { class: 'nav-link', href: '#/admin/archivos' }, icon('shield', 16), 'Administración')]);

  mainEl = h('main', { class: 'main', id: 'main' });
  clear(root).append(
    h(
      'div',
      { class: 'app' },
      h(
        'header',
        { class: 'topbar' },
        h('a', { class: 'brand', href: '#/catalogo', 'aria-label': 'VAULT, inicio' }, dialMark(28), 'VAULT'),
        h('nav', { class: 'nav', 'aria-label': 'Principal' }, navLinks.map(([, a]) => a)),
        h('div', { class: 'topbar-spacer' }),
        h(
          'div',
          { class: 'who' },
          h('div', { class: 'who-info' }, h('span', { class: 'who-role' }, roleLabel(session.role)), h('span', { class: 'who-exp' }, `Sesión hasta las ${formatTime(session.expiresAt)}`)),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: logout }, icon('logout', 16), 'Salir'),
        ),
      ),
      mainEl,
    ),
  );
}

function renderRoute() {
  if (!session || !mainEl) return;
  stopView();
  let hash = location.hash || '#/catalogo';
  if (hash === '#/admin') hash = '#/admin/archivos';
  let route = ROUTES[hash];
  if (!route || (route.admin && session.role !== 'admin')) {
    hash = '#/catalogo';
    route = ROUTES[hash];
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }
  for (const [key, a] of navLinks) {
    a.classList.toggle('is-active', key === route.nav);
    if (key === route.nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  clear(mainEl);
  window.scrollTo(0, 0);
  disposeView = route.view.mount(mainEl, { session }) ?? null;
}

async function logout() {
  try {
    await api.logout();
  } catch {
  }
  showLogin(null);
}

window.addEventListener('hashchange', renderRoute);

authEvents.addEventListener('unauthorized', () => {
  if (!session) return; 
  showLogin('Tu sesión terminó. Vuelve a entrar para continuar.');
});

async function boot() {
  try {
    startApp(await api.me({ silent: true }));
  } catch (err) {
    showLogin(err && err.status === 0 ? err.message : null);
  }
}

boot().catch((err) => {
  console.error(err);
  toast('No se pudo iniciar VAULT.', 'error');
});
