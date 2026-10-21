/* ==========================================================================
   CHOKING LOTUS — launch page interactions
   Everything here is optional decoration on top of a fully readable page.
   ========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------- product cards */

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const orbitField = $('[data-orbit-field]');
  const snapshot = Array.isArray(window.CHOKING_LOTUS_PRODUCTS) ? window.CHOKING_LOTUS_PRODUCTS : [];
  const snapshotById = new Map(snapshot.map((product) => [String(product.id), product]));

  // The gafcodes panel is a document.write widget rendered into #imvu-feed-source,
  // so it refreshes itself from the store on every page load. Read it back and
  // merge in the prices captured by tools/fetch_products.py.
  const readLiveFeed = () => {
    const root = document.getElementById('imvu-feed-source');
    if (!root) return [];
    return $$('.productbox a', root).map((link) => {
      const img = $('img', link);
      const id = new URL(link.href, window.location.href).searchParams.get('products_id') || '';
      const title = (img?.getAttribute('title') || '').replace(/^[^\w]+/, '').trim();
      const known = snapshotById.get(String(id));
      return {
        id,
        name: title || known?.name || 'untitled',
        img: known?.img || img?.getAttribute('src') || '',
        url: link.href,
        price: Number.isFinite(known?.price) ? known.price : null
      };
    }).filter((product) => product.id && product.img);
  };

  const liveProducts = readLiveFeed();
  const products = liveProducts.length ? liveProducts : snapshot;
  if (orbitField && products.length) {
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    orbitField.innerHTML = products.slice(0, 8).map((product, index) => {
      const name = escapeHtml(product.name || 'untitled');
      const id = escapeHtml(product.id || '');
      const angle = angles[index % angles.length];
      const href = escapeHtml(product.url || `https://www.imvu.com/shop/product.php?products_id=${id}`);
      const img = escapeHtml(product.img || '');
      const price = Number.isFinite(product.price) ? product.price : '—';
      const priceMarkup = `<span class="orbit-card__price"><span class="orbit-card__price-label">price:</span><span class="orbit-card__price-value">${price}</span></span>`;
      return `
        <div class="orbit__slot" style="--angle: ${angle}deg">
          <div class="orbit__upright">
            <a class="orbit-card" href="${href}" target="_blank" rel="noopener noreferrer" data-product-id="${id}"
               aria-label="${name} — price ${price} credits on IMVU, opens in a new tab">
              <span class="orbit-card__liquid" aria-hidden="true"></span>
              <span class="orbit-card__frame">
                <span class="orbit-card__head"><span class="orbit-card__new"><i class="orbit-card__dot" aria-hidden="true"></i>new</span></span>
                <span class="orbit-card__plate">
                  <img src="${img}" alt="${name} — IMVU product by Choking Lotus" width="100" height="80" loading="eager" decoding="async">
                </span>
                <span class="orbit-card__name">${name}</span>
                ${priceMarkup}
              </span>
              <span class="orbit-card__sheen" aria-hidden="true"></span>
            </a>
          </div>
        </div>`;
    }).join('');
  }

  /* ---------------------------------------------------------------- header */

  const header = $('[data-header]');
  const progress = $('[data-progress]');
  const scrollCue = $('.hero__scroll');

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      header?.classList.toggle('is-scrolled', y > 24);
      if (scrollCue) scrollCue.style.opacity = y > 120 ? '0' : '';
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.transform = `scaleX(${scrollable > 0 ? Math.min(y / scrollable, 1) : 0})`;
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ----------------------------------------------------------- mobile menu */

  const menuToggle = $('[data-menu-toggle]');
  const mobileMenu = $('[data-mobile-menu]');
  let menuOpen = false;

  const setMenu = (open) => {
    if (!menuToggle || !mobileMenu) return;
    menuOpen = open;
    menuToggle.setAttribute('aria-expanded', String(open));
    mobileMenu.setAttribute('aria-hidden', String(!open));
    mobileMenu.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
    if (open) {
      const first = $('a', mobileMenu);
      window.setTimeout(() => first?.focus(), 220);
    }
  };

  menuToggle?.addEventListener('click', () => setMenu(!menuOpen));
  $$('a', mobileMenu || document.createElement('div')).forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuOpen) {
      setMenu(false);
      menuToggle?.focus();
    }
  });
  window.matchMedia('(min-width: 981px)').addEventListener('change', (event) => {
    if (event.matches && menuOpen) setMenu(false);
  });

  /* --------------------------------------------------------------- reveals */

  const revealTargets = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealTargets.forEach((el) => revealObserver.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  }

  // word-by-word reveal for the atelier statement
  const statement = $('[data-words]');
  if (statement) {
    const words = statement.textContent.trim().split(/\s+/);
    statement.textContent = '';
    statement.classList.add('is-split');
    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.style.setProperty('--i', index);
      span.textContent = `${word} `;
      statement.appendChild(span);
    });

    if ('IntersectionObserver' in window && !reduceMotion.matches) {
      const wordObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          $$('.word', statement).forEach((word) => word.classList.add('is-in'));
          wordObserver.disconnect();
        });
      }, { threshold: 0.35 });
      wordObserver.observe(statement);
    } else {
      $$('.word', statement).forEach((word) => word.classList.add('is-in'));
    }
  }

  /* ------------------------------------------------------ pointer ambience */

  let px = 0;
  let py = 0;
  let targetX = 0;
  let targetY = 0;
  let cursorVisible = false;
  const cursor = $('.cursor');

  const onPointerMove = (event) => {
    targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetY = (event.clientY / window.innerHeight - 0.5) * 2;
    if (cursor) {
      const rect = cursor.getBoundingClientRect();
      px = event.clientX;
      py = event.clientY;
      if (!cursorVisible) {
        cursor.classList.add('is-visible');
        cursorVisible = true;
        // put it in place before the next paint to avoid a streak from 0,0
        cursor.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
      }
      void rect;
    }
  };

  if (finePointer.matches && !reduceMotion.matches) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', () => cursor?.classList.remove('is-visible'));
    document.addEventListener('pointerenter', () => cursorVisible && cursor?.classList.add('is-visible'));

    const interactive = 'a, button, input, .orbit-card, .product__art';
    document.addEventListener('pointerover', (event) => {
      if (event.target.closest(interactive)) cursor?.classList.add('is-active');
    });
    document.addEventListener('pointerout', (event) => {
      if (event.target.closest(interactive)) cursor?.classList.remove('is-active');
    });
  }

  /* --------------------------------------------------------------- ticking */

  let bgTick = false;
  const renderAmbience = () => {
    if (!finePointer.matches || reduceMotion.matches) return;
    root.style.setProperty('--bg-x', `${targetX * -10}px`);
    root.style.setProperty('--bg-y', `${targetY * -8}px`);
    root.style.setProperty('--rail-y', `${targetY * 12}px`);
    if (cursor && cursorVisible) {
      px += (targetX * window.innerWidth * 0.5 + window.innerWidth * 0.5 - px) * 0.18;
      py += (targetY * window.innerHeight * 0.5 + window.innerHeight * 0.5 - py) * 0.18;
      cursor.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
    }
    requestAnimationFrame(renderAmbience);
  };
  if (finePointer.matches && !reduceMotion.matches) requestAnimationFrame(renderAmbience);

  // magnetic buttons
  if (finePointer.matches && !reduceMotion.matches) {
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (event) => {
        const rect = el.getBoundingClientRect();
        const relX = (event.clientX - rect.left) / rect.width - 0.5;
        const relY = (event.clientY - rect.top) / rect.height - 0.5;
        el.style.setProperty('--mx', `${relX * 10}px`);
        el.style.setProperty('--my', `${relY * 7}px`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      });
    });

    $$('[data-tilt]').forEach((art) => {
      const card = art.closest('.product__link') || art;
      card.addEventListener('pointermove', (event) => {
        const rect = art.getBoundingClientRect();
        const relX = (event.clientX - rect.left) / rect.width - 0.5;
        const relY = (event.clientY - rect.top) / rect.height - 0.5;
        art.style.transform = `perspective(1000px) rotateX(${(-relY * 4).toFixed(2)}deg) rotateY(${(relX * 4).toFixed(2)}deg)`;
      });
      card.addEventListener('pointerleave', () => {
        art.style.transform = '';
      });
    });
  }

  void bgTick;

  /* ------------------------------------------------------------- countdown */

  const countdown = $('[data-countdown]');
  if (countdown) {
    const target = new Date(countdown.dataset.date || '2026-11-13T20:00:00Z').getTime();
    const units = {
      days: $('[data-unit="days"]', countdown),
      hours: $('[data-unit="hours"]', countdown),
      minutes: $('[data-unit="minutes"]', countdown),
      seconds: $('[data-unit="seconds"]', countdown)
    };
    const previous = { days: '', hours: '', minutes: '', seconds: '' };

    const tickUnit = (el, key, value) => {
      if (!el) return;
      const next = String(value).padStart(2, '0');
      if (next === previous[key]) return;
      el.textContent = next;
      previous[key] = next;
      if (reduceMotion.matches) return;
      el.classList.remove('is-ticking');
      // restart the animation without forcing a reflow on every unit
      void el.offsetWidth;
      el.classList.add('is-ticking');
    };

    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        const opened = countdown.querySelector('.countdown__label');
        if (opened) opened.textContent = '[ LOW TIDE — THE WATER IS OPEN ]';
        ['days', 'hours', 'minutes', 'seconds'].forEach((key) => tickUnit(units[key], key, 0));
        return;
      }
      const seconds = Math.floor(diff / 1000);
      tickUnit(units.days, 'days', Math.floor(seconds / 86400));
      tickUnit(units.hours, 'hours', Math.floor((seconds % 86400) / 3600));
      tickUnit(units.minutes, 'minutes', Math.floor((seconds % 3600) / 60));
      tickUnit(units.seconds, 'seconds', seconds % 60);
    };

    update();
    window.setInterval(update, 1000);
  }

  /* ------------------------------------------------------------------- ics */

  const icsButton = $('[data-ics]');
  icsButton?.addEventListener('click', () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Choking Lotus//Drop 001//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:drop-001-blackwater-${stamp}@chokinglotus`,
      `DTSTAMP:${stamp}`,
      'DTSTART:20261113T200000Z',
      'DTEND:20261113T220000Z',
      'SUMMARY:Choking Lotus — Drop 001: Blackwater',
      'DESCRIPTION:Nine relics. One tide. The Choking Lotus IMVU store opens at 20:00 UTC.',
      'LOCATION:IMVU — Choking Lotus store',
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    const blob = new Blob([`${lines.join('\r\n')}\r\n`], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'choking-lotus-drop-001.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    const label = $('span', icsButton);
    if (label) {
      const original = label.textContent;
      label.textContent = 'Saved to your calendar';
      window.setTimeout(() => { label.textContent = original; }, 2600);
    }
  });

  /* --------------------------------------------------------------- filters */

  const filterBar = $('[data-filters]');
  const grid = $('[data-product-grid]');
  if (filterBar && grid) {
    const chips = $$('[data-filter]', filterBar);
    const products = $$('.product', grid);
    const count = $('[data-filter-count]', filterBar);

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const value = chip.dataset.filter;
        chips.forEach((other) => {
          const active = other === chip;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-pressed', String(active));
        });

        let visible = 0;
        products.forEach((product) => {
          const show = value === 'all' || product.dataset.category === value;
          product.hidden = !show;
          if (show) {
            visible += 1;
            if (!product.classList.contains('is-in')) product.classList.add('is-in');
          }
        });
        if (count) count.textContent = String(visible).padStart(2, '0');
      });
    });
  }

  /* ------------------------------------------------------------------ form */

  const form = $('[data-access-form]');
  if (form) {
    const email = $('#email', form);
    const field = $('.access-form__field', form);
    const error = $('[data-form-error]', form);
    const success = $('[data-form-success]', form);
    const submit = $('button[type="submit"]', form);

    const showError = (message) => {
      if (error) error.textContent = message;
      field?.classList.add('is-invalid');
      email?.setAttribute('aria-invalid', 'true');
    };
    const clearError = () => {
      if (error) error.textContent = '';
      field?.classList.remove('is-invalid');
      email?.removeAttribute('aria-invalid');
    };

    email?.addEventListener('input', clearError);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = (email?.value || '').trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

      if (!valid) {
        showError('Enter an email the tide can reach.');
        email?.focus();
        return;
      }

      // Wire this to your list provider (or a serverless endpoint) here.
      // The UI intentionally resolves locally so the page can ship before the
      // backend exists; no address is stored or transmitted.
      clearError();
      form.classList.add('is-done');
      if (success) {
        success.hidden = false;
        success.textContent = `[ YOU’RE ON THE LIST ] ${value} — the water will find you first.`;
      }
      submit?.setAttribute('disabled', 'true');
      form.reset();
    });
  }

  /* ----------------------------------------------------------- active nav */

  const navLinks = $$('.nav__link');
  const sections = navLinks
    .map((link) => $(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const active = link.getAttribute('href') === `#${entry.target.id}`;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-40% 0px -50% 0px' });
    sections.forEach((section) => navObserver.observe(section));
  }

  /* -------------------------------------------------------- footer note */

  const footerNote = $('[data-footer-note]');
  if (footerNote) {
    const noteText = $('[data-footer-note-text]', footerNote);
    const noteClose = $('[data-footer-note-close]', footerNote);
    const fallbackNote = 'page designed and coded by xr™';
    let typingTimer;

    const showNote = (raw) => {
      const message = String(raw || fallbackNote).replace(/\s+/g, ' ').trim() || fallbackNote;
      footerNote.setAttribute('aria-label', message);
      footerNote.setAttribute('aria-hidden', 'false');
      footerNote.classList.add('is-visible');

      if (reduceMotion.matches) {
        noteText.textContent = message;
        footerNote.classList.add('is-done');
        return;
      }

      let index = 0;
      noteText.textContent = '';
      const type = () => {
        index += 1;
        noteText.textContent = message.slice(0, index);
        if (index < message.length) {
          typingTimer = window.setTimeout(type, 34);
        } else {
          footerNote.classList.add('is-done');
        }
      };
      typingTimer = window.setTimeout(type, 1100);
    };

    const noteSource = window.location.protocol === 'file:'
      ? Promise.resolve(fallbackNote)
      : fetch('footer-note.txt', { cache: 'no-store' })
          .then((response) => (response.ok ? response.text() : fallbackNote))
          .catch(() => fallbackNote);

    noteSource.then(showNote);

    noteClose?.addEventListener('click', () => {
      window.clearTimeout(typingTimer);
      footerNote.classList.add('is-dismissed');
      footerNote.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => footerNote.remove(), 750);
    });
  }

  /* ------------------------------------------------------------- hash fix */

  if (window.location.hash) {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target) {
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      });
    }
  }
})();
