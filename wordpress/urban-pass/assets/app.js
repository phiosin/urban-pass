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
    index: null, days: {}, date: null, tab: "classes", q: "", time: "", acts: store.get("acts", []),
    onlyBoth: true, plan: store.get("plan", ""), district: "", wp: store.get("wp", ["app", "external", "checkin"]),
    showCourts: store.get("showCourts", true), plus1Only: store.get("plus1Only", false),
    timeMode: store.get("timeMode", "any"), timeVal: store.get("timeVal", "18:00")
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
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>',
    locate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>',
    mark: '<svg class="up-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="12" cy="16" r="9" fill="#2e70ce"/><circle cx="20" cy="16" r="9" fill="none" stroke="#fff" stroke-width="2.5"/></svg>'
  };

  /* ---------- helpers on data ---------- */
  function studio(c) { return S.index.studios[c.st] || {}; }
  function planIncludes(pl) { return !S.plan || (pl || []).indexOf(S.plan) >= 0; }
  function hasCourtData() { return !!(S.index && Array.isArray(S.index.courts)); }
  function hasPlus1Data() {
    if (!S.index) return false;
    return Object.keys(S.index.studios || {}).some(function (k) { return S.index.studios[k].plus1 != null; }) ||
      (S.index.plus1_places || []).length > 0 || (S.index.courts || []).some(function (p) { return p.plus1 != null; });
  }
  function plus1Matches(place) { return !S.plus1Only || !hasPlus1Data() || !!(place && place.plus1); }
  function placeMatches(place, allowCourt) {
    if (!place || (!allowCourt && place.court)) return false;
    var platforms = place.platforms || [];
    if (S.plan && platforms.indexOf("USC") >= 0 && platforms.indexOf("Wellpass") < 0 && !planIncludes(place.plans)) return false;
    if (!plus1Matches(place)) return false;
    if (S.district && place.district !== S.district) return false;
    if (S.acts.length && !hasAct(place.activities)) return false;
    var q = S.q.toLowerCase();
    return !q || (place.name + " " + (place.wp_name || "") + " " + (place.district || "") + " " +
      (place.street || "") + " " + (place.activities || []).join(" ")).toLowerCase().indexOf(q) >= 0;
  }
  function lowestPlan(pl) {
    for (var i = 0; i < PLANS.length; i++) if (pl.indexOf(PLANS[i]) >= 0) return PLANS[i];
    return pl[0] || "";
  }
  function dayLabel(d, long) {
    var dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("en-GB", long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short" });
  }
  function toMin(hm) { return (+hm.slice(0, 2)) * 60 + (+hm.slice(3, 5)); }
  function localISO(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function bookable(c) { return c.ok === true || (c.ok == null && studio(c).wp_status !== "app"); }
  function actOf(c) { return (c.c || "").trim() || "Other"; }
  // Activities you can do without booking a class (gym floor, pool, courts, walls, sauna).
  var DROPIN = /fitness|gym|swim|squash|tennis|padel|badminton|climb|boulder|sauna|spa|wellness|skat|golf|volleyball|ski/i;
  function isDropIn(a) { return DROPIN.test(a); }
  // One name per activity across USC ("Padel") and Wellpass ("PADEL", "TABLE_TENNIS").
  var SYN = { "musculation": "strength training", "dance": "dancing", "cross training": "crosstraining",
    "boxing sports": "boxing", "martial arts": "martial arts", "swimming pool": "swimming", "swim": "swimming",
    "indoor cycling": "indoor cycling", "pilates mat": "pilates", "bouldering": "bouldering", "climbing": "climbing" };
  function normAct(a) { a = String(a || "").toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim(); return SYN[a] || a; }
  function actLabelOf(a) { a = normAct(a); return a.charAt(0).toUpperCase() + a.slice(1); }
  function hasAct(list) {
    return (list || []).some(function (a) { return S.acts.indexOf(normAct(a)) >= 0; });
  }
  // Courts, pools, gyms...: no class needed, one pass is enough to get in.
  function actIcon(a) {
    a = normAct(a);
    return /tennis|padel|squash|badminton|pickleball|volleyball/.test(a) ? "🎾 " : /swim/.test(a) ? "🏊 " :
      /climb|boulder/.test(a) ? "🧗 " : /sauna|spa|wellness/.test(a) ? "♨️ " : /fitness|gym|strength/.test(a) ? "🏋️ " : "";
  }
  function accessMode() { return S.acts.length > 0 && S.acts.every(isDropIn); }
  function studioOffers(st) {
    return S.acts.some(function (a) { return isDropIn(a) && (st.disciplines || []).map(normAct).indexOf(a) >= 0; });
  }
  function topCategories(classes) {
    var n = {};
    classes.forEach(function (c) {
      var k = (c.c || "").split(/[\/,]/)[0].trim();
      if (k) n[k] = (n[k] || 0) + 1;
    });
    return Object.keys(n).sort(function (a, b) { return n[b] - n[a]; }).slice(0, 8);
  }
  function filtered(ignoreActs) {
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
      if (!planIncludes(c.pl) || !plus1Matches(st)) return false;
      if (S.district && st.district !== S.district) return false;
      if (!ignoreActs && S.acts.length && S.acts.indexOf(normAct(actOf(c))) < 0) return false;
      if (t && (c.s < t[2] || c.s > t[3])) return false;
      if (S.timeMode && S.timeMode !== "any" && S.timeVal) {
        if (S.timeMode === "after" && c.s < S.timeVal) return false;
        if (S.timeMode === "before" && c.s >= S.timeVal) return false;
        if (S.timeMode === "at" && Math.abs(toMin(c.s) - toMin(S.timeVal)) > 30) return false;
      }
      if (q && (c.t + " " + c.c + " " + st.name + " " + st.wp_name + " " + st.district).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  /* ---------- shell ---------- */
  function shell() {
    root.innerHTML =
      '<header class="up-top">' +
        '<div class="up-bar"><button class="up-back" data-setup aria-label="Change settings">‹</button>' +
          '<button class="up-summary" data-setup2><b>Urban Pass</b><span></span></button></div>' +
        '<label class="up-search">' + ICON.search + '<input type="search" placeholder="Search classes, studios, districts" aria-label="Search"></label>' +
        '<nav class="up-days" aria-label="Day"></nav>' +
      '</header>' +
      '<main class="up-main"><div class="up-loading">Loading classes…</div></main>' +
      '<section class="up-mapview" hidden><div class="up-chips up-mapchips"></div><div class="up-map"></div>' +
        '<div class="up-mapcount"></div><button class="up-locate" aria-label="Show my location">' + ICON.locate + '</button></section>' +
      '<nav class="up-tabs" role="tablist">' +
        tabBtn("classes", "Classes") + tabBtn("map", "Map") + tabBtn("studios", "Studios") + tabBtn("info", "About") +
      '</nav>';
    $(".up-search input").addEventListener("input", function (e) { S.q = e.target.value; render(); });
    $("[data-setup]").addEventListener("click", showSetup);
    $("[data-setup2]").addEventListener("click", showSetup);
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
    $(".up-days").style.display = "none";
    $(".up-search").style.display = S.tab === "info" || S.tab === "map" ? "none" : "";
    $(".up-summary span").textContent = summaryText();
    document.body.classList.toggle("up-noscroll", S.tab === "map");
    root.style.setProperty("--up-top-h", $(".up-top").getBoundingClientRect().height + "px");
    var isMap = S.tab === "map";
    $(".up-main").hidden = isMap;
    $(".up-mapview").hidden = !isMap;
    root.classList.toggle("up-on-map", isMap);
    if (isMap) renderMap();
    else if (S.tab === "classes") renderClasses();
    else if (S.tab === "studios") renderStudios();
    else renderInfo();
  }

  function chip(id, label, on, dot) {
    var html = '<button class="up-chip" data-chip="' + esc(id) + '" aria-pressed="' + !!on + '">' + (dot ? '<span class="up-dot"></span>' : "") + esc(label) + '</button>';
    if (id === "acts") return chip("plan", "USC " + (S.plan || "plan") + " ▾", !!S.plan, !!S.plan) +
      (hasCourtData() ? chip("courts", S.showCourts ? "Courts" : "Courts hidden", S.showCourts) : "") +
      (hasPlus1Data() ? chip("plus1", S.plus1Only ? "+1 only" : "Wellpass +1", S.plus1Only) : "") + html;
    return html;
  }

  function chipsHtml(day) {
    var nFilters = (S.district ? 1 : 0) + (S.wp.length < 3 ? 1 : 0);
    var actLabel = !S.acts.length ? "All activities" : S.acts.length === 1 ? actLabelOf(S.acts[0]) : actLabelOf(S.acts[0]) + " +" + (S.acts.length - 1);
    return chip("acts", actLabel + " ▾", S.acts.length > 0, S.acts.length > 0) +
      (S.index.wellpass_checked ? chip("both", "✓ On both schedules", S.onlyBoth) : "") +
      chip("filters", nFilters ? "Filters · " + nFilters : "Filters", nFilters > 0, nFilters > 0) +
      TIMES.map(function (t) { return chip("time:" + t[0], t[1], S.time === t[0]); }).join("");
  }

  function nearHtml(st, all) {
    var n = st.near || [];
    if (!n.length) return "";
    return (all ? n : n.slice(0, 1)).map(function (x) {
      return '<span class="up-near"><span class="up-st">' + x.t.split("+").map(function (t) {
        return '<i class="up-st-' + t.toLowerCase() + '">' + t + '</i>'; }).join("") + '</span>' +
        esc(x.n) + ' · ' + (x.m < 1000 ? x.m + " m" : (x.m / 1000).toFixed(1) + " km") + '</span>';
    }).join("");
  }

  function renderClasses() {
    var day = S.days[S.date];
    if (!day) return;
    var list = filtered();
    var chips = chipsHtml(day);
    var studios = {};
    list.forEach(function (c) { studios[c.st] = 1; });
    var age = generatedAt() ? (Date.now() - generatedAt().getTime()) / 3600000 : 0;
    var stale = age > 20 ? '<div class="up-stale">Data is ' + Math.round(age / 24 * 10) / 10 + ' days old. Spots and schedules may have changed.' +
      (CFG.refreshUrl ? ' <a target="_blank" rel="noopener" href="' + url(CFG.refreshUrl) + '">Update now</a>' : "") + '</div>' : "";
    var html = '<div class="up-chips">' + chips + '</div>' + stale +
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
    var badges = placeBadges(st);
    if (c.ok === true) badges.push('<span class="up-badge ok">✓ Wellpass' + (c.w != null ? " · " + esc(c.w) + " left" : "") + '</span>');
    else badges.push('<span class="up-badge">' + esc(WP_LABEL[st.wp_status] || "Wellpass") + '</span>');
    badges.push('<span class="up-badge blue">USC ' + esc(lowestPlan(c.pl)) + (c.pl.length > 1 ? "+" : "") + (c.u ? " · " + esc(c.u) + " left" : "") + '</span>');
    if (c.act === false && c.ok !== true) badges.push('<span class="up-badge warn">Check activity</span>');
    return '<button class="up-card" data-class="' + i + '">' +
      '<div class="up-time"><b>' + esc(c.s) + '</b><span>' + esc(c.e) + '</span></div>' +
      '<div><div class="up-title">' + esc(c.t) + '</div>' +
      '<div class="up-sub">' + esc(st.name) + ' · ' + esc(st.district) + '</div>' +
      (st.near && st.near.length ? '<div class="up-nearrow">' + nearHtml(st) + '</div>' : "") +
      '<div class="up-badges">' + badges.join("") + '</div></div>' +
      (c.img ? '<img class="up-thumb" loading="lazy" alt="" src="' + url(c.img) + '" onerror="this.style.visibility=\'hidden\'">' : '<div class="up-thumb"></div>') +
      '</button>';
  }

  function placeBadges(place) {
    var out = [];
    if (place.plus1) out.push('<span class="up-badge plus1">Wellpass +1</span>');
    if (place.discount) out.push('<span class="up-badge discount">Discount</span>');
    if (place.external_booking || place.wp_status === "external") out.push('<span class="up-badge external">↗ External booking</span>');
    if (place.court) out.push('<span class="up-badge court">Court</span>');
    return out;
  }

  function placeCard(place, i, isCourt) {
    var attr = isCourt ? 'data-court="' + i + '"' : 'data-plus-place="' + i + '"';
    var platforms = (place.platforms || []).join(" + ");
    var detail = [place.street, place.district, (place.activities || []).slice(0, 3).join(" · ")].filter(Boolean).join(" · ");
    return '<button class="up-card up-studio up-place-card" ' + attr + '><div>' +
      '<div class="up-title">' + (isCourt ? '🎾 ' : '') + esc(place.name) + '</div>' +
      '<div class="up-sub">' + esc(detail) + '</div><div class="up-badges">' +
      '<span class="up-badge blue">' + esc(platforms) + '</span>' +
      (place.plans && place.plans.length ? '<span class="up-badge">USC ' + esc(place.plans.join(" / ")) + '</span>' : "") +
      (isCourt && place.lat == null ? '<span class="up-badge warn">Map location unavailable</span>' : "") +
      placeBadges(place).join("") + '</div></div><div class="up-count">' + (isCourt ? "Court" : "+1") + '</div></button>';
  }

  function bindChips(scope) {
    (scope || root).querySelectorAll("[data-chip]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.chip;
        if (id === "both") S.onlyBoth = !S.onlyBoth;
        else if (id === "filters") return openFilters();
        else if (id === "plan") return openPlanPicker();
        else if (id === "courts") { S.showCourts = !S.showCourts; store.set("showCourts", S.showCourts); }
        else if (id === "plus1") { S.plus1Only = !S.plus1Only; store.set("plus1Only", S.plus1Only); }
        else if (id.indexOf("time:") === 0) S.time = S.time === id.slice(5) ? "" : id.slice(5);
        else if (id === "acts") return openActivities();
        render();
      });
    });
  }

  function renderStudios() {
    var day = S.days[S.date] || { classes: [] };
    var counts = {};
    filtered().forEach(function (c) { counts[c.st] = (counts[c.st] || 0) + 1; });
    var q = S.q.toLowerCase();
    var keys = Object.keys(S.index.studios).filter(function (k) {
      var s = S.index.studios[k];
      if (!planIncludes(s.plans) || !plus1Matches(s)) return false;
      if (S.acts.length && !counts[k] && !hasAct(s.disciplines)) return false;
      return !q || (s.name + " " + s.wp_name + " " + s.district + " " + s.disciplines.join(" ")).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (counts[b] || 0) - (counts[a] || 0) || S.index.studios[a].name.localeCompare(S.index.studios[b].name, "de"); });
    var html = '<div class="up-chips">' + chipsHtml(day) + '</div>' +
      '<div class="up-meta">' + keys.length + ' studios on both platforms · classes on ' + esc(dayLabel(S.date, true)) + '</div>';
    keys.forEach(function (k) {
      var s = S.index.studios[k];
      html += '<button class="up-card up-studio" data-studio="' + esc(k) + '"><div>' +
        '<div class="up-title">' + esc(s.name) + '</div>' +
        '<div class="up-sub">' + esc(s.street) + ' · ' + esc(s.district) + '</div>' +
        '<div class="up-badges"><span class="up-badge ' + (s.wp_status === "app" ? "ok" : "") + '">' + esc(s.wp_label) + '</span>' + placeBadges(s).join("") +
        (s.disciplines[0] ? '<span class="up-badge">' + esc(s.disciplines.slice(0, 2).join(" · ")) + '</span>' : "") + '</div></div>' +
        '<div class="up-count">' + (counts[k] || 0) + ' classes</div></button>';
    });
    var plusPlaces = (S.index.plus1_places || []).filter(function (p) { return placeMatches(p, false); });
    var courts = S.showCourts ? (S.index.courts || []).filter(function (p) { return placeMatches(p, true); }) : [];
    if (plusPlaces.length) {
      html += '<h2 class="up-section-title">Wellpass +1 places</h2>';
      plusPlaces.forEach(function (p, i) { html += placeCard(p, i, false); });
    }
    if (courts.length) {
      html += '<h2 class="up-section-title">Courts and rentable places</h2>';
      courts.forEach(function (p, i) { html += placeCard(p, i, true); });
    }
    $(".up-main").innerHTML = html;
    bindChips();
    root.querySelectorAll("[data-studio]").forEach(function (el) {
      el.addEventListener("click", function () { openStudio(el.dataset.studio); });
    });
    root.querySelectorAll("[data-plus-place]").forEach(function (el) {
      el.addEventListener("click", function () { openPlusPlace(plusPlaces[+el.dataset.plusPlace]); });
    });
    root.querySelectorAll("[data-court]").forEach(function (el) {
      el.addEventListener("click", function () { openCourt(courts[+el.dataset.court]); });
    });
  }

  function generatedAt() { return S.index && S.index.generated ? new Date(S.index.generated.replace("Z", ":00Z")) : null; }

  function renderInfo() {
    var g = generatedAt();
    $(".up-main").innerHTML = '<div class="up-info">' +
      '<h2>Book together, with different passes</h2>' +
      '<p>Urban Pass shows Berlin classes you can book with <b>Urban Sports Club</b> and with <b>EGYM Wellpass</b>, so you can train with friends on the other platform.</p>' +
      '<h3>What the badges mean</h3><ul>' +
      '<li><b>Numbered pin</b>: a shared studio; the number is today\'s classes. <b>Court pin</b>: a court or rentable sports venue. Blue labels show platform coverage; blue clusters count map places.</li>' +
      '<li><b>Wellpass +1</b>: a Wellpass member can bring a guest. <b>Discount</b> shows the short Wellpass offer terms.</li>' +
      '<li><b>External booking ↗</b>: book on the linked venue or partner site. Hollow pins mark drop-in and Wellpass-only +1 places. A few USC-only courts lack map coordinates and stay in the list.</li>' +
      '<li><b>✓ Wellpass</b>: the same class (same studio, time and name) is on both schedules.</li>' +
      '<li><b>Check in on site</b> / <b>Book via studio link</b>: the studio takes Wellpass without in-app booking. Check with the studio first.</li>' +
      '<li><b>USC Classic+</b>: the lowest Urban Sports Club plan that includes the class.</li></ul>' +
      '<h3>Where the data comes from</h3>' +
      '<p>The public Urban Sports Club class schedule, the public Wellpass studio finder, and the Wellpass app schedule.</p>' +
      '<div class="up-box"><h3>Last update</h3><p>' + (g ? esc(g.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) : "unknown") + '</p>' +
      (CFG.refreshUrl ? '<a class="up-btn" target="_blank" rel="noopener" href="' + url(CFG.refreshUrl) + '">Update classes now</a>' +
        '<p style="font-size:13px;color:#5c687c;margin-top:8px">Opens GitHub: tap <b>Run workflow</b>. The new data is live after about 15 minutes.</p>' : "") +
      '</div>' +
      '<div class="up-note">Spots and schedules can change after the last update. Always confirm in each app before booking. Urban Pass is a private project and isn\'t affiliated with Urban Sports Club or EGYM Wellpass.</div>' +
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
        (st.booking ? '<a class="up-btn external-link" target="_blank" rel="noopener" href="' + url(st.booking) + '">↗ Book externally</a>' : "");
    } else {
      wpBox = '<p>The studio takes Wellpass by check-in. Check that this class is included.</p>';
    }
    if (st.wp_status !== "external" && st.external_booking && st.booking) {
      wpBox += '<a class="up-btn external-link" target="_blank" rel="noopener" href="' + url(st.booking) + '">↗ Book externally</a>';
    }
    var sh = sheet(
      '<h2>' + esc(c.t) + '</h2>' +
      '<div class="up-badges up-place-badges">' + placeBadges(st).join("") + '</div>' +
      '<div class="up-sub">' + esc(dayLabel(S.date, true)) + ' · ' + esc(c.s) + '–' + esc(c.e) + (c.c ? ' · ' + esc(c.c) : "") + '</div>' +
      '<div class="up-box"><h3>Studio</h3><p><b>' + esc(st.name) + '</b></p><p>' + esc(st.street) + ', ' + esc(st.district) + '</p>' +
        '<div class="up-nearlist">' + nearHtml(st, true) + '</div>' +
        '<div class="up-row"><button class="up-btn ghost" data-show-map="' + esc(c.st) + '">Show on map</button>' +
        '<button class="up-btn ghost" data-open-studio="' + esc(c.st) + '">All classes here</button></div>' +
        '<a class="up-btn ghost" target="_blank" rel="noopener" href="' + url(mapLink(st)) + '">Directions</a></div>' +
      '<div class="up-box"><h3>Urban Sports Club</h3><p>Plans: ' + esc(c.pl.join(", ")) + (c.u ? ' · <b>' + esc(c.u) + ' spots left</b>' : "") + '</p>' +
        '<a class="up-btn" target="_blank" rel="noopener" href="https://urbansportsclub.com/activities?class=' + encodeURIComponent(c.id) + '">Book in Urban Sports Club app</a></div>' +
      '<div class="up-box"><h3>Wellpass</h3>' + wpBox +
        (st.discount_text ? '<p class="up-discount-text">' + esc(st.discount_text) + '</p>' : "") +
        wpLink(st, 'Open in Wellpass app') +
        (st.terms ? '<details><summary style="margin-top:10px;cursor:pointer;font-size:13px;color:#5c687c">Wellpass terms for this studio</summary><div class="up-terms">' + esc(st.terms) + '</div></details>' : "") +
      '</div>',
      c.img
    );
    bindSheetLinks(sh);
  }

  function bindSheetLinks(sh) {
    sh.el.querySelectorAll("[data-open-studio]").forEach(function (b) {
      b.addEventListener("click", function () { sh.close(); openStudio(b.dataset.openStudio); });
    });
    sh.el.querySelectorAll("[data-show-map]").forEach(function (b) {
      b.addEventListener("click", function () { sh.close(); showOnMap(b.dataset.showMap); });
    });
  }

  function openStudio(key) {
    var st = S.index.studios[key];
    var classes = filtered().filter(function (c) { return c.st === key; });
    var rows = classes.length ? classes.map(function (c) {
      return '<p style="display:flex;gap:10px"><b style="width:44px;flex:none">' + esc(c.s) + '</b><span>' + esc(c.t) +
        (c.ok === true ? ' <span class="up-badge ok">✓ Wellpass</span>' : "") + '</span></p>';
    }).join("") : '<p>No classes matching your filters on this day.</p>';
    var dropIn = S.acts.filter(function (a) { return isDropIn(a) && (st.disciplines || []).map(normAct).indexOf(a) >= 0; });
    if (dropIn.length && !classes.length) rows += '<p><b>Drop-in:</b> ' + esc(dropIn.map(actLabelOf).join(", ")) + ' without a class. Check opening hours with the studio.</p>';
    var sh = sheet(
      '<h2>' + esc(st.name) + '</h2><div class="up-sub">' + esc(st.street) + ' · ' + esc(st.district) + '</div>' +
      '<div class="up-badges up-place-badges">' + placeBadges(st).join("") + '</div>' +
      (accessMode() || st.court || dropIn.length ? infoButton() + accessInfo(st) : "") +
      '<div class="up-nearlist">' + nearHtml(st, true) + '</div>' +
      '<div class="up-box"><h3>' + esc(dayLabel(S.date, true)) + '</h3>' + rows + '</div>' +
      '<div class="up-box"><h3>Wellpass</h3><p>' + esc(st.wp_label) + ' · listed as “' + esc(st.wp_name) + '”</p>' +
        (st.discount_text ? '<p class="up-discount-text">' + esc(st.discount_text) + '</p>' : "") +
        ((st.external_booking || st.wp_status === "external") && st.booking ? '<a class="up-btn external-link" target="_blank" rel="noopener" href="' + url(st.booking) + '">↗ Book externally</a>' : "") +
        (st.terms ? '<div class="up-terms">' + esc(st.terms) + '</div>' : "") +
        wpLink(st, 'Open in Wellpass app') + '</div>' +
      '<div class="up-box"><h3>Urban Sports Club</h3><p>' + esc(st.disciplines.join(" · ")) + '</p><p>Plans: ' + esc(st.plans.join(", ")) + '</p>' +
        '<a class="up-btn ghost" target="_blank" rel="noopener" href="' + url(st.usc_url) + '">Open in Urban Sports Club app</a></div>' +
      '<div class="up-row">' + (S.tab === "map" ? "" : '<button class="up-btn ghost" data-show-map="' + esc(key) + '">Show on map</button>') +
      '<a class="up-btn" target="_blank" rel="noopener" href="' + url(mapLink(st)) + '">Directions</a></div>'
    );
    bindSheetLinks(sh);
    bindInfo(sh);
  }

  function openPlace(place, isCourt) {
    var platforms = place.platforms || [];
    var coverage = platforms.map(function (p) { return '<span class="up-badge blue">' + esc(p) + '</span>'; }).join(" ");
    var booking = place.booking ? '<a class="up-btn external-link" target="_blank" rel="noopener" href="' + url(place.booking) + '">↗ Book externally</a>' : "";
    var body = '<h2>' + (isCourt ? '🎾 ' : '') + esc(place.name) + '</h2>' +
      '<div class="up-sub">' + esc([place.street, place.district].filter(Boolean).join(" · ")) + '</div>' +
      '<div class="up-badges up-place-badges">' + coverage + placeBadges(place).join("") + '</div>' +
      infoButton() + accessInfo(place) +
      (place.activities && place.activities.length ? '<p class="up-place-activities">' + esc(place.activities.join(" · ")) + '</p>' : "") +
      (place.plus1 ? '<div class="up-box"><h3>Wellpass +1</h3><p>The Wellpass member can bring one guest to this place.</p></div>' : "") +
      (place.discount_text ? '<div class="up-box"><h3>Wellpass discount</h3><p>' + esc(place.discount_text) + '</p></div>' : "") +
      (isCourt ? '<div class="up-box"><h3>Coverage</h3><p>' + esc(platforms.join(" and ")) +
        (platforms.indexOf("USC") >= 0 && place.plans && place.plans.length ? ' · USC plans: ' + esc(place.plans.join(", ")) : "") +
        '</p><p>Both players need access to the court; check the venue for the remaining price and booking conditions.</p></div>' : "") +
      (booking ? '<div class="up-box"><h3>External booking</h3><p>Use the venue or partner booking page.</p>' + booking + '</div>' : "") +
      (place.terms && !place.discount_text ? '<div class="up-box"><h3>Wellpass terms</h3><div class="up-terms">' + esc(place.terms) + '</div></div>' : "") +
      '<div class="up-row">' + (place.usc_url ? '<a class="up-btn ghost" target="_blank" rel="noopener" href="' + url(place.usc_url) + '">Urban Sports Club</a>' : "") +
      (place.wp_url ? wpLink(place, 'Wellpass app') : "") +
      '</div><a class="up-btn ghost" target="_blank" rel="noopener" href="' + url(mapLink(place)) + '">Directions</a>';
    var sh = sheet(body);
    bindInfo(sh);
  }

  function accessInfo(place) {
    var pf = place.platforms || ["USC", "Wellpass"];
    var onWp = pf.indexOf("Wellpass") >= 0, onUsc = pf.indexOf("USC") >= 0;
    var wp = !onWp ? "Not on Wellpass. The Wellpass member pays the venue directly."
      : place.discount_text ? "Reduced fee: " + place.discount_text
      : "Included. Check in with the Wellpass app" + (place.external_booking || place.wp_status === "external" ? ", but book via the venue's own app or website." : ".");
    var usc = !onUsc ? "Not on Urban Sports Club. The USC member pays the venue directly."
      : (place.plans && place.plans.length ? "Included from the USC " + lowestPlan(place.plans) + " plan" +
        (S.plan && !planIncludes(place.plans) ? " (not in the " + S.plan + " plan you picked)" : "") + "." : "Included with Urban Sports Club.");
    return '<div class="up-box up-infobox" hidden><h3>Who covers the entry?</h3>' +
      '<p><b>Wellpass:</b> ' + esc(wp) + '</p><p><b>Urban Sports Club:</b> ' + esc(usc) + '</p>' +
      (place.plus1 ? '<p><b>Wellpass +1:</b> the Wellpass member can bring the other person as a guest.</p>' : "") +
      (place.court ? '<p>Courts are rented per court, so whatever one pass covers lowers the price for everyone playing. Padel and tennis need at least two players.</p>' : "") +
      '</div>';
  }
  function infoButton() { return '<button class="up-info-btn" data-info>ⓘ Who covers the entry?</button>'; }
  function bindInfo(sh) {
    var b = sh.el.querySelector("[data-info]"), box = sh.el.querySelector(".up-infobox");
    if (b && box) b.addEventListener("click", function () { box.hidden = !box.hidden; if (!box.hidden) box.scrollIntoView({ block: "nearest", behavior: "smooth" }); });
  }

  function openCourt(place) { openPlace(place, true); }
  function openPlusPlace(place) { openPlace(place, false); }

  function openActivities() {
    var day = S.days[S.date] || { classes: [] };
    var counts = {}, drop = {};
    filtered(true).forEach(function (c) { var a = normAct(actOf(c)); counts[a] = (counts[a] || 0) + 1; });
    allPlaces().forEach(function (pl) {
      var seen = {};
      (pl.disciplines || pl.activities || []).forEach(function (d) { d = normAct(d); if (!seen[d]) { seen[d] = 1; drop[d] = (drop[d] || 0) + 1; } });
    });
    var names = Object.keys(counts);
    Object.keys(drop).forEach(function (d) { if (names.indexOf(d) < 0) names.push(d); });
    names.sort(function (a, b) { return (counts[b] || 0) - (counts[a] || 0) || a.localeCompare(b, "de"); });
    var pick = S.acts.slice();
    function row(a) {
      var on = pick.indexOf(a) >= 0;
      var sub = (counts[a] ? counts[a] + (counts[a] === 1 ? " class" : " classes") : "no classes") +
        (drop[a] && isDropIn(a) ? " · " + drop[a] + " places, no class needed" : "");
      return '<button class="up-act" data-act="' + esc(a) + '" aria-pressed="' + on + '"><span>' + esc(actLabelOf(a)) +
        '<small>' + esc(sub) + '</small></span><i>' + (on ? "✓" : "") + '</i></button>';
    }
    var sh = sheet(
      '<h2>Activities</h2><div class="up-sub">' + esc(dayLabel(S.date, true)) + ' · pick one or more</div>' +
      '<input class="up-actsearch" type="search" placeholder="Search activities (yoga, padel, swimming…)">' +
      '<div class="up-actlist"></div>' +
      '<div class="up-row up-actbar"><button class="up-btn ghost" data-clear>All activities</button><button class="up-btn" data-done>Show</button></div>'
    );
    var list = sh.el.querySelector(".up-actlist");
    function draw(q) {
      q = (q || "").toLowerCase();
      var shown = names.filter(function (a) { return !q || a.toLowerCase().indexOf(q) >= 0; });
      list.innerHTML = shown.length ? shown.map(row).join("") : '<p class="up-sub">Nothing matches. Tennis, padel and similar only show up if a shared studio offers them.</p>';
      list.querySelectorAll("[data-act]").forEach(function (b) {
        b.addEventListener("click", function () {
          var a = b.dataset.act, i = pick.indexOf(a);
          if (i >= 0) pick.splice(i, 1); else pick.push(a);
          b.setAttribute("aria-pressed", i < 0);
          b.querySelector("i").textContent = i < 0 ? "✓" : "";
        });
      });
    }
    draw("");
    sh.el.querySelector(".up-actsearch").addEventListener("input", function (e) { draw(e.target.value); });
    sh.el.querySelector("[data-clear]").addEventListener("click", function () { S.acts = []; store.set("acts", []); sh.close(); render(); });
    sh.el.querySelector("[data-done]").addEventListener("click", function () { S.acts = pick; store.set("acts", pick); sh.close(); render(); });
  }

  function openPlanPicker() {
    var choices = [""].concat(PLANS);
    var sh = sheet('<h2>Urban Sports Club plan</h2><p class="up-sub">Choose your friend\'s plan. Studios outside it are hidden.</p>' +
      '<div class="up-planlist">' + choices.map(function (p) {
        var label = p || "Any plan";
        return '<button class="up-chip" data-plan="' + esc(p) + '" aria-pressed="' + (S.plan === p) + '">' + esc(label) + '</button>';
      }).join("") + '</div>');
    sh.el.querySelectorAll("[data-plan]").forEach(function (b) {
      b.addEventListener("click", function () {
        S.plan = b.dataset.plan; store.set("plan", S.plan); sh.close(); render();
      });
    });
  }

  function openFilters() {
    var districts = {};
    Object.keys(S.index.studios).forEach(function (k) { districts[S.index.studios[k].district] = 1; });
    var s = sheet(
      '<h2>Filters</h2>' +
      '<label class="up-field"><span>District</span><select data-f="district"><option value="">All of Berlin</option>' +
        Object.keys(districts).filter(Boolean).sort().map(function (d) { return '<option' + (S.district === d ? " selected" : "") + '>' + esc(d) + '</option>'; }).join("") + '</select></label>' +
      '<div class="up-field"><span>How Wellpass works at the studio</span><div class="up-seg">' +
        Object.keys(WP_LABEL).map(function (k) { return '<button class="up-chip" data-wp="' + k + '" aria-pressed="' + (S.wp.indexOf(k) >= 0) + '">' + WP_LABEL[k] + '</button>'; }).join("") +
      '</div></div>' +
      '<div class="up-row" style="margin-top:18px"><button class="up-btn ghost" data-reset>Reset</button><button class="up-btn" data-done>Show classes</button></div>'
    );
    var el = s.el;
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
      S.plan = ""; S.district = ""; S.wp = ["app", "external", "checkin"]; S.plus1Only = false; S.showCourts = true;
      store.set("plan", ""); store.set("wp", S.wp); store.set("plus1Only", false); store.set("showCourts", true); s.close(); render();
    });
    el.querySelector("[data-done]").addEventListener("click", function () { s.close(); render(); });
  }

  /* ---------- map ---------- */
  var CDN = "https://cdnjs.cloudflare.com/ajax/libs/";
  var M = { map: null, pins: null, stations: null, me: null, loading: null, focus: null };

  function loadAsset(tag, attrs) {
    return new Promise(function (ok, fail) {
      var el = document.createElement(tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      el.onload = ok; el.onerror = fail;
      document.head.appendChild(el);
    });
  }
  function loadLeaflet() {
    if (M.loading) return M.loading;
    M.loading = Promise.all([
      loadAsset("link", { rel: "stylesheet", href: CDN + "leaflet/1.9.4/leaflet.min.css" }),
      loadAsset("link", { rel: "stylesheet", href: CDN + "leaflet.markercluster/1.5.3/MarkerCluster.min.css" }),
      loadAsset("script", { src: CDN + "leaflet/1.9.4/leaflet.min.js" })
    ]).then(function () {
      return loadAsset("script", { src: CDN + "leaflet.markercluster/1.5.3/leaflet.markercluster.min.js" });
    });
    return M.loading;
  }

  function stationIcon(t) {
    return L.divIcon({ className: "up-stmark", html: '<i class="up-st-' + t.toLowerCase() + '">' + t + '</i>', iconSize: [18, 18], iconAnchor: [9, 9] });
  }
  function pinIcon(n, name, hollow, flags) {
    flags = flags || {};
    return L.divIcon({
      className: "up-pin" + (hollow ? " up-pin-drop" : "") + (flags.court ? " up-pin-court" : ""),
      html: '<span><b>' + (flags.court ? '<i class="up-court-glyph"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 12h16M12 3v18"/></svg></i>' : (hollow ? "" : n)) + '</b></span>' +
        (flags.plus1 ? '<small class="up-pin-plus">+1</small>' : "") + (flags.external ? '<small class="up-pin-external">↗</small>' : "") +
        '<em>' + esc(name) + '</em>',
      iconSize: [34, 42], iconAnchor: [17, 40]
    });
  }

  function initMap() {
    var el = $(".up-map");
    M.map = L.map(el, { zoomControl: false }).setView([52.515, 13.405], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, className: "up-tiles",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(M.map);
    M.stations = L.layerGroup();
    (S.index.stations || []).forEach(function (s) {
      L.marker([s.lat, s.lng], { icon: stationIcon(s.t), keyboard: false, zIndexOffset: -1000 })
        .bindTooltip(s.t + " " + esc(s.n), { direction: "top", offset: [0, -8] })
        .addTo(M.stations);
    });
    function syncStations() {
      var show = M.map.getZoom() >= 13;
      if (show && !M.map.hasLayer(M.stations)) M.stations.addTo(M.map);
      if (!show && M.map.hasLayer(M.stations)) M.map.removeLayer(M.stations);
    }
    function syncLabels() { el.classList.toggle("up-labels", M.map.getZoom() >= 14); }
    M.map.on("zoomend", syncStations);
    M.map.on("zoomend", syncLabels);
    syncStations();
    syncLabels();
    M.pins = L.markerClusterGroup({
      showCoverageOnHover: false, spiderfyOnMaxZoom: true, maxClusterRadius: 48,
      iconCreateFunction: function (cl) {
        var n = cl.getChildCount();
        var size = n < 10 ? 38 : n < 50 ? 46 : 54;
        return L.divIcon({ className: "up-cluster", html: '<span>' + n + '</span>', iconSize: [size, size] });
      }
    }).addTo(M.map);
    $(".up-locate").addEventListener("click", locateMe);
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    var b = $(".up-locate");
    b.classList.add("busy");
    navigator.geolocation.getCurrentPosition(function (pos) {
      b.classList.remove("busy");
      var ll = [pos.coords.latitude, pos.coords.longitude];
      if (M.me) M.me.setLatLng(ll);
      else M.me = L.circleMarker(ll, { radius: 8, color: "#fff", weight: 3, fillColor: "#2e70ce", fillOpacity: 1 }).addTo(M.map);
      M.map.setView(ll, Math.max(M.map.getZoom(), 15));
    }, function () {
      b.classList.remove("busy");
      alert("Couldn't get your location. Check that location access is allowed for this site.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  function renderMap() {
    var day = S.days[S.date];
    var chipsEl = $(".up-mapchips");
    chipsEl.innerHTML = ""; chipsEl.hidden = true;
    $(".up-mapview").style.setProperty("--up-top-h", $(".up-top").getBoundingClientRect().height + "px");
    if (!window.L || !window.L.markerClusterGroup) {
      $(".up-mapcount").textContent = "Loading map…";
      loadLeaflet().then(function () { if (!M.map) initMap(); renderMap(); })
        .catch(function () { $(".up-mapcount").textContent = "Couldn't load the map. Check your connection."; });
      return;
    }
    if (!M.map) initMap();
    M.map.invalidateSize();
    if (!day) return;
    var by = {};
    filtered().forEach(function (c) { (by[c.st] = by[c.st] || []).push(c); });
    M.pins.clearLayers();
    var markers = [], focusMarker = null;
    Object.keys(by).forEach(function (k) {
      var st = S.index.studios[k];
      if (!st || st.lat == null) return;
      var m = L.marker([st.lat, st.lng], { icon: pinIcon(by[k].length, st.name, false, {
        plus1: !!st.plus1, external: !!st.external_booking
      }), title: st.name });
      m.on("click", function () { openStudio(k); });
      markers.push(m);
      if (M.focus === k) focusMarker = m;
    });
    var nDrop = 0;
    if (S.acts.length) {
      Object.keys(S.index.studios).forEach(function (k) {
        var st = S.index.studios[k];
        if (by[k] || st.lat == null || !studioOffers(st)) return;
        if (S.showCourts && st.court) return; // shown as a court pin
        if (!planIncludes(st.plans) || !plus1Matches(st)) return;
        if (S.district && st.district !== S.district) return;
        if (S.wp.indexOf(st.wp_status) < 0) return;
        var m = L.marker([st.lat, st.lng], { icon: pinIcon(0, st.name, true), title: st.name, zIndexOffset: -500 });
        m.on("click", function () { openStudio(k); });
        markers.push(m);
        nDrop++;
      });
    }
    var plus1PlaceCount = 0;
    (S.plus1Only || accessMode() ? (S.index.plus1_places || []) : []).filter(function (p) { return placeMatches(p, false); }).forEach(function (p) {
      if (p.lat == null) return;
      var m = L.marker([p.lat, p.lng], { icon: pinIcon(0, p.name, true, { plus1: true, external: !!p.external_booking }), title: p.name });
      m.on("click", function () { openPlusPlace(p); });
      markers.push(m);
      plus1PlaceCount++;
    });
    var courtCount = 0;
    if (S.showCourts && (!S.acts.length || accessMode())) (S.index.courts || []).filter(function (p) { return placeMatches(p, true); }).forEach(function (p) {
      if (p.lat == null) return;
      var m = L.marker([p.lat, p.lng], { icon: pinIcon(0, p.name, false, {
        court: true, plus1: !!p.plus1, external: !!p.external_booking
      }), title: p.name });
      m.on("click", function () { openCourt(p); });
      markers.push(m);
      courtCount++;
    });
    M.pins.addLayers(markers);
    var nClasses = Object.keys(by).reduce(function (a, k) { return a + by[k].length; }, 0);
    if (S.funnel) {
      S.funnel = false;
      showFunnel({ classes: nClasses, places: courtCount + nDrop + plus1PlaceCount });
    }
    var parts = [];
    var nStudios = Object.keys(by).length;
    if (nClasses) parts.push(nClasses + " classes at " + nStudios + " studios");
    if (courtCount) parts.push(courtCount + " courts");
    if (nDrop) parts.push(nDrop + " places, no class needed");
    if (plus1PlaceCount) parts.push(plus1PlaceCount + (S.plus1Only ? " Wellpass +1" : " Wellpass only"));
    $(".up-mapcount").textContent = (parts.length ? parts.join(" · ") : "Nothing found, try another day or activity") + " · " + dayLabel(S.date) + " " + S.date.slice(8, 10).replace(/^0/, "");
    if (focusMarker) {
      var k = M.focus;
      M.focus = null;
      M.pins.zoomToShowLayer(focusMarker, function () { openStudio(k); });
    }
  }

  function showOnMap(key) {
    M.focus = key;
    S.tab = "map";
    render();
  }


  /* ---------- app links ---------- */
  var WP_APP = "https://wellpass.egym.link/app"; // opens the Wellpass app (universal link)
  function isPhone() { return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (window.matchMedia && matchMedia("(pointer: coarse)").matches); }
  function wpLink(st, label) {
    var name = st.wp_name || st.name || "";
    return '<a class="up-btn ghost" target="_blank" rel="noopener" data-wp-open="' + esc(name) + '" href="' + url(st.wp_url) + '">' + esc(label) + '</a>';
  }
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "up-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-wp-open]");
    if (!a || !isPhone()) return;
    e.preventDefault();
    var name = a.getAttribute("data-wp-open");
    var go = function () { window.location.href = WP_APP; };
    if (navigator.clipboard && name) {
      navigator.clipboard.writeText(name).then(function () {
        toast("“" + name + "” copied. Paste it into the Wellpass search.");
        setTimeout(go, 900);
      }, go);
    } else go();
  });



  /* ---------- statistics ---------- */
  function fmt(n) { return Math.round(n).toLocaleString("en"); }
  function overlapStats() {
    var days = (S.index.days || []).filter(function (d) { return d.usc_total >= 300; }); // skip a nearly finished today
    if (!days.length) return null;
    var usc = 0, both = 0, slots = { morning: [0, 0], midday: [0, 0], evening: [0, 0] };
    days.forEach(function (d) {
      usc += d.usc_total; both += d.confirmed || 0;
      ["morning", "midday", "evening"].forEach(function (k) {
        slots[k][0] += (d.usc_slots || {})[k] || 0; slots[k][1] += (d.both_slots || {})[k] || 0;
      });
    });
    return { usc: usc / days.length, both: both / days.length, share: both / usc, slots: slots, totals: S.index.totals || null };
  }
  function pct(x) { return x < 0.1 ? (Math.round(x * 1000) / 10) + "%" : Math.round(x * 100) + "%"; }
  function statsHtml() {
    var st = overlapStats();
    if (!st) return "";
    return '<div class="up-stats"><div class="up-stat-big"><b>' + pct(st.share) + '</b>' +
      '<span>Only this share of Urban Sports Club classes in Berlin can also be booked with Wellpass.</span></div></div>';
  }

  function showFunnel(res) {
    var d = (S.index.days || []).filter(function (x) { return x.date === S.date; })[0] || {};
    var t = S.index.totals || {};
    var venues = (t.usc_venues || 0) + (t.wp_studios || 0) - (t.shared_studios || 0);
    var supply = (d.usc_total || 0) + venues;
    if (!supply) return;
    var found = res.classes + res.places;
    var gone = Math.max(0, 1 - found / supply);
    var wrap = document.createElement("div");
    wrap.className = "up-funnel";
    wrap.innerHTML = '<div class="up-funnel-card">' +
      '<p class="up-funnel-day">Berlin · ' + esc(dayLabel(S.date, true)) + '</p>' +
      '<div class="up-funnel-num"><b data-n>' + fmt(supply) + '</b><span data-l>options in Berlin</span></div>' +
      '<p class="up-funnel-sub">' + fmt(d.usc_total || 0) + ' classes · ' + fmt(venues) + ' studios and places</p>' +
      '<div class="up-funnel-track"><i></i></div>' +
      '<p class="up-funnel-out"><b>' + pct(gone) + '</b> filtered out</p>' +
      '<p class="up-funnel-left">' + (res.classes ? fmt(res.classes) + " classes" : "") + (res.classes && res.places ? " + " : "") +
        (res.places ? fmt(res.places) + " places" : "") + (found ? " fit your search" : "Nothing fits. Try fewer filters.") + '</p>' +
      '</div>';
    document.body.appendChild(wrap);
    var numEl = wrap.querySelector("[data-n]"), lab = wrap.querySelector("[data-l]"), bar = wrap.querySelector(".up-funnel-track i");
    var start = null, dur = 1300, from = supply, to = found;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function step(ts) {
      if (!start) start = ts;
      var k = reduce ? 1 : Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - k, 3);
      numEl.textContent = fmt(from + (to - from) * e);
      bar.style.width = (100 * (1 - e * gone)) + "%";
      if (k < 1) requestAnimationFrame(step);
      else { lab.textContent = found === 1 ? "option for you" : "options for you"; wrap.classList.add("done"); }
    }
    setTimeout(function () { wrap.classList.add("show"); requestAnimationFrame(step); }, 30);
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      wrap.classList.add("bye");
      setTimeout(function () { wrap.remove(); }, 450);
    }
    wrap.addEventListener("click", close);
    setTimeout(close, reduce ? 1800 : 3000);
  }

  /* ---------- landing + setup ---------- */
  function allPlaces() {
    var out = [];
    Object.keys(S.index.studios || {}).forEach(function (k) { out.push(S.index.studios[k]); });
    return out.concat(S.index.courts || [], S.index.plus1_places || []);
  }
  function activityOptions() {
    var n = {};
    allPlaces().forEach(function (pl) {
      var seen = {};
      (pl.disciplines || pl.activities || []).forEach(function (a) {
        a = normAct(a);
        if (a && !seen[a]) { seen[a] = 1; n[a] = (n[a] || 0) + 1; }
      });
    });
    return Object.keys(n).sort(function (a, b) { return n[b] - n[a] || a.localeCompare(b, "de"); });
  }

  function landingStats() {
    var t = S.index.totals || {};
    var days = (S.index.days || []).filter(function (d) { return d.usc_total >= 300; }).slice(0, 3);
    var usc = 0, both = 0;
    days.forEach(function (d) { usc += d.usc_total; both += d.confirmed || 0; });
    return { venues: t.usc_venues, shared: t.shared_studios, usc: usc, both: both, nDays: days.length };
  }

  function showLanding() {
    var st = landingStats();
    document.body.classList.remove("up-noscroll");
    root.classList.remove("up-on-map");
    root.innerHTML =
      '<section class="up-landing">' +
        '<div class="up-landing-top">' + ICON.mark + '</div>' +
        '<h1>Urban Pass</h1>' +
        (st.venues ? '<p class="up-claim">Only <em>' + pct(st.shared / st.venues) + '</em> of <b>Urban Sports</b> studios in Berlin can also be booked with <b>Wellpass</b>.</p>' : "") +
        '<div class="up-facts">' +
          (st.venues ? '<p><b>' + fmt(st.venues) + '</b> Urban Sports venues · only <b>' + fmt(st.shared) + '</b> take both</p>' : "") +
          (st.usc ? '<p><b>' + fmt(st.usc) + '</b> Urban Sports classes in the next ' + st.nDays + ' days · only <b>' + fmt(st.both) + '</b> bookable with both</p>' : "") +
        '</div>' +
        '<button class="up-btn up-go" data-go>Find classes</button>' +
        '<p class="up-fine">Private project. Not affiliated with Urban Sports Club or EGYM Wellpass.</p>' +
      '</section>';
    $("[data-go]").addEventListener("click", showSetup);
  }

  function showSetup() {
    var opts = activityOptions();
    var draft = {
      acts: S.acts.slice(), plan: S.plan, plus1: S.plus1Only, date: S.date || S.index.days[0].date,
      timeMode: S.timeMode || "any", timeVal: S.timeVal || "18:00"
    };
    document.body.classList.remove("up-noscroll");
    root.classList.remove("up-on-map");
    root.innerHTML =
      '<section class="up-setup">' +
        '<header class="up-setup-top">' + ICON.mark + '<div><h1>What are you looking for?</h1><p>Everything except the activity is optional.</p></div></header>' +
        '<div class="up-step"><h2><b>1</b> Activities <small>pick one or more</small></h2>' +
          '<input class="up-actsearch" type="search" placeholder="Search: yoga, padel, swimming…">' +
          '<div class="up-seg up-setup-acts"></div><p class="up-hint" hidden></p></div>' +
        '<div class="up-step up-step-plan"><h2><b>2</b> Your friend\'s Urban Sports Club plan</h2><div class="up-seg up-setup-plan"></div></div>' +
        '<div class="up-step"><label class="up-switch"><input type="checkbox" data-plus1' + (draft.plus1 ? " checked" : "") + '><span></span>' +
          '<div><b>Only Wellpass +1 places</b><small>The Wellpass member brings the other person as a guest. No Urban Sports Club needed.</small></div></label></div>' +
        '<div class="up-step"><h2><b>3</b> Day</h2><div class="up-seg up-setup-days"></div></div>' +
        '<div class="up-step"><h2><b>4</b> Time <small>optional</small></h2><div class="up-seg up-setup-timemode"></div>' +
          '<div class="up-timepick" hidden><input type="time" step="300" lang="de-DE" aria-label="Time" value="' + esc(draft.timeVal) + '"></div></div>' +
        '<div class="up-setup-bar"><button class="up-btn" data-show>Go</button></div>' +
      '</section>';
    window.scrollTo(0, 0);
    var actsEl = $(".up-setup-acts"), hint = $(".up-hint");
    function drawActs(q) {
      q = normAct(q || "");
      var list = q ? opts.filter(function (a) { return a.indexOf(q) >= 0; }) : opts.slice(0, 16);
      draft.acts.forEach(function (a) { if (list.indexOf(a) < 0) list.unshift(a); });
      actsEl.innerHTML = '<button class="up-chip" data-a="" aria-pressed="' + !draft.acts.length + '">Anything</button>' +
        list.map(function (a) { return '<button class="up-chip" data-a="' + esc(a) + '" aria-pressed="' + (draft.acts.indexOf(a) >= 0) + '">' + esc(actLabelOf(a)) + '</button>'; }).join("") +
        (q && !list.length ? '<p class="up-sub">No place on either pass offers that right now.</p>' : "");
      actsEl.querySelectorAll("[data-a]").forEach(function (b) {
        b.addEventListener("click", function () {
          var a = b.dataset.a, i = draft.acts.indexOf(a);
          if (!a) draft.acts = [];
          else if (i >= 0) draft.acts.splice(i, 1);
          else draft.acts.push(a);
          drawActs($(".up-setup .up-actsearch").value);
        });
      });
      hint.hidden = !(draft.acts.length && draft.acts.every(isDropIn));
      hint.textContent = "No class needed here. You'll see places where at least one of your passes gets you in or lowers the fee. Tap ⓘ on a place to see who covers what.";
    }
    function drawPlan() {
      var el = $(".up-setup-plan");
      el.innerHTML = [["", "Not sure"]].concat(PLANS.map(function (p) { return [p, p]; })).map(function (x) {
        return '<button class="up-chip" data-p="' + x[0] + '" aria-pressed="' + (draft.plan === x[0]) + '">' + x[1] + '</button>';
      }).join("");
      el.querySelectorAll("[data-p]").forEach(function (b) { b.addEventListener("click", function () { draft.plan = b.dataset.p; drawPlan(); }); });
      $(".up-step-plan").classList.toggle("up-muted", draft.plus1);
    }
    function drawDays() {
      var el = $(".up-setup-days");
      el.innerHTML = S.index.days.map(function (d, i) {
        var label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayLabel(d.date) + " " + d.date.slice(8, 10).replace(/^0/, "");
        return '<button class="up-chip" data-d="' + d.date + '" aria-pressed="' + (draft.date === d.date) + '">' + esc(label) + '</button>';
      }).join("");
      el.querySelectorAll("[data-d]").forEach(function (b) { b.addEventListener("click", function () { draft.date = b.dataset.d; drawDays(); }); });
    }
    function drawTime() {
      var el = $(".up-setup-timemode");
      el.innerHTML = [["any", "Any time"], ["at", "Around"], ["after", "At or after"], ["before", "Before"]].map(function (x) {
        return '<button class="up-chip" data-tm="' + x[0] + '" aria-pressed="' + (draft.timeMode === x[0]) + '">' + x[1] + '</button>';
      }).join("");
      el.querySelectorAll("[data-tm]").forEach(function (b) { b.addEventListener("click", function () { draft.timeMode = b.dataset.tm; drawTime(); }); });
      $(".up-timepick").hidden = draft.timeMode === "any";
    }
    drawActs(""); drawPlan(); drawDays(); drawTime();
    $(".up-setup .up-actsearch").addEventListener("input", function (e) { drawActs(e.target.value); });
    $("[data-plus1]").addEventListener("change", function (e) { draft.plus1 = e.target.checked; drawPlan(); });
    $(".up-timepick input").addEventListener("change", function (e) { if (e.target.value) draft.timeVal = e.target.value.slice(0, 5); });
    $("[data-show]").addEventListener("click", function () {
      S.acts = draft.acts.slice(); store.set("acts", S.acts);
      S.plan = draft.plus1 ? "" : draft.plan; store.set("plan", S.plan);
      S.plus1Only = draft.plus1; store.set("plus1Only", S.plus1Only);
      S.timeMode = draft.timeMode; S.timeVal = draft.timeVal; store.set("timeMode", S.timeMode); store.set("timeVal", S.timeVal);
      store.set("date", draft.date);
      if (accessMode()) { S.showCourts = true; store.set("showCourts", true); }
      S.q = ""; S.time = ""; S.tab = "map"; S.funnel = true;
      shell();
      selectDay(draft.date);
    });
  }

  /* ---------- start ---------- */
  root.innerHTML = '<div class="up-loading">Loading…</div>';
  fetchJSON("index.json").then(function (idx) {
    S.index = idx;
    S.acts = S.acts.map(normAct);
    var iso = localISO(new Date());
    idx.days = idx.days.filter(function (d) { return d.date >= iso; }).concat([]);
    if (!idx.days.length) idx.days = [{ date: iso }];
    var cached = store.get("date", "");
    S.date = idx.days.some(function (d) { return d.date === cached; }) ? cached : idx.days[0].date;
    showLanding();
  }).catch(function () {
    root.innerHTML = '<div class="up-empty"><b>No data yet.</b>The data update hasn\'t run.</div>';
  });
})();
