/* 03 — Checkout transparente
   Front-end apenas: máscaras, validação, resumo dinâmico e estados de sucesso.
   Integração com gateway: substitua a função `submitPayment` abaixo.           */
(function () {
  const root = document.getElementById('nlCheckoutRoot');
  const form = document.getElementById('nlCheckout');
  if (!root || !form) return;

  const NL = window.NL;
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const digits = (v) => v.replace(/\D/g, '');

  const daysLeft = Number(root.dataset.daysLeft) || 0;
  const dueDate = NL.addDays(new Date(), daysLeft);
  const METHOD_LABEL = { card: 'Cartão de crédito', pix: 'Pix' };

  const state = { plan: 'anual', method: 'card', touched: new Set() };

  // --- Estado inicial via query string --------------------------------------
  const params = new URLSearchParams(location.search);
  if (NL.plans[params.get('plano')]) state.plan = params.get('plano');
  if (METHOD_LABEL[params.get('metodo')]) state.method = params.get('metodo');

  $$('[data-co-server]').forEach((el) => (el.textContent = root.dataset.server || el.textContent));

  // --- Plano -----------------------------------------------------------------
  $$('input[name="plan"]').forEach((r) => {
    r.checked = r.value === state.plan;
    r.addEventListener('change', () => {
      if (!r.checked) return;
      state.plan = r.value;
      render();
    });
  });

  // --- Tabs de pagamento -----------------------------------------------------
  const tabs = $$('[role="tab"]');
  function selectMethod(method, focus) {
    state.method = method;
    tabs.forEach((t) => {
      const on = t.dataset.method === method;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    render();
  }
  tabs.forEach((t) => {
    t.addEventListener('click', () => selectMethod(t.dataset.method));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const enabled = tabs;
      const j = enabled.indexOf(t);
      const next = enabled[(j + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
      selectMethod(next.dataset.method, true);
    });
  });

  // --- Resumo ----------------------------------------------------------------
  const sum = (k) => $(`[data-co-sum="${k}"]`);
  const installments = $('#coInstallments');
  const payBtn = document.getElementById('coPay');
  const payLabel = payBtn.querySelector('.nl-btn__label');

  function totals() {
    const p = NL.plans[state.plan];
    const subtotal = p.base * p.months;
    const total = p.price * p.months;
    return { p, subtotal, total, discount: subtotal - total, until: NL.addMonths(dueDate, p.months) };
  }

  function render() {
    const { p, subtotal, total, discount, until } = totals();
    const annual = p.months > 1;

    sum('label').textContent = annual ? `Plano anual · ${p.months} meses` : 'Plano mensal';
    sum('subtotal').textContent = NL.money(subtotal);
    sum('discount-row').hidden = !(discount > 0.001);
    sum('discount').textContent = `− ${NL.money(discount)}`;
    sum('total').textContent = NL.money(total);

    if (!annual) sum('meta').textContent = 'Cobrança recorrente mensal';
    else if (state.method === 'card') sum('meta').textContent = `ou até ${p.months}x de ${NL.money(p.price)} sem juros`;
    else sum('meta').textContent = `Pagamento único para ${p.months} meses`;

    sum('current-until').textContent = NL.shortDate(dueDate);
    sum('new-until').textContent = NL.shortDate(until);

    sum('renew-label').textContent = annual ? 'Servidor ativo até' : 'Próxima cobrança';
    sum('renew').textContent = NL.shortDate(until);

    payLabel.textContent = state.method === 'pix' ? 'Pagar com Pix' : 'Pagar com Cartão';

    // Pix: pagamento único no anual, Pix recorrente no mensal
    $('[data-pix="title"]').textContent = annual ? 'Pague pelo app do seu banco' : 'Pix recorrente, todo mês';
    $('[data-pix="text"]').textContent = annual
      ? 'Ao confirmar, você recebe um QR Code e o código Pix copia e cola. O pagamento é aprovado em segundos e seu servidor é renovado automaticamente.'
      : 'Ao confirmar, você autoriza a cobrança mensal no app do seu banco, uma única vez. Depois disso, o valor é debitado todo mês automaticamente e seu servidor segue no ar. Cancele quando quiser.';

    // Parcelas só no anual; mensal é recorrente
    $('#coInstallmentsField').hidden = !annual;
    $('#coRecurringNote').hidden = annual;
    if (annual) {
      const prev = installments.value || '1'; // padrão: à vista
      installments.innerHTML = Array.from({ length: p.months }, (_, i) => {
        const n = i + 1;
        return `<option value="${n}" data-hint="${n === 1 ? 'à vista' : 'sem juros'}">${n}x de ${NL.money(total / n)}</option>`;
      }).join('');
      installments.value = Number(prev) <= p.months ? prev : '1';
    }
  }

  // --- Máscaras --------------------------------------------------------------
  const masks = {
    doc(v) {
      const d = digits(v).slice(0, 14);
      if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    },
    card(v) {
      const d = digits(v);
      if (/^3[47]/.test(d)) return d.slice(0, 15).replace(/^(\d{4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '));
      return d.slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
    },
    exp(v) {
      let d = digits(v).slice(0, 4);
      if (d.length === 1 && Number(d) > 1) d = '0' + d;
      return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
    },
    cvv: (v) => digits(v).slice(0, 4)
  };

  const brandEl = $('#coCardBrand');
  function detectBrand(num) {
    const d = digits(num);
    if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(d)) return 'ELO';
    if (/^(606282|3841)/.test(d)) return 'HIPER';
    if (/^4/.test(d)) return 'VISA';
    if (/^(5[1-5]|2[2-7])/.test(d)) return 'MASTER';
    if (/^3[47]/.test(d)) return 'AMEX';
    return '';
  }

  $$('[data-mask]').forEach((input) => {
    input.addEventListener('input', () => {
      const atEnd = input.selectionStart === input.value.length;
      input.value = masks[input.dataset.mask](input.value);
      if (atEnd) input.setSelectionRange(input.value.length, input.value.length);
      if (input.dataset.mask === 'card') {
        const b = detectBrand(input.value);
        brandEl.textContent = b;
        brandEl.classList.toggle('is-visible', !!b);
      }
    });
  });

  // --- Validação -------------------------------------------------------------
  const luhn = (d) => {
    let s = 0;
    for (let i = 0; i < d.length; i++) {
      let n = Number(d[d.length - 1 - i]);
      if (i % 2) { n *= 2; if (n > 9) n -= 9; }
      s += n;
    }
    return s % 10 === 0;
  };
  const cpfOk = (c) => {
    if (/^(\d)\1+$/.test(c)) return false;
    const calc = (len) => {
      let s = 0;
      for (let i = 0; i < len; i++) s += Number(c[i]) * (len + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
  };
  const cnpjOk = (c) => {
    if (/^(\d)\1+$/.test(c)) return false;
    const calc = (len) => {
      const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const s = w.reduce((a, x, i) => a + x * Number(c[i]), 0);
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
  };

  const rules = {
    name: (v) => v.trim().split(/\s+/).length >= 2 || 'Informe nome e sobrenome',
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Confira seu e-mail',
    doc: (v) => {
      const d = digits(v);
      if (d.length === 11) return cpfOk(d) || 'CPF inválido';
      if (d.length === 14) return cnpjOk(d) || 'CNPJ inválido';
      return 'Informe um CPF ou CNPJ';
    },
    cardNumber: (v) => { const d = digits(v); return (d.length >= 13 && luhn(d)) || 'Número do cartão inválido'; },
    cardName: (v) => v.trim().length >= 3 || 'Informe o nome impresso',
    cardExp: (v) => {
      const m = v.match(/^(\d{2})\/(\d{2})$/);
      if (!m || +m[1] < 1 || +m[1] > 12) return 'Use o formato MM/AA';
      const end = new Date(2000 + +m[2], +m[1], 0, 23, 59);
      return end >= new Date() || 'Cartão vencido';
    },
    cardCvv: (v) => {
      const len = /^3[47]/.test(digits($('#coCardNumber').value)) ? 4 : 3;
      return digits(v).length === len || 'CVV inválido';
    }
  };

  const isActive = (input) => input.dataset.group !== 'card' || state.method === 'card';

  function validate(input, { shake = false } = {}) {
    const field = input.closest('.nl-field');
    const result = rules[input.dataset.rule](input.value);
    const ok = result === true;
    field.classList.toggle('is-invalid', !ok);
    field.classList.toggle('is-valid', ok);
    field.querySelector('.nl-field__error').textContent = ok ? '' : result;
    input.setAttribute('aria-invalid', String(!ok));
    if (!ok && shake) {
      field.classList.remove('is-shake'); void field.offsetWidth; field.classList.add('is-shake');
    }
    return ok;
  }

  $$('[data-rule]').forEach((input) => {
    input.addEventListener('blur', () => {
      if (input.value.trim()) state.touched.add(input);
      if (state.touched.has(input)) validate(input);
      updateSteps();
    });
    input.addEventListener('input', () => {
      if (state.touched.has(input) || input.closest('.is-invalid')) validate(input);
    });
  });

  // marca etapas concluídas
  function updateSteps() {
    const sectionOk = (name) =>
      $$(`[data-co-section="${name}"] [data-rule]`).filter(isActive).every((i) => rules[i.dataset.rule](i.value) === true);
    $('[data-co-section="plan"]').classList.add('is-done');
    $('[data-co-section="data"]').classList.toggle('is-done', sectionOk('data'));
    $('[data-co-section="payment"]').classList.toggle('is-done', sectionOk('payment'));
  }

  // --- Envio -----------------------------------------------------------------
  // Substitua pela chamada real ao gateway (tokenização do cartão, criação do Pix etc.)
  function submitPayment(payload) {
    return new Promise((resolve) => setTimeout(() => resolve({ ok: true, payload }), 1400));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = $$('[data-rule]').filter(isActive);
    inputs.forEach((i) => state.touched.add(i));
    const invalid = inputs.filter((i) => !validate(i, { shake: true }));
    updateSteps();
    if (invalid.length) {
      invalid[0].focus({ preventScroll: true });
      invalid[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    payBtn.classList.add('is-loading');
    payLabel.textContent = 'Processando…';

    const data = Object.fromEntries(new FormData(form));
    await submitPayment({ ...data, plan: state.plan, method: state.method });

    payBtn.classList.remove('is-loading');
    showSuccess(data);
  });

  // --- Sucesso ---------------------------------------------------------------
  let timerId = null;
  const s = (k) => $(`[data-s="${k}"]`);

  function showSuccess(data) {
    const { p, total, until } = totals();
    $$('[data-co-view="form"]').forEach((el) => (el.hidden = true));
    $('[data-co-view="success"]').hidden = false;
    $$('[data-success]').forEach((el) => (el.hidden = el.dataset.success !== state.method));

    // ícone: check para cartão, relógio para Pix (aguardando pagamento)
    $('.nl-co-success__icon svg').innerHTML = state.method === 'card'
      ? '<path d="M20 6 9 17l-5-5"/>'
      : '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';

    s('plan').textContent = p.months > 1 ? `Anual · ${p.months} meses` : 'Mensal recorrente';
    s('amount').textContent =
      state.method === 'card' && p.months > 1 && Number(data.installments) > 1
        ? `${data.installments}x de ${NL.money(total / Number(data.installments))}`
        : NL.money(total);
    const recurringPix = state.method === 'pix' && p.months === 1;
    s('method').textContent = recurringPix ? 'Pix recorrente' : METHOD_LABEL[state.method];
    s('pix-text').textContent = recurringPix
      ? 'Escaneie o QR Code no app do seu banco e autorize o Pix recorrente. As próximas cobranças acontecem automaticamente, todo mês.'
      : 'Escaneie o QR Code ou copie o código. Assim que o pagamento cair, a renovação é confirmada automaticamente.';
    s('until').textContent = NL.shortDate(until);

    if (state.method === 'card') s('email').textContent = data.email;

    if (state.method === 'pix') {
      const code = `00020126580014BR.GOV.BCB.PIX0136${cryptoId()}5204000053039865406${total.toFixed(2)}5802BR5908NEST LAB6009SAO PAULO62070503***6304`;
      s('pix-code').textContent = code;
      drawQR(s('qr'), hash(code));
      startTimer(30 * 60);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('[data-co-restart]').addEventListener('click', () => {
    clearInterval(timerId);
    $('[data-co-view="success"]').hidden = true;
    $$('[data-co-view="form"]').forEach((el) => (el.hidden = false));
    render();
    tabs.find((t) => t.dataset.method === state.method).focus();
  });

  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = s(btn.dataset.copy).textContent;
      try { await navigator.clipboard.writeText(text); } catch {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      btn.textContent = 'Copiado!';
      btn.classList.add('is-copied');
      setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('is-copied'); }, 1800);
    });
  });

  function startTimer(seconds) {
    clearInterval(timerId);
    const el = s('timer');
    const tick = () => {
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const sec = String(seconds % 60).padStart(2, '0');
      el.textContent = `${m}:${sec}`;
      if (seconds-- <= 0) clearInterval(timerId);
    };
    tick();
    timerId = setInterval(tick, 1000);
  }

  // QR ilustrativo (placeholder até a integração devolver a imagem real)
  function drawQR(canvas, seed) {
    const n = 29, ctx = canvas.getContext('2d'), size = canvas.width / n;
    let x = seed || 1;
    const rnd = () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#17151f';
    const inFinder = (r, c) => (r < 8 && c < 8) || (r < 8 && c > n - 9) || (r > n - 9 && c < 8);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!inFinder(r, c) && rnd() > 0.52) ctx.fillRect(c * size, r * size, size, size);
    }
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(([r, c]) => {
      ctx.fillStyle = '#17151f'; ctx.fillRect(c * size, r * size, 7 * size, 7 * size);
      ctx.fillStyle = '#fff'; ctx.fillRect((c + 1) * size, (r + 1) * size, 5 * size, 5 * size);
      ctx.fillStyle = '#673de6'; ctx.fillRect((c + 2) * size, (r + 2) * size, 3 * size, 3 * size);
    });
  }

  function hash(str) { let h = 0; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
  function cryptoId() {
    return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/[^a-z0-9-]/gi, '').slice(0, 36);
  }

  // --- Init ------------------------------------------------------------------
  selectMethod(state.method);
  updateSteps();
})();
