import { api } from '../api.js';
import { clear, dialMark, h, icon } from '../dom.js';

export function mountLogin(root, { notice, onLogin }) {
  const input = h('input', {
    class: 'input',
    id: 'password',
    name: 'password',
    type: 'password',
    autocomplete: 'current-password',
    autocapitalize: 'off',
    spellcheck: 'false',
    maxlength: 256,
    required: true,
    placeholder: 'Contraseña',
    'aria-describedby': 'login-message',
  });
  const toggle = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mostrar contraseña', 'aria-pressed': 'false' }, icon('eye', 18));
  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Entrar');
  const message = h('div', { id: 'login-message', role: 'alert' });
  const form = h(
    'form',
    { class: 'login-form', novalidate: true },
    h('div', { class: 'field' }, h('label', { for: 'password', class: 'sr-only' }, 'Contraseña'), h('div', { class: 'input-wrap has-toggle' }, icon('lock', 16), input, toggle)),
    message,
    submit,
  );

  const card = h(
    'div',
    { class: 'login-card' },
    h('div', { class: 'login-head login-dial' }, dialMark(72), h('h1', { class: 'login-title' }, 'VAULT'), h('p', { class: 'login-sub' }, 'Archivos privados. Entra con tu contraseña.')),
    form,
    h('p', { class: 'login-foot' }, 'Acceso restringido'),
  );
  const screen = h('div', { class: 'login' }, card);
  clear(root).append(screen);

  function show(text, kind = 'error') {
    clear(message);
    if (!text) return;
    message.append(h('div', { class: `form-error${kind === 'notice' ? ' form-notice' : ''}` }, icon('alert', 16), h('span', null, text)));
  }
  if (notice) show(notice, 'notice');

  function setBusy(busy) {
    screen.classList.toggle('is-working', busy);
    input.disabled = busy;
    submit.disabled = busy;
    submit.textContent = busy ? 'Verificando…' : 'Entrar';
  }

  toggle.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    toggle.replaceChildren(icon(visible ? 'eyeOff' : 'eye', 18));
    input.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = input.value;
    if (!password) {
      show('Escribe tu contraseña.');
      input.focus();
      return;
    }
    show(null);
    setBusy(true);
    try {
      await api.login(password);
      input.value = '';
      let me;
      try {
        me = await api.me({ silent: true });
      } catch {
        setBusy(false);
        show('La contraseña es correcta, pero tu navegador no guardó la sesión. VAULT necesita cookies de terceros: Safari y los modos de navegación privada suelen bloquearlas. Prueba con Chrome o Edge, o permite las cookies de este sitio.');
        return;
      }
      screen.classList.remove('is-working');
      screen.classList.add('is-open');
      setTimeout(() => onLogin(me), 420);
    } catch (err) {
      setBusy(false);
      input.select();
      if (err.status === 401) show('Contraseña incorrecta.');
      else if (err.status === 429) show(`Demasiados intentos. Vuelve a intentarlo en ${Math.max(1, Math.ceil(err.retryAfter / 60))} min.`);
      else show(err.message);
      input.focus();
    }
  });

  input.focus();
}
