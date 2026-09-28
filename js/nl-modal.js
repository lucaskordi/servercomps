/* Popups (01 — vencimento, 04 — pagamento em atraso)
   Uso: NL.modals[id].open() / .close()  (NL.modal = primeiro popup da página)
   Atributos no .nl-modal:
     data-auto-open        abre sozinho ao carregar
     data-checkout-url     destino do CTA (recebe ?plano=mensal|anual quando há seletor de plano)
   Botões externos: <button data-nl-open-modal="idDoModal">                     */
(function () {
  const NL = (window.NL = window.NL || {});
  const modals = (NL.modals = {});

  function init(modal) {
    const panel = modal.querySelector('.nl-modal__panel');
    const cta = modal.querySelector('[data-nl-cta]');
    const ctaLabel = cta && cta.querySelector('.nl-btn__label');
    const checkoutUrl = modal.dataset.checkoutUrl || 'checkout.html';
    let lastFocus = null;

    const focusables = () =>
      [...panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')]
        .filter((el) => el.offsetParent !== null);

    function open() {
      lastFocus = document.activeElement;
      modal.classList.add('is-open');
      document.documentElement.style.overflow = 'hidden';
      setTimeout(() => (cta || focusables()[0])?.focus({ preventScroll: true }), 80);
      modal.dispatchEvent(new CustomEvent('nl:open'));
    }

    function close() {
      modal.classList.remove('is-open');
      document.documentElement.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      modal.dispatchEvent(new CustomEvent('nl:close'));
    }

    modal.addEventListener('click', (e) => { if (e.target.closest('[data-nl-close]')) close(); });

    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') return close();
      if (e.key === 'Tab') {
        const els = focusables();
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Seletor de plano (se houver) atualiza destino e texto do CTA
    const plans = modal.querySelector('.nl-plans');
    if (plans && cta) {
      NL.bindPlanPicker(plans, (plan) => {
        cta.href = `${checkoutUrl}?plano=${plan}`;
        if (ctaLabel) ctaLabel.textContent = plan === 'anual' ? 'Renovar com 20% off' : 'Renovar mensal';
      });
    }

    const api = { open, close, el: modal };
    modals[modal.id] = api;
    if (!NL.modal) NL.modal = api;

    if (modal.hasAttribute('data-auto-open')) setTimeout(open, 350);
  }

  document.querySelectorAll('.nl-modal').forEach(init);

  document.querySelectorAll('[data-nl-open-modal]').forEach((b) =>
    b.addEventListener('click', () => (modals[b.dataset.nlOpenModal] || NL.modal)?.open())
  );
})();
