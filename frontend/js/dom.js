const SVG_NS = 'http://www.w3.org/2000/svg';
const PROP_KEYS = new Set(['value', 'checked', 'disabled', 'selected', 'indeterminate', 'readOnly', 'required', 'multiple']);
const UNSAFE_URL = /^\s*(javascript|data|vbscript):/i;

function applyProps(el, props) {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style') Object.assign(el.style, value); // CSSOM: permitido por la CSP
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on')) {
      if (typeof value !== 'function') throw new TypeError(`${key} debe ser una función`);
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (PROP_KEYS.has(key)) el[key] = value;
    else if (key === 'href' || key === 'src') {
      if (!UNSAFE_URL.test(String(value))) el.setAttribute(key, value);
    } else el.setAttribute(key, value === true ? '' : String(value));
  }
}

function appendChildren(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) appendChildren(el, child);
    else if (child instanceof Node) el.append(child);
    else el.append(document.createTextNode(String(child)));
  }
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  appendChildren(el, children);
  return el;
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

export function add(el, ...children) {
  appendChildren(el, children);
  return el;
}

export function fill(el, ...children) {
  el.replaceChildren();
  appendChildren(el, children);
  return el;
}

const ICONS = {
  search: { c: [[11, 11, 8]], p: ['m21 21-4.3-4.3'] },
  lock: { r: [[3, 11, 18, 11, 2]], p: ['M7 11V7a5 5 0 0 1 10 0v4'] },
  download: { p: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'] },
  upload: { p: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'] },
  trash: { p: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'] },
  edit: { p: ['M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'] },
  x: { p: ['M18 6 6 18', 'm6 6 12 12'] },
  check: { p: ['M20 6 9 17l-5-5'] },
  eye: { p: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z'], c: [[12, 12, 3]] },
  eyeOff: {
    p: [
      'M9.88 9.88a3 3 0 1 0 4.24 4.24',
      'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68',
      'M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61',
      'm2 2 20 20',
    ],
  },
  logout: { p: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'] },
  shield: { p: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'] },
  folder: { p: ['M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'] },
  file: { p: ['M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z', 'M14 2v6h6'] },
  arrowUp: { p: ['m5 12 7-7 7 7', 'M12 19V5'] },
  arrowDown: { p: ['M12 5v14', 'm19 12-7 7-7-7'] },
  grip: { p: ['M9 5h.01', 'M9 12h.01', 'M9 19h.01', 'M15 5h.01', 'M15 12h.01', 'M15 19h.01'], bold: true },
  refresh: { p: ['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M3 21v-5h5'] },
  tag: { p: ['M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z', 'M7 7h.01'] },
  alert: { c: [[12, 12, 10]], p: ['M12 8v4', 'M12 16h.01'] },
  plus: { p: ['M5 12h14', 'M12 5v14'] },
  grid: { r: [[3, 3, 7, 7, 1], [14, 3, 7, 7, 1], [14, 14, 7, 7, 1], [3, 14, 7, 7, 1]] },
  monitor: { r: [[2, 3, 20, 14, 2]], p: ['M8 21h8', 'M12 17v4'] },
};

export function icon(name, size = 18) {
  const def = ICONS[name];
  const el = svg('svg', {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': def.bold ? 3 : 1.8,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    class: 'icon',
  });
  for (const d of def.p ?? []) el.append(svg('path', { d }));
  for (const [cx, cy, r] of def.c ?? []) el.append(svg('circle', { cx, cy, r }));
  for (const [x, y, width, height, rx] of def.r ?? []) el.append(svg('rect', { x, y, width, height, rx }));
  return el;
}

export function dialMark(size = 40) {
  const ticks = svg('g', { class: 'dial-ticks' });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const long = i % 6 === 0;
    const r1 = long ? 33 : 36;
    ticks.append(
      svg('line', {
        x1: (50 + Math.sin(a) * r1).toFixed(2),
        y1: (50 - Math.cos(a) * r1).toFixed(2),
        x2: (50 + Math.sin(a) * 41).toFixed(2),
        y2: (50 - Math.cos(a) * 41).toFixed(2),
      }),
    );
  }
  return svg(
    'svg',
    { viewBox: '0 0 100 100', width: size, height: size, class: 'dial', 'aria-hidden': 'true' },
    svg('circle', { class: 'dial-ring', cx: 50, cy: 50, r: 46 }),
    ticks,
    svg('circle', { class: 'dial-core', cx: 50, cy: 50, r: 22 }),
    svg('path', { class: 'dial-notch', d: 'M50 3 L57 16 H43 Z' }),
  );
}

const numberFmt = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' });
const dateTimeFmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'medium' });

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${numberFmt.format(v)} ${units[i]}`;
}

export const formatDate = (ts) => dateFmt.format(new Date(ts));
export const formatDateTime = (ts) => dateTimeFmt.format(new Date(ts));

export function formatAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'ahora';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

export function formatTime(ts) {
  return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

export const ROLE_LABELS = { guest: 'Invitado', sensei: 'Sensei', admin: 'Admin' };
export const roleLabel = (role) => ROLE_LABELS[role] ?? role ?? '—';

export function kindOf(ext) {
  const e = String(ext).toLowerCase();
  if (e === 'pdf') return 'pdf';
  if (e === 'docx') return 'doc';
  if (e === 'zip') return 'zip';
  if (e === 'txt') return 'txt';
  return 'img';
}

export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

export function toast(message, type = 'info') {
  const host = document.getElementById('toasts');
  if (!host) return;
  const icons = { ok: 'check', error: 'alert', info: 'shield' };
  const el = h('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' }, icon(icons[type] ?? 'shield', 16), h('span', null, message));
  const remove = () => el.remove();
  el.addEventListener('click', remove);
  host.append(el);
  while (host.children.length > 4) host.firstElementChild.remove();
  setTimeout(remove, type === 'error' ? 7000 : 4000);
}

function openDialog(dlg) {
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close(); 
  });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

export function modal({ title, body, footer, wide = false }) {
  const dlg = h(
    'dialog',
    { class: `dialog${wide ? ' dialog-wide' : ''}`, 'aria-label': title },
    h('header', { class: 'dialog-head' }, h('h2', null, title), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onClick: () => dlg.close() }, icon('x', 18))),
    h('div', { class: 'dialog-body' }, body),
    footer ? h('footer', { class: 'dialog-foot' }, footer) : null,
  );
  return openDialog(dlg);
}

export function confirmDialog({ title, message, confirmText = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const cancel = h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => dlg.close('cancel') }, 'Cancelar');
    const ok = h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', onClick: () => dlg.close('ok') }, confirmText);
    const dlg = h(
      'dialog',
      { class: 'dialog dialog-sm', 'aria-label': title },
      h('div', { class: 'dialog-body' }, h('h2', { class: 'dialog-title' }, title), h('p', { class: 'muted' }, message)),
      h('footer', { class: 'dialog-foot' }, cancel, ok),
    );
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'));
    openDialog(dlg);
    (danger ? cancel : ok).focus();
  });
}

export function pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return h('div', { class: 'pager pager-empty' });
  return h(
    'nav',
    { class: 'pager', 'aria-label': 'Paginación' },
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: page <= 1, onClick: () => onPage(page - 1) }, 'Anterior'),
    h('span', { class: 'pager-info' }, `Página ${page} de ${pages}`),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: page >= pages, onClick: () => onPage(page + 1) }, 'Siguiente'),
  );
}

export function selectEl(options, value, onChange, props = {}) {
  const el = h(
    'select',
    { class: 'select', ...props, onChange: (e) => onChange(e.target.value) },
    options.map(([val, label]) => h('option', { value: val, selected: String(val) === String(value) }, label)),
  );
  return el;
}

export function emptyState({ title, text, action }) {
  return h('div', { class: 'empty' }, icon('folder', 30), h('h3', null, title), text ? h('p', { class: 'muted' }, text) : null, action ?? null);
}
