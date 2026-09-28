/* 02 — Aviso de canto
   Uso: NL.toast.show() / NL.toast.hide()
   Atributos no .nl-toast:
     data-auto-show        aparece sozinho ao carregar (com pequeno atraso)
     data-snooze-hours     se definido, ao fechar não reaparece por N horas (localStorage) */
(function () {
  const toast = document.getElementById('nlRenewToast');
  if (!toast) return;

  const KEY = 'nl-renew-toast-snooze';
  const snoozeHours = Number(toast.dataset.snoozeHours) || 0;

  const isSnoozed = () => {
    if (!snoozeHours) return false;
    try { return Date.now() < Number(localStorage.getItem(KEY) || 0); } catch { return false; }
  };

  function show() {
    toast.classList.remove('is-leaving');
    toast.classList.add('is-visible');
    toast.dispatchEvent(new CustomEvent('nl:show'));
  }

  function hide() {
    toast.classList.add('is-leaving');
    toast.classList.remove('is-visible');
    if (snoozeHours) {
      try { localStorage.setItem(KEY, String(Date.now() + snoozeHours * 36e5)); } catch {}
    }
    toast.dispatchEvent(new CustomEvent('nl:hide'));
  }

  toast.addEventListener('click', (e) => { if (e.target.closest('[data-nl-dismiss]')) hide(); });
  toast.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

  document.querySelectorAll('[data-nl-show-toast]').forEach((b) => b.addEventListener('click', show));

  window.NL = window.NL || {};
  window.NL.toast = { show, hide, el: toast };

  if (toast.hasAttribute('data-auto-show') && !isSnoozed()) setTimeout(show, 600);
})();
