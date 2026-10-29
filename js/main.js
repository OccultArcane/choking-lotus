/* ==========================================================================
   CHOKING LOTUS — orbit cards, cursor atmosphere, credit notice
   ========================================================================== */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  /* ------------------------------------------------------- product cards */

  const orbitField = $('[data-orbit-field]');
  const products = Array.isArray(window.CHOKING_LOTUS_PRODUCTS) ? window.CHOKING_LOTUS_PRODUCTS : [];
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  // Only the Freebuff deployment (and local wrangler) serves the worker routes;
  // GitHub Pages serves the committed copy and nothing else.
  const servesLiveRoutes = /\.freebuff\.page$/.test(window.location.hostname) ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'localhost';

  const renderOrbit = (list) => {
    if (!orbitField || !list.length) return;
    orbitField.innerHTML = list.slice(0, 8).map((product, index) => {
      const name = escapeHtml(product.name || 'untitled');
      // Store titles join pieces with "+" ("brun+undercut+scar"); let a long
      // one wrap at those seams instead of breaking mid-word in the label.
      const nameMarkup = name.replace(/\+/g, '+<wbr>');
      const id = escapeHtml(product.id || '');
      const angle = angles[index % angles.length];
      const href = escapeHtml(product.url || `https://www.imvu.com/shop/product.php?products_id=${id}`);
      const img = escapeHtml(product.img || '');
      const price = Number.isFinite(product.price) ? product.price : '—';
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
                <span class="orbit-card__name">${nameMarkup}</span>
                <span class="orbit-card__price"><span class="orbit-card__price-label">price:</span><span class="orbit-card__price-value">${price}</span></span>
              </span>
              <span class="orbit-card__sheen" aria-hidden="true"></span>
            </a>
          </div>
        </div>`;
    }).join('');
  };

  renderOrbit(products);

  // The worker reads the store's own newest-first listing, so a new drop reaches
  // the Freebuff deployment without a redeploy. The shipped snapshot stays on
  // screen until the response lands, and is all GitHub Pages ever has.
  if (orbitField && servesLiveRoutes) {
    fetch('api/products', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const live = Array.isArray(payload?.products) ? payload.products : [];
        if (!live.length) return;
        renderOrbit(live);
      })
      .catch(() => {});
  }

  /* --------------------------------------------- keep the orbit on its own island */
  // The cards must never touch the friends row, the Instagram mark, the credit
  // chip or the legal strip, at any window size. Those four are fixed, so each
  // one is measured and the orbit is sized to the largest ring whose cards stay
  // clear of it. The constants mirror css/style.css: cards orbit at 0.44 x
  // --size and are 0.175 x --size wide by 0.25 x --size tall, so CARD_X and
  // CARD_Y are half that footprint. How much of it points at an element depends
  // on the direction from the orbit's centre, which is what `reach` below does.
  const RADIUS = 0.44;
  const CARD_X = 0.0875;
  const CARD_Y = 0.125;
  const CLEARANCE = 12;
  const MIN_SIZE = 120;
  const heroEl = $('.hero');
  const orbitEl = $('[data-orbit]');

  const fitOrbit = () => {
    if (!heroEl || !orbitEl) return;
    const heroBox = heroEl.getBoundingClientRect();
    if (!heroBox.width || !heroBox.height) return;

    const cx = heroBox.left + heroBox.width / 2;
    const cy = heroBox.top + heroBox.height / 2;
    let size = Math.min(heroBox.height * 0.74, heroBox.width * 0.8);

    for (const selector of ['.friends', '.hero__instagram', '.footer-note', '.legal']) {
      const el = $(selector);
      if (!el) continue;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      // Nearest point of the element, and the direction of it from the centre.
      const qx = Math.min(Math.max(cx, box.left), box.right);
      const qy = Math.min(Math.max(cy, box.top), box.bottom);
      const dx = cx - qx;
      const dy = cy - qy;
      const distance = Math.hypot(dx, dy);
      if (distance <= CLEARANCE) {
        size = MIN_SIZE;
        continue;
      }
      // A card centred toward that point reaches this far past its own centre.
      const reach = RADIUS + CARD_X * Math.abs(dx) / distance + CARD_Y * Math.abs(dy) / distance;
      size = Math.min(size, (distance - CLEARANCE) / reach);
    }

    orbitEl.style.setProperty('--size', `${Math.max(MIN_SIZE, Math.round(size))}px`);
  };

  if (orbitEl) {
    fitOrbit();
    // Runs straight away rather than in a frame: the work is four measurements,
    // and a hidden tab must still resize correctly when its window changes.
    window.addEventListener('resize', fitOrbit, { passive: true });
    window.addEventListener('orientationchange', fitOrbit);
    if (document.fonts?.ready) document.fonts.ready.then(fitOrbit).catch(() => {});
  }

  /* ------------------------------------------------ live friends, where possible */
  // The row ships with the page, so it always renders. On the Freebuff deployment
  // a same-origin worker route proxies the IMVU lookup, which the browser cannot
  // call itself, so a renamed avatar or a new profile picture shows up on the
  // next load. On GitHub Pages that route does not exist, the fetch 404s and the
  // committed copy stays in place.
  // Asking elsewhere would just log a 404, so the static row stands as-is.
  const friendLinks = $$('.friend');
  const friendFlag = $('[data-friends-flag]');
  let flagTimer = 0;
  const flashFriendFlag = () => {
    if (!friendFlag) return;
    window.clearTimeout(flagTimer);
    friendFlag.classList.add('is-visible');
    flagTimer = window.setTimeout(() => friendFlag.classList.remove('is-visible'), 6000);
  };
  if (friendLinks.length && servesLiveRoutes) {
    const ids = friendLinks.map((link) => link.dataset.imvuId).filter((id) => /^\d+$/.test(id));
    if (ids.length) {
      fetch(`api/friends?ids=${ids.join(',')}`, { headers: { accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (!payload || !Array.isArray(payload.friends)) return;
          let applied = false;
          for (const live of payload.friends) {
            const link = friendLinks.find((el) => el.dataset.imvuId === String(live.id));
            if (!link) continue;

            const username = typeof live.username === 'string' ? live.username.trim() : '';
            if (username) {
              const label = $('.friend__name', link);
              if (label && label.textContent !== username) label.textContent = username;
              link.setAttribute('aria-label', `Shop ${username} on IMVU, opens in a new tab`);
              applied = true;
            }

            const portrait = typeof live.portrait === 'string' ? live.portrait : '';
            const image = $('.friend__pic', link);
            if (image && /^https:\/\//.test(portrait) && image.src !== portrait) {
              const fallback = image.src;
              image.addEventListener('error', () => { image.src = fallback; }, { once: true });
              image.src = portrait;
            }
          }
          if (applied) flashFriendFlag();
        })
        .catch(() => {});
    }
  }

  /* ------------------------------------------------------ pointer ambience */

  const cursor = $('.cursor');
  let px = 0;
  let py = 0;
  let targetX = 0;
  let targetY = 0;
  let cursorVisible = false;

  const onPointerMove = (event) => {
    targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetY = (event.clientY / window.innerHeight - 0.5) * 2;
    if (!cursor) return;
    px = event.clientX;
    py = event.clientY;
    if (!cursorVisible) {
      cursorVisible = true;
      cursor.classList.add('is-visible');
      // put it in place before the next paint to avoid a streak from 0,0
      cursor.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
    }
  };

  const renderAmbience = () => {
    document.documentElement.style.setProperty('--bg-x', `${targetX * -10}px`);
    document.documentElement.style.setProperty('--bg-y', `${targetY * -8}px`);
    if (cursor && cursorVisible) {
      px += (targetX * window.innerWidth * 0.5 + window.innerWidth * 0.5 - px) * 0.18;
      py += (targetY * window.innerHeight * 0.5 + window.innerHeight * 0.5 - py) * 0.18;
      cursor.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
    }
    requestAnimationFrame(renderAmbience);
  };

  if (finePointer.matches && !reduceMotion.matches) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', () => cursor?.classList.remove('is-visible'));
    document.addEventListener('pointerenter', () => cursorVisible && cursor?.classList.add('is-visible'));

    const interactive = 'a, button';
    document.addEventListener('pointerover', (event) => {
      if (event.target.closest(interactive)) cursor?.classList.add('is-active');
    });
    document.addEventListener('pointerout', (event) => {
      if (event.target.closest(interactive)) cursor?.classList.remove('is-active');
    });

    requestAnimationFrame(renderAmbience);
  }

  /* -------------------------------------------------------- footer note */

  const footerNote = $('[data-footer-note]');
  if (footerNote) {
    const noteText = $('[data-footer-note-text]', footerNote);
    const noteClose = $('[data-footer-note-close]', footerNote);
    const fallbackNote = 'Page designed and coded by xr™';
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
      window.setTimeout(() => {
        footerNote.remove();
        fitOrbit();
      }, 750);
    });
  }
})();
