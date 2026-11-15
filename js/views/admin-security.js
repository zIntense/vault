import { api } from '../api.js';
import { clear, confirmDialog, fill, emptyState, formatAgo, formatDateTime, h, icon, pager, roleLabel, selectEl, toast } from '../dom.js';
import { adminTabs } from './admin-shared.js';

const PAGE_SIZE = 50;

const ACTION_LABELS = {
  login_ok: 'Inicio de sesión',
  login_fail: 'Contraseña incorrecta',
  login_blocked: 'Acceso bloqueado por intentos',
  logout: 'Cierre de sesión',
  upload_init: 'Subida iniciada',
  upload_complete: 'Subida completada',
  upload_rejected: 'Subida rechazada',
  upload_abort: 'Subida cancelada',
  file_update: 'Archivo editado',
  file_delete: 'Archivo eliminado',
  files_reorder: 'Archivos reordenados',
  category_create: 'Categoría creada',
  category_update: 'Categoría editada',
  category_delete: 'Categoría eliminada',
  session_revoke: 'Sesión revocada',
  sessions_revoke_all: 'Sesiones revocadas',
  download_missing: 'Descarga sin archivo',
};

function describeDevice(ua) {
  if (!ua) return 'Dispositivo desconocido';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl/i.test(ua) ? 'curl' : 'Navegador';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  return os ? `${browser} en ${os}` : browser;
}

function table(headers, rows) {
  return h(
    'div',
    { class: 'table-wrap' },
    h('table', { class: 'table' }, h('thead', null, h('tr', null, headers.map((t) => h('th', { scope: 'col' }, t)))), h('tbody', null, rows)),
  );
}

export function mount(root, { session }) {
  const state = { tab: 'sesiones', page: 1, action: '', token: 0 };
  const body = h('div');
  const tabBar = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Seguridad' });

  root.append(
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Administración'), h('p', null, 'Quién entró, qué se hizo y qué se descargó.'))),
    adminTabs('seguridad'),
    tabBar,
    body,
  );

  function renderTabs() {
    fill(
      tabBar,
      [
        ['sesiones', 'Sesiones activas'],
        ['actividad', 'Actividad'],
        ['descargas', 'Descargas'],
      ].map(([key, label]) =>
        h('button', { class: `tab${state.tab === key ? ' is-active' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(state.tab === key), onClick: () => switchTab(key) }, label),
      ),
    );
  }

  function switchTab(key) {
    state.tab = key;
    state.page = 1;
    state.action = '';
    renderTabs();
    load();
  }

  async function load() {
    const token = ++state.token;
    clear(body).append(h('p', { class: 'muted' }, 'Cargando…'));
    try {
      let view;
      if (state.tab === 'sesiones') view = sessionsView(await api.admin.sessions());
      else if (state.tab === 'actividad') view = auditView(await api.admin.audit({ page: state.page, pageSize: PAGE_SIZE, action: state.action }));
      else view = downloadsView(await api.admin.downloads({ page: state.page, pageSize: PAGE_SIZE }));
      if (token !== state.token) return;
      clear(body).append(view);
    } catch (err) {
      if (token !== state.token) return;
      clear(body);
      if (err.status !== 401) body.append(emptyState({ title: 'No se pudo cargar', text: err.message }));
    }
  }

  function sessionsView({ sessions }) {
    const others = sessions.filter((s) => !s.current).length;
    const rows = sessions.map((s) =>
      h(
        'tr',
        null,
        h('td', null, h('span', { class: `chip${s.role === 'admin' ? ' chip-accent' : ''}` }, roleLabel(s.role)), s.current ? h('span', { class: 'chip chip-ok', style: { marginLeft: '6px' } }, 'Esta sesión') : null),
        h('td', null, h('strong', null, describeDevice(s.userAgent))),
        h('td', { class: 'mono' }, s.ip ?? '—'),
        h('td', null, formatAgo(s.lastSeen)),
        h('td', null, formatDateTime(s.expiresAt)),
        h('td', { class: 'td-actions' }, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => revoke(s) }, s.current ? 'Cerrar esta sesión' : 'Revocar')),
      ),
    );
    return h(
      'div',
      null,
      h(
        'div',
        { class: 'panel-head' },
        h('p', { class: 'muted' }, sessions.length === 1 ? 'Hay 1 sesión activa.' : `Hay ${sessions.length} sesiones activas.`),
        h(
          'div',
          { class: 'inline-form' },
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: load }, icon('refresh', 14), 'Actualizar'),
          h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: others === 0, onClick: () => revokeAll(false) }, 'Cerrar las demás'),
          h('button', { class: 'btn btn-danger btn-sm', type: 'button', onClick: () => revokeAll(true) }, 'Cerrar todas'),
        ),
      ),
      sessions.length ? table(['Rol', 'Dispositivo', 'Red', 'Última actividad', 'Vence', ''], rows) : emptyState({ title: 'No hay sesiones activas' }),
    );
  }

  async function afterSelfRevoke() {
    try {
      await api.me();
    } catch {
    }
  }

  async function revoke(s) {
    if (s.current) {
      const ok = await confirmDialog({ title: 'Cerrar esta sesión', message: 'Saldrás de VAULT y tendrás que entrar de nuevo.', confirmText: 'Cerrar sesión' });
      if (!ok) return;
    }
    try {
      const res = await api.admin.revokeSession(s.id);
      toast('Sesión revocada', 'ok');
      if (res.current) return afterSelfRevoke();
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
    }
    load();
  }

  async function revokeAll(includeCurrent) {
    const ok = await confirmDialog({
      title: includeCurrent ? 'Cerrar todas las sesiones' : 'Cerrar las demás sesiones',
      message: includeCurrent ? 'Se cerrarán todas las sesiones, incluida la tuya. Todos tendrán que entrar de nuevo.' : 'Se cerrarán todas las sesiones excepto la tuya. Esas personas tendrán que entrar de nuevo.',
      confirmText: 'Cerrar sesiones',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.admin.revokeAllSessions(includeCurrent);
      toast(res.revoked === 1 ? 'Se cerró 1 sesión' : `Se cerraron ${res.revoked} sesiones`, 'ok');
      if (res.includedCurrent) return afterSelfRevoke();
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
    }
    load();
  }

  function auditView(data) {
    const filter = selectEl([['', 'Toda la actividad'], ...Object.entries(ACTION_LABELS)], state.action, (v) => {
      state.action = v;
      state.page = 1;
      load();
    }, { 'aria-label': 'Filtrar por acción' });
    const rows = data.entries.map((e) =>
      h(
        'tr',
        null,
        h('td', null, formatDateTime(e.ts)),
        h('td', null, h('strong', null, ACTION_LABELS[e.action] ?? e.action)),
        h('td', null, e.role ? roleLabel(e.role) : '—'),
        h('td', { class: 'cell-clip', title: e.detail ?? '' }, e.detail ?? '—'),
        h('td', { class: 'mono' }, e.ip ?? '—'),
      ),
    );
    return h(
      'div',
      null,
      h('div', { class: 'panel-head' }, h('p', { class: 'muted' }, `${data.total} ${data.total === 1 ? 'registro' : 'registros'}`), h('div', { style: { minWidth: '240px' } }, filter)),
      rows.length ? table(['Fecha', 'Acción', 'Rol', 'Detalle', 'Red'], rows) : emptyState({ title: 'Sin registros', text: 'No hay actividad con ese filtro.' }),
      pager({ page: data.page, pageSize: data.pageSize, total: data.total, onPage: (p) => { state.page = p; load(); } }),
    );
  }

  function downloadsView(data) {
    const rows = data.downloads.map((d) =>
      h('tr', null, h('td', null, formatDateTime(d.ts)), h('td', { class: 'cell-clip' }, h('strong', null, d.fileName), d.fileId ? null : h('span', { class: 'chip', style: { marginLeft: '8px' } }, 'Archivo eliminado')), h('td', null, d.role ? roleLabel(d.role) : '—'), h('td', { class: 'mono' }, d.ip ?? '—')),
    );
    return h(
      'div',
      null,
      h('div', { class: 'panel-head' }, h('p', { class: 'muted' }, `${data.total} ${data.total === 1 ? 'descarga' : 'descargas'}`), h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: load }, icon('refresh', 14), 'Actualizar')),
      rows.length ? table(['Fecha', 'Archivo', 'Rol', 'Red'], rows) : emptyState({ title: 'Todavía no hay descargas' }),
      pager({ page: data.page, pageSize: data.pageSize, total: data.total, onPage: (p) => { state.page = p; load(); } }),
    );
  }

  void session;
  renderTabs();
  load();
  return () => {
    state.token += 1;
  };
}
