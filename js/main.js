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
  const snapshot = Array.isArray(window.CHOKING_LOTUS_PRODUCTS) ? window.CHOKING_LOTUS_PRODUCTS : [];
  const snapshotById = new Map(snapshot.map((product) => [String(product.id), product]));

  // The gafcodes panel is a document.write widget rendered into #imvu-feed-source,
  // so it refreshes itself from the store on every page load. Read it back and
  // merge in the prices captured by tools/fetch_products.py.
  const readLiveFeed = () => {
    const source = document.getElementById('imvu-feed-source');
    if (!source) return [];
    return $$('.productbox a', source).map((link) => {
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
                <span class="orbit-card__price"><span class="orbit-card__price-label">price:</span><span class="orbit-card__price-value">${price}</span></span>
              </span>
              <span class="orbit-card__sheen" aria-hidden="true"></span>
            </a>
          </div>
        </div>`;
    }).join('');
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
})();
