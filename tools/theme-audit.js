/*
 * Theme audit harness. Paste into the page (javascript_tool) and call
 * `await helmAudit()`. Returns measured failures, not opinions.
 *
 * Three checks, all computed from what the browser actually painted:
 *   CONTRAST  every text node's colour against its true effective background
 *             (walks ancestors through transparent backgrounds, composites
 *             alpha), scored with the WCAG 2.1 relative-luminance formula.
 *   INVISIBLE elements that occupy space but paint nothing: zero-size icon
 *             spans, empty buttons, colour equal to background.
 *   LITERAL   is only detectable in source, not here — see the grep in BRIEF.
 */
window.helmAudit = async function (opts = {}) {
  const srgb = c => (c /= 255) <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const parse = s => { const m = (s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (fg, bg) => fg[3] >= 1 ? fg.slice(0, 3)
    : [0, 1, 2].map(i => Math.round(fg[i] * fg[3] + bg[i] * (1 - fg[3])));

  // The true background behind an element: walk up through transparency.
  function bgOf(el) {
    let cur = el, acc = null;
    while (cur && cur !== document.documentElement.parentNode) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c && c[3] > 0) { acc = acc ? over(acc.concat(1), c.slice(0, 3)).concat(1) : c;
        if (c[3] >= 1) return acc.slice(0, 3); }
      cur = cur.parentElement;
    }
    return acc ? acc.slice(0, 3) : [255, 255, 255];
  }

  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
      && parseFloat(cs.opacity) > 0.05; };

  const out = { contrast: [], invisible: [] };
  const path = el => { const p = []; let c = el;
    while (c && c.nodeType === 1 && p.length < 4) { p.unshift(c.id ? '#' + c.id
      : c.tagName.toLowerCase() + (c.className && typeof c.className === 'string'
        ? '.' + c.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); c = c.parentElement; }
    return p.join(' > '); };

  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);

    // Own text only — an element inheriting a child's text would double-count.
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length);
    if (own) {
      const fg = parse(cs.color); if (fg) {
        const bg = bgOf(el);
        const r = ratio(over(fg, bg), bg);
        const size = parseFloat(cs.fontSize);
        const bold = parseInt(cs.fontWeight, 10) >= 700;
        const large = size >= 24 || (size >= 18.66 && bold);
        const need = large ? 3 : 4.5;
        if (r < need) out.contrast.push({ sel: path(el), text: el.textContent.trim().slice(0, 40),
          ratio: +r.toFixed(2), need, size, color: cs.color, bg: `rgb(${bg.join(',')})` });
      }
    }

    // An icon slot that paints nothing: no text, no background, no image, no border,
    // no child that paints — the empty-.icon-bell class of bug.
    if (/icon|glyph/i.test(el.className || '') && !el.textContent.trim()
        && el.children.length === 0
        && cs.backgroundImage === 'none' && (cs.maskImage || 'none') === 'none'
        && (cs.webkitMaskImage || 'none') === 'none'
        && parse(cs.backgroundColor)?.[3] === 0
        && getComputedStyle(el, '::before').content === 'none'
        && getComputedStyle(el, '::after').content === 'none') {
      out.invisible.push({ sel: path(el), reason: 'icon element paints nothing' });
    }
  }

  // Controls that are on screen but have no accessible visual content at all.
  for (const el of document.querySelectorAll('button, a[role="button"]')) {
    if (!vis(el)) continue;
    const paints = el.textContent.trim() || el.querySelector('svg, img, canvas')
      || [...el.querySelectorAll('*')].some(c => { const s = getComputedStyle(c);
        return s.backgroundImage !== 'none' || (s.maskImage || 'none') !== 'none'; });
    if (!paints) out.invisible.push({ sel: path(el), reason: 'control renders nothing' });
  }

  return { theme: document.documentElement.getAttribute('data-theme'),
           where: opts.where || '', ...out,
           counts: { contrast: out.contrast.length, invisible: out.invisible.length } };
};
'helmAudit ready';
