<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { Button } from '$lib/components/ui/button/index.js'
  import ClosurePeriodsPanel from './ClosurePeriodsPanel.svelte'
  import SeasonMemberConfig from './SeasonMemberConfig.svelte'
  import type {
    AbsenceRow,
    ClosurePeriodRow,
    MemberRow,
    SeasonMemberSettingRow,
    SeasonRow,
  } from '$lib/server/schema'

  let {
    season,
    closures,
    members,
    memberSettings,
    seasonAbsences,
    workableSlotsCount,
    permanentCount,
    poolCount,
  }: {
    season: SeasonRow
    closures: ClosurePeriodRow[]
    members: MemberRow[]
    memberSettings: SeasonMemberSettingRow[]
    seasonAbsences: AbsenceRow[]
    workableSlotsCount: number
    permanentCount: number
    poolCount: number
  } = $props()

  let step = $state(1)
  let requiredCount = $state(3)
  let generating = $state(false)

  const STEPS = [
    { label: 'Vacances & fermetures' },
    { label: 'Configuration des membres' },
    { label: 'Générer le planning' },
  ]

  const estimatedPerMember = $derived(
    poolCount > 0 ? Math.round(workableSlotsCount / poolCount) : 0,
  )
</script>

<div class="wizard">
  <!-- Indicateur de progression -->
  <div class="progress">
    {#each STEPS as s, i (i)}
      <button
        type="button"
        class="step-pill"
        class:active={step === i + 1}
        class:done={step > i + 1}
        onclick={() => (step = i + 1)}
      >
        <span class="dot">{step > i + 1 ? '✓' : i + 1}</span>
        <span class="step-label">{s.label}</span>
      </button>
      {#if i < STEPS.length - 1}
        <span class="sep">→</span>
      {/if}
    {/each}
  </div>

  <!-- Étape 1 — Vacances & fermetures -->
  {#if step === 1}
    <div class="step-body">
      <ClosurePeriodsPanel {closures} seasonStartDate={season.startDate} readOnly={false} />
    </div>
    <div class="step-nav">
      <Button onclick={() => (step = 2)}>Suivant →</Button>
    </div>
  {/if}

  <!-- Étape 2 — Configuration des membres -->
  {#if step === 2}
    <div class="step-body">
      <h2 class="step-title">Configuration des membres</h2>
      <p class="step-hint">
        Marquez les membres <strong>permanents</strong> (présents tous les samedis) et ajoutez leurs indisponibilités
        déjà connues.
      </p>
      <SeasonMemberConfig {members} {memberSettings} {seasonAbsences} readOnly={false} />
    </div>
    <div class="step-nav">
      <Button variant="ghost" onclick={() => (step = 1)}>← Précédent</Button>
      <Button onclick={() => (step = 3)}>Suivant →</Button>
    </div>
  {/if}

  <!-- Étape 3 — Génération -->
  {#if step === 3}
    <div class="step-body">
      <h2 class="step-title">Générer le planning</h2>

      <div class="stats-grid">
        <div class="stat">
          <span class="stat-value">{workableSlotsCount}</span>
          <span class="stat-label">samedis travaillables</span>
        </div>
        <div class="stat">
          <span class="stat-value">{permanentCount}</span>
          <span class="stat-label">membres permanents</span>
        </div>
        <div class="stat">
          <span class="stat-value">{poolCount}</span>
          <span class="stat-label">membres en pool</span>
        </div>
        {#if poolCount > 0}
          <div class="stat">
            <span class="stat-value">~{estimatedPerMember}</span>
            <span class="stat-label">samedis/membre (pool)</span>
          </div>
        {/if}
      </div>

      <div class="required-field">
        <label for="req-count" class="req-label">Effectif requis par samedi</label>
        <div class="req-input-row">
          <input
            id="req-count"
            type="number"
            min="1"
            max="10"
            bind:value={requiredCount}
            class="req-input"
          />
          <span class="req-hint">membres par défaut pour tous les samedis</span>
        </div>
      </div>

      <form
        method="POST"
        action="?/generatePlanning"
        use:enhance={toastEnhance({
          success: 'Planning généré.',
          redirect: 'Planning généré.',
          onPending: (p) => (generating = p),
        })}
      >
        <input type="hidden" name="requiredCount" value={requiredCount} />
        <Button type="submit" disabled={generating} class="generate-btn">
          {generating ? 'Génération en cours…' : '⚡ Générer le planning'}
        </Button>
      </form>

      <p class="generate-note">
        Cette action génère automatiquement toutes les assignations. Vous pourrez ajuster
        manuellement après.
      </p>
    </div>
    <div class="step-nav">
      <Button variant="ghost" onclick={() => (step = 2)}>← Précédent</Button>
    </div>
  {/if}
</div>

<style>
  .wizard {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* Barre de progression */
  .progress {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .step-pill {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border: none;
    background: none;
    cursor: pointer;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-full, 9999px);
    border: 1px solid var(--border);
    font-size: var(--text-small);
    color: var(--text-muted);
    transition: all 0.15s;
  }
  .step-pill.active {
    border-color: var(--primary);
    background: var(--primary);
    color: #fff;
    font-weight: 600;
  }
  .step-pill.done {
    border-color: var(--success, #16a34a);
    background: var(--success, #16a34a);
    color: #fff;
  }
  .dot {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
    background: rgba(255 255 255 / 0.25);
    color: #fff;
  }
  .step-pill:not(.active):not(.done) .dot {
    background: var(--border);
    color: var(--text-muted);
  }
  .sep {
    color: var(--text-muted);
    opacity: 0.4;
    font-size: var(--text-small);
  }
  .step-label {
    white-space: nowrap;
  }

  /* Corps d'étape */
  .step-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .step-title {
    color: var(--text-main);
    margin: 0;
    font-size: var(--text-h2);
  }
  .step-hint {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-small);
  }

  /* Stats */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--space-3);
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    text-align: center;
  }
  .stat-value {
    font-size: var(--text-h1, 2rem);
    font-weight: 700;
    color: var(--primary);
    line-height: 1;
  }
  .stat-label {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  /* Effectif requis */
  .required-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .req-label {
    font-size: var(--text-small);
    font-weight: 500;
    color: var(--text-main);
  }
  .req-input-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .req-input {
    width: 72px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: var(--text-body);
    background: var(--bg-card);
    color: var(--text-main);
    text-align: center;
  }
  .req-input:focus {
    outline: 2px solid var(--primary);
    outline-offset: 1px;
  }
  .req-hint {
    font-size: var(--text-small);
    color: var(--text-muted);
  }

  /* Bouton générer */
  .generate-note {
    margin: 0;
    font-size: var(--text-small);
    color: var(--text-muted);
  }

  /* Navigation */
  .step-nav {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
</style>
