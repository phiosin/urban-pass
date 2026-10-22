/* Urban Pass app: classes you can book with both Urban Sports Club and Wellpass. No dependencies. */
(function () {
  "use strict";
  var CFG = window.URBAN_PASS || { data: "data/", v: "" };
  var root = document.getElementById("urban-pass-app");
  if (!root) return;

  var PLANS = ["Essential", "Classic", "Premium", "Max"];
  var WP_LABEL = { app: "Book in Wellpass app", external: "Book via studio link", checkin: "Check in on site" };
  var TIMES = [["morning", "Morning", "00:00", "11:59"], ["midday", "Midday", "12:00", "16:59"], ["evening", "Evening", "17:00", "23:59"]];

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem("urbanpass." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("urbanpass." + k, JSON.stringify(v)); } catch (e) {} }
  };

  var S = {
    index: null, days: {}, date: null, tab: "classes", q: "", time: "", cat: "",
    onlyBoth: true, plan: store.get("plan", ""), district: "", wp: store.get("wp", ["app", "external", "checkin"])
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function url(u) { return /^https:\/\//.test(u || "") ? esc(u) : "#"; }
  function $(sel, el) { return (el || root).querySelector(sel); }
  function fetchJSON(name) {
    return fetch(CFG.data + name + "?v=" + encodeURIComponent(CFG.v)).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  var ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    classes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    studios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>',
    mark: '<svg class="up-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="12" cy="16" r="9" fill="#2e70ce"/><circle cx="20" cy="16" r="9" fill="none" stroke="#fff" stroke-width="2.5"/></svg>'
  };

  /* ---------- helpers on data ---------- */
  function studio(c) { return S.index.studios[c.st] || {}; }
  function lowestPlan(pl) {
    for (var i = 0; i < PLANS.length; i++) if (pl.indexOf(PLANS[i]) >= 0) return PLANS[i];
    return pl[0] || "";
  }
  function dayLabel(d, long) {
    var dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("en-GB", long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short" });
  }
  function localISO(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function bookable(c) { return c.ok === true || (c.ok == null && studio(c).wp_status !== "app"); }
  function topCategories(classes) {
    var n = {};
    classes.forEach(function (c) {
      var k = (c.c || "").split(/[\/,]/)[0].trim();
      if (k) n[k] = (n[k] || 0) + 1;
    });
    return Object.keys(n).sort(function (a, b) { return n[b] - n[a]; }).slice(0, 8);
  }
  function filtered() {
    var day = S.days[S.date];
    if (!day) return [];
    var q = S.q.toLowerCase(), t = TIMES.filter(function (x) { return x[0] === S.time; })[0];
    var now = new Date(), nowHM = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);
    var isToday = S.date === localISO(now);
    return day.classes.filter(function (c) {
      var st = studio(c);
      if (isToday && c.s < nowHM) return false;
      if (S.onlyBoth && S.index.wellpass_checked && c.ok !== true) return false;
      if (!bookable(c)) return false;
      if (S.wp.indexOf(st.wp_status) < 0) return false;
      if (S.plan && c.pl.indexOf(S.plan) < 0) return false;
      if (S.district && st.district !== S.district) return false;
      if (S.cat && (c.c || "").indexOf(S.cat) !== 0) return false;
      if (t && (c.s < t[2] || c.s > t[3])) return false;
      if (q && (c.t + " " + c.c + " " + st.name + " " + st.wp_name + " " + st.district).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  /* ---------- shell ---------- */
  function shell() {
    root.innerHTML =
      '<header class="up-top">' +
        '<div class="up-brand">' + ICON.mark + '<div><h1>Urban Pass</h1><p>Berlin · Urban Sports Club × Wellpass</p></div></div>' +
        '<label class="up-search">' + ICON.search + '<input type="search" placeholder="Search classes, studios, districts" aria-label="Search"></label>' +
        '<nav class="up-days" aria-label="Day"></nav>' +
      '</header>' +
      '<main class="up-main"><div class="up-loading">Loading classes…</div></main>' +
      '<nav class="up-tabs" role="tablist">' +
        tabBtn("classes", "Classes") + tabBtn("studios", "Studios") + tabBtn("info", "About") +
      '</nav>';
    $(".up-search input").addEventListener("input", function (e) { S.q = e.target.value; render(); });
    root.querySelectorAll(".up-tab").forEach(function (b) {
      b.addEventListener("click", function () { S.tab = b.dataset.tab; render(); window.scrollTo(0, 0); });
    });
  }
  function tabBtn(id, label) {
    return '<button class="up-tab" role="tab" data-tab="' + id + '">' + ICON[id] + '<span>' + label + '</span></button>';
  }

  function renderDays() {
    var nav = $(".up-days");
    nav.innerHTML = S.index.days.map(function (d) {
      var n = d.date.slice(8, 10).replace(/^0/, "");
      return '<button class="up-day" data-date="' + d.date + '" aria-pressed="' + (d.date === S.date) + '"><small>' +
        esc(dayLabel(d.date)) + '</small><b>' + n + '</b></button>';
    }).join("");
    nav.querySelectorAll(".up-day").forEach(function (b) {
      b.addEventListener("click", function () { selectDay(b.dataset.date); });
    });
  }

  function selectDay(date) {
    S.date = date;
    renderDays();
    if (S.days[date]) return render();
    $(".up-main").innerHTML = '<div class="up-loading">Loading classes…</div>';
    fetchJSON(date + ".json").then(function (d) { S.days[date] = d; render(); })
      .catch(function () { $(".up-main").innerHTML = '<div class="up-empty"><b>Couldn\'t load this day.</b>Try again later.</div>'; });
  }

  /* ---------- views ---------- */
  function render() {
    root.querySelectorAll(".up-tab").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === S.tab); });
    $(".up-days").style.display = S.tab === "info" ? "none" : "";
    $(".up-search").style.display = S.tab === "info" ? "none" : "";
    root.style.setProperty("--up-top-h", $(".up-top").getBoundingClientRect().height + "px");
    if (S.tab === "classes") renderClasses();
    else if (S.tab === "studios") renderStudios();
    else renderInfo();
  }

  function chip(id, label, on, dot) {
    return '<button class="up-chip" data-chip="' + esc(id) + '" aria-pressed="' + !!on + '">' + (dot ? '<span class="up-dot"></span>' : "") + esc(label) + '</button>';
  }

  function renderClasses() {
    var day = S.days[S.date];
    if (!day) return;
    var list = filtered();
    var nFilters = (S.plan ? 1 : 0) + (S.district ? 1 : 0) + (S.wp.length < 3 ? 1 : 0);
    var chips = (S.index.wellpass_checked ? chip("both", "✓ On both schedules", S.onlyBoth) : "") +
      chip("filters", nFilters ? "Filters · " + nFilters : "Filters", nFilters > 0, nFilters > 0) +
      TIMES.map(function (t) { return chip("time:" + t[0], t[1], S.time === t[0]); }).join("") +
      topCategories(day.classes).map(function (c) { return chip("cat:" + c, c, S.cat === c); }).join("");
    var studios = {};
    list.forEach(function (c) { studios[c.st] = 1; });
    var html = '<div class="up-chips">' + chips + '</div>' +
      '<div class="up-meta">' + list.length + ' classes at ' + Object.keys(studios).length + ' studios · ' + esc(dayLabel(S.date, true)) + '</div>';
    if (!list.length) {
      html += '<div class="up-empty"><b>No classes match.</b>Try another day or fewer filters.</div>';
    } else {
      var hour = "";
      list.forEach(function (c, i) {
        var h = c.s.slice(0, 2);
        if (h !== hour) { hour = h; html += '<div class="up-hour">' + h + ':00</div>'; }
        html += classCard(c, i);
      });
    }
    $(".up-main").innerHTML = html;
    bindChips();
    root.querySelectorAll("[data-class]").forEach(function (el) {
      el.addEventListener("click", function () { openClass(list[+el.dataset.class]); });
    });
  }

  function classCard(c, i) {
    var st = studio(c);
    var badges = [];
    if (c.ok === true) badges.push('<span class="up-badge ok">✓ Wellpass' + (c.w != null ? " · " + esc(c.w) + " left" : "") + '</span>');
    else badges.push('<span class="up-badge">' + esc(WP_LABEL[st.wp_status] || "Wellpass") + '</span>');
    badges.push('<span class="up-badge blue">USC ' + esc(lowestPlan(c.pl)) + (c.pl.length > 1 ? "+" : "") + (c.u ? " · " + esc(c.u) + " left" : "") + '</span>');
    if (c.act === false && c.ok !== true) badges.push('<span class="up-badge warn">Check activity</span>');
    return '<button class="up-card" data-class="' + i + '">' +
      '<div class="up-time"><b>' + esc(c.s) + '</b><span>' + esc(c.e) + '</span></div>' +
      '<div><div class="up-title">' + esc(c.t) + '</div>' +
      '<div class="up-sub">' + esc(st.name) + ' · ' + esc(st.district) + '</div>' +
      '<div class="up-badges">' + badges.join("") + '</div></div>' +
      (c.img ? '<img class="up-thumb" loading="lazy" alt="" src="' + url(c.img) + '" onerror="this.style.visibility=\'hidden\'">' : '<div class="up-thumb"></div>') +
      '</button>';
  }

  function bindChips() {
    root.querySelectorAll("[data-chip]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.chip;
        if (id === "both") S.onlyBoth = !S.onlyBoth;
        else if (id === "filters") return openFilters();
        else if (id.indexOf("time:") === 0) S.time = S.time === id.slice(5) ? "" : id.slice(5);
        else if (id.indexOf("cat:") === 0) S.cat = S.cat === id.slice(4) ? "" : id.slice(4);
        render();
      });
    });
  }

  function renderStudios() {
    var day = S.days[S.date] || { classes: [] };
    var counts = {};
    day.classes.forEach(function (c) { if (!S.onlyBoth || c.ok === true || !S.index.wellpass_checked) counts[c.st] = (counts[c.st] || 0) + 1; });
    var q = S.q.toLowerCase();
    var keys = Object.keys(S.index.studios).filter(function (k) {
      var s = S.index.studios[k];
      return !q || (s.name + " " + s.wp_name + " " + s.district + " " + s.disciplines.join(" ")).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (counts[b] || 0) - (counts[a] || 0) || S.index.studios[a].name.localeCompare(S.index.studios[b].name, "de"); });
    var html = '<div class="up-meta" style="padding-top:14px">' + keys.length + ' studios on both platforms · classes on ' + esc(dayLabel(S.date, true)) + '</div>';
    keys.forEach(function (k) {
      var s = S.index.studios[k];
      html += '<button class="up-card up-studio" data-studio="' + esc(k) + '"><div>' +
        '<div class="up-title">' + esc(s.name) + '</div>' +
        '<div class="up-sub">' + esc(s.street) + ' · ' + esc(s.district) + '</div>' +
        '<div class="up-badges"><span class="up-badge ' + (s.wp_status === "app" ? "ok" : "") + '">' + esc(s.wp_label) + '</span>' +
        (s.disciplines[0] ? '<span class="up-badge">' + esc(s.disciplines.slice(0, 2).join(" · ")) + '</span>' : "") + '</div></div>' +
        '<div class="up-count">' + (counts[k] || 0) + ' classes</div></button>';
    });
    $(".up-main").innerHTML = html;
    root.querySelectorAll("[data-studio]").forEach(function (el) {
      el.addEventListener("click", function () { openStudio(el.dataset.studio); });
    });
  }

  function renderInfo() {
    var g = S.index.generated ? new Date(S.index.generated.replace("Z", ":00Z")) : null;
    $(".up-main").innerHTML = '<div class="up-info">' +
      '<h2>Book together, with different passes</h2>' +
      '<p>Urban Pass shows Berlin classes you can book with <b>Urban Sports Club</b> and with <b>EGYM Wellpass</b>, so you can train with friends on the other platform.</p>' +
      '<h3>What the badges mean</h3><ul>' +
      '<li><b>✓ Wellpass</b>: the same class (same studio, time and name) is on both schedules.</li>' +
      '<li><b>Check in on site</b> / <b>Book via studio link</b>: the studio takes Wellpass without in-app booking. Check with the studio first.</li>' +
      '<li><b>USC Classic+</b>: the lowest Urban Sports Club plan that includes the class.</li></ul>' +
      '<h3>Where the data comes from</h3>' +
      '<p>The public Urban Sports Club class schedule, the public Wellpass studio finder, and the Wellpass app schedule. It is refreshed every morning' +
      (g ? ' (last update ' + esc(g.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })) + ')' : '') + '.</p>' +
      '<div class="up-note">Spots and schedules can change after the daily update. Always confirm in each app before booking. Urban Pass is a private project and isn\'t affiliated with Urban Sports Club or EGYM Wellpass.</div>' +
      '</div>';
  }

  /* ---------- sheets ---------- */
  function sheet(html, hero) {
    var wrap = document.createElement("div");
    wrap.className = "up-sheet-wrap";
    wrap.innerHTML = '<div class="up-scrim"></div><div class="up-sheet" role="dialog" aria-modal="true">' +
      '<div class="up-grab"></div><button class="up-close" aria-label="Close">×</button>' +
      (hero ? '<img class="up-hero" alt="" src="' + url(hero) + '" onerror="this.remove()">' : "") +
      '<div class="up-sheet-body">' + html + '</div></div>';
    function close() { wrap.remove(); document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; }
    function onKey(e) { if (e.key === "Escape") close(); }
    wrap.querySelector(".up-scrim").addEventListener("click", close);
    wrap.querySelector(".up-close").addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    document.body.style.overflow = "hidden";
    wrap.querySelector(".up-close").focus();
    return { el: wrap, close: close };
  }

  function mapLink(st) {
    var q = st.lat ? st.lat + "," + st.lng : st.street + ", Berlin";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }

  function openClass(c) {
    var st = studio(c);
    var wpBox;
    if (c.ok === true) {
      wpBox = '<p>✓ This class is on the Wellpass schedule' + (c.w != null ? " · <b>" + esc(c.w) + " spots left</b>" : "") + '.</p><p>Book it in the Wellpass app.</p>';
    } else if (st.wp_status === "external") {
      wpBox = '<p>The studio takes Wellpass with booking on its own page. Check that this class is included.</p>' +
        (st.booking ? '<a class="up-btn ghost" target="_blank" rel="noopener" href="' + url(st.booking) + '">Studio booking page</a>' : "");
    } else {
      wpBox = '<p>The studio takes Wellpass by check-in. Check that this class is included.</p>';
    }
    sheet(
      '<h2>' + esc(c.t) + '</h2>' +
      '<div class="up-sub">' + esc(dayLabel(S.date, true)) + ' · ' + esc(c.s) + '–' + esc(c.e) + (c.c ? ' · ' + esc(c.c) : "") + '</div>' +
      '<div class="up-box"><h3>Studio</h3><p><b>' + esc(st.name) + '</b></p><p>' + esc(st.street) + ', ' + esc(st.district) + '</p>' +
        '<div class="up-row"><a class="up-btn ghost" target="_blank" rel="noopener" href="' + url(mapLink(st)) + '">Directions</a>' +
        '<button class="up-btn ghost" data-open-studio="' + esc(c.st) + '">All classes here</button></div></div>' +
      '<div class="up-box"><h3>Urban Sports Club</h3><p>Plans: ' + esc(c.pl.join(", ")) + (c.u ? ' · <b>' + esc(c.u) + ' spots left</b>' : "") + '</p>' +
        '<a class="up-btn" target="_blank" rel="noopener" href="https://urbansportsclub.com/de/class-details/' + encodeURIComponent(c.id) + '">Open class on Urban Sports Club</a></div>' +
      '<div class="up-box"><h3>Wellpass</h3>' + wpBox +
        '<a class="up-btn ghost" target="_blank" rel="noopener" href="' + url(st.wp_url) + '">Studio on Wellpass</a>' +
        (st.terms ? '<details><summary style="margin-top:10px;cursor:pointer;font-size:13px;color:#5c687c">Wellpass terms for this studio</summary><div class="up-terms">' + esc(st.terms) + '</div></details>' : "") +
      '</div>',
      c.img
    ).el.querySelectorAll("[data-open-studio]").forEach(function (b) {
      b.addEventListener("click", function () { b.closest(".up-sheet-wrap").remove(); document.body.style.overflow = ""; openStudio(b.dataset.openStudio); });
    });
  }

  function openStudio(key) {
    var st = S.index.studios[key];
    var classes = ((S.days[S.date] || {}).classes || []).filter(function (c) { return c.st === key && bookable(c); });
    var rows = classes.length ? classes.map(function (c) {
      return '<p style="display:flex;gap:10px"><b style="width:44px;flex:none">' + esc(c.s) + '</b><span>' + esc(c.t) +
        (c.ok === true ? ' <span class="up-badge ok">✓ Wellpass</span>' : "") + '</span></p>';
    }).join("") : '<p>No shared classes on this day.</p>';
    sheet(
      '<h2>' + esc(st.name) + '</h2><div class="up-sub">' + esc(st.street) + ' · ' + esc(st.district) + '</div>' +
      '<div class="up-box"><h3>' + esc(dayLabel(S.date, true)) + '</h3>' + rows + '</div>' +
      '<div class="up-box"><h3>Wellpass</h3><p>' + esc(st.wp_label) + ' · listed as “' + esc(st.wp_name) + '”</p>' +
        (st.terms ? '<div class="up-terms">' + esc(st.terms) + '</div>' : "") +
        '<a class="up-btn ghost" target="_blank" rel="noopener" href="' + url(st.wp_url) + '">Studio on Wellpass</a></div>' +
      '<div class="up-box"><h3>Urban Sports Club</h3><p>' + esc(st.disciplines.join(" · ")) + '</p><p>Plans: ' + esc(st.plans.join(", ")) + '</p>' +
        '<a class="up-btn ghost" target="_blank" rel="noopener" href="' + url(st.usc_url) + '">Studio on Urban Sports Club</a></div>' +
      '<a class="up-btn" target="_blank" rel="noopener" href="' + url(mapLink(st)) + '">Directions</a>'
    );
  }

  function openFilters() {
    var districts = {};
    Object.keys(S.index.studios).forEach(function (k) { districts[S.index.studios[k].district] = 1; });
    var s = sheet(
      '<h2>Filters</h2>' +
      '<label class="up-field"><span>Your friend\'s Urban Sports Club plan</span><select data-f="plan"><option value="">Any plan</option>' +
        PLANS.map(function (p) { return '<option' + (S.plan === p ? " selected" : "") + '>' + p + '</option>'; }).join("") + '</select></label>' +
      '<label class="up-field"><span>District</span><select data-f="district"><option value="">All of Berlin</option>' +
        Object.keys(districts).filter(Boolean).sort().map(function (d) { return '<option' + (S.district === d ? " selected" : "") + '>' + esc(d) + '</option>'; }).join("") + '</select></label>' +
      '<div class="up-field"><span>How Wellpass works at the studio</span><div class="up-seg">' +
        Object.keys(WP_LABEL).map(function (k) { return '<button class="up-chip" data-wp="' + k + '" aria-pressed="' + (S.wp.indexOf(k) >= 0) + '">' + WP_LABEL[k] + '</button>'; }).join("") +
      '</div></div>' +
      '<div class="up-row" style="margin-top:18px"><button class="up-btn ghost" data-reset>Reset</button><button class="up-btn" data-done>Show classes</button></div>'
    );
    var el = s.el;
    el.querySelector('[data-f="plan"]').addEventListener("change", function (e) { S.plan = e.target.value; store.set("plan", S.plan); });
    el.querySelector('[data-f="district"]').addEventListener("change", function (e) { S.district = e.target.value; });
    el.querySelectorAll("[data-wp]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.dataset.wp, i = S.wp.indexOf(k);
        if (i >= 0) S.wp.splice(i, 1); else S.wp.push(k);
        b.setAttribute("aria-pressed", i < 0);
        store.set("wp", S.wp);
      });
    });
    el.querySelector("[data-reset]").addEventListener("click", function () {
      S.plan = ""; S.district = ""; S.wp = ["app", "external", "checkin"]; store.set("plan", ""); store.set("wp", S.wp); s.close(); render();
    });
    el.querySelector("[data-done]").addEventListener("click", function () { s.close(); render(); });
  }

  /* ---------- start ---------- */
  shell();
  fetchJSON("index.json").then(function (idx) {
    S.index = idx;
    var iso = localISO(new Date());
    var first = idx.days.filter(function (d) { return d.date >= iso; })[0] || idx.days[0];
    render();
    selectDay(first.date);
  }).catch(function () {
    $(".up-main").innerHTML = '<div class="up-empty"><b>No data yet.</b>The daily update hasn\'t run.</div>';
  });
})();
