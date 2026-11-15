import { api } from '../api.js';
import { clear, confirmDialog, fill, debounce, emptyState, formatBytes, formatDate, h, icon, modal, pager, selectEl, toast } from '../dom.js';
import { ACCESS_LABELS, adminTabs } from './admin-shared.js';
import { createUploadPanel } from './upload-panel.js';

const PAGE_SIZE = 100;
const EMPTY_FILTERS = { q: '', category: '', status: '', published: '', from: '', to: '' };

export function mount(root) {
  const state = { filters: { ...EMPTY_FILTERS }, sort: 'order', page: 1, files: [], total: 0, categories: [], token: 0, loading: true, dragId: null };

  const upload = createUploadPanel({ onUploaded: debounce(() => load(), 400) });

  const qInput = h('input', { class: 'input', type: 'search', placeholder: 'Nombre, descripción o etiqueta', maxlength: 100, 'aria-label': 'Buscar archivos' });
  const catSel = h('select', { class: 'select', 'aria-label': 'Filtrar por categoría' });
  const statusSel = selectEl(
    [
      ['', 'Todos los estados'],
      ['ready', 'Listos'],
      ['pending', 'Subida incompleta'],
    ],
    '',
    (v) => setFilter('status', v),
    { 'aria-label': 'Filtrar por estado' },
  );
  const pubSel = selectEl(
    [
      ['', 'Publicados y no'],
      ['1', 'Publicados'],
      ['0', 'Sin publicar'],
    ],
    '',
    (v) => setFilter('published', v),
    { 'aria-label': 'Filtrar por publicación' },
  );
  const fromInput = h('input', { class: 'input', type: 'date', 'aria-label': 'Desde' });
  const toInput = h('input', { class: 'input', type: 'date', 'aria-label': 'Hasta' });
  const sortSel = selectEl(
    [
      ['order', 'Orden manual'],
      ['date_desc', 'Más recientes'],
      ['date_asc', 'Más antiguos'],
      ['name', 'Nombre (A-Z)'],
      ['size', 'Mayor tamaño'],
      ['downloads', 'Más descargados'],
    ],
    'order',
    (v) => {
      state.sort = v;
      state.page = 1;
      load();
    },
    { 'aria-label': 'Ordenar' },
  );
  const resetBtn = h('button', { class: 'btn btn-ghost', type: 'button', onClick: resetFilters }, 'Quitar filtros');

  const field = (label, control, cls = '') => h('div', { class: `field ${cls}` }, h('label', null, label), control);
  const filtersBox = h(
    'div',
    { class: 'filters' },
    field('Buscar', qInput, 'field-wide'),
    field('Categoría', catSel),
    field('Estado', statusSel),
    field('Publicación', pubSel),
    field('Desde', fromInput),
    field('Hasta', toInput),
    field('Orden', sortSel),
    h('div', { class: 'field' }, h('label', { class: 'sr-only' }, 'Acciones'), resetBtn),
  );

  const info = h('span', { class: 'result-info', 'aria-live': 'polite' });
  const list = h('div');
  const pagerBox = h('div');

  root.append(
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Administración'), h('p', null, 'Sube, ordena y publica los archivos que verán los usuarios.'))),
    adminTabs('archivos'),
    upload.el,
    h('section', { class: 'panel', 'aria-label': 'Archivos' }, h('div', { class: 'panel-head' }, h('h2', null, 'Archivos'), info), filtersBox, list, pagerBox),
  );

  qInput.addEventListener('input', debounce(() => setFilter('q', qInput.value.trim()), 250));
  catSel.addEventListener('change', () => setFilter('category', catSel.value));
  fromInput.addEventListener('change', () => setFilter('from', fromInput.value));
  toInput.addEventListener('change', () => setFilter('to', toInput.value));

  const hasFilters = () => Object.values(state.filters).some(Boolean);
  // Reordenar solo tiene sentido viendo TODOS los archivos en orden manual.
  const canReorder = () => state.sort === 'order' && !hasFilters() && state.total <= PAGE_SIZE;

  function setFilter(key, value) {
    state.filters[key] = value;
    state.page = 1;
    load();
  }
  function resetFilters() {
    state.filters = { ...EMPTY_FILTERS };
    state.sort = 'order';
    qInput.value = fromInput.value = toInput.value = '';
    catSel.value = statusSel.value = pubSel.value = '';
    sortSel.value = 'order';
    state.page = 1;
    load();
  }

  async function loadCategories() {
    try {
      state.categories = (await api.admin.categories()).categories;
    } catch {
      state.categories = [];
    }
    const current = state.filters.category;
    fill(
      catSel,
      h('option', { value: '' }, 'Todas las categorías'),
      h('option', { value: 'none', selected: current === 'none' }, 'Sin categoría'),
      state.categories.map((c) => h('option', { value: c.id, selected: c.id === current }, c.name)),
    );
    upload.setCategories(state.categories);
  }

  async function load() {
    const token = ++state.token;
    state.loading = true;
    try {
      const data = await api.admin.files({ ...state.filters, sort: state.sort, page: state.page, pageSize: PAGE_SIZE });
      if (token !== state.token) return;
      state.files = data.files;
      state.total = data.total;
    } catch (err) {
      if (token !== state.token) return;
      if (err.status !== 401) toast(err.message, 'error');
    }
    state.loading = false;
    render();
  }

  function render() {
    clear(list);
    clear(pagerBox);
    info.textContent = state.total === 1 ? '1 archivo' : `${state.total} archivos`;
    if (state.files.length === 0) {
      list.append(
        hasFilters()
          ? emptyState({ title: 'No hay resultados', text: 'Ningún archivo coincide con esos filtros.', action: h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: resetFilters }, 'Quitar filtros') })
          : emptyState({ title: 'Todavía no subiste archivos', text: 'Arrastra archivos a la zona de arriba para empezar.' }),
      );
      return;
    }
    const reorder = canReorder();
    const head = h(
      'div',
      { class: 'frow frow-head', role: 'row' },
      h('span'),
      h('span', null, 'Nombre'),
      h('span', null, 'Categoría'),
      h('span', null, 'Tamaño'),
      h('span', { class: 'col-date' }, 'Subido'),
      h('span', null, 'Acceso'),
      h('span', null, 'Público'),
      h('span', { class: 'col-dl' }, 'Desc.'),
      h('span'),
    );
    list.append(h('div', { class: 'rows', role: 'table', 'aria-label': 'Archivos' }, head, state.files.map((f, i) => fileRow(f, i, reorder))));
    if (!reorder && state.sort === 'order') {
      list.append(h('p', { class: 'muted', style: { fontSize: '13px', marginTop: '10px' } }, 'Para reordenar con las flechas o arrastrando, quita los filtros y deja el orden manual.'));
    }
    pagerBox.append(pager({ page: state.page, pageSize: PAGE_SIZE, total: state.total, onPage: (p) => { state.page = p; load(); } }));
  }

  function fileRow(f, index, reorder) {
    const ready = f.status === 'ready';
    const pub = h('input', { type: 'checkbox', checked: f.published, disabled: !ready, 'aria-label': `Publicado: ${f.name}` });
    pub.addEventListener('change', () => togglePublished(f, pub));
    const row = h(
      'div',
      { class: 'frow', role: 'row', draggable: reorder ? 'true' : null },
      h('span', { class: 'grip', title: reorder ? 'Arrastra para reordenar' : null }, reorder ? icon('grip', 16) : null),
      h('div', { class: 'fname' }, h('strong', { title: f.name }, f.name), h('small', { title: f.originalName }, ready ? f.originalName : 'Subida incompleta: elimínalo o vuelve a subirlo')),
      h(
        'div',
        { class: 'fmeta' },
        h('span', { class: 'fcell col-cat' }, f.category ? f.category.name : 'Sin categoría'),
        h('span', { class: 'fcell col-size' }, formatBytes(f.size)),
        h('span', { class: 'fcell col-date' }, formatDate(f.createdAt)),
        h('span', { class: `chip col-access${f.minRole === 'guest' ? ' chip-accent' : ''}`, title: ACCESS_LABELS[f.minRole] }, f.minRole === 'guest' ? 'Todos' : 'Solo Sensei'),
      ),
      h('div', { class: 'fswitch' }, h('span', { class: 'cell-label muted' }, 'Público'), h('label', { class: 'switch col-pub' }, pub, h('span', { class: 'switch-track' }))),
      h('span', { class: 'fcell col-dl', title: 'Descargas' }, String(f.downloadCount)),
      h(
        'div',
        { class: 'factions' },
        h('button', { class: 'icon-btn', type: 'button', title: 'Subir en la lista', 'aria-label': `Subir ${f.name} en la lista`, disabled: !reorder || index === 0, onClick: () => move(index, index - 1) }, icon('arrowUp', 16)),
        h('button', { class: 'icon-btn', type: 'button', title: 'Bajar en la lista', 'aria-label': `Bajar ${f.name} en la lista`, disabled: !reorder || index === state.files.length - 1, onClick: () => move(index, index + 1) }, icon('arrowDown', 16)),
        h('button', { class: 'icon-btn', type: 'button', title: 'Editar', 'aria-label': `Editar ${f.name}`, disabled: !ready, onClick: () => openEdit(f) }, icon('edit', 16)),
        h('button', { class: 'icon-btn is-danger', type: 'button', title: 'Eliminar', 'aria-label': `Eliminar ${f.name}`, onClick: () => remove(f) }, icon('trash', 16)),
      ),
    );
    if (reorder) wireDrag(row, f);
    return row;
  }

  function wireDrag(row, f) {
    row.addEventListener('dragstart', (e) => {
      state.dragId = f.id;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', f.id);
    });
    row.addEventListener('dragend', () => {
      state.dragId = null;
      row.classList.remove('is-dragging');
      for (const el of list.querySelectorAll('.is-drop-target')) el.classList.remove('is-drop-target');
    });
    row.addEventListener('dragover', (e) => {
      if (!state.dragId || state.dragId === f.id) return;
      e.preventDefault();
      row.classList.add('is-drop-target');
    });
    row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('is-drop-target');
      const from = state.files.findIndex((x) => x.id === state.dragId);
      const to = state.files.findIndex((x) => x.id === f.id);
      if (from >= 0 && to >= 0) move(from, to);
    });
  }

  async function move(from, to) {
    if (to < 0 || to >= state.files.length || from === to) return;
    const [item] = state.files.splice(from, 1);
    state.files.splice(to, 0, item);
    render();
    try {
      await api.admin.reorderFiles(state.files.map((x) => x.id));
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
      load(); 
    }
  }

  async function togglePublished(f, checkbox) {
    const wanted = checkbox.checked;
    checkbox.disabled = true;
    try {
      const { file } = await api.admin.updateFile(f.id, { published: wanted });
      Object.assign(f, file);
      toast(wanted ? 'Archivo publicado' : 'Archivo oculto', 'ok');
    } catch (err) {
      checkbox.checked = !wanted;
      if (err.status !== 401) toast(err.message, 'error');
    }
    checkbox.disabled = false;
  }

  async function remove(f) {
    const ok = await confirmDialog({
      title: 'Eliminar archivo',
      message: `“${f.name}” se borrará del almacenamiento y dejará de estar disponible. No se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.admin.deleteFile(f.id);
      toast('Archivo eliminado', 'ok');
      load();
      loadCategories();
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
    }
  }

  function openEdit(f) {
    const name = h('input', { class: 'input', type: 'text', maxlength: 200, value: f.name });
    const desc = h('textarea', { class: 'textarea', maxlength: 1000 });
    desc.value = f.description;
    const cat = h('select', { class: 'select' }, h('option', { value: '' }, 'Sin categoría'), state.categories.map((c) => h('option', { value: c.id, selected: f.category && c.id === f.category.id }, c.name)));
    const tags = h('input', { class: 'input', type: 'text', maxlength: 200, value: f.tags.join(', '), placeholder: 'mates, guía, 2026' });
    const access = selectEl(
      [
        ['sensei', 'Solo Sensei y Admin'],
        ['guest', 'Todos los usuarios'],
      ],
      f.minRole,
      () => {},
    );
    const published = h('input', { type: 'checkbox', checked: f.published });
    const errorBox = h('div', { role: 'alert' });
    const save = h('button', { class: 'btn btn-primary', type: 'button' }, 'Guardar cambios');
    const cancel = h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => dlg.close() }, 'Cancelar');

    const body = h(
      'div',
      { class: 'form-grid' },
      h('div', { class: 'field span-2' }, h('label', null, 'Nombre'), name),
      h('div', { class: 'field span-2' }, h('label', null, 'Descripción'), desc),
      h('div', { class: 'field' }, h('label', null, 'Categoría'), cat),
      h('div', { class: 'field' }, h('label', null, 'Quién puede verlo'), access),
      h('div', { class: 'field span-2' }, h('label', null, 'Etiquetas (separadas por coma)'), tags),
      h('label', { class: 'check span-2' }, published, 'Publicado: visible en el catálogo'),
      h('p', { class: 'muted span-2', style: { fontSize: '13px' } }, `Archivo original: ${f.originalName}. ${formatBytes(f.size)}, subido el ${formatDate(f.createdAt)}, ${f.downloadCount} descargas.`),
      h('div', { class: 'span-2' }, errorBox),
    );
    const dlg = modal({ title: 'Editar archivo', body, footer: [cancel, save], wide: true });

    save.addEventListener('click', async () => {
      clear(errorBox);
      save.disabled = true;
      save.textContent = 'Guardando…';
      try {
        await api.admin.updateFile(f.id, {
          displayName: name.value,
          description: desc.value,
          categoryId: cat.value || null,
          tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean),
          minRole: access.value,
          published: published.checked,
        });
        dlg.close();
        toast('Cambios guardados', 'ok');
        load();
        loadCategories();
      } catch (err) {
        save.disabled = false;
        save.textContent = 'Guardar cambios';
        if (err.status === 401) return dlg.close();
        errorBox.append(h('div', { class: 'form-error' }, icon('alert', 16), h('span', null, err.message)));
      }
    });
    name.focus();
  }

  loadCategories();
  load();

  return () => {
    state.token += 1;
    upload.dispose();
  };
}
