class DCLogic {
  setState(patch) {
    this.state = Object.assign({}, this.state || {}, typeof patch === 'function' ? patch(this.state || {}, this.props) : patch);
    if (this.__update) this.__update();
  }
  forceUpdate() { if (this.__update) this.__update(); }
}
class Component extends DCLogic {
  roomData() {
    return [
      {
        id: 'saadiyat', no: '01', name: 'The Gallery', place: 'Saadiyat Island', region: 'Abu Dhabi',
        scene: 's-gallery', tags: ['culture', 'waterfront'],
        blurb: 'Museums on one side, an open beach on the other. This is the place for people who want art, architecture and the sea within the same short walk.',
        homes: [['Marsa Al Saadiyat', 1], ['Talay', 1], ['Saadiyat Lagoons', 0], ['Mamsha Gardens', 0], ['Saadiyat Grove', 0], ['Louvre Abu Dhabi Residences', 0], ['Nobu Residences', 0], ['Mandarin Oriental Residences', 0], ['The Row Saadiyat', 0], ['The Arthouse', 0], ['The Source', 0]],
        facts: [['351', 'standalone villas at Talay, the first homes of Marsa Al Saadiyat'], ['8 km', 'of coastline in the Marsa Al Saadiyat masterplan']]
      },
      {
        id: 'yas', no: '02', name: 'The Games Room', place: 'Yas Island', region: 'Abu Dhabi',
        scene: 's-games', tags: ['leisure', 'family', 'waterfront'],
        blurb: 'The leisure island of Abu Dhabi, home to a Formula 1 circuit, theme parks, golf and a marina. Parkland neighbourhoods run through it, and a new waterfront quarter is taking shape on the northern shore.',
        homes: [['Yas Point', 1], ['The Canopies', 1], ['Yas Park Place', 1], ['The Orchids at Yas Acres', 1], ['Yas Riva', 0], ['Yas Living', 0], ['Gardenia Bay', 0], ['Sama Yas', 0], ['Yas Golf Collection', 0], ['Yas Park Gate', 0]],
        facts: [['1,600', 'homes planned at Yas Point, on the northern shore of the island']]
      },
      {
        id: 'fahid', no: '03', name: 'The Spa', place: 'Fahid Island', region: 'Abu Dhabi',
        scene: 's-spa', tags: ['wellness', 'waterfront', 'nature'],
        blurb: 'A natural island between Yas and Saadiyat, planned around wellbeing. Mangroves, shaded trails and a long beachfront set the pace, with close to a third of the land kept for nature.',
        homes: [['Fahid Island masterplan', 0], ['The Beach House', 0]],
        facts: [['11 km', 'of coastline around the island'], ['30%', 'of the masterplan set aside for natural spaces']]
      },
      {
        id: 'abu-dhabi', no: '04', name: 'The Family Room', place: 'Abu Dhabi mainland', region: 'Abu Dhabi',
        scene: 's-family', tags: ['family'],
        blurb: 'Neighbourhoods planned around everyday family life, from the Reeman communities on the mainland to Al Ghadeer, on the corridor between the capital and Dubai.',
        homes: [['Al Ghadeer Gardens', 1], ['Al Ghadeer', 0], ['Alreeman II', 0], ['Reeman Living', 0]],
        facts: []
      },
      {
        id: 'dubai', no: '05', name: 'The Garden', place: 'Dubai', region: 'With Dubai Holding',
        scene: 's-garden', tags: ['nature', 'wellness', 'family'],
        blurb: 'Three communities created with Dubai Holding, each with its own idea of living well: Haven for wellness, Athlon for an active life, The Wilds for nature at the doorstep.',
        homes: [['Haven', 0], ['Verdes by Haven', 0], ['Athlon', 0], ['Rise by Athlon', 0], ['The Wilds', 0], ['The Wilds Residences', 1], ['Moringa Mansions', 0]],
        facts: [['740', 'apartments and duplexes at The Wilds Residences'], ['38', 'Moringa Mansions at the heart of The Wilds']]
      }
    ].map((r) => Object.assign(r, { name: r.place }));
  }

  /* Each name is one page of the site, shown at #name. */
  routeNames() {
    return ['home', 'house'].concat(this.roomData().map((r) => r.id), ['event', 'register', 'organiser']);
  }

  navigate(name) {
    const s = this.state || {};
    const roomIds = this.roomData().map((r) => r.id);
    const route = this.routeNames().indexOf(name) >= 0 ? name : 'home';
    const patch = { route: route, swap: (s.swap || 0) + 1, door: false };
    if (roomIds.indexOf(route) >= 0) {
      const seen = Object.assign({}, s.seen || {});
      seen[route] = true;
      patch.seen = seen;
    }
    this.setState(patch);
    return route;
  }

  renderVals() {
    const p = this.props || {};
    const s = Object.assign({
      route: 'home', door: false, swap: 0, filter: 'all', seen: {}, picks: {},
      fName: '', fEmail: '', fPhone: '', role: 'buyer', guests: 1, time: 'afternoon',
      consent: false, tried: false, sent: false
    }, this.state || {});
    const up = (patch) => this.setState(patch);
    const data = this.roomData();
    const roomIds = data.map((r) => r.id);
    const isRoom = roomIds.indexOf(s.route) >= 0;

    const rooms = data.map((r, i) => {
      const match = s.filter === 'all' || r.tags.indexOf(s.filter) >= 0;
      const picked = !!s.picks[r.id];
      const cls = [];
      if (!match) cls.push('is-dim');
      if (i % 2 === 1) cls.push('alt');
      if (picked) cls.push('is-picked');
      if (s.route === r.id) cls.push('is-active');
      const picks = Object.assign({}, s.picks);
      picks[r.id] = !picked;
      return {
        id: r.id, no: r.no, name: r.name, place: r.place, sceneCls: r.scene, href: '#' + r.id,
        cls: cls.join(' '),
        pipCls: s.seen[r.id] ? 'is-seen' : '',
        picked: picked,
        optCls: picked ? 'is-on' : '',
        label: 'Area ' + r.no + ': ' + r.place + ', ' + r.region,
        toggle: () => up({ picks: picks })
      };
    });

    const cur = data.filter((r) => r.id === s.route)[0] || data[0];
    const at = data.indexOf(cur);
    const prev = data[(at + data.length - 1) % data.length];
    const next = data[(at + 1) % data.length];
    const curPicked = !!s.picks[cur.id];
    const curPicks = Object.assign({}, s.picks);
    curPicks[cur.id] = !curPicked;
    const room = {
      no: cur.no, name: cur.name, place: cur.place, region: cur.region, blurb: cur.blurb, sceneCls: cur.scene,
      count: cur.no + ' of 05',
      homes: cur.homes.map((h) => ({ n: h[0], isNew: h[1] === 1 })),
      facts: cur.facts.map((f) => ({ fig: f[0], lab: f[1] })),
      hasFacts: cur.facts.length > 0,
      picked: curPicked,
      pickCls: curPicked ? 'is-on' : '',
      pickLabel: curPicked ? 'On your visit' : 'Add this area to my visit',
      toggle: () => up({ picks: curPicks }),
      prevHref: '#' + prev.id, prevNo: prev.no, prevName: prev.name,
      nextHref: '#' + next.id, nextNo: next.no, nextName: next.name
    };

    const seenCount = data.filter((r) => s.seen[r.id]).length;
    const seenLabel = seenCount >= data.length ? 'All five rooms seen' : seenCount + ' of ' + data.length + ' rooms seen';

    const filters = [
      ['all', 'Everything'], ['waterfront', 'Waterfront'], ['culture', 'Culture'], ['family', 'Family life'],
      ['wellness', 'Wellness'], ['leisure', 'Sport and leisure'], ['nature', 'Nature']
    ].map((f) => ({ id: f[0], label: f[1], on: s.filter === f[0], cls: s.filter === f[0] ? 'is-on' : '', pick: () => up({ filter: f[0] }) }));

    const ticker = ['Saadiyat Lagoons', 'Talay', 'Mamsha Gardens', 'Yas Point', 'The Canopies', 'Yas Park Place', 'Yas Riva', 'Fahid Island', 'Al Ghadeer Gardens', 'Haven', 'Athlon', 'The Wilds', 'Moringa Mansions', 'Gardenia Bay'].map((n) => ({ n: n }));

    const nameOk = s.fName.trim().length >= 2;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.fEmail.trim());
    const phoneOk = s.fPhone.replace(/\D/g, '').length >= 7;
    const allOk = nameOk && emailOk && phoneOk && !!s.consent;

    const roles = [['buyer', 'Home buyer'], ['investor', 'Investor']]
      .map((o) => ({ id: 'role-' + o[0], label: o[1], on: s.role === o[0], cls: s.role === o[0] ? 'is-on' : '', pick: () => up({ role: o[0] }) }));
    const timeDefs = [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']];
    const times = timeDefs.map((o) => ({ id: 'time-' + o[0], label: o[1], on: s.time === o[0], cls: s.time === o[0] ? 'is-on' : '', pick: () => up({ time: o[0] }) }));
    const timeLabel = (timeDefs.filter((o) => o[0] === s.time)[0] || timeDefs[1])[1].toLowerCase();

    /* The walk: every page ends in a door to the next one. */
    const seq = this.routeNames();
    const stops = {
      home: { no: '', name: 'The front door', place: 'Back to the start', scene: 's-gallery' },
      event: { no: '06', name: 'The event', place: 'When and where', scene: 's-deck' },
      register: { no: '07', name: 'Register', place: 'Have your key', scene: 's-family' },
      organiser: { no: '08', name: 'The organiser', place: 'BlackOak Real Estate', scene: 's-games' }
    };
    data.forEach((r) => { stops[r.id] = { no: r.no, name: r.place, place: r.region, scene: r.scene }; });
    const hasNext = s.route !== 'home' && s.route !== 'house' && !isRoom;
    const nextId = seq[(seq.indexOf(s.route) + 1) % seq.length];
    const stop = stops[nextId] || stops.home;
    const nextDoor = {
      href: '#' + nextId, no: stop.no, name: stop.name, place: stop.place, sceneCls: stop.scene,
      cls: seq.indexOf(nextId) % 2 === 1 ? 'alt' : '',
      kicker: nextId === 'home' ? 'The last door' : 'The next door',
      label: 'Open the door to ' + stop.name + ', ' + stop.place
    };
    const calm = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const pickedNames = data.filter((r) => s.picks[r.id]).map((r) => r.name);
    const keyRooms = (pickedNames.length === 0 || pickedNames.length === data.length) ? 'All five areas' : pickedNames.join(', ');
    const trimmed = s.fName.trim();
    const venue = String(p.venue ?? '[VENUE]').trim();

    return {
      eventDate: p.eventDate ?? '[EVENT DATE]',
      venue: venue,
      hasVenue: venue.length > 0,
      venueText: venue.length > 0 ? venue : 'To be announced',
      organiser: p.organiser ?? '[ORGANISER NAME]',
      accent: p.accent ?? '#D6AC65',

      isHome: s.route === 'home',
      isHouse: s.route === 'house' || isRoom,
      hasNext: hasNext,
      next: nextDoor,
      isRoom: isRoom,
      isRegister: s.route === 'register',
      isEvent: s.route === 'event',
      isOrganiser: s.route === 'organiser',

      doorOpen: !!s.door,
      doorCls: s.door ? 'is-open' : '',
      doorLabel: s.door ? 'Stepping inside' : 'Open the door',
      toggleDoor: () => {
        if (s.door) return;
        up({ door: true });
        setTimeout(() => { if (((this.state || {}).route || 'home') === 'home') window.location.hash = 'house'; }, calm ? 0 : 1150);
      },
      heroMove: (e) => {
        const el = e && e.currentTarget;
        if (!el || !el.getBoundingClientRect) return;
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) return;
        el.style.setProperty('--mx', (((e.clientX - b.left) / b.width - 0.5) * 2).toFixed(3));
        el.style.setProperty('--my', (((e.clientY - b.top) / b.height - 0.5) * 2).toFixed(3));
      },
      heroLeave: (e) => {
        const el = e && e.currentTarget;
        if (!el || !el.style) return;
        el.style.setProperty('--mx', '0');
        el.style.setProperty('--my', '0');
      },

      ticker: ticker,
      filters: filters,
      rooms: rooms,
      others: rooms.filter((r) => r.id !== s.route).map((r) => Object.assign({}, r, { cls: r.cls.replace('is-dim', '').trim() })),
      room: room,
      swapCls: s.swap % 2 === 0 ? 'swap-a' : 'swap-b',
      seenLabel: seenLabel,

      fName: s.fName, fEmail: s.fEmail, fPhone: s.fPhone,
      onName: (e) => up({ fName: e.target.value }),
      onEmail: (e) => up({ fEmail: e.target.value }),
      onPhone: (e) => up({ fPhone: e.target.value }),
      roles: roles,
      times: times,
      guests: s.guests,
      fewer: () => up({ guests: Math.max(1, s.guests - 1) }),
      more: () => up({ guests: Math.min(6, s.guests + 1) }),
      consent: !!s.consent,
      onConsent: (e) => up({ consent: !!e.target.checked }),
      errName: s.tried && !nameOk,
      errEmail: s.tried && !emailOk,
      errPhone: s.tried && !phoneOk,
      errConsent: s.tried && !s.consent,
      nameCls: s.tried && !nameOk ? 'is-bad' : '',
      emailCls: s.tried && !emailOk ? 'is-bad' : '',
      phoneCls: s.tried && !phoneOk ? 'is-bad' : '',
      submit: (e) => {
        if (e && e.preventDefault) e.preventDefault();
        up(allOk ? { tried: true, sent: true } : { tried: true });
      },
      edit: () => up({ sent: false }),
      sent: !!s.sent,
      notSent: !s.sent,
      firstName: trimmed ? trimmed.split(/\s+/)[0] : 'guest',

      keyCls: s.sent ? 'is-cut' : '',
      keyStatus: s.sent ? 'Place held, preview only' : 'Draft guest key',
      keyName: trimmed || 'Your name',
      keyRooms: keyRooms,
      keyTime: timeLabel,
      keyParty: s.guests === 1 ? 'Admits one' : 'Admits ' + s.guests
    };
  }
}
const DC_PROPS = {"eventDate": "12:12:2026", "venue": "Aldar Sales Center Dubai", "organiser": "BlackOak Real Estate", "accent": "#D6AC65"};
(function () {
  'use strict';
  /* Small renderer for the page template: {{ holes }}, <sc-for>, <sc-if> and event attributes.
     Nodes are created once and then updated in place, so focus, transitions and animations survive a state change. */
  var HOLE = /\{\{\s*([^{}]*?)\s*\}\}/g;
  var WHOLE = /^\s*\{\{\s*([^{}]*?)\s*\}\}\s*$/;
  var EVENTS = { onclick: 'click', onchange: 'input', oninput: 'input', onsubmit: 'submit', onmousemove: 'mousemove', onmouseleave: 'mouseleave' };

  function lookup(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.');
    var v = scope[parts[0]];
    for (var i = 1; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) { var v = lookup(p, scope); return v == null ? '' : String(v); });
  }
  function setRaw(el, name, v) {
    if (name === 'value') { var s = v == null ? '' : String(v); if (el.value !== s) el.value = s; return; }
    if (name === 'checked') { el.checked = !!v; return; }
    if (typeof v === 'boolean') {
      if (name.indexOf('aria-') === 0) el.setAttribute(name, String(v));
      else if (v) el.setAttribute(name, ''); else el.removeAttribute(name);
      return;
    }
    if (v == null) { el.removeAttribute(name); return; }
    var str = String(v);
    if (el.getAttribute(name) !== str) el.setAttribute(name, str);
  }

  function mountList(tplNodes, parent, ctx, before) {
    var parts = [];
    for (var i = 0; i < tplNodes.length; i++) { var part = mountNode(tplNodes[i], parent, ctx, before); if (part) parts.push(part); }
    return {
      update: function () { for (var i = 0; i < parts.length; i++) parts[i].update(); },
      destroy: function () { for (var i = 0; i < parts.length; i++) parts[i].destroy(); }
    };
  }
  function mountNode(tpl, parent, ctx, before) {
    if (tpl.nodeType === 3) return mountText(tpl, parent, ctx, before);
    if (tpl.nodeType !== 1) return null;
    if (tpl.localName === 'sc-if') return mountIf(tpl, parent, ctx, before);
    if (tpl.localName === 'sc-for') return mountFor(tpl, parent, ctx, before);
    return mountElement(tpl, parent, ctx, before);
  }
  function mountText(tpl, parent, ctx, before) {
    var text = tpl.data;
    var dyn = text.indexOf('{{') >= 0;
    var node = document.createTextNode(dyn ? '' : text);
    parent.insertBefore(node, before || null);
    return {
      update: function () { if (dyn) { var s = interp(text, ctx.scope); if (node.data !== s) node.data = s; } },
      destroy: function () { if (node.parentNode) node.parentNode.removeChild(node); }
    };
  }
  function mountElement(tpl, parent, ctx, before) {
    var el = document.importNode(tpl, false);
    var binds = [];
    Array.prototype.slice.call(tpl.attributes).forEach(function (a) {
      var name = a.name, value = a.value;
      var whole = WHOLE.exec(value);
      if (EVENTS[name] && whole) {
        el.removeAttribute(name);
        el.addEventListener(EVENTS[name], function (e) { var fn = lookup(whole[1], ctx.scope); if (typeof fn === 'function') fn(e); });
        return;
      }
      if (value.indexOf('{{') < 0) return;
      el.removeAttribute(name);
      binds.push(whole
        ? function () { setRaw(el, name, lookup(whole[1], ctx.scope)); }
        : function () { var s = interp(value, ctx.scope); if (el.getAttribute(name) !== s) el.setAttribute(name, s); });
    });
    var kids = mountList(tpl.childNodes, el, ctx, null);
    parent.insertBefore(el, before || null);
    return {
      update: function () { for (var i = 0; i < binds.length; i++) binds[i](); kids.update(); },
      destroy: function () { kids.destroy(); if (el.parentNode) el.parentNode.removeChild(el); }
    };
  }
  function mountIf(tpl, parent, ctx, before) {
    var anchor = document.createComment('if');
    parent.insertBefore(anchor, before || null);
    var path = (WHOLE.exec(tpl.getAttribute('value') || '') || [])[1];
    var inner = null;
    return {
      update: function () {
        var on = !!(path && lookup(path, ctx.scope));
        if (on && !inner) inner = mountList(tpl.childNodes, parent, ctx, anchor);
        else if (!on && inner) { inner.destroy(); inner = null; }
        if (inner) inner.update();
      },
      destroy: function () { if (inner) inner.destroy(); inner = null; if (anchor.parentNode) anchor.parentNode.removeChild(anchor); }
    };
  }
  function mountFor(tpl, parent, ctx, before) {
    var anchor = document.createComment('for');
    parent.insertBefore(anchor, before || null);
    var path = (WHOLE.exec(tpl.getAttribute('list') || '') || [])[1];
    var as = tpl.getAttribute('as') || 'item';
    var rows = [];
    function scopeFor(item, i) { var s = Object.create(ctx.scope); s[as] = item; s.$index = i; return s; }
    return {
      update: function () {
        var list = (path && lookup(path, ctx.scope)) || [];
        if (list.length !== rows.length) {
          for (var k = 0; k < rows.length; k++) rows[k].part.destroy();
          rows = [];
          for (var i = 0; i < list.length; i++) {
            var rctx = { scope: scopeFor(list[i], i) };
            rows.push({ ctx: rctx, part: mountList(tpl.childNodes, parent, rctx, anchor) });
          }
        } else {
          for (var j = 0; j < list.length; j++) rows[j].ctx.scope = scopeFor(list[j], j);
        }
        for (var n = 0; n < rows.length; n++) rows[n].part.update();
      },
      destroy: function () { for (var k = 0; k < rows.length; k++) rows[k].part.destroy(); rows = []; if (anchor.parentNode) anchor.parentNode.removeChild(anchor); }
    };
  }

  var component = new Component();
  component.props = DC_PROPS;
  var ctx = { scope: component.renderVals() };
  var view = mountList(document.getElementById('dc').content.childNodes, document.getElementById('app'), ctx, null);
  component.__update = function () { ctx.scope = component.renderVals(); view.update(); };
  view.update();

  /* Pages: each one is shown at its own #name, so the back button and shared links work. */
  var routes = component.routeNames();
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hashName() {
    try { return decodeURIComponent((window.location.hash || '').replace(/^#/, '')); } catch (e) { return ''; }
  }
  function toTop() {
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
  }
  function glide(el) { el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }); }
  /* Areas open as a popup over the walkthrough page, so the page behind keeps its place. */
  var areaIds = component.roomData().map(function (r) { return r.id; });
  function isArea(name) { return areaIds.indexOf(name) >= 0; }
  function go(name) {
    var prev = (component.state || {}).route || 'home';
    var route = component.navigate(name);
    document.documentElement.classList.toggle('is-modal', isArea(route));
    if (isArea(route)) {
      var modal = document.querySelector('.modal');
      if (modal) modal.scrollTop = 0;
      var close = document.getElementById('modal-close');
      if (close && !isArea(prev)) { try { close.focus({ preventScroll: true }); } catch (e) { /* focus is optional */ } }
    } else if (!(isArea(prev) && route === 'house')) {
      toTop();
    }
    return route;
  }
  function show(name) {
    var route = go(name);
    try { if (hashName() !== route) window.location.hash = route; } catch (e) { /* the address is optional */ }
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isArea((component.state || {}).route)) show('house');
  });
  window.addEventListener('hashchange', function () {
    var name = hashName() || 'home';
    if (routes.indexOf(name) >= 0 && ((component.state || {}).route || 'home') !== name) go(name);
  });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('modal')) { show('house'); return; }
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var name = a.getAttribute('href').slice(1);
    if (name === 'rooms') { e.preventDefault(); show('house'); return; }
    if (routes.indexOf(name) >= 0) {
      e.preventDefault();
      /* A door swings open first, then you walk through it. */
      if (a.classList.contains('door') && !calm) {
        if (a.dataset.busy) return;
        a.dataset.busy = '1';
        a.classList.add('is-active');
        setTimeout(function () { delete a.dataset.busy; show(name); }, 850);
        return;
      }
      show(name);
      return;
    }
    var target = document.getElementById(name);
    if (!target) return;
    e.preventDefault();
    glide(target);
  });
  var first = hashName();
  if (first !== 'home' && routes.indexOf(first) >= 0) go(first);
})();
