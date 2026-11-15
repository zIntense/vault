import { ApiError, api, downloadFile } from '../api.js';
import { add, clear, debounce, emptyState, formatBytes, formatDate, h, icon, kindOf, toast } from '../dom.js';

const PAGE_SIZE = 24;
const KIND_ICON = { pdf: 'file', doc: 'file', zip: 'folder', txt: 'file', img: 'file' };

export function mount(root, { session }) {
  const state = { q: '', category: '', page: 1, files: [], total: 0, loading: true, token: 0, categories: [] };

  const search = h('input', { class: 'input', type: 'search', placeholder: 'Buscar por nombre, descripción o etiqueta', maxlength: 100, 'aria-label': 'Buscar archivos' });
  const info = h('span', { class: 'result-info', 'aria-live': 'polite' });
  const side = h('aside', { class: 'side', 'aria-label': 'Categorías' });
  const grid = h('div', { class: 'grid' });
  const moreBox = h('div', { class: 'more' });

  root.append(
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Catálogo'), h('p', null, session.role === 'admin' ? 'Así ven el catálogo los usuarios. La gestión está en Administración.' : 'Archivos disponibles para ti.'))),
    h('div', { class: 'toolbar' }, h('div', { class: 'input-wrap' }, icon('search', 16), search), info),
    h('div', { class: 'catalog' }, side, h('section', { 'aria-label': 'Archivos' }, grid, moreBox)),
  );

  async function loadCategories() {
    try {
      state.categories = (await api.categories()).categories;
    } catch {
      state.categories = [];
    }
    renderSide();
  }

  async function loadFiles({ append = false } = {}) {
    const token = ++state.token;
    state.loading = true;
    if (!append) renderGrid();
    try {
      const data = await api.files({ q: state.q, category: state.category, page: state.page, pageSize: PAGE_SIZE });
      if (token !== state.token) return; // llegó tarde: ya hay una búsqueda más nueva
      state.files = append ? [...state.files, ...data.files] : data.files;
      state.total = data.total;
    } catch (err) {
      if (token !== state.token) return;
      if (err.status !== 401) toast(err.message, 'error');
      if (!append) state.files = [];
      state.total = state.files.length;
    }
    state.loading = false;
    renderGrid();
  }

  function renderSide() {
    clear(side);
    if (state.categories.length === 0) {
      side.hidden = true;
      return;
    }
    side.hidden = false;
    const item = (id, name, count) =>
      h(
        'button',
        { class: `side-link${state.category === id ? ' is-active' : ''}`, type: 'button', 'aria-pressed': String(state.category === id), onClick: () => setCategory(id) },
        h('span', null, name),
        count !== undefined ? h('span', { class: 'count' }, count) : null,
      );
    add(side, h('div', { class: 'side-title' }, 'Categorías'), item('', 'Todos'), state.categories.map((c) => item(c.id, c.name, c.count)));
  }

  function renderGrid() {
    clear(grid);
    clear(moreBox);
    if (state.loading && state.files.length === 0) {
      info.textContent = '';
      for (let i = 0; i < 6; i++) grid.append(h('div', { class: 'skeleton', 'aria-hidden': 'true' }));
      return;
    }
    info.textContent = state.total === 1 ? '1 archivo' : `${state.total} archivos`;
    if (state.files.length === 0) {
      const filtered = state.q || state.category;
      grid.append(
        h(
          'div',
          { style: { gridColumn: '1 / -1' } },
          emptyState(
            filtered
              ? { title: 'No hay resultados', text: 'Prueba con otro término o quita el filtro de categoría.', action: h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: clearFilters }, 'Quitar filtros') }
              : { title: 'Aún no hay archivos', text: 'Cuando se publiquen archivos para tu rol, aparecerán aquí.' },
          ),
        ),
      );
      return;
    }
    for (const f of state.files) grid.append(fileCard(f));
    if (state.files.length < state.total) {
      moreBox.append(h('button', { class: 'btn btn-ghost', type: 'button', disabled: state.loading, onClick: loadMore }, `Mostrar más (${state.total - state.files.length} restantes)`));
    }
  }

  function fileCard(f) {
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'button' }, icon('download', 16), 'Descargar');
    btn.addEventListener('click', () => startDownload(btn, f));
    const kind = kindOf(f.extension);
    return h(
      'article',
      { class: 'card' },
      h('div', { class: 'plate', dataset: { kind } }, h('span', { class: 'plate-ext' }, f.extension), icon(KIND_ICON[kind], 22)),
      h(
        'div',
        { class: 'card-body' },
        f.category ? h('span', { class: 'card-cat' }, f.category.name) : null,
        h('h3', { class: 'card-title' }, f.name),
        f.description ? h('p', { class: 'card-desc' }, f.description) : null,
        f.tags.length ? h('div', { class: 'tags' }, f.tags.map((t) => h('button', { class: 'tag', type: 'button', title: `Buscar “${t}”`, onClick: () => searchFor(t) }, t))) : null,
      ),
      h('div', { class: 'card-foot' }, stat('Tamaño', formatBytes(f.size)), stat('Publicado', formatDate(f.createdAt))),
      h('div', { class: 'card-action' }, btn),
    );
  }

  const stat = (label, value) => h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value' }, value));

  async function startDownload(btn, f) {
    btn.disabled = true;
    btn.replaceChildren(icon('refresh', 16), 'Preparando…');
    try {
      const name = await downloadFile(f.id);
      toast(`Descargando ${name}`, 'ok');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toast('Este archivo ya no está disponible.', 'error');
        resetAndLoad();
      } else if (err.status !== 401) toast(err.message, 'error');
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.replaceChildren(icon('download', 16), 'Descargar');
      }, 900);
    }
  }

  function resetAndLoad() {
    state.page = 1;
    loadFiles();
    loadCategories();
  }
  function setCategory(id) {
    state.category = id;
    state.page = 1;
    renderSide();
    loadFiles();
  }
  function searchFor(text) {
    search.value = text;
    state.q = text;
    state.page = 1;
    loadFiles();
  }
  function clearFilters() {
    search.value = '';
    state.q = '';
    state.category = '';
    state.page = 1;
    renderSide();
    loadFiles();
  }
  function loadMore() {
    state.page += 1;
    loadFiles({ append: true });
  }

  const onSearch = debounce(() => {
    state.q = search.value.trim();
    state.page = 1;
    loadFiles();
  }, 250);
  search.addEventListener('input', onSearch);

  loadCategories();
  loadFiles();

  return () => {
    state.token += 1;
    onSearch.cancel();
  };
}
