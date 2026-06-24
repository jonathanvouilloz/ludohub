<script lang="ts">
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import { Button } from '$lib/components/ui/button/index.js'
  import { Input } from '$lib/components/ui/input/index.js'
  import { Label } from '$lib/components/ui/label/index.js'
  import DatePicker from '$lib/components/ui/date-picker/DatePicker.svelte'
  import WeatherPicker from './WeatherPicker.svelte'
  import Stepper from './Stepper.svelte'
  import { formatDayMonth } from '$lib/utils/dates.js'
  import type { AttendanceRow } from '$lib/server/schema'

  let {
    open = $bindable(false),
    slug,
    record = null,
    eventTypes = [],
  }: {
    open?: boolean
    slug: string
    record?: AttendanceRow | null
    eventTypes?: { id: string; name: string }[]
  } = $props()

  const periodLabels: Record<string, string> = {
    matin: 'Matin',
    apres_midi: 'Après-midi',
    evenement: 'Événement',
  }

  // Valeur sentinelle du Select pour « Autre » (saisie libre).
  const TYPE_OTHER = '__autre__'

  // Date locale du jour au format `YYYY-MM-DD` (défaut en création).
  function todayLocal(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // Période par défaut selon l'heure : après-midi à partir de 14h30, sinon matin.
  function defaultPeriodForNow(): string {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes() >= 870 ? 'apres_midi' : 'matin'
  }

  let date = $state('')
  let period = $state<string>('matin')
  let eventLabel = $state('')
  // Choix dans le Select : id d'un type, `TYPE_OTHER`, ou '' (rien choisi).
  let eventTypeChoice = $state('')
  let adultsCount = $state<number>(0)
  let childrenCount = $state<number>(0)
  let loansCount = $state<number>(0)
  let returnsCount = $state<number>(0)
  let weather = $state<string | null>(null)
  let temperature = $state<number | null>(null)
  let error = $state('')
  let submitting = $state(false)
  let weatherLoading = $state(false)

  const isEdit = $derived(record != null)
  const isOther = $derived(eventTypeChoice === TYPE_OTHER)
  // Libellé affiché dans le déclencheur du Select.
  const typeTriggerLabel = $derived(
    eventTypeChoice === TYPE_OTHER
      ? 'Autre (préciser)'
      : (eventTypes.find((t) => t.id === eventTypeChoice)?.name ?? 'Choisir un type'),
  )

  // Pré-remplissage météo via l'endpoint serveur (jamais bloquant), pour un créneau.
  function loadWeather(d: string, p: string) {
    if (!d) return
    weatherLoading = true
    fetch(`/${slug}/frequentation/weather?date=${d}&period=${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((w) => {
        // Ignore si la date/période a changé entre-temps ou si rien n'est revenu.
        if (w && date === d && period === p) {
          weather = w.condition
          temperature = w.temperature
        }
      })
      .catch(() => {
        /* on laisse les champs en l'état */
      })
      .finally(() => {
        weatherLoading = false
      })
  }

  // Garde anti re-fetch : clé (date|période) déjà initialisée/chargée.
  let loadedKey = ''
  let opened = false

  // (Ré)initialise les champs à chaque ouverture, selon création ou édition.
  $effect(() => {
    if (!open) {
      opened = false
      return
    }
    if (opened) return
    opened = true
    if (record) {
      date = record.date
      period = record.period
      eventLabel = record.eventLabel ?? ''
      // Type connu et toujours actif → on le présélectionne ; sinon « Autre »
      // (le libellé snapshot reste affiché via la saisie libre).
      eventTypeChoice =
        record.eventTypeId && eventTypes.some((t) => t.id === record.eventTypeId)
          ? record.eventTypeId
          : record.eventLabel
            ? TYPE_OTHER
            : ''
      adultsCount = record.adultsCount
      childrenCount = record.childrenCount
      loansCount = record.loansCount
      returnsCount = record.returnsCount
      weather = record.weather
      temperature = record.temperature
      loadedKey = `${record.date}|${record.period}` // pas de re-fetch sur une séance existante
    } else {
      date = todayLocal()
      period = defaultPeriodForNow()
      eventLabel = ''
      // Sans aucun type défini, on bascule directement sur la saisie libre.
      eventTypeChoice = eventTypes.length > 0 ? '' : TYPE_OTHER
      adultsCount = 0
      childrenCount = 0
      loansCount = 0
      returnsCount = 0
      weather = null
      temperature = null
      loadedKey = `${date}|${period}`
      loadWeather(date, period) // pré-remplissage du jour, à chaque ouverture
    }
    error = ''
  })

  // Re-fetch la météo quand l'utilisateur change la date ou la période (pas à l'init).
  $effect(() => {
    const key = `${date}|${period}`
    if (!open || !opened) return
    if (date && key !== loadedKey) {
      loadedKey = key
      loadWeather(date, period)
    }
  })
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{isEdit ? "Corriger l'ouverture" : 'Clôturer une ouverture'}</Dialog.Title>
      <Dialog.Description>
        Date, période, compteurs et météo. La météo est pré-remplie et reste corrigible.
      </Dialog.Description>
    </Dialog.Header>

    <form
      method="POST"
      action={isEdit ? '?/update' : '?/record'}
      use:enhance={toastEnhance({
        success: isEdit ? 'Fréquentation mise à jour.' : 'Ouverture clôturée.',
        errorMode: 'inline',
        onPending: (p) => (submitting = p),
        onError: (m) => (error = m),
        onSuccess: () => (open = false),
      })}
    >
      {#if isEdit && record}
        <input type="hidden" name="id" value={record.id} />
      {/if}

      {#if isEdit}
        <div class="field">
          <Label for="freq-date">Date</Label>
          <DatePicker id="freq-date" name="date" bind:value={date} />
        </div>
      {:else}
        <p class="today-label">Aujourd'hui · {formatDayMonth(date)}</p>
        <input type="hidden" name="date" value={date} />
      {/if}

      <div class="field">
        <Label for="freq-period">Période</Label>
        <Select.Root type="single" name="period" bind:value={period}>
          <Select.Trigger id="freq-period">{periodLabels[period]}</Select.Trigger>
          <Select.Content>
            <Select.Item value="matin" label="Matin" />
            <Select.Item value="apres_midi" label="Après-midi" />
            <Select.Item value="evenement" label="Événement" />
          </Select.Content>
        </Select.Root>
      </div>

      {#if period === 'evenement'}
        <div class="field">
          <Label for="freq-type">Type d'événement</Label>
          <Select.Root type="single" bind:value={eventTypeChoice}>
            <Select.Trigger id="freq-type">{typeTriggerLabel}</Select.Trigger>
            <Select.Content>
              {#each eventTypes as type (type.id)}
                <Select.Item value={type.id} label={type.name} />
              {/each}
              <Select.Item value={TYPE_OTHER} label="Autre (préciser)" />
            </Select.Content>
          </Select.Root>
          <!-- Le type connu est résolu côté serveur (snapshot du nom) ; pour
               « Autre » on transmet la saisie libre. -->
          <input type="hidden" name="eventTypeId" value={isOther ? '' : eventTypeChoice} />
        </div>

        {#if isOther}
          <div class="field">
            <Label for="freq-label">Libellé de l'événement</Label>
            <Input
              id="freq-label"
              name="eventLabel"
              bind:value={eventLabel}
              placeholder="ex. Soirée jeux, Accueil parascolaire…"
            />
          </div>
        {:else}
          <input type="hidden" name="eventLabel" value="" />
        {/if}
      {/if}

      <div class="counters">
        <Stepper id="freq-adults" name="adultsCount" label="Adultes" bind:value={adultsCount} />
        <Stepper
          id="freq-children"
          name="childrenCount"
          label="Enfants"
          bind:value={childrenCount}
        />
        <Stepper id="freq-loans" name="loansCount" label="Prêts" bind:value={loansCount} />
        <Stepper id="freq-returns" name="returnsCount" label="Retours" bind:value={returnsCount} />
      </div>

      <WeatherPicker bind:weather bind:temperature />
      {#if weatherLoading}
        <p class="weather-loading" aria-live="polite">Météo en cours…</p>
      {/if}

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}>Annuler</Button>
        <Button type="submit" disabled={submitting}>
          {#if submitting}
            Enregistrement…
          {:else}
            {isEdit ? 'Enregistrer' : "Clôturer l'ouverture"}
          {/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .today-label {
    margin: 0;
    font-weight: var(--weight-semibold);
    color: var(--text-main);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  /* Compteurs en grille 2×2 à toutes les tailles (minmax 0 = colonnes
     rétrécissables) pour limiter la hauteur du modal sur petit écran / zoom. */
  .counters {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--space-4);
  }
  .weather-loading {
    margin: 0;
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  .error {
    margin: 0;
    font-size: var(--text-small);
    color: var(--danger);
  }
</style>
