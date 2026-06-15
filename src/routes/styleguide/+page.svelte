<svelte:head>
  <title>Styleguide — LudoHub</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="sg-page">
  <header class="sg-header">
    <h1>LudoHub — Styleguide</h1>
    <p class="sg-subtitle">Référence visuelle interne · Source de vérité : <code>docs/DESIGN.md</code></p>
  </header>

  <!-- ─── COULEURS ─────────────────────────────────────────── -->
  <section class="sg-section" id="colors">
    <h2>Couleurs</h2>

    <h3>Core</h3>
    <div class="sg-swatches">
      <div class="sg-swatch" style="background: var(--primary)"><span>primary</span><small>#0073E6</small></div>
      <div class="sg-swatch" style="background: var(--primary-dark)"><span>primary-dark</span><small>#005BA8</small></div>
      <div class="sg-swatch sg-swatch--light" style="background: var(--primary-light)"><span>primary-light</span><small>#E8F2FE</small></div>
      <div class="sg-swatch" style="background: var(--accent)"><span>accent</span><small>#C0007A</small></div>
      <div class="sg-swatch" style="background: var(--accent-dark)"><span>accent-dark</span><small>#9A0062</small></div>
    </div>

    <h3>Surfaces</h3>
    <div class="sg-swatches">
      <div class="sg-swatch sg-swatch--light" style="background: var(--bg-base); border: 1px solid var(--border)"><span>bg-base</span><small>#EEF2F8</small></div>
      <div class="sg-swatch sg-swatch--light" style="background: var(--bg-card); border: 1px solid var(--border)"><span>bg-card</span><small>#FFFFFF</small></div>
      <div class="sg-swatch sg-swatch--light" style="background: var(--bg-sidebar); border: 1px solid var(--border)"><span>bg-sidebar</span><small>#F1F5FA</small></div>
    </div>

    <h3>Sémantiques</h3>
    <div class="sg-swatches">
      <div class="sg-swatch" style="background: var(--success)"><span>success</span><small>#0E9E6E</small></div>
      <div class="sg-swatch" style="background: var(--warning)"><span>warning</span><small>#E07800</small></div>
      <div class="sg-swatch" style="background: var(--danger)"><span>danger</span><small>#F02849</small></div>
    </div>
  </section>

  <!-- ─── TYPOGRAPHIE ──────────────────────────────────────── -->
  <section class="sg-section" id="typography">
    <h2>Typographie — Nunito</h2>
    <div class="sg-type-scale">
      <div class="sg-type-row"><span class="sg-display">Display — 32px / 700</span><code>.display</code></div>
      <div class="sg-type-row"><span class="sg-h1">Heading 1 — 24px / 700</span><code>.h1</code></div>
      <div class="sg-type-row"><span class="sg-h2">Heading 2 — 20px / 600</span><code>.h2</code></div>
      <div class="sg-type-row"><span class="sg-h3">Heading 3 — 16px / 600</span><code>.h3</code></div>
      <div class="sg-type-row"><span class="sg-body">Body — 15px / 400 — Texte courant de l'application</span><code>.body</code></div>
      <div class="sg-type-row"><span class="sg-small">Small — 13px / 400 — Métadonnées, timestamps</span><code>.small</code></div>
      <div class="sg-type-row"><span class="sg-label">Label — 12px / 500 — NAV ITEMS · BADGES</span><code>.label</code></div>
    </div>
  </section>

  <!-- ─── BOUTONS ───────────────────────────────────────────── -->
  <section class="sg-section" id="buttons">
    <h2>Boutons</h2>
    <div class="sg-row sg-row--gap">
      <button class="btn btn-primary">Action principale</button>
      <button class="btn btn-secondary">Action secondaire</button>
      <button class="btn btn-ghost">Ghost</button>
      <button class="btn btn-danger">Supprimer</button>
      <button class="btn btn-primary" disabled>Désactivé</button>
    </div>
    <div class="sg-note">Tous les boutons ont <code>border-radius: var(--radius-pill)</code> (pill shape)</div>
  </section>

  <!-- ─── BADGES ────────────────────────────────────────────── -->
  <section class="sg-section" id="badges">
    <h2>Badges</h2>
    <div class="sg-row sg-row--gap sg-row--wrap">
      <span class="badge badge-success">Approuvé</span>
      <span class="badge badge-warning">En attente</span>
      <span class="badge badge-danger">Refusé</span>
      <span class="badge badge-info">Info</span>
      <span class="badge badge-neutral">Archivé</span>
      <span class="badge badge-success badge--dot">Actif</span>
      <span class="badge badge-danger badge--dot">Critique</span>
    </div>
  </section>

  <!-- ─── CARDS ─────────────────────────────────────────────── -->
  <section class="sg-section" id="cards">
    <h2>Cards</h2>
    <div class="sg-row sg-row--gap">
      <div class="card">
        <h3 style="font-size: var(--text-h3); font-weight: var(--weight-semibold); margin-bottom: var(--space-2)">Titre de carte</h3>
        <p style="font-size: var(--text-body); color: var(--text-muted)">Contenu de la carte. Les cartes utilisent shadow-md par défaut et shadow-lg au hover avec un leger translateY(-2px).</p>
      </div>
      <div class="card card--hover">
        <h3 style="font-size: var(--text-h3); font-weight: var(--weight-semibold); margin-bottom: var(--space-2)">Carte hoverable</h3>
        <p style="font-size: var(--text-body); color: var(--text-muted)">Hover sur cette carte pour voir l'élévation.</p>
      </div>
    </div>
  </section>

  <!-- ─── MOTION ────────────────────────────────────────────── -->
  <section class="sg-section" id="motion">
    <h2>Motion — Tokens</h2>
    <div class="sg-tokens-grid">
      <div class="sg-token"><code>--dur-fast</code><span>150ms</span></div>
      <div class="sg-token"><code>--dur-base</code><span>250ms</span></div>
      <div class="sg-token"><code>--dur-slow</code><span>450ms</span></div>
      <div class="sg-token"><code>--dur-reveal</code><span>600ms</span></div>
      <div class="sg-token"><code>--ease-out-strong</code><span>cubic-bezier(0.23, 1, 0.32, 1)</span></div>
      <div class="sg-token"><code>--ease-in-out-strong</code><span>cubic-bezier(0.77, 0, 0.175, 1)</span></div>
      <div class="sg-token"><code>--ease-drawer</code><span>cubic-bezier(0.32, 0.72, 0, 1)</span></div>
    </div>
    <div class="sg-note">Intensité 5/10 — outil de travail. Transitions de page, hover cards, ouverture modales uniquement.</div>
  </section>
</div>

<style>
  /* ── Page wrapper ─────────────────────────────────────── */
  .sg-page {
    background: var(--bg-base);
    min-height: 100vh;
    padding: var(--space-10) var(--space-8);
    font-family: var(--font-sans);
    color: var(--text-main);
  }

  .sg-header {
    margin-bottom: var(--space-12);
    padding-bottom: var(--space-6);
    border-bottom: 2px solid var(--border);
  }

  .sg-header h1 {
    font-size: var(--text-display);
    font-weight: var(--weight-bold);
    margin: 0 0 var(--space-2);
  }

  .sg-subtitle {
    color: var(--text-muted);
    font-size: var(--text-body);
    margin: 0;
  }

  /* ── Sections ─────────────────────────────────────────── */
  .sg-section {
    margin-bottom: var(--space-12);
  }

  .sg-section h2 {
    font-size: var(--text-h1);
    font-weight: var(--weight-bold);
    margin: 0 0 var(--space-6);
    color: var(--text-main);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border);
  }

  .sg-section h3 {
    font-size: var(--text-h3);
    font-weight: var(--weight-semibold);
    color: var(--text-muted);
    margin: var(--space-5) 0 var(--space-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* ── Swatches ─────────────────────────────────────────── */
  .sg-swatches {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .sg-swatch {
    width: 120px;
    height: 80px;
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: var(--space-2);
    color: white;
  }

  .sg-swatch--light { color: var(--text-main); }

  .sg-swatch span {
    font-size: 11px;
    font-weight: var(--weight-bold);
    line-height: 1.2;
  }

  .sg-swatch small {
    font-size: 10px;
    opacity: 0.8;
    font-family: monospace;
  }

  /* ── Typographie ──────────────────────────────────────── */
  .sg-type-scale { display: flex; flex-direction: column; gap: var(--space-4); }

  .sg-type-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--border);
  }

  .sg-type-row code {
    font-size: 11px;
    background: var(--primary-light);
    color: var(--primary-dark);
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .sg-display  { font-size: var(--text-display); font-weight: var(--weight-bold); }
  .sg-h1       { font-size: var(--text-h1); font-weight: var(--weight-bold); }
  .sg-h2       { font-size: var(--text-h2); font-weight: var(--weight-semibold); }
  .sg-h3       { font-size: var(--text-h3); font-weight: var(--weight-semibold); }
  .sg-body     { font-size: var(--text-body); font-weight: var(--weight-normal); }
  .sg-small    { font-size: var(--text-small); font-weight: var(--weight-normal); }
  .sg-label    { font-size: var(--text-label); font-weight: var(--weight-medium); text-transform: uppercase; letter-spacing: 0.05em; }

  /* ── Boutons ──────────────────────────────────────────── */
  .btn {
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-pill);
    font-family: var(--font-sans);
    font-size: var(--text-body);
    font-weight: var(--weight-medium);
    cursor: pointer;
    border: none;
    transition: all var(--dur-fast) var(--ease-out-strong);
  }

  .btn-primary  { background: var(--accent); color: white; }
  .btn-primary:hover:not(:disabled)  { background: var(--accent-dark); }

  .btn-secondary  { background: var(--primary); color: white; }
  .btn-secondary:hover:not(:disabled) { background: var(--primary-dark); }

  .btn-ghost  { background: transparent; color: var(--primary); border: 1.5px solid var(--primary); }
  .btn-ghost:hover:not(:disabled) { background: var(--primary-light); }

  .btn-danger { background: var(--danger); color: white; }
  .btn-danger:hover:not(:disabled) { opacity: 0.9; }

  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn:focus-visible { outline: none; box-shadow: var(--shadow-focus); }

  /* ── Badges ───────────────────────────────────────────── */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 3px var(--space-2);
    border-radius: var(--radius-pill);
    font-size: var(--text-label);
    font-weight: var(--weight-medium);
  }

  .badge-success { background: var(--success-light); color: var(--success); }
  .badge-warning { background: var(--warning-light); color: var(--warning); }
  .badge-danger  { background: var(--danger-light);  color: var(--danger);  }
  .badge-info    { background: var(--primary-light);  color: var(--primary); }
  .badge-neutral { background: var(--bg-hover); color: var(--text-muted); border: 1px solid var(--border); }

  .badge--dot::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  /* ── Cards ────────────────────────────────────────────── */
  .card {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    padding: var(--space-5);
    max-width: 280px;
  }

  .card--hover {
    transition: box-shadow var(--dur-fast) var(--ease-out-strong),
                transform var(--dur-fast) var(--ease-out-strong);
  }

  .card--hover:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
  }

  /* ── Motion tokens ────────────────────────────────────── */
  .sg-tokens-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-3);
  }

  .sg-token {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-3) var(--space-4);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }

  .sg-token code {
    font-size: 12px;
    color: var(--primary);
    background: var(--primary-light);
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .sg-token span {
    font-size: var(--text-small);
    color: var(--text-muted);
    font-family: monospace;
  }

  /* ── Utilitaires ──────────────────────────────────────── */
  .sg-row { display: flex; align-items: center; }
  .sg-row--gap { gap: var(--space-3); }
  .sg-row--wrap { flex-wrap: wrap; }

  .sg-note {
    margin-top: var(--space-4);
    font-size: var(--text-small);
    color: var(--text-muted);
    font-style: italic;
  }
</style>
