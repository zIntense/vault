import { h, icon } from '../dom.js';

export function adminTabs(active) {
  const tabs = [
    ['archivos', 'Archivos', 'file'],
    ['categorias', 'Categorías', 'folder'],
    ['seguridad', 'Seguridad', 'shield'],
  ];
  return h(
    'nav',
    { class: 'tabs', 'aria-label': 'Secciones de administración' },
    tabs.map(([key, label, ic]) => h('a', { class: `tab${key === active ? ' is-active' : ''}`, href: `#/admin/${key}`, 'aria-current': key === active ? 'page' : null }, icon(ic, 16), label)),
  );
}

export const ACCESS_LABELS = { guest: 'Todos', sensei: 'Solo Sensei y Admin' };
