(() => {
  const WHATSAPP = '27718974062';
  const EMAIL = 'info.gnsga@gmail.com';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Nav: solid on scroll, hide on scroll down ---------- */
  const nav = $('[data-nav]');
  const burger = $('[data-burger]');
  const actionbar = $('[data-actionbar]');
  let lastY = scrollY;

  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('is-solid', y > 40);
    if (!nav.classList.contains('is-open')) {
      nav.classList.toggle('is-hidden', y > lastY && y > innerHeight * .9);
    }
    actionbar.classList.toggle('is-on', y > innerHeight * .6);
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = open => {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('[data-drawer] a').forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: .18, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal, [data-transform]').forEach(el => io.observe(el));

  const shots = $$('.shot');
  shots.forEach((s, i) => {
    s.classList.add('reveal-3d');
    s.style.transitionDelay = `${(i % 4) * 70}ms`;
    io.observe(s);
  });

  /* ---------- Hero: 3D pointer parallax ---------- */
  const hero = $('[data-hero]');
  const stage = $('[data-hero-stage]');
  const card = $('.hero__card');
  if (!reduced) {
    let tx = 0, ty = 0, cx = 0, cy = 0, sy = 0, raf;
    const loop = () => {
      cx += (tx - cx) * .06;
      cy += (ty - cy) * .06;
      const s = Math.min(scrollY / innerHeight, 1);
      sy += (s - sy) * .2;
      stage.style.transform = `translate3d(${cx * -14}px, ${cy * -10 + sy * 120}px, 0) rotateY(${cx * 2.2}deg) rotateX(${-cy * 1.6}deg) scale(${1 + sy * .08})`;
      if (card) card.style.transform = `translate3d(${cx * 16}px, ${cy * 12}px, 60px) rotateY(${cx * -6}deg) rotateX(${cy * 5}deg)`;
      raf = requestAnimationFrame(loop);
    };
    if (fine) {
      hero.addEventListener('pointermove', e => {
        tx = e.clientX / innerWidth - .5;
        ty = e.clientY / innerHeight - .5;
      });
      hero.addEventListener('pointerleave', () => { tx = ty = 0; });
    }
    new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) loop();
    }).observe(hero);
  }

  /* ---------- Intro: layered depth ---------- */
  const depth = $('[data-depth]');
  if (depth && !reduced) {
    const layers = $$('[data-depth-layer]', depth);
    const update = () => {
      const r = depth.getBoundingClientRect();
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      layers.forEach(l => {
        const d = parseFloat(l.dataset.depthLayer);
        l.style.transform = `translate3d(0, ${p * d * -60}px, 0) rotate(${p * d * -1.2}deg)`;
      });
    };
    addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    update();
  }

  /* ---------- Service cards: tilt + spotlight ---------- */
  if (fine && !reduced) {
    $$('[data-tilt]').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${x * 100}%`);
        el.style.setProperty('--my', `${y * 100}%`);
        el.style.transform = `rotateY(${(x - .5) * 10}deg) rotateX(${(.5 - y) * 10}deg) translateZ(10px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Service links preselect the form ---------- */
  $$('[data-service]').forEach(a => a.addEventListener('click', () => {
    const want = a.dataset.service;
    $$('[data-chips] input').forEach(i => { if (i.value === want) i.checked = true; });
  }));

  /* ---------- Gallery filter ---------- */
  const filters = $('[data-filters]');
  filters.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    $$('button', filters).forEach(x => {
      const on = x === b;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-selected', on);
    });
    const f = b.dataset.filter;
    shots.forEach(s => {
      const show = f === 'all' || s.dataset.cat === f;
      s.classList.toggle('is-hidden', !show);
      if (show) s.classList.add('is-in');
    });
  });

  /* ---------- Lightbox ---------- */
  const lb = $('[data-lightbox]');
  const lbImg = $('[data-lb-img]');
  const lbCap = $('[data-lb-cap]');
  let current = 0;
  const visible = () => shots.filter(s => !s.classList.contains('is-hidden'));

  const show = i => {
    const list = visible();
    current = (i + list.length) % list.length;
    const s = list[current];
    const img = $('img', s);
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = img.alt;
  };
  const open = s => {
    show(visible().indexOf(s));
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    $('[data-lb-close]').focus();
  };
  const close = () => {
    lb.hidden = true;
    document.body.style.overflow = '';
  };
  shots.forEach(s => $('button', s).addEventListener('click', () => open(s)));
  $('[data-lb-close]').addEventListener('click', close);
  $('[data-lb-prev]').addEventListener('click', () => show(current - 1));
  $('[data-lb-next]').addEventListener('click', () => show(current + 1));
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
  let touchX = null;
  lb.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  /* ---------- Quote form -> WhatsApp / email ---------- */
  const form = $('[data-form]');
  const err = $('[data-error]');
  let via = 'whatsapp';
  $$('button[data-via]', form).forEach(b => b.addEventListener('click', () => { via = b.dataset.via; }));

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(form);
    const name = (data.get('name') || '').trim();
    const phone = (data.get('phone') || '').trim();
    const area = (data.get('area') || '').trim();
    const message = (data.get('message') || '').trim();
    const services = data.getAll('service');

    form.elements.name.classList.toggle('is-bad', !name);
    form.elements.phone.classList.toggle('is-bad', !phone);
    if (!name || !phone) {
      err.textContent = 'Please add your name and a number we can reach you on.';
      return;
    }
    err.textContent = '';

    const lines = [`Hi Shaun, I'd like a quote.`, '', `Name: ${name}`, `Phone: ${phone}`];
    if (area) lines.push(`Area: ${area}`);
    if (services.length) lines.push(`Looking for: ${services.join(', ')}`);
    if (message) lines.push('', message);
    const text = lines.join('\n');

    if (via === 'email') {
      location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Quote request from ' + name)}&body=${encodeURIComponent(text)}`;
    } else {
      window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    }
  });

  $('[data-year]').textContent = new Date().getFullYear();
})();
