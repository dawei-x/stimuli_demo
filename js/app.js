(() => {
  const CFG = (window.DEMO_CONFIG || {});
  const MANIFEST_URL = CFG.MANIFEST_URL;
  const DEFAULT_TAB = (CFG.DEFAULT_TAB || 'sample').toLowerCase();

  const $ = sel => document.querySelector(sel);
  function el(tag, attrs={}, ...children) {
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    for (const c of children) n.append(c);
    return n;
  }
  const toFixed3 = x => (typeof x === 'number' && isFinite(x)) ? x.toFixed(3) : '—';

  // Sidebar model meta
  (function writeModelMeta(){
    const m = CFG.MODEL_INFO || {};
    const box = $('#model-meta');
    box.innerHTML = `
      <div><strong>Model</strong>: ${m.model || '—'}</div>
      <div><strong>Extractor</strong>: ${m.extractor || '—'}</div>
      <div><strong>Representative</strong>: ${m.representative || '—'}</div>
      <div><strong>Coverage</strong>: ${m.coverage_label || '—'} (α = ${m.alpha ?? '—'})</div>
      <div><strong>Data Source</strong>: ${m.data || '—'}</div>
    `;
  })();

  // App state
  let stimuli = [];
  let currentIndex = 0;
  let trialStart = null;
  const logs = [];

  // Elements
  const layoutEl = document.querySelector('.layout');
  const sampleContainer = $('#sample-stim');
  const browseContainer = $('#browse-stim');
  const browseList = $('#browse-list');

  function pill(text, title) {
    return el('span', {class:'pill', title: title || ''}, text);
  }

  // Abbreviation list under the Reveal button
  function abbrItem(key, desc) {
    return el('div', {class:'abbr-item'},
      el('span', {class:'abbr-key'}, `${key}: `),
      el('span', {class:'abbr-desc'}, desc)
    );
  }
  function buildAbbrList() {
    return el('div', {class:'abbr-list'},
      abbrItem('set_size', 'Number of labels in the prediction set.'),
      abbrItem('avg_sim', 'Average pairwise cosine similarity among class proxy embeddings.'),
      abbrItem('med_sim', 'Median pairwise cosine similarity among class proxy embeddings.'),
      abbrItem('min_sim', 'Minimum pairwise cosine similarity among class proxy embeddings.'),
      abbrItem('wn_max', 'Maximum WordNet shortest-path distance in the set.'),
      abbrItem('wn_avg', 'Average WordNet shortest-path distance in the set.')
    );
  }

  function renderStimulus(container, stim) {
    if (!stim) { container.innerHTML = '<div class="muted">No stimulus loaded yet.</div>'; return; }
    container.innerHTML = '';
    trialStart = performance.now();

    const gt = stim.ground_truth || null;
    const gtId = (gt && gt.label_id != null) ? String(gt.label_id) : null;
    const gtName = gt ? String(gt.label) : null;

    // Is the ground truth in the prediction set?
    const setHasId   = gtId  != null && (stim.prediction_set || []).some(p => String(p.label_id) === gtId);
    const setHasName = gtName != null && (stim.prediction_set || []).some(p => String(p.label)    === gtName);
    const covered = gt ? (setHasId || setHasName) : null;

    // LEFT: caption → image → reveal → abbr list
    const left = el('div', {class:'panel'},
      el('div', {class:'muted caption', html:`Instance (trial ${stim.trial_id})`}),
      el('img', {src: stim.instance_url, alt: 'instance'}),
      el('div', {class:'reveal-box'}, (() => {
        const wrap = el('div', {});
        const revealBtn = el('button', {class:'btn btn-primary btn-lg', id:'btn-reveal'}, 'Reveal true label');
        const revealNote = el('div', {id:'reveal-info', class:'muted', style:'margin-top:8px; display:none;'});

        let revealed = false;
        revealBtn.addEventListener('click', () => {
          revealed = !revealed;
          revealBtn.textContent = revealed ? 'Hide true label' : 'Reveal true label';

          if (!covered && gt) {
            revealNote.style.display = revealed ? '' : 'none';
            revealNote.textContent = `True label: ${gtName ?? gtId ?? 'unknown'} (not in prediction set)`;
          } else {
            revealNote.style.display = 'none';
          }

          // Toggle classes on proxy cards in this stimulus
          const grid = container.querySelector('.proxies');
          if (grid) {
            Array.from(grid.children).forEach(card => {
              const cid = card.getAttribute('data-id');
              const cname = card.getAttribute('data-label');
              card.classList.toggle('revealed', revealed);

              if (covered && gt) {
                const isGT = (gtId != null) ? (String(cid) === gtId) : (cname === gtName);
                card.classList.toggle('gt', revealed && isGT);
                card.classList.toggle('non-gt', revealed && !isGT);
              } else {
                card.classList.remove('gt', 'non-gt');
              }
            });
          }
        });

        wrap.append(revealBtn, revealNote);
        return wrap;
      })()),
      buildAbbrList()
    );

    // RIGHT: stats + proxy grid (no "covered" pill)
    const stats = el('div', {class:'stats'},
      pill(`set_size=${stim.set_size}`, 'Number of labels in the prediction set.'),
      pill(`avg_sim=${toFixed3(stim.similarity?.avg)}`, 'Average pairwise cosine similarity among class proxy embeddings.'),
      pill(`med_sim=${toFixed3(stim.similarity?.median)}`, 'Median pairwise cosine similarity among class proxy embeddings.'),
      pill(`min_sim=${toFixed3(stim.similarity?.min)}`, 'Minimum pairwise cosine similarity among class proxy embeddings.'),
      pill(`wn_max=${stim.similarity?.wn_max ?? '—'}`, 'Maximum WordNet shortest-path distance within the set.'),
      pill(`wn_avg=${stim.similarity?.wn_avg ?? '—'}`, 'Average WordNet shortest-path distance within the set.')
    );

    const grid = el('div', {class:'proxies'});
    (stim.prediction_set || []).forEach((p) => {
      const card = el('div', {class:'proxy', 'data-label': p.label, 'data-id': p.label_id ?? ''},
        el('img', {src: p.proxy_url, alt: p.label}),
        el('h4', {}, p.label)
      );
      card.addEventListener('click', () => {
        const rt = Math.round(performance.now() - trialStart);
        const selId = (p.label_id != null) ? String(p.label_id) : null;
        const selName = String(p.label);
        const isCorrect = gt ? (gtId != null ? (selId === gtId) : (selName === gtName)) : null;

        logs.push({
          trial_id: stim.trial_id,
          selected_label: selName,
          selected_label_id: selId,
          is_correct: isCorrect,
          gt_in_set: covered, // logged only
          rt_ms: rt,
          set_size: stim.set_size,
          sim_avg: stim.similarity?.avg ?? null,
          sim_median: stim.similarity?.median ?? null,
          sim_min: stim.similarity?.min ?? null,
          wn_max: stim.similarity?.wn_max ?? null,
          wn_avg: stim.similarity?.wn_avg ?? null,
          model: (CFG.MODEL_INFO && CFG.MODEL_INFO.model) || 'wide_resnet101_2',
          representative: (CFG.MODEL_INFO && CFG.MODEL_INFO.representative) || 'centroid',
          alpha: (CFG.MODEL_INFO && CFG.MODEL_INFO.alpha) ?? 0.10,
          timestamp: new Date().toISOString()
        });

        // quick visual feedback
        card.style.outline = isCorrect === true ? '2px solid var(--ok)' :
                             isCorrect === false ? '2px solid var(--err)' : '2px solid var(--warn)';
        setTimeout(()=> { card.style.outline = ''; }, 300);
      });
      grid.append(card);
    });

    const right = el('div', {class:'panel'},
      el('div', {class:'row', style:'justify-content:space-between;align-items:center;'},
        el('div', {}, 'Prediction set'),
        stats
      ),
      el('div', {style:'height:8px;'}),
      grid
    );

    container.append(el('div', {class:'stim'}, left, right));
  }

  function renderBrowseList() {
    const list = $('#browse-list');
    list.innerHTML = '';
    (stimuli || []).forEach((s, idx) => {
      const t = el('div', {class:'thumb', 'data-idx': idx},
        el('img', {src: s.instance_url, alt: 'thumb'}),
        el('div', {class:'muted', html:`trial ${s.trial_id}`})
      );
      t.addEventListener('click', () => {
        currentIndex = idx;
        renderStimulus($('#browse-stim'), stimuli[currentIndex]);
      });
      list.append(t);
    });
  }

  // Tabs (toggle sidebar)
  function setTab(target) {
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${target}"]`).classList.add('active');

    $('#panel-sample').style.display = (target==='sample') ? '' : 'none';
    $('#panel-browse').style.display = (target==='browse') ? '' : 'none';

    if (target === 'browse') layoutEl.classList.add('no-sidebar');
    else layoutEl.classList.remove('no-sidebar');
  }
  document.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('click', ()=> setTab(tab.dataset.tab));
  });

  // Sample
  $('#btn-sample').addEventListener('click', () => {
    if (!stimuli.length) { $('#sample-meta').textContent = 'loading…'; return; }
    const idx = Math.floor(Math.random()*stimuli.length);
    const stim = stimuli[idx];
    $('#sample-meta').textContent = `trial ${stim.trial_id}`;
    renderStimulus($('#sample-stim'), stim);
  });

  // Download CSV
  $('#btn-download').addEventListener('click', ()=>{
    if (!logs.length) { alert('No responses yet.'); return; }
    const cols = [
      'trial_id','selected_label','selected_label_id','is_correct','gt_in_set','rt_ms',
      'set_size','sim_avg','sim_median','sim_min','wn_max','wn_avg',
      'model','representative','alpha','timestamp'
    ];
    const esc = v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const lines = [cols.join(',')];
    for (const r of logs) lines.push(cols.map(c=>esc(r[c])).join(','));
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'choices.csv';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  });

  // Keyboard: ONLY arrows in Browse
  document.addEventListener('keydown', (e)=>{
    if ($('#panel-browse').style.display !== 'none' && stimuli.length) {
      if (e.key === 'ArrowRight') {
        currentIndex = Math.min(currentIndex+1, stimuli.length-1);
        renderStimulus($('#browse-stim'), stimuli[currentIndex]);
      } else if (e.key === 'ArrowLeft') {
        currentIndex = Math.max(currentIndex-1, 0);
        renderStimulus($('#browse-stim'), stimuli[currentIndex]);
      }
    }
  });

  // Load manifest
  (async function loadManifest() {
    try {
      const res = await fetch(MANIFEST_URL, {cache:'no-cache'});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();
      stimuli = (manifest.stimuli || []).slice().sort((a,b)=> (a.trial_id||0)-(b.trial_id||0));

      renderBrowseList();
      renderStimulus($('#browse-stim'), stimuli[0] || null);
      $('#sample-meta').textContent = stimuli.length ? `ready (${stimuli.length})` : 'empty';

      setTab(DEFAULT_TAB);
      console.log('Loaded stimuli:', stimuli.length);
    } catch (err) {
      console.error('Failed to load manifest:', err);
      $('#sample-meta').textContent = 'failed to load';
      $('#browse-stim').innerHTML = '<div class="muted">Failed to load manifest. Check the S3 URL/CORS.</div>';
    }
  })();
})();
