/* Diamond Willow | MBO campaign dashboard
   Renders the JSON served by the Apps Script data layer. */
(function () {
  'use strict';

  var CFG = window.DW_DASHBOARD || {};
  var TZ = CFG.timeZone || 'America/Edmonton';
  var params = new URLSearchParams(location.search);
  var API = params.get('api');
  var KEY = params.get('k');
  var LOCAL = params.get('data'); // local preview file, used for QA only
  var app = document.getElementById('app');
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------------- formatting ---------------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function fmtInt(v) { return isNum(v) ? Math.round(v).toLocaleString('en-CA') : '0'; }
  function fmtPct(v) {
    if (!isNum(v)) return null;
    var p = v * 100;
    var d = p !== 0 && Math.abs(p) < 1 ? 2 : 1;
    return p.toFixed(d) + '%';
  }
  function fmtBench(v) {
    if (!isNum(v)) return '';
    return parseFloat((v * 100).toFixed(2)) + '%';
  }
  function fmtDuration(sec) {
    if (!isNum(sec)) return null;
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    if (s === 60) { m += 1; s = 0; }
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtYmd(ymd) {
    if (!ymd) return '';
    var p = String(ymd).slice(0, 10).split('-');
    return MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]) + ', ' + p[0];
  }
  function fmtShortYmd(ymd) {
    var p = String(ymd).slice(0, 10).split('-');
    return MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]);
  }
  function fmtDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var date = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }).format(d);
    var time = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d);
    return date + ', ' + time + ' ' + (CFG.timeZoneLabel || '');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
  }

  /* ---------------- small components ---------------- */
  var ICON_CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.2l2.6 2.6L10 3.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  var ICON_DOWN = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2v7.5M2.6 6.2L6 9.6l3.4-3.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  var ICON_BUILD = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 13h12M3 13V6h8v7M5 6V3h4v3" fill="none" stroke="#fff" stroke-width="1.4"/></svg>';

  function info(text) {
    return '<span class="info-wrap"><button class="info" type="button" aria-label="About this metric">i</button>' +
      '<span class="info-tip" role="tooltip">' + esc(text) + '</span></span>';
  }
  function status(value, bench) {
    if (!isNum(value) || !isNum(bench)) return '<span class="status status-none">No data yet</span>';
    return value >= bench
      ? '<span class="status status-good">' + ICON_CHECK + 'At or above benchmark</span>'
      : '<span class="status status-below">' + ICON_DOWN + 'Below benchmark</span>';
  }
  function meter(value, bench) {
    var max = Math.max((bench || 0) * 2, (value || 0) * 1.15, 0.0001);
    var fill = isNum(value) ? Math.min(100, value / max * 100) : 0;
    var mark = isNum(bench) ? bench / max * 100 : null;
    return '<div class="meter" aria-hidden="true"><span class="meter-fill" style="width:' + fill.toFixed(2) + '%"></span>' +
      (mark !== null ? '<span class="meter-mark" style="left:' + mark.toFixed(2) + '%"></span>' : '') + '</div>';
  }
  function pendingNote(title, text) {
    return '<div class="pending-note"><div class="pending-card" role="note"><span class="p-icon">' + ICON_BUILD + '</span>' +
      '<strong>' + esc(title) + '</strong><p>' + esc(text) + '</p></div></div>';
  }
  function pendingWrap(inner, title, text) {
    return '<div class="is-pending"><div class="pending-content" aria-hidden="true">' + inner + '</div>' + pendingNote(title, text) + '</div>';
  }
  function pendingInline(text) {
    return '<div class="pending-inline" role="note"><span class="p-icon">' + ICON_BUILD + '</span><span><strong>Under construction.</strong> ' + esc(text) + '</span></div>';
  }
  function sectionHead(num, title, desc, source, sourceNote) {
    return '<header class="section-head"><span class="section-num">' + num + '</span>' +
      '<div><h2 class="section-title">' + esc(title) + '</h2><p class="section-desc">' + esc(desc) + '</p></div>' +
      '<p class="section-source">Source<strong>' + esc(source) + '</strong>' + (sourceNote ? esc(sourceNote) : '') + '</p></header>';
  }
  function barList(items, opts) {
    opts = opts || {};
    if (!items || !items.length) return '<p class="empty">' + esc(opts.empty || 'No data yet.') + '</p>';
    var max = opts.scaleMax || Math.max.apply(null, items.map(function (i) { return i.ratio; }).concat([0.0001]));
    return '<ul class="bars">' + items.map(function (i) {
      var w = Math.max(0, Math.min(100, i.ratio / max * 100));
      var mark = isNum(opts.bench) ? '<span class="bar-mark" style="left:' + (opts.bench / max * 100).toFixed(2) + '%"></span>' : '';
      return '<li class="bar-row"><span class="bar-label">' + esc(i.label) + '</span>' +
        '<span class="bar-value">' + esc(i.primary) + (i.secondary ? '<span>' + esc(i.secondary) + '</span>' : '') + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + w.toFixed(2) + '%"></span>' + mark + '</span></li>';
    }).join('') + '</ul>';
  }

  /* ---------------- KPI tiles ---------------- */
  function kpi(o) {
    var value = fmtPct(o.value);
    var head =
      '<div class="kpi-channel">' + esc(o.channel) + '</div>' +
      '<div class="kpi-head"><span class="kpi-label">' + esc(o.label) + '</span>' + info(o.tip) + '</div>';
    if (o.pending) {
      var ghost = '<div class="kpi-value"><span class="skel skel-lg"></span></div>' + meter(null, o.bench) +
        '<div class="kpi-foot"><span class="bench">Benchmark <b>' + fmtBench(o.bench) + '</b></span></div>';
      return '<article class="card kpi">' + head + '<div class="kpi-pending is-pending"><div class="pending-content" aria-hidden="true">' + ghost + '</div>' +
        pendingNote('Under construction', o.pending) + '</div></article>';
    }
    return '<article class="card kpi">' + head +
      '<div class="kpi-value">' + (value || '<small>No data yet</small>') + '</div>' + meter(o.value, o.bench) +
      '<div class="kpi-foot"><span class="bench">Benchmark <b>' + fmtBench(o.bench) + '</b></span>' + status(o.value, o.bench) + '</div></article>';
  }

  /* ---------------- column chart ---------------- */
  function fillDays(daily, start) {
    if (!daily || !daily.length) return [];
    var map = {};
    daily.forEach(function (d) { map[d.date] = d.views; });
    var first = start && start < daily[0].date ? start : daily[0].date;
    var last = daily[daily.length - 1].date;
    var minEnd = new Date(first + 'T12:00:00Z'); minEnd.setUTCDate(minEnd.getUTCDate() + 13);
    if (minEnd.toISOString().slice(0, 10) > last) last = minEnd.toISOString().slice(0, 10);
    var out = [], d = new Date(first + 'T12:00:00Z'), end = new Date(last + 'T12:00:00Z');
    while (d <= end && out.length < 400) {
      var k = d.toISOString().slice(0, 10);
      out.push({ date: k, views: map[k] || 0, future: k > daily[daily.length - 1].date });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  function drawColumns(el) {
    var data = JSON.parse(el.getAttribute('data-series') || '[]');
    if (!data.length) { el.innerHTML = '<p class="empty">No visits recorded yet.</p>'; return; }
    var W = Math.max(240, el.clientWidth), H = 190, top = 22, bottom = 26, left = 0;
    var plotH = H - top - bottom;
    var max = Math.max.apply(null, data.map(function (d) { return d.views; }).concat([1]));
    var n = data.length, gap = 2;
    var bw = (W - gap * (n - 1)) / n;
        var x0 = left;
    var parts = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Daily page visits, ' + n + ' days, peak ' + fmtInt(max) + '">'];
    parts.push('<line class="axis" x1="0" x2="' + W + '" y1="' + top + '" y2="' + top + '"/>');
    parts.push('<text x="' + W + '" y="' + (top - 7) + '" text-anchor="end">' + fmtInt(max) + ' visits</text>');
    parts.push('<line class="axis" x1="0" x2="' + W + '" y1="' + (top + plotH) + '" y2="' + (top + plotH) + '"/>');
    data.forEach(function (d, i) {
      if (d.future) return;
      var h = d.views ? Math.max(2, d.views / max * plotH) : 0;
      var x = x0 + i * (bw + gap);
      parts.push('<rect class="col-hit" data-i="' + i + '" x="' + (x - gap / 2) + '" y="' + top + '" width="' + (bw + gap) + '" height="' + plotH + '"/>');
      parts.push('<rect class="col" x="' + x + '" y="' + (top + plotH - h) + '" width="' + bw + '" height="' + h + '"/>');
    });
    var lastReal = data.filter(function (x) { return !x.future; }).length - 1;
    var labelIdx = [0, n - 1];
    if (lastReal > 0 && lastReal < n - 1) labelIdx.splice(1, 0, lastReal);
    labelIdx.forEach(function (i) {
      var cx = x0 + i * (bw + gap) + bw / 2;
      var anchor = i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle');
      var tx = anchor === 'start' ? x0 + i * (bw + gap) : anchor === 'end' ? x0 + i * (bw + gap) + bw : cx;
      parts.push('<text x="' + tx + '" y="' + (H - 6) + '" text-anchor="' + anchor + '">' + fmtShortYmd(data[i].date) + '</text>');
    });
    parts.push('</svg><div class="tip-float" aria-hidden="true"></div>');
    el.innerHTML = parts.join('');

    var tip = el.querySelector('.tip-float');
    var cols = el.querySelectorAll('.col');
    el.querySelectorAll('.col-hit').forEach(function (hit, j) {
      hit.addEventListener('mouseenter', function () {
        var i = Number(hit.getAttribute('data-i'));
        cols.forEach(function (c) { c.classList.remove('is-active'); });
        cols[j].classList.add('is-active');
        var r = cols[j].getBBox ? cols[j].getBBox() : { x: 0, y: 0, width: 0 };
        var scale = el.clientWidth / W;
        tip.innerHTML = fmtYmd(data[i].date) + '<br><b>' + fmtInt(data[i].views) + '</b> visits';
        tip.style.left = ((r.x + r.width / 2) * scale) + 'px';
        tip.style.top = (Math.min(r.y, top + plotH - 2) * (el.querySelector('svg').clientHeight / H)) + 'px';
        tip.classList.add('is-on');
      });
      hit.addEventListener('mouseleave', function () {
        tip.classList.remove('is-on');
        cols.forEach(function (c) { c.classList.remove('is-active'); });
      });
    });
  }

  /* ---------------- sections ---------------- */
  function renderMeta(d) {
    var meta = document.getElementById('meta');
    meta.innerHTML =
      '<div><dt>Campaign start</dt><dd>' + fmtYmd(d.campaignStart) + '</dd></div>' +
      '<div><dt>Last refreshed</dt><dd>' + esc(fmtDateTime(d.generatedAt)) + '</dd></div>' +
      '<div><dt>Refresh rate</dt><dd>Every hour</dd></div>';
    var live = document.getElementById('live');
    if (d.live && d.live.status === 'ok' && isNum(d.live.mboGuideActiveUsers)) {
      var n = d.live.mboGuideActiveUsers;
      live.innerHTML = '<span class="live-dot" aria-hidden="true"></span><span><b>' + fmtInt(n) + '</b> ' +
        (n === 1 ? 'person' : 'people') + ' on the MBO Guide now</span>';
      live.title = 'Active in the last 30 minutes, from Google Analytics realtime';
      live.hidden = false;
    }
  }

  function findAsset(d, key) {
    var a = d.pages && d.pages.assets;
    return (a || []).filter(function (x) { return x.key === key; })[0] || null;
  }

  function renderScorecard(d) {
    var b = d.benchmarks || {};
    var li = d.linkedin || {};
    var em = d.email || {};
    var mbo = findAsset(d, 'mbo-guide');
    var liPending = li.status !== 'ok' ? 'Waiting for LinkedIn to approve API access.' : null;
    var emPending = em.status !== 'ok' ? 'Connecting to HubSpot.' : null;
    var secPending = !mbo ? 'Connecting to Google Analytics.' :
      (mbo.sections.status !== 'ok' || !isNum(mbo.sections.overall)) ? 'Section data is collecting since ' + fmtShortYmd(d.breakdownStart) + '.' : null;

    var tiles = [
      kpi({ channel: 'LinkedIn posts', label: 'Engagement rate', value: li.totals && li.totals.engagementRate, bench: b.liEngagement, pending: liPending,
        tip: 'Reactions, comments, shares and clicks divided by impressions, across campaign posts.' }),
      kpi({ channel: 'LinkedIn posts', label: 'Click through rate', value: li.totals && li.totals.ctr, bench: b.liCtr, pending: liPending,
        tip: 'Clicks divided by impressions, only on posts that include a link.' }),
      kpi({ channel: 'Promotional emails', label: 'Delivery rate', value: em.totals && em.totals.deliveryRate, bench: b.emailDelivery, pending: emPending,
        tip: 'Delivered emails divided by sent emails, across every campaign send.' }),
      kpi({ channel: 'Promotional emails', label: 'Click through rate', value: em.totals && em.totals.ctr, bench: b.emailCtr, pending: emPending,
        tip: 'Clicks divided by delivered emails, across every campaign send.' }),
      kpi({ channel: 'Promotional emails', label: 'Positive reply rate', value: em.positive && em.positive.rate, bench: b.emailPositive,
        pending: emPending || (em.positive && em.positive.status === 'ok' ? null : 'Replies are being collected. The rate appears once the team reviews them.'),
        tip: 'Replies the team marked Positive in the responses sheet, divided by delivered emails. Automatic replies are excluded.' }),
      kpi({ channel: 'MBO Guide page', label: 'Sections viewed', value: mbo && mbo.sections.overall, bench: b.sectionViews, pending: secPending,
        tip: 'Average share of the guide’s sections each visitor scrolled into view.' }),
      kpi({ channel: 'MBO Guide page', label: 'CTA click through rate', value: mbo && mbo.cta.ctr, bench: b.ctaCtr,
        pending: !mbo ? 'Connecting to Google Analytics.' : null,
        tip: 'Clicks on the page’s calls to action divided by page visits.' })
    ];
    return '<section class="section wrap" id="scorecard">' +
      sectionHead('', 'Scorecard', 'Every benchmarked metric in the measurement plan, at a glance. The black tick on each bar marks the benchmark.', 'All channels', 'Campaign to date') +
      '<div class="grid grid-kpi-3">' + [tiles[2], tiles[3], tiles[4]].join('') + '</div>' +
      '<div class="grid grid-kpi-4">' + [tiles[0], tiles[1], tiles[5], tiles[6]].join('') + '</div></section>';
  }

  function renderLinkedIn(d) {
    var li = d.linkedin || {};
    var head = sectionHead('01', 'LinkedIn posts', 'Organic performance of the campaign posts published from the Diamond Willow company page.', 'LinkedIn analytics', 'Posts since ' + fmtShortYmd(d.linkedinStart));
    var cols = ['Post', 'Asset', 'Published', 'Impressions', 'Engagement rate', 'CTR', 'Clicks'];
    var thead = '<thead><tr>' + cols.map(function (c, i) { return '<th' + (i > 2 ? ' class="num"' : '') + '>' + c + '</th>'; }).join('') + '</tr></thead>';

    if (li.status !== 'ok') {
      var rows = [0, 1, 2, 3].map(function () {
        return '<tr><td><span class="skel" style="width:220px"></span></td><td><span class="skel" style="width:90px"></span></td><td><span class="skel" style="width:60px"></span></td>' +
          '<td class="num"><span class="skel" style="width:50px;margin-left:auto"></span></td><td class="num"><span class="skel" style="width:44px;margin-left:auto"></span></td>' +
          '<td class="num"><span class="skel" style="width:40px;margin-left:auto"></span></td><td class="num"><span class="skel" style="width:30px;margin-left:auto"></span></td></tr>';
      }).join('');
      var table = '<div class="card"><div class="table-wrap"><table>' + thead + '<tbody>' + rows + '</tbody></table></div></div>';
      return '<section class="section wrap" id="linkedin">' + head +
        pendingWrap(table, 'Under construction', 'LinkedIn post analytics will appear here as soon as LinkedIn approves API access. Every campaign post since ' + fmtYmd(d.linkedinStart) + ' will load automatically.') +
        '</section>';
    }

    var posts = li.posts || [];
    var body = posts.length ? posts.map(function (p) {
      return '<tr><td><a class="cell-main" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.title || 'View post') + '</a></td>' +
        '<td>' + esc(p.asset || 'Other') + '</td><td class="nowrap">' + esc(fmtDate(p.publishedAt)) + '</td>' +
        '<td class="num">' + fmtInt(p.impressions) + '</td><td class="num">' + (fmtPct(p.engagementRate) || '0%') + '</td>' +
        '<td class="num">' + (p.hasLink ? (fmtPct(p.ctr) || '0%') : 'No link') + '</td><td class="num">' + (p.hasLink ? fmtInt(p.clicks) : 'No link') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">No campaign posts published yet.</td></tr>';
    return '<section class="section wrap" id="linkedin">' + head +
      '<div class="card"><div class="table-wrap"><table>' + thead + '<tbody>' + body + '</tbody></table></div></div></section>';
  }

  function renderEmail(d) {
    var em = d.email || {};
    var b = d.benchmarks || {};
    var head = sectionHead('02', 'Promotional emails', 'Every campaign send from HubSpot, by sender. New sends appear automatically.', 'HubSpot', 'Sends since ' + fmtShortYmd(d.campaignStart));
    if (em.status !== 'ok') {
      return '<section class="section wrap" id="emails">' + head +
        pendingWrap('<div class="card"><span class="skel" style="width:40%"></span><br><span class="skel" style="width:70%"></span><br><span class="skel" style="width:55%"></span></div>',
          'Under construction', 'Email results will appear as soon as the HubSpot connection is active.') + '</section>';
    }
    var t = em.totals || {};
    var stats = '<div class="stats">' +
      stat('Sends', fmtInt(t.sends)) + stat('Emails sent', fmtInt(t.sent)) + stat('Delivered', fmtInt(t.delivered)) + stat('Clicks', fmtInt(t.clicks)) +
      '</div>';
    var sends = em.sends || [];
    var showPos = em.positive && em.positive.status === 'ok';
    var rows = sends.length ? sends.map(function (s) {
      return '<tr><td><div class="cell-main">' + esc(s.asset) + '</div><div class="cell-sub">' + esc(s.sender) + '’s list</div></td>' +
        '<td class="nowrap">' + esc(fmtDate(s.sentAt)) + '</td>' +
        '<td class="num">' + fmtInt(s.delivered) + '</td>' +
        '<td class="num"><span class="mini">' + (fmtPct(s.deliveryRate) || '0%') + meter(s.deliveryRate, b.emailDelivery) + '</span></td>' +
        '<td class="num">' + fmtInt(s.clicks) + '</td>' +
        '<td class="num"><span class="mini">' + (fmtPct(s.ctr) || '0%') + meter(s.ctr, b.emailCtr) + '</span></td>' +
        (showPos ? '<td class="num"><span class="mini">' + (fmtPct(s.positiveRate) || '0%') + meter(s.positiveRate, b.emailPositive) + '</span></td>' : '') + '</tr>';
    }).join('') : '<tr><td colspan="7" class="empty">No campaign sends yet.</td></tr>';
    var foot = sends.length > 1 ? '<tfoot><tr><td>All sends</td><td></td><td class="num">' + fmtInt(t.delivered) + '</td><td class="num">' + (fmtPct(t.deliveryRate) || '0%') +
      '</td><td class="num">' + fmtInt(t.clicks) + '</td><td class="num">' + (fmtPct(t.ctr) || '0%') + '</td>' +
      (showPos ? '<td class="num">' + (fmtPct(em.positive.rate) || '0%') + '</td>' : '') + '</tr></tfoot>' : '';
    var table = '<div class="table-wrap"><table><thead><tr><th>Email</th><th>Sent</th><th class="num">Delivered</th><th class="num">Delivery rate</th><th class="num">Clicks</th><th class="num">CTR</th>' +
      (showPos ? '<th class="num">Positive replies</th>' : '') + '</tr></thead><tbody>' + rows + '</tbody>' + foot + '</table></div>';
    return '<section class="section wrap" id="emails">' + head +
      '<div class="card"><div class="card-title">Results by send</div><p class="card-sub">The tick on each bar marks the benchmark: ' + fmtBench(b.emailDelivery) + ' delivery, ' + fmtBench(b.emailCtr) + ' click through' + (showPos ? ', ' + fmtBench(b.emailPositive) + ' positive replies' : '') + '.</p>' +
      '<div class="card-body">' + table + '</div><div class="card-body">' + stats + '</div></div></section>';
  }

  function stat(label, value, note) {
    return '<div class="stat"><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + value + '</div>' + (note ? '<div class="stat-note">' + esc(note) + '</div>' : '') + '</div>';
  }

  function renderAssetPanel(d, a, isFirst) {
    var b = d.benchmarks || {};
    var since = 'Since ' + fmtYmd(d.campaignStart);
    var breakdownNote = 'Breakdown since ' + fmtYmd(d.breakdownStart) + '.';
    var notTracked = 'Engagement tracking for this page is being set up. Results will appear here once it is live.';

    // Traffic
    var srcItems = (a.sources || []).map(function (s) { return { label: s.label, ratio: s.share || 0, primary: fmtPct(s.share) || '0%', secondary: fmtInt(s.views) }; });
    var traffic =
      '<h3 class="group-label">Page traffic</h3>' +
      '<div class="grid grid-2">' +
        '<div class="card"><div class="card-title">Page visits' + info('Page views recorded by Google Analytics for this asset.') + '</div><p class="card-sub">' + since + '</p>' +
          '<div class="card-body"><div class="hero-num">' + fmtInt(a.views) + '</div>' +
          '<div class="cols" data-series="' + esc(JSON.stringify(fillDays(a.daily, d.campaignStart))) + '"></div></div></div>' +
        '<div class="card"><div class="card-title">Traffic sources' + info('Share of page visits by source. Vanity URLs are identified by their campaign tag. Everything else uses the Google Analytics channel.') + '</div><p class="card-sub">Share of page visits</p>' +
          '<div class="card-body">' + barList(srcItems, { empty: 'No visits recorded yet.' }) + '</div></div>' +
      '</div>';
    if (a.key !== 'mbo-guide') {
      var pageItems = (a.pages || []).map(function (p) { return { label: p.path, ratio: p.views, primary: fmtInt(p.views) }; });
      traffic += '<div class="card" style="margin-top:24px"><div class="card-title">Pages included</div><p class="card-sub">' +
        (a.key === 'case-study' ? 'Case studies listed on the Case Studies page are added automatically.' : 'Every Debt Digest issue is included automatically.') +
        '</p><div class="card-body">' + barList(pageItems, { empty: 'No visits to these pages since ' + fmtYmd(d.campaignStart) + '.' }) + '</div></div>';
    }

    // Engagement
    var sec = a.sections || {};
    var secItems = (sec.items || []).map(function (s) { return { label: s.label, ratio: s.pct || 0, primary: fmtPct(s.pct) || '0%', secondary: fmtInt(s.users) + (s.users === 1 ? ' visitor' : ' visitors') }; });
    var secReady = a.tracked && sec.status === 'ok' && secItems.length;
    var secCard =
      '<div class="card-title">Sections viewed' + info('Share of visitors who scrolled each section into view. The headline figure is the average share of sections seen per visitor.') + '</div>' +
      '<p class="card-sub">Benchmark ' + fmtBench(b.sectionViews) + '. ' + breakdownNote + '</p>' +
      '<div class="card-body"><div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap"><span class="hero-num">' + (fmtPct(sec.overall) || '0%') + '</span>' + status(sec.overall, b.sectionViews) + '</div>' +
      '<div style="margin-top:24px">' + barList(secItems, { bench: b.sectionViews, scaleMax: 1, empty: 'No section views yet.' }) + '</div>' +
      (secItems.length ? '<p class="legend"><i></i>Benchmark ' + fmtBench(b.sectionViews) + '</p>' : '') + '</div>';
    var secTitle = '<div class="card-title">Sections viewed' + info('Share of visitors who scrolled each section into view. The headline figure is the average share of sections seen per visitor.') + '</div>' +
      '<p class="card-sub">Benchmark ' + fmtBench(b.sectionViews) + '</p>';
    var secPendingCard = function (msg) {
      return '<div class="card">' + secTitle + '<div class="card-body is-pending" style="min-height:240px"><div class="pending-content" aria-hidden="true">' + skeletonCard() + '</div>' + pendingNote('Under construction', msg) + '</div></div>';
    };
    var secHtml = !a.tracked
      ? secPendingCard(notTracked)
      : (!secReady ? secPendingCard('Section data started collecting on ' + fmtYmd(d.breakdownStart) + ' and appears within 48 hours.') : '<div class="card">' + secCard + '</div>');

    var printsSaves = '<div class="stats" style="border-top:0">' + stat('Prints', fmtInt(a.prints)) + stat('Saves', fmtInt(a.saves)) + '</div>';
    var timeCard = '<div class="card"><div class="card-title">Time on page' + info('Average engagement time per visitor, from Google Analytics.') + '</div><p class="card-sub">' + since + '</p>' +
      '<div class="card-body"><div class="hero-num">' + (fmtDuration(a.avgEngagementSec) || '0:00') + '</div><p class="note">Minutes and seconds</p></div>' +
      '<div class="card-body card-split"><div class="card-title">Prints and saves' + info('Times visitors printed the page or saved it as a file.') + '</div>' +
      (a.tracked ? printsSaves : pendingInline('Print and save tracking is being set up for this page.')) + '</div></div>';

    var engagement = '<h3 class="group-label">Page engagement</h3><div class="grid grid-2">' + secHtml + timeCard + '</div>';

    // Conversion
    var cta = a.cta || {};
    var ctaItems = (cta.byType || []).map(function (c) { return { label: c.label, ratio: c.share || 0, primary: fmtPct(c.share) || '0%', secondary: fmtInt(c.clicks) + (c.clicks === 1 ? ' click' : ' clicks') }; });
    var convInner =
      '<div class="grid grid-2">' +
        '<div class="card"><div class="card-title">CTA clicks' + info('Clicks on the page’s calls to action: book a call, call, email and LinkedIn.') + '</div><p class="card-sub">' + since + '</p>' +
          '<div class="card-body"><div class="hero-num">' + fmtInt(cta.clicks) + '</div></div>' +
          '<div class="card-body card-split"><div class="card-title">CTA click through rate</div>' +
          '<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:10px"><span class="stat-value">' + (fmtPct(cta.ctr) || '0%') + '</span>' + status(cta.ctr, b.ctaCtr) + '</div>' +
          '<div style="margin-top:14px">' + meter(cta.ctr, b.ctaCtr) + '</div><p class="legend"><i></i>Benchmark ' + fmtBench(b.ctaCtr) + ' of page visits</p></div></div>' +
        '<div class="card"><div class="card-title">Clicks by CTA' + info('Share of CTA clicks by type.') + '</div><p class="card-sub">' + breakdownNote + '</p>' +
          '<div class="card-body">' + barList(ctaItems, { empty: 'No CTA clicks recorded in the breakdown yet.' }) + '</div></div>' +
      '</div>';
    var conversion = '<h3 class="group-label">Page conversion</h3>' + (a.tracked ? convInner : pendingWrap(convInner, 'Under construction', notTracked));

    return '<div class="asset-panel" role="tabpanel" id="panel-' + esc(a.key) + '" aria-labelledby="tab-' + esc(a.key) + '"' + (isFirst ? '' : ' hidden') + '>' +
      traffic + engagement + conversion + '</div>';
  }

  function skeletonCard() {
    return '<span class="skel" style="width:30%"></span><div style="height:20px"></div><span class="skel skel-lg"></span><div style="height:28px"></div>' +
      '<span class="skel" style="width:90%"></span><div style="height:14px"></div><span class="skel" style="width:70%"></span><div style="height:14px"></div><span class="skel" style="width:50%"></span>';
  }

  function renderPages(d) {
    var head = sectionHead('03', 'Webpages', 'Traffic, engagement and conversion on the campaign pages. Choose an asset to see its results.', 'Google Analytics', 'Visits since ' + fmtShortYmd(d.campaignStart));
    var pages = d.pages || {};
    if (pages.status !== 'ok') {
      return '<section class="section wrap" id="webpages">' + head +
        pendingWrap('<div class="card">' + skeletonCard() + '</div>', 'Under construction', 'Page results will appear as soon as the Google Analytics connection is active.') + '</section>';
    }
    var assets = pages.assets || [];
    var tabs = '<div class="tabs" role="tablist" aria-label="Campaign asset">' + assets.map(function (a, i) {
      return '<button class="tab" role="tab" type="button" id="tab-' + esc(a.key) + '" aria-controls="panel-' + esc(a.key) + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '">' + esc(a.label) + '</button>';
    }).join('') + '</div>';
    return '<section class="section wrap" id="webpages">' + head + tabs + assets.map(function (a, i) { return renderAssetPanel(d, a, i === 0); }).join('') + '</section>';
  }

  function renderResponses(d) {
    var r = d.responses || {};
    var head = sectionHead('04', 'Responses', 'Responses from partners and contacts from potential clients. Email replies are added automatically and reviewed by the Diamond Willow team.', 'Diamond Willow team', 'Shared responses sheet');
    if (r.status !== 'ok') {
      return '<section class="section wrap" id="responses">' + head +
        pendingWrap('<div class="card">' + skeletonCard() + '</div>', 'Under construction', 'The shared responses sheet is being connected.') + '</section>';
    }
    var t = r.totals || {};
    var members = r.byMember || [];
    var maxP = Math.max.apply(null, members.map(function (m) { return m.partners; }).concat([1]));
    var maxG = Math.max.apply(null, members.map(function (m) { return m.gsm; }).concat([1]));
    var cell = function (v, max) {
      return '<td class="num"><span class="mini">' + fmtInt(v) + '<span class="meter" aria-hidden="true"><span class="meter-fill" style="width:' + (v / max * 100).toFixed(1) + '%"></span></span></span></td>';
    };
    var rows = members.map(function (m) {
      return '<tr><td class="cell-main">' + esc(m.member) + '</td>' + cell(m.partners, maxP) + cell(m.gsm, maxG) + '<td class="num">' + fmtInt(m.replies) + '</td></tr>';
    }).join('');
    var review = t.awaitingReview
      ? '<p class="note">' + fmtInt(t.awaitingReview) + ' email ' + (t.awaitingReview === 1 ? 'reply is' : 'replies are') + ' waiting for review in the responses sheet.</p>' : '';
    return '<section class="section wrap" id="responses">' + head +
      '<div class="grid grid-2">' +
        '<div class="card"><div class="card-title">By team member</div><p class="card-sub">Updates within minutes of a change in the sheet.</p>' +
          '<div class="card-body table-wrap"><table><thead><tr><th>Team member</th><th class="num">Partner responses</th><th class="num">Potential client contacts</th><th class="num">Email replies</th></tr></thead><tbody>' + rows +
          '</tbody><tfoot><tr><td>Total</td><td class="num">' + fmtInt(t.partners) + '</td><td class="num">' + fmtInt(t.gsm) + '</td><td class="num">' + fmtInt(t.replies) + '</td></tr></tfoot></table></div>' + review + '</div>' +
        '<div class="card"><div class="card-title">Campaign to date</div><p class="card-sub">All team members</p>' +
          '<div class="card-body"><div class="stats" style="border-top:0">' +
            stat('Partner responses', '<span class="hero-num">' + fmtInt(t.partners) + '</span>') +
            stat('Potential client contacts', '<span class="hero-num">' + fmtInt(t.gsm) + '</span>') +
          '</div></div></div>' +
      '</div></section>';
  }

  function renderMethod(d) {
    var b = d.benchmarks || {};
    var items = [
      ['LinkedIn engagement rate', 'Reactions, comments, shares and clicks divided by impressions. Benchmark ' + fmtBench(b.liEngagement) + '.'],
      ['LinkedIn click through rate', 'Clicks divided by impressions, on posts with a link only. Benchmark ' + fmtBench(b.liCtr) + '.'],
      ['Email delivery rate', 'Delivered divided by sent, from HubSpot. Benchmark ' + fmtBench(b.emailDelivery) + '.'],
      ['Email click through rate', 'Clicks divided by delivered, from HubSpot. Benchmark ' + fmtBench(b.emailCtr) + '.'],
      ['Email positive reply rate', 'Replies to campaign emails are copied from HubSpot into the responses sheet, without automatic replies. The team marks each one. Positive replies divided by delivered. Benchmark ' + fmtBench(b.emailPositive) + '.'],
      ['Page visits and sources', 'Page views from Google Analytics. Vanity URLs are matched by their campaign tag.'],
      ['Sections viewed', 'Visitors who saw each section divided by page visitors, averaged across sections. Benchmark ' + fmtBench(b.sectionViews) + '.'],
      ['CTA click through rate', 'CTA clicks divided by page visits. Benchmark ' + fmtBench(b.ctaCtr) + '.'],
      ['Responses', 'Counted from the shared sheet the Diamond Willow team fills in.'],
      ['How values are produced', 'Pulled directly from each platform’s API every hour. Calculations run in a fixed script. No AI is used to produce any number.']
    ];
    return '<div class="wrap"><details class="method"><summary>How each metric is calculated</summary><div class="method-body">' +
      items.map(function (i) { return '<p><b>' + esc(i[0]) + '</b>' + esc(i[1]) + '</p>'; }).join('') + '</div></details></div>';
  }

  /* ---------------- behaviour ---------------- */
  var activeTab = null;
  function wireTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    function select(tab) {
      activeTab = tab.id;
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      drawAllColumns();
      postHeight();
    }
    var keep = activeTab && document.getElementById(activeTab);
    if (keep) select(keep);
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus(); select(next);
      });
    });
  }

  function drawAllColumns() {
    document.querySelectorAll('.cols').forEach(function (el) { if (el.offsetParent !== null) drawColumns(el); });
  }

  var lastHeight = 0;
  function postHeight() {
    if (window.parent === window) return;
    var h = Math.ceil(document.documentElement.scrollHeight);
    if (Math.abs(h - lastHeight) < 2) return;
    lastHeight = h;
    window.parent.postMessage({ type: 'dw-dash-height', height: h }, CFG.embedOrigin || '*');
  }

  function render(d) {
    renderMeta(d);
    var errors = (d.errors || []).length
      ? '<div class="wrap"><p class="alert">Some data could not be refreshed in the last run. The latest available values are shown.</p></div>' : '';
    app.innerHTML = errors + renderScorecard(d) + renderLinkedIn(d) + renderEmail(d) + renderPages(d) + renderResponses(d) + renderMethod(d);
    wireTabs();
    drawAllColumns();
    postHeight();
  }

  function showState(title, text) {
    app.innerHTML = '<div class="wrap state"><div class="state-card"><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p></div></div>';
    postHeight();
  }

  function load() {
    var url = LOCAL ? LOCAL : (API && KEY ? API + (API.indexOf('?') === -1 ? '?' : '&') + 'k=' + encodeURIComponent(KEY) : null);
    if (!url) {
      showState('Private dashboard', 'This dashboard opens from the Diamond Willow website. Please use the link and password shared with you.');
      return;
    }
    fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        if (d.error === 'unauthorized') return showState('Access denied', 'The access key is not valid. Please contact Woods.');
        if (d.error) return showState('Data is on its way', d.message || 'The first data refresh has not run yet. Please check back shortly.');
        render(d);
      })
      .catch(function () {
        showState('Data temporarily unavailable', 'The dashboard could not reach its data source. Please refresh the page in a minute.');
      });
  }

  document.getElementById('printBtn').addEventListener('click', function () { window.print(); });
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { drawAllColumns(); postHeight(); }, 150); });
  if ('ResizeObserver' in window) new ResizeObserver(postHeight).observe(document.body);
  setInterval(load, 15 * 60 * 1000);
  load();
})();
