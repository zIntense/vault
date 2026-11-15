import { api } from '../api.js';
import { clear, confirmDialog, emptyState, h, icon, modal, toast } from '../dom.js';
import { adminTabs } from './admin-shared.js';

export function mount(root) {
  const state = { categories: [], token: 0 };

  const nameInput = h('input', { class: 'input', type: 'text', maxlength: 60, placeholder: 'Nombre de la categoría', 'aria-label': 'Nombre de la nueva categoría' });
  const createBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, icon('plus', 16), 'Crear categoría');
  const createForm = h('form', { class: 'inline-form', novalidate: true }, nameInput, createBtn);
  const list = h('div');

  root.append(
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Administración'), h('p', null, 'Las categorías agrupan los archivos en el catálogo.'))),
    adminTabs('categorias'),
    h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Nueva categoría')), createForm),
    h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Categorías')), list),
  );

  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    createBtn.disabled = true;
    try {
      await api.admin.createCategory({ name });
      nameInput.value = '';
      toast('Categoría creada', 'ok');
      await load();
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
    }
    createBtn.disabled = false;
    nameInput.focus();
  });

  async function load() {
    const token = ++state.token;
    try {
      const data = await api.admin.categories();
      if (token !== state.token) return;
      state.categories = data.categories;
    } catch (err) {
      if (token !== state.token) return;
      if (err.status !== 401) toast(err.message, 'error');
    }
    render();
  }

  function render() {
    clear(list);
    if (state.categories.length === 0) {
      list.append(emptyState({ title: 'Aún no hay categorías', text: 'Crea la primera arriba. Después podrás asignarla al subir o editar un archivo.' }));
      return;
    }
    const last = state.categories.length - 1;
    list.append(
      h(
        'div',
        { class: 'rows' },
        state.categories.map((c, i) =>
          h(
            'div',
            { class: 'cat-row' },
            h('div', { class: 'cat-name' }, h('strong', null, c.name), h('small', null, `${c.files} ${c.files === 1 ? 'archivo' : 'archivos'}, ${c.published} ${c.published === 1 ? 'publicado' : 'publicados'}`)),
            h('div', { class: 'chips' }, c.published > 0 ? h('span', { class: 'chip chip-ok' }, 'Visible') : h('span', { class: 'chip' }, 'Sin archivos visibles')),
            h(
              'div',
              { class: 'factions' },
              iconBtn('arrowUp', `Subir ${c.name}`, i === 0, () => moveCategory(i, i - 1)),
              iconBtn('arrowDown', `Bajar ${c.name}`, i === last, () => moveCategory(i, i + 1)),
              iconBtn('edit', `Renombrar ${c.name}`, false, () => openRename(c)),
              iconBtn('trash', `Eliminar ${c.name}`, false, () => remove(c), true),
            ),
          ),
        ),
      ),
    );
  }

  const iconBtn = (name, label, disabled, onClick, danger = false) =>
    h('button', { class: `icon-btn${danger ? ' is-danger' : ''}`, type: 'button', title: label, 'aria-label': label, disabled, onClick }, icon(name, 16));

  async function moveCategory(from, to) {
    const order = [...state.categories];
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item);
    state.categories = order;
    render();
    try {
      for (let i = 0; i < order.length; i++) {
        if (order[i].sortOrder !== i + 1) await api.admin.updateCategory(order[i].id, { sortOrder: i + 1 });
      }
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
    }
    load();
  }

  function openRename(c) {
    const input = h('input', { class: 'input', type: 'text', maxlength: 60, value: c.name, 'aria-label': 'Nuevo nombre' });
    const errorBox = h('div', { role: 'alert' });
    const save = h('button', { class: 'btn btn-primary', type: 'button' }, 'Guardar');
    const cancel = h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => dlg.close() }, 'Cancelar');
    const dlg = modal({ title: 'Renombrar categoría', body: h('div', { class: 'field' }, h('label', null, 'Nombre'), input, errorBox), footer: [cancel, save] });
    const submit = async () => {
      clear(errorBox);
      save.disabled = true;
      try {
        await api.admin.updateCategory(c.id, { name: input.value });
        dlg.close();
        toast('Categoría renombrada', 'ok');
        load();
      } catch (err) {
        save.disabled = false;
        if (err.status === 401) return dlg.close();
        errorBox.append(h('div', { class: 'form-error' }, icon('alert', 16), h('span', null, err.message)));
      }
    };
    save.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    input.select();
  }

  async function remove(c) {
    const ok = await confirmDialog({
      title: 'Eliminar categoría',
      message: c.files > 0 ? `Los ${c.files} archivos de “${c.name}” no se borran: quedarán sin categoría.` : `Se eliminará la categoría “${c.name}”.`,
      confirmText: 'Eliminar categoría',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.admin.deleteCategory(c.id);
      toast('Categoría eliminada', 'ok');
      load();
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
    }
  }

  load();
  return () => {
    state.token += 1;
  };
}
