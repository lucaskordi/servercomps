/* Nest Lab — Core helpers (planos, datas, moeda) */
(function () {
  const NL = (window.NL = window.NL || {});

  // Preços centralizados — altere aqui e o checkout recalcula tudo.
  NL.plans = {
    mensal: { id: 'mensal', name: 'Mensal', base: 99.9, price: 99.9, months: 1 },
    anual:  { id: 'anual',  name: 'Anual',  base: 99.9, price: 79.9, months: 12 }
  };

  NL.money = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  NL.addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
  NL.addMonths = (date, n) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; };

  NL.formatDate = (date, opts = { day: 'numeric', month: 'long' }) =>
    new Intl.DateTimeFormat('pt-BR', opts).format(date);

  // Data curta padrão para resumos: "30 set 2027"
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  NL.shortDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  // <span data-nl-due="3"></span> → "30 de setembro" (hoje + 3 dias)
  NL.hydrateDates = (root = document) => {
    root.querySelectorAll('[data-nl-due]').forEach((el) => {
      el.textContent = NL.formatDate(NL.addDays(new Date(), Number(el.dataset.nlDue) || 0));
    });
  };

  // Liga um grupo de radios .nl-plan a um callback
  NL.bindPlanPicker = (root, onChange) => {
    if (!root) return;
    const radios = root.querySelectorAll('input[type="radio"]');
    radios.forEach((r) => r.addEventListener('change', () => r.checked && onChange(r.value)));
    const current = root.querySelector('input:checked');
    if (current) onChange(current.value);
  };

  // Select customizado: <select data-nl-select> vira um dropdown com a identidade.
  // O <select> nativo continua no form (valor + evento "change"), só fica oculto.
  // <option data-hint="sem juros"> exibe um texto secundário ao lado.
  NL.enhanceSelect = (select) => {
    if (select.dataset.nlEnhanced) return;
    select.dataset.nlEnhanced = '1';

    const id = select.id || `nl-select-${Math.random().toString(36).slice(2, 8)}`;
    const wrap = document.createElement('div');
    wrap.className = 'nl-select';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('nl-select__native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${id}-trigger`;
    trigger.className = `${select.className.replace('nl-select__native', '')} nl-select__trigger`.trim();
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${id}-list`);
    trigger.innerHTML = '<span class="nl-select__value"></span><span class="nl-select__chev" aria-hidden="true"><svg class="nl-i" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></span>';

    const list = document.createElement('ul');
    list.className = 'nl-select__list';
    list.id = `${id}-list`;
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    wrap.append(trigger, list);

    const label = document.querySelector(`label[for="${select.id}"]`);
    if (label) {
      label.htmlFor = trigger.id;
      label.id = label.id || `${id}-label`;
      list.setAttribute('aria-labelledby', label.id);
    }

    let active = -1;
    const options = () => [...list.children];
    const optionHTML = (o) =>
      `<span>${o.textContent}</span>${o.dataset.hint ? `<small>${o.dataset.hint}</small>` : ''}`;

    function build() {
      list.innerHTML = [...select.options].map((o, i) =>
        `<li class="nl-select__option" role="option" id="${id}-opt-${i}" data-index="${i}" aria-selected="${o.selected}">${optionHTML(o)}<svg class="nl-i nl-select__option-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></li>`
      ).join('');
      syncValue();
    }

    function syncValue() {
      const o = select.options[select.selectedIndex];
      trigger.querySelector('.nl-select__value').innerHTML = o ? optionHTML(o) : '';
      options().forEach((li, i) => li.setAttribute('aria-selected', String(i === select.selectedIndex)));
    }

    function setActive(i) {
      const opts = options();
      if (!opts.length) return;
      active = Math.max(0, Math.min(opts.length - 1, i));
      opts.forEach((li, j) => li.classList.toggle('is-active', j === active));
      trigger.setAttribute('aria-activedescendant', opts[active].id);
      const li = opts[active];
      if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop - 6;
      else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight + 6;
    }

    function open() {
      if (wrap.classList.contains('is-open')) return;
      const r = trigger.getBoundingClientRect();
      wrap.classList.toggle('is-up', window.innerHeight - r.bottom < 320 && r.top > 320);
      wrap.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      setActive(select.selectedIndex);
    }

    function close() {
      wrap.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
    }

    function choose(i) {
      if (i !== select.selectedIndex) {
        select.selectedIndex = i;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncValue();
      close();
      trigger.focus();
    }

    trigger.addEventListener('click', () => (wrap.classList.contains('is-open') ? close() : open()));

    trigger.addEventListener('keydown', (e) => {
      const isOpen = wrap.classList.contains('is-open');
      const last = options().length - 1;
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); isOpen ? setActive(active + 1) : open(); break;
        case 'ArrowUp': e.preventDefault(); isOpen ? setActive(active - 1) : open(); break;
        case 'Home': if (isOpen) { e.preventDefault(); setActive(0); } break;
        case 'End': if (isOpen) { e.preventDefault(); setActive(last); } break;
        case 'Enter': case ' ':
          e.preventDefault(); isOpen ? choose(active) : open(); break;
        case 'Escape': if (isOpen) { e.preventDefault(); close(); } break;
        case 'Tab': close(); break;
      }
    });

    list.addEventListener('mousemove', (e) => {
      const li = e.target.closest('.nl-select__option');
      if (li && Number(li.dataset.index) !== active) setActive(Number(li.dataset.index));
    });
    list.addEventListener('mousedown', (e) => e.preventDefault()); // mantém o foco no trigger
    list.addEventListener('click', (e) => {
      const li = e.target.closest('.nl-select__option');
      if (li) choose(Number(li.dataset.index));
    });

    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
    select.addEventListener('change', syncValue);
    new MutationObserver(build).observe(select, { childList: true, subtree: true, characterData: true });

    build();
    return { open, close, refresh: build, el: wrap };
  };

  const init = () => {
    NL.hydrateDates();
    document.querySelectorAll('select[data-nl-select]').forEach(NL.enhanceSelect);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
