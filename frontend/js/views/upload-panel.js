
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_MB } from '../config.js';
import { clear, fill, formatBytes, h, icon, selectEl, toast } from '../dom.js';
import { extensionOf, uploadFile, validateFile } from '../upload.js';

const PARALLEL = 2;
let nextId = 1;

export function createUploadPanel({ onUploaded }) {
  const items = []; // { id, file, name, description, status, progress, message, ctl, view }
  let categories = [];

  const input = h('input', { type: 'file', multiple: true, hidden: true, accept: ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',') });
  const dropzone = h(
    'div',
    { class: 'dropzone', role: 'button', tabindex: '0', 'aria-label': 'Elegir archivos para subir' },
    icon('upload', 28),
    h('strong', null, 'Arrastra archivos aquí o haz clic para elegirlos'),
    h('small', null, `PDF, DOCX, ZIP, TXT e imágenes. Máximo ${MAX_UPLOAD_MB} MB por archivo.`),
  );

  const categorySel = h('select', { class: 'select' });
  const accessSel = selectEl(
    [
      ['sensei', 'Solo Sensei y Admin'],
      ['guest', 'Todos los usuarios'],
    ],
    'sensei',
    () => {},
  );
  const tagsInput = h('input', { class: 'input', type: 'text', maxlength: 200, placeholder: 'mates, guía, 2026' });
  const publishCheck = h('input', { type: 'checkbox' });
  const queue = h('div', { class: 'queue', 'aria-live': 'polite' });
  const startBtn = h('button', { class: 'btn btn-primary', type: 'button' }, icon('upload', 16), 'Subir');
  const clearBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, 'Quitar terminados');
  const optsBox = h(
    'div',
    null,
    h(
      'div',
      { class: 'upload-opts' },
      h('div', { class: 'field' }, h('label', null, 'Categoría'), categorySel),
      h('div', { class: 'field' }, h('label', null, 'Quién puede verlo'), accessSel),
      h('div', { class: 'field' }, h('label', null, 'Etiquetas (separadas por coma)'), tagsInput),
      h('label', { class: 'check' }, publishCheck, 'Publicar al terminar'),
    ),
    h('div', { class: 'upload-actions' }, clearBtn, startBtn),
  );
  optsBox.hidden = true;

  const el = h('section', { class: 'panel', 'aria-label': 'Subir archivos' }, h('div', { class: 'panel-head' }, h('h2', null, 'Subir archivos')), dropzone, input, queue, optsBox);

  // ───── Categorías ─────
  function setCategories(list) {
    categories = list;
    const current = categorySel.value;
    fill(categorySel, h('option', { value: '' }, 'Sin categoría'), list.map((c) => h('option', { value: c.id, selected: c.id === current }, c.name)));
  }

  // ───── Elegir y soltar ─────
  function addFiles(fileList) {
    for (const file of fileList) {
      const problem = validateFile(file);
      if (problem) {
        toast(`${file.name}: ${problem}.`, 'error');
        continue;
      }
      const ext = extensionOf(file.name);
      const item = { id: nextId++, file, name: file.name.slice(0, file.name.length - ext.length - 1), description: '', status: 'staged', progress: 0, message: '', ctl: null };
      item.view = buildItem(item);
      items.push(item);
      queue.append(item.view.el);
    }
    refresh();
  }

  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => {
    addFiles([...input.files]);
    input.value = '';
  });
  for (const type of ['dragenter', 'dragover']) {
    dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      dropzone.classList.add('is-over');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-over');
    });
  }
  dropzone.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));

  const swallow = (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault();
  };
  window.addEventListener('dragover', swallow);
  window.addEventListener('drop', swallow);

  function buildItem(item) {
    const nameInput = h('input', { class: 'input input-sm', type: 'text', maxlength: 200, value: item.name, 'aria-label': `Nombre para mostrar de ${item.file.name}`, placeholder: 'Nombre' });
    const descInput = h('input', { class: 'input input-sm', type: 'text', maxlength: 1000, 'aria-label': `Descripción de ${item.file.name}`, placeholder: 'Descripción (opcional)' });
    nameInput.addEventListener('input', () => (item.name = nameInput.value));
    descInput.addEventListener('input', () => (item.description = descInput.value));
    const status = h('span', { class: 'qitem-status' });
    const bar = h('div', { class: 'progress-bar' });
    const progress = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-label': `Progreso de ${item.file.name}` }, bar);
    const actions = h('div', { class: 'factions' });
    const fields = h('div', { class: 'qitem-fields' }, nameInput, descInput);
    const el = h(
      'div',
      { class: 'qitem' },
      h('div', { class: 'qitem-main' }, h('div', { class: 'qitem-line' }, icon('file', 16), h('span', { class: 'qitem-file' }, `${item.file.name} (${formatBytes(item.file.size)})`)), fields),
      h('div', { class: 'qitem-line' }, status, actions),
      progress,
    );
    progress.hidden = true;
    return { el, status, bar, progress, actions, fields, nameInput, descInput };
  }

  function renderItem(item) {
    const v = item.view;
    const labels = { staged: 'Listo para subir', queued: 'En espera', uploading: item.message || 'Subiendo…', done: 'Subido', error: item.message || 'Error', canceled: 'Cancelado' };
    v.status.textContent = item.status === 'uploading' && item.progress > 0 && item.progress < 1 ? `${Math.round(item.progress * 100)} %` : labels[item.status];
    v.status.className = `qitem-status${item.status === 'done' ? ' is-ok' : ''}${item.status === 'error' ? ' is-error' : ''}`;
    v.progress.hidden = item.status === 'staged';
    v.progress.className = `progress${item.status === 'done' ? ' is-done' : ''}${item.status === 'error' ? ' is-error' : ''}`;
    v.bar.style.width = `${Math.round((item.status === 'done' ? 1 : item.progress) * 100)}%`;
    v.progress.setAttribute('aria-valuenow', String(Math.round(item.progress * 100)));
    v.nameInput.disabled = v.descInput.disabled = item.status !== 'staged' && item.status !== 'error';
    clear(v.actions);
    if (item.status === 'staged' || item.status === 'done' || item.status === 'canceled') {
      v.actions.append(iconBtn('x', item.status === 'done' ? 'Quitar de la lista' : 'Quitar', () => removeItem(item)));
    } else if (item.status === 'error') {
      v.actions.append(iconBtn('refresh', 'Reintentar', () => retry(item)), iconBtn('x', 'Quitar', () => removeItem(item)));
    } else {
      v.actions.append(iconBtn('x', 'Cancelar subida', () => item.ctl && item.ctl.cancel()));
    }
  }

  const iconBtn = (name, label, onClick) => h('button', { class: 'icon-btn', type: 'button', title: label, 'aria-label': label, onClick }, icon(name, 16));

  function removeItem(item) {
    const i = items.indexOf(item);
    if (i >= 0) items.splice(i, 1);
    item.view.el.remove();
    refresh();
  }

  function retry(item) {
    item.status = 'staged';
    item.progress = 0;
    item.message = '';
    renderItem(item);
    refresh();
  }

  function refresh() {
    for (const item of items) renderItem(item);
    const staged = items.filter((i) => i.status === 'staged').length;
    const busy = items.some((i) => i.status === 'queued' || i.status === 'uploading');
    optsBox.hidden = items.length === 0;
    startBtn.disabled = staged === 0;
    startBtn.replaceChildren(icon('upload', 16), staged > 1 ? `Subir ${staged} archivos` : 'Subir archivo');
    clearBtn.hidden = !items.some((i) => ['done', 'canceled', 'error'].includes(i.status));
    categorySel.disabled = accessSel.disabled = tagsInput.disabled = publishCheck.disabled = false;
    if (busy) pump();
  }

  function sharedMeta() {
    return {
      categoryId: categorySel.value || null,
      minRole: accessSel.value,
      published: publishCheck.checked,
      tags: tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean),
    };
  }

  startBtn.addEventListener('click', () => {
    const meta = sharedMeta();
    for (const item of items) {
      if (item.status !== 'staged') continue;
      item.status = 'queued';
      item.meta = { ...meta, description: item.description.trim(), ...(item.name.trim() ? { displayName: item.name.trim() } : {}) };
    }
    refresh();
  });
  clearBtn.addEventListener('click', () => {
    for (const item of [...items]) if (['done', 'canceled', 'error'].includes(item.status)) removeItem(item);
  });

  function pump() {
    let running = items.filter((i) => i.status === 'uploading').length;
    for (const item of items) {
      if (running >= PARALLEL) break;
      if (item.status !== 'queued') continue;
      running++;
      run(item);
    }
  }

  async function run(item) {
    item.status = 'uploading';
    item.progress = 0;
    item.message = '';
    renderItem(item);
    item.ctl = uploadFile(item.file, item.meta, {
      onProgress: (frac) => {
        item.progress = frac;
        renderItem(item);
      },
      onStage: (text) => {
        item.message = text;
        renderItem(item);
      },
    });
    try {
      await item.ctl.promise;
      item.status = 'done';
      item.progress = 1;
      onUploaded();
    } catch (err) {
      item.status = err.canceled ? 'canceled' : 'error';
      item.message = err.canceled ? '' : err.message || 'No se pudo subir el archivo.';
    }
    item.ctl = null;
    refresh();
  }

  function dispose() {
    window.removeEventListener('dragover', swallow);
    window.removeEventListener('drop', swallow);
    for (const item of items) if (item.ctl) item.ctl.cancel();
  }

  return { el, setCategories, dispose };
}
