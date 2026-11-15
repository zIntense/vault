import { api } from './api.js';
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_MB } from './config.js';

export class UploadError extends Error {
  constructor(message, canceled = false) {
    super(message);
    this.name = 'UploadError';
    this.canceled = canceled;
  }
}

export function extensionOf(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}


export function validateFile(file) {
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `tipo no permitido (.${ext || '?'})`;
  if (file.size === 0) return 'el archivo está vacío';
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `supera los ${MAX_UPLOAD_MB} MB`;
  return null;
}

function putToStorage({ url, method, headers }, file, onProgress, setXhr) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    setXhr(xhr);
    xhr.open(method, url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 403) reject(new UploadError('El almacenamiento rechazó la subida: la URL venció o la configuración de R2 no coincide.'));
      else reject(new UploadError(`El almacenamiento respondió con un error (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new UploadError('No se pudo conectar con el almacenamiento. Revisa la política CORS del bucket de R2.'));
    xhr.onabort = () => reject(new UploadError('Subida cancelada.', true));
    xhr.send(file);
  });
}

export function uploadFile(file, meta, { onProgress, onStage }) {
  let xhr = null;
  let fileId = null;
  let canceled = false;

  const promise = (async () => {
    onStage('Preparando…');
    const init = await api.admin.uploadInit({ fileName: file.name, size: file.size, ...meta });
    fileId = init.fileId;
    if (canceled) throw new UploadError('Subida cancelada.', true);
    onStage('Subiendo…');
    await putToStorage(init.upload, file, onProgress, (x) => {
      xhr = x;
    });
    onStage('Verificando…');
    return (await api.admin.uploadComplete(fileId)).file;
  })().catch(async (err) => {
    if (fileId) {
      try {
        await api.admin.uploadAbort(fileId); 
      } catch {
      }
    }
    throw err;
  });

  return {
    promise,
    cancel() {
      canceled = true;
      if (xhr) xhr.abort();
    },
  };
}
