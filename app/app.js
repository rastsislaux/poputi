// Poputi Along-the-way checker (Objective)
// Loads piecewise-linear f(x) from fitted_threshold.json, lets user pick A,B,C on map, computes δ* vs f(x).

(function () {
  const CONFIG = {
    thresholdUrl: 'fitted_threshold.json',
    // OSRM public demo server (shared; best-effort). Swap for your routing backend if needed.
    osrmBase: 'https://routing.openstreetmap.de',
  };

  // UI elements
  const el = {
    strategy: document.getElementById('strategy'),
    means: document.getElementById('means'),
    geocoder: document.getElementById('geocoder'),
    addrA: document.getElementById('addr-a'), suggA: document.getElementById('sugg-a'),
    addrB: document.getElementById('addr-b'), suggB: document.getElementById('sugg-b'),
    addrC: document.getElementById('addr-c'), suggC: document.getElementById('sugg-c'),
    reset: document.getElementById('reset'),
    compute: document.getElementById('compute'),
    base: document.getElementById('base-time'),
    via: document.getElementById('via-time'),
    extra: document.getElementById('extra-time'),
    thr: document.getElementById('threshold'),
    diff: document.getElementById('diff'),
    pct: document.getElementById('percent'),
    result: document.getElementById('result'),
    lang: document.getElementById('lang-select'),
  };

  // Map
  const map = L.map('map').setView([53.9, 27.5667], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const markers = { A: null, B: null, C: null };
  // i18n
  const i18n = {
    en: {
      title: 'Poputi',
      hint: 'Find A, B, C via search below. Zoom or drag to adjust.',
      from: 'From', to: 'To', midpoint: 'Mid-point', addrPlaceholder: 'Enter address or place',
      means: 'Means', advanced: 'Advanced settings', strategy: 'Strategy', objective: 'Objective', geocoder: 'Geocoder',
      check: 'Check', base: 'Base time A→B', via: 'Via C time A→C→B', extra: 'Proposed extra (δ*)', threshold: 'Threshold f(x)', difference: 'Difference', percent: 'Percent',
      method: 'Methodology',
      methodText: 'Population responses are cleaned (latest per user×question), times normalized to minutes, and an objective threshold f(x) is fitted as a monotone curve (isotonic regression over binned medians). The fitted curve is shipped as fitted_threshold.json and evaluated via linear interpolation.',
      sourceText: 'Source & analysis: ',
      along: 'YES!', notAlong: 'NO', initial: 'Select A, B, C and press Check.'
    },
    ru: {
      title: 'Попути',
      hint: 'Найдите точки A, B, C через поиск ниже. Масштабируйте и перемещайте карту.',
      from: 'Откуда', to: 'Куда', midpoint: 'Промежуточная точка', addrPlaceholder: 'Введите адрес или место',
      means: 'Способ', advanced: 'Дополнительные настройки', strategy: 'Стратегия', objective: 'Объективная', geocoder: 'Геокодер',
      check: 'Проверить', base: 'Базовое время A→B', via: 'Через C время A→C→B', extra: 'Предложенная дельта (δ*)', threshold: 'Порог f(x)', difference: 'Разница', percent: 'Процент',
      method: 'Методика',
      methodText: 'Ответы очищаются (последний на пользователя×вопрос), времена нормируются в минуты, и строится монотонный порог f(x) (изотоническая регрессия по медианам в бинах). Готовая кривая поставляется в fitted_threshold.json и оценивается линейной интерполяцией.',
      sourceText: 'Исходники и анализ: ',
      along: 'ДА!', notAlong: 'НЕТ', initial: 'Выберите A, B, C и нажмите Проверить.'
    }
  };

  function applyI18n(lang) {
    const t = i18n[lang] || i18n.en;
    const setText = (id, key) => { const n = document.getElementById(id); if (n) n.textContent = t[key]; };
    setText('app-title','title'); setText('hint-text','hint');
    document.querySelectorAll('[data-i18n]').forEach(node => { const key = node.getAttribute('data-i18n'); if (t[key]) node.textContent = t[key]; });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(node => { const key = node.getAttribute('data-i18n-placeholder'); if (t[key] && node.placeholder !== undefined) node.placeholder = t[key]; });
    document.querySelectorAll('[data-i18n-title-car]').forEach(node => node.setAttribute('title', lang==='ru'?'Авто':'Car'));
    document.querySelectorAll('[data-i18n-title-walk]').forEach(node => node.setAttribute('title', lang==='ru'?'Пешком':'Walk'));
    const methodText = document.getElementById('method-text'); if (methodText) methodText.textContent = t.methodText;
    const sourceText = document.getElementById('source-text'); if (sourceText) sourceText.firstChild && (sourceText.firstChild.textContent = t.sourceText);
    const head = document.getElementById('answer-head'); if (head && head.textContent === '...' ) head.textContent = t.initial;
  }
  const polylines = { ab: null, acb: null };
  let meansValue = 'driving';

  function placeMarker(which, latlng) {
    if (markers[which]) { map.removeLayer(markers[which]); }
    const color = which === 'A' ? 'green' : which === 'B' ? 'red' : 'orange';
    const m = L.marker(latlng, { draggable: true, title: which, icon: coloredIcon(color) }).addTo(map);
    m.bindTooltip(which, { permanent: true, direction: 'top' }).openTooltip();
    m.on('dragend', () => { /* keep position */ });
    markers[which] = m;
  }

  function coloredIcon(color) {
    // Simple colored circle marker via DivIcon
    const html = `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px #0003"></div>`;
    return L.divIcon({ html, className: 'dot', iconSize: [16, 16] });
  }

  // Geocoder interface + implementations
  const Geocoders = {
    async photon(query) {
      if (!query || query.trim().length < 2) return [];
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) return [];
      const data = await res.json();
      const feats = Array.isArray(data.features) ? data.features : [];
      return feats.map(f => {
        const p = f.properties || {};
        const name = p.name || p.street || p.label || '';
        const parts = [name, p.city, p.state, p.country].filter(Boolean);
        return {
          display_name: parts.join(', '),
          lat: f.geometry && Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates[1] : undefined,
          lon: f.geometry && Array.isArray(f.geometry.coordinates) ? f.geometry.coordinates[0] : undefined,
        };
      }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon));
    },
    async nominatim(query) {
      if (!query || query.trim().length < 3) return [];
      // Not for client-side autocomplete per policy; treat as on-demand search.
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) return [];
      const arr = await res.json();
      return (Array.isArray(arr) ? arr : []).slice(0,6).map(o => ({
        display_name: o.display_name,
        lat: parseFloat(o.lat),
        lon: parseFloat(o.lon),
      })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon));
    },
    async locationiq(query) {
      if (!query || query.trim().length < 2) return [];
      const key = (window && window.LOCATIONIQ_KEY) || '';
      if (!key) return [];
      const url = `https://us1.locationiq.com/v1/search?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&format=json&limit=6`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) return [];
      const arr = await res.json();
      return (Array.isArray(arr) ? arr : []).map(o => ({
        display_name: o.display_name || `${o.address?.name || ''}, ${o.address?.city || ''}`,
        lat: parseFloat(o.lat),
        lon: parseFloat(o.lon),
      })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon));
    }
  };

  async function geocode(query) {
    const which = el.geocoder?.value || 'nominatim';
    if (which === 'nominatim') return Geocoders.nominatim(query);
    if (which === 'locationiq') return Geocoders.locationiq(query);
    return Geocoders.photon(query);
  }

  function bindSuggest(input, suggEl, which) {
    let t = null;
    input.addEventListener('input', () => {
      const v = input.value.trim();
      clearTimeout(t);
      if (!v) { suggEl.classList.add('hidden'); suggEl.innerHTML = ''; return; }
      t = setTimeout(async () => {
        const arr = await geocode(v);
        suggEl.innerHTML = '';
        arr.slice(0, 6).forEach(item => {
          const div = document.createElement('div');
          div.className = 'suggest-item';
          div.textContent = item.display_name;
          div.addEventListener('click', () => {
            input.value = item.display_name;
            suggEl.classList.add('hidden');
            const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
            placeMarker(which, { lat, lng: lon });
            map.setView([lat, lon], 13);
          });
          suggEl.appendChild(div);
        });
        suggEl.classList.toggle('hidden', arr.length === 0);
      }, 250);
    });
    input.addEventListener('blur', () => setTimeout(() => suggEl.classList.add('hidden'), 200));
  }

  bindSuggest(el.addrA, el.suggA, 'A');
  bindSuggest(el.addrB, el.suggB, 'B');
  bindSuggest(el.addrC, el.suggC, 'C');

  // Means icon buttons behavior
  (function() {
    const wrap = document.getElementById('means-icons');
    if (!wrap) return;
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.means-btn');
      if (!btn) return;
      wrap.querySelectorAll('.means-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed','true');
      const val = btn.getAttribute('data-value');
      meansValue = val || 'driving';
      if (el.means) el.means.value = meansValue;
    });
  })();

  // Legacy reset handler removed (button not present).

  function fmtMin(m) {
    const v = Math.round(m);
    const h = Math.floor(v/60), mm = v % 60;
    if (h <= 0) return `${v}m`;
    if (mm === 0) return `${h}h`;
    return `${h}h ${mm}m`;
  }

  function setResult(r) {
    if (!r) {
      el.base.textContent = '–';
      el.via.textContent = '–';
      el.extra.textContent = '–';
      el.thr.textContent = '–';
      el.diff.textContent = '–';
      el.pct.textContent = '–';
      el.result.textContent = 'Select A, B, C and press Check.';
      return;
    }
    el.base.textContent = fmtMin(r.baseMin);
    el.via.textContent = fmtMin(r.viaMin);
    el.extra.textContent = fmtMin(r.extraMin);
    el.thr.textContent = fmtMin(r.thrMin);
    const sign = r.deltaMin >= 0 ? '+' : '';
    el.diff.textContent = `${sign}${fmtMin(r.deltaMin)}`;
    const pct = (r.deltaMin / r.thrMin) * 100;
    el.pct.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    const head = document.getElementById('answer-head');
    const sub = document.getElementById('answer-sub');
    if (r.deltaMin <= 0) {
      head.textContent = 'YES!';
      head.classList.remove('bad');
      head.classList.add('ok');
    } else {
      head.textContent = 'NO';
      head.classList.remove('ok');
      head.classList.add('bad');
    }
    sub.classList.remove('hidden');
    sub.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% from threshold`;
  }

  async function routeDurationMin(coords) {
    // coords: [[lat, lon], [lat, lon], ...]
    const locs = coords.map(([lat, lon]) => `${lon},${lat}`).join(';');
    const profile = meansValue === 'walking' ? 'foot' : 'car';
    const url = `${CONFIG.osrmBase}/routed-${profile}/route/v1/driving/${locs}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Routing failed');
    const data = await res.json();
    if (!data.routes || !data.routes[0]) throw new Error('No route');
    const sec = data.routes[0].duration; // seconds
    return sec / 60; // minutes
  }

  async function drawRoute(name, coords, color) {
    // Render OSRM route geometry instead of straight lines
    const locs = coords.map(([lat, lon]) => `${lon},${lat}`).join(';');
    const profile = meansValue === 'walking' ? 'foot' : 'car';
    const url = `${CONFIG.osrmBase}/routed-${profile}/route/v1/driving/${locs}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const geom = data.routes && data.routes[0] && data.routes[0].geometry;
    if (!geom) return;
    if (polylines[name]) map.removeLayer(polylines[name]);
    polylines[name] = L.geoJSON(geom, { style: { color, weight: 4, opacity: 0.6 } }).addTo(map);
  }

  // Threshold f(x) from piecewise-linear JSON
  let f = null;
  function buildInterpolator(json) {
    const xs = json.breakpoints || [];
    const ys = json.values || [];
    return function fx(x) {
      if (!xs.length) return 0;
      if (x <= xs[0]) return ys[0];
      if (x >= xs[xs.length-1]) return ys[ys.length-1];
      let i = 0;
      while (i < xs.length-1 && !(x >= xs[i] && x <= xs[i+1])) i++;
      const x0 = xs[i], x1 = xs[i+1], y0 = ys[i], y1 = ys[i+1];
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }

  async function loadThreshold() {
    const res = await fetch(CONFIG.thresholdUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load threshold');
    const json = await res.json();
    f = buildInterpolator(json);
    // draw tiny plot
    try { drawMiniPlotWithChart(json); } catch {}
  }

  el.compute.addEventListener('click', async () => {
    if (!markers.A || !markers.B || !markers.C) { setResult(null); return; }
    try {
      const A = markers.A.getLatLng();
      const B = markers.B.getLatLng();
      const C = markers.C.getLatLng();
      // durations (minutes)
      const baseMin = await routeDurationMin([[A.lat, A.lng],[B.lat, B.lng]]);
      const viaMin = await routeDurationMin([[A.lat, A.lng],[C.lat, C.lng],[B.lat, B.lng]]);
      // draw OSRM routes
      await drawRoute('ab', [[A.lat, A.lng],[B.lat, B.lng]], '#10b981');
      await drawRoute('acb', [[A.lat, A.lng],[C.lat, C.lng],[B.lat, B.lng]], '#f59e0b');

      const extraMin = Math.max(0, viaMin - baseMin);
      const thrMin = f ? f(baseMin) : 0;
      const deltaMin = extraMin - thrMin;
      setResult({ baseMin, viaMin, extraMin, thrMin, deltaMin });
    } catch (e) {
      console.error(e);
      setResult(null);
      el.result.textContent = 'Failed to compute. Try again.';
    }
  });

  // init
  (async function init() {
    const lang = (localStorage.getItem('app_lang') || (el.lang && el.lang.value)) || 'en';
    if (el.lang) el.lang.value = lang;
    applyI18n(lang);
    if (el.lang) el.lang.addEventListener('change', () => {
      const l = el.lang.value; localStorage.setItem('app_lang', l); applyI18n(l);
    });
    try { await loadThreshold(); } catch {}
  })();
})();
// Tiny inline plot using Chart.js
function drawMiniPlotWithChart(json) {
  const cv = document.getElementById('mini-plot');
  if (!cv || !window.Chart) return;
  const xs = json.breakpoints || [], ys = json.values || [];
  if (!xs.length) return;
  new Chart(cv.getContext('2d'), {
    type: 'line',
    data: { labels: xs, datasets: [{ label: 'f(x)', data: ys, borderColor: '#4f46e5', pointRadius: 0, tension: 0, borderWidth: 2 }] },
    options: {
      animation: false,
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'Base time' }, grid: { display: false } },
        y: { title: { display: true, text: 'Threshold δ_acc' }, beginAtZero: true }
      }
    }
  });
}



