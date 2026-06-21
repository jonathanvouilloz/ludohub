<script lang="ts">
  import { tick } from 'svelte'
  import { enhance } from '$app/forms'
  import { toastEnhance } from '$lib/utils/enhance'
  import { toast } from '$lib/components/ui/sonner/index.js'
  import * as Select from '$lib/components/ui/select/index.js'
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js'
  import { Button, buttonVariants } from '$lib/components/ui/button/index.js'
  import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
  import CalendarOffIcon from '@lucide/svelte/icons/calendar-off'
  import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw'
  import { formatDayWeekday, formatMonthYear, isGenevaHoliday } from '$lib/utils/dates.js'
  import type {
    AbsenceRow,
    AssignmentRow,
    ClosurePeriodRow,
    MemberRow,
    SaturdaySlotRow,
  } from '$lib/server/schema'

  type AssignmentWithMember = AssignmentRow & { member: MemberRow; absence?: AbsenceRow | null }
  type SlotWithAssignments = SaturdaySlotRow & {
    closure?: ClosurePeriodRow | null
    assignments: AssignmentWithMember[]
  }

  let {
    slots,
    members = [],
    today = '',
    readOnly = false,
    currentMemberId = '',
    canSwapOwn = false,
    showStats = false,
  }: {
    slots: SlotWithAssignments[]
    members?: MemberRow[]
    today?: string
    readOnly?: boolean
    /** Membre courant : restreint la source d'échange à ses propres samedis. */
    currentMemberId?: string
    /** Membre simple : lecture seule, mais peut échanger SON samedi. */
    canSwapOwn?: boolean
    /** Affiche le panneau « samedis par personne » (éditeur de saison). */
    showStats?: boolean
  } = $props()

  // Échange possible si édition complète (responsable) OU échange perso (membre).
  const canSwap = $derived(!readOnly || canSwapOwn)

  // Sentinelle « retirer » dans le Select d'une cellule occupée.
  const REMOVE = '__remove__'
  // Nombre de couleurs de surbrillance distinctes (cycle au-delà).
  const PALETTE = 6

  // Nombre de colonnes membre = max sur tous les samedis de (effectif requis,
  // assignations déjà posées). Les colonnes sont de simples places à remplir :
  // la cellule i affiche `slot.assignments[i]` (pas d'index de colonne en DB).
  const columnCount = $derived(
    slots.length === 0
      ? 1
      : Math.max(1, ...slots.map((s) => Math.max(s.requiredCount, s.assignments.length))),
  )
  const columns = $derived(Array.from({ length: columnCount }, (_, i) => i))

  // Surbrillance multi-membres (état client, pas un filtre) : chaque membre
  // sélectionné prend une couleur de la palette selon son index.
  let highlightMemberIds = $state<string[]>([])
  const highlightLabel = $derived(
    highlightMemberIds.length === 0
      ? 'Surligner des membres'
      : `${highlightMemberIds.length} surligné·e·s`,
  )
  const hlColor = (memberId: string) => {
    const i = highlightMemberIds.indexOf(memberId)
    return i === -1 ? 0 : (i % PALETTE) + 1
  }
  const highlightStyle = (memberId: string, swapSrc: boolean) => {
    if (swapSrc) return ''
    const n = hlColor(memberId)
    return n === 0
      ? ''
      : `background: var(--hl-${n}); box-shadow: inset 2px 0 0 var(--hl-bar-${n});`
  }
  function removeHighlight(id: string) {
    highlightMemberIds = highlightMemberIds.filter((x) => x !== id)
  }
  function toggleStatHighlight(id: string) {
    highlightMemberIds = highlightMemberIds.includes(id)
      ? highlightMemberIds.filter((x) => x !== id)
      : [...highlightMemberIds, id]
  }

  // ─── Stats « samedis par personne » (panneau éditeur) ───────────────────────
  // Compte les assignations sur les samedis réellement travaillés (hors annulés
  // et fermetures). Inclut les membres à 0 pour repérer les oublis.
  let statsOpen = $state(true)
  const statRows = $derived.by(() => {
    const count = new Map<string, number>()
    for (const s of slots) {
      if (s.isCancelled || s.closure) continue
      for (const a of s.assignments) count.set(a.member.id, (count.get(a.member.id) ?? 0) + 1)
    }
    return members
      .map((m) => ({ id: m.id, name: m.name, n: count.get(m.id) ?? 0 }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
  })
  const statMax = $derived(Math.max(1, ...statRows.map((r) => r.n)))
  const statAvg = $derived(
    statRows.length ? Math.round(statRows.reduce((t, r) => t + r.n, 0) / statRows.length) : 0,
  )
  const statMin = $derived(statRows.length ? statRows[statRows.length - 1].n : 0)

  // Mode échange : clic membre A → clic membre B (autre samedi) → confirmation → échange.
  type SwapEnd = { slotId: string; memberId: string; name: string; date: string }
  let swapMode = $state(false)
  let swapSource = $state<SwapEnd | null>(null)
  // Échange en attente de confirmation (alimente le modal récapitulatif).
  let pendingSwap = $state<{ a: SwapEnd; b: SwapEnd } | null>(null)

  // Repli des mois. Tous les mois passés sont regroupés derrière un seul toggle
  // « N samedis passés » (sinon les en-têtes de mois passés s'accumulent au fil
  // de l'année). Une fois ce bloc déplié, chaque mois passé s'affiche ouvert.
  let monthOverride = $state<Record<string, boolean>>({})
  const monthOpen = (key: string) => (key in monthOverride ? monthOverride[key] : true)
  function toggleMonth(key: string) {
    monthOverride = { ...monthOverride, [key]: !monthOpen(key) }
  }
  let showPast = $state(false)

  function groupByMonth(list: SlotWithAssignments[]) {
    const groups: { key: string; label: string; past: boolean; slots: SlotWithAssignments[] }[] = []
    for (const s of list) {
      const key = s.date.slice(0, 7)
      const last = groups[groups.length - 1]
      if (last && last.key === key) last.slots.push(s)
      else groups.push({ key, label: formatMonthYear(s.date), past: false, slots: [s] })
    }
    // Un mois est « passé » si son dernier samedi est antérieur à aujourd'hui.
    for (const g of groups) g.past = !!today && g.slots[g.slots.length - 1].date < today
    return groups
  }
  const monthGroups = $derived(groupByMonth(slots))
  const pastGroups = $derived(monthGroups.filter((g) => g.past))
  const futureGroups = $derived(monthGroups.filter((g) => !g.past))
  const pastSlotCount = $derived(pastGroups.reduce((n, g) => n + g.slots.length, 0))

  const freeMembers = (slot: SlotWithAssignments) =>
    members.filter((m) => !slot.assignments.some((a) => a.member.id === m.id))
  const isPastSlot = (slot: SlotWithAssignments) => !!today && slot.date < today

  // ─── Soumissions (formulaires cachés pilotés par état + tick) ───────────────
  let fSlotId = $state('')
  let fMemberId = $state('')
  let fNewMemberId = $state('')
  let fSlotAId = $state('')
  let fMemberAId = $state('')
  let fSlotBId = $state('')
  let fMemberBId = $state('')

  let assignFormEl = $state<HTMLFormElement>()
  let setFormEl = $state<HTMLFormElement>()
  let removeFormEl = $state<HTMLFormElement>()
  let swapFormEl = $state<HTMLFormElement>()

  async function doAssign(slotId: string, memberId: string) {
    fSlotId = slotId
    fMemberId = memberId
    await tick()
    assignFormEl?.requestSubmit()
  }
  async function doSet(slotId: string, oldMemberId: string, newMemberId: string) {
    fSlotId = slotId
    fMemberId = oldMemberId
    fNewMemberId = newMemberId
    await tick()
    setFormEl?.requestSubmit()
  }
  async function doRemove(slotId: string, memberId: string) {
    fSlotId = slotId
    fMemberId = memberId
    await tick()
    removeFormEl?.requestSubmit()
  }
  async function doSwap(
    a: { slotId: string; memberId: string },
    b: { slotId: string; memberId: string },
  ) {
    fSlotAId = a.slotId
    fMemberAId = a.memberId
    fSlotBId = b.slotId
    fMemberBId = b.memberId
    await tick()
    swapFormEl?.requestSubmit()
  }

  function onCellChange(slot: SlotWithAssignments, a: AssignmentWithMember, v: string) {
    if (!v || v === a.member.id) return
    if (v === REMOVE) doRemove(slot.id, a.member.id)
    else doSet(slot.id, a.member.id, v)
  }
  function onEmptyChange(slot: SlotWithAssignments, v: string) {
    if (v && v !== REMOVE) doAssign(slot.id, v)
  }

  function cellSwapClick(slot: SlotWithAssignments, a: AssignmentWithMember) {
    if (!swapSource) {
      // Membre simple : il ne peut prendre comme source que son propre samedi.
      if (readOnly && canSwapOwn && a.member.id !== currentMemberId) {
        toast.error('Vous ne pouvez échanger que votre propre samedi.')
        return
      }
      swapSource = {
        slotId: slot.id,
        memberId: a.member.id,
        name: a.member.name,
        date: slot.date,
      }
      return
    }
    // Re-clic sur la source → désélection.
    if (swapSource.slotId === slot.id && swapSource.memberId === a.member.id) {
      swapSource = null
      return
    }
    if (swapSource.slotId === slot.id) {
      toast.error('Choisis un membre d’un autre samedi.')
      return
    }
    // Cible valide → on demande confirmation au lieu d'échanger directement.
    pendingSwap = {
      a: swapSource,
      b: { slotId: slot.id, memberId: a.member.id, name: a.member.name, date: slot.date },
    }
    swapSource = null
  }

  function confirmSwap() {
    if (!pendingSwap) return
    const { a, b } = pendingSwap
    pendingSwap = null
    doSwap({ slotId: a.slotId, memberId: a.memberId }, { slotId: b.slotId, memberId: b.memberId })
  }

  function toggleSwapMode() {
    swapMode = !swapMode
    swapSource = null
  }

  const isSwapSrc = (slotId: string, memberId: string) =>
    swapSource?.slotId === slotId && swapSource?.memberId === memberId

  // Cellule non sélectionnable en mode échange : préviendrait un doublon (même
  // personne deux fois le même samedi) ou n'est pas un samedi/source autorisé.
  function swapDisabled(slot: SlotWithAssignments, a: AssignmentWithMember | undefined): boolean {
    if (!a) return true
    if (!swapSource) {
      // Pas encore de source : membre = seulement la sienne ; responsable = toutes.
      return readOnly && canSwapOwn ? a.member.id !== currentMemberId : false
    }
    if (isSwapSrc(slot.id, a.member.id)) return false // la source (re-clic = annuler)
    if (slot.id === swapSource.slotId) return true // même samedi
    const srcAlreadyHere = slot.assignments.some((x) => x.member.id === swapSource!.memberId)
    const targetOnSrcSlot = slots
      .find((s) => s.id === swapSource!.slotId)
      ?.assignments.some((x) => x.member.id === a.member.id)
    return srcAlreadyHere || !!targetOnSrcSlot
  }
</script>

<!-- Contrôle d'une place membre, partagé desktop (cellule) et mobile (chip). -->
{#snippet memberControl(
  slot: SlotWithAssignments,
  a: AssignmentWithMember | undefined,
  i: number,
  rowRO: boolean,
)}
  {#key a?.id ?? `empty-${i}`}
    {#if swapMode}
      {#if a && !isPastSlot(slot)}
        <button
          type="button"
          class="cell-btn"
          class:swap-disabled={swapDisabled(slot, a)}
          disabled={swapDisabled(slot, a)}
          onclick={() => cellSwapClick(slot, a)}
        >
          {a.member.name}
        </button>
      {:else if a}
        <span class="name">{a.member.name}</span>
      {:else}
        <span class="empty">—</span>
      {/if}
    {:else if rowRO}
      {#if a}<span class="name">{a.member.name}</span>{:else}<span class="empty">—</span>{/if}
    {:else if a}
      <Select.Root
        type="single"
        value={a.member.id}
        onValueChange={(v) => onCellChange(slot, a, v)}
      >
        <Select.Trigger class="cell-trigger">{a.member.name}</Select.Trigger>
        <Select.Content class="scroll-cap">
          <Select.Item value={a.member.id} label={a.member.name} />
          {#each freeMembers(slot) as m (m.id)}
            <Select.Item value={m.id} label={m.name} />
          {/each}
          <Select.Item value={REMOVE} label="— Retirer —" />
        </Select.Content>
      </Select.Root>
    {:else}
      <Select.Root type="single" value="" onValueChange={(v) => onEmptyChange(slot, v)}>
        <Select.Trigger class="cell-trigger empty">+ Assigner</Select.Trigger>
        <Select.Content class="scroll-cap">
          {#each freeMembers(slot) as m (m.id)}
            <Select.Item value={m.id} label={m.name} />
          {/each}
        </Select.Content>
      </Select.Root>
    {/if}
  {/key}
{/snippet}

<!-- Bouton icône Fermer / Rouvrir un samedi, partagé desktop et mobile. -->
{#snippet slotActions(slot: SlotWithAssignments, rowRO: boolean)}
  {#if !rowRO && !slot.closure}
    {#if slot.isCancelled}
      <form method="POST" action="?/reopenSlot" use:enhance={toastEnhance({ success: null })}>
        <input type="hidden" name="slotId" value={slot.id} />
        <Button type="submit" variant="ghost" size="icon-sm" title="Rouvrir ce samedi">
          <RotateCcwIcon aria-hidden="true" />
          <span class="sr-only">Rouvrir</span>
        </Button>
      </form>
    {:else}
      <form
        method="POST"
        action="?/cancelSlot"
        use:enhance={toastEnhance({ success: 'Samedi fermé.' })}
      >
        <input type="hidden" name="slotId" value={slot.id} />
        <Button type="submit" variant="ghost" size="icon-sm" title="Fermer ce samedi">
          <CalendarOffIcon aria-hidden="true" />
          <span class="sr-only">Fermer</span>
        </Button>
      </form>
    {/if}
  {/if}
{/snippet}

<!-- Un mois (en-tête repliable + lignes), version tableau desktop. -->
{#snippet desktopGroup(group: { key: string; label: string; slots: SlotWithAssignments[] })}
  {@const open = monthOpen(group.key)}
  <tr class="month-row">
    <td colspan={columnCount + 1}>
      <button type="button" class="month-toggle" onclick={() => toggleMonth(group.key)}>
        <span class="chevron">{open ? '▾' : '▸'}</span>
        {group.label}
        <span class="month-count">
          {group.slots.length} samedi{group.slots.length > 1 ? 's' : ''}
        </span>
      </button>
    </td>
  </tr>
  {#if open}
    {#each group.slots as slot (slot.id)}
      {@const holiday = isGenevaHoliday(slot.date)}
      {@const filled = slot.assignments.filter((a) => !a.absence).length}
      {@const understaffed = !slot.isCancelled && !slot.closure && filled < slot.requiredCount}
      {@const rowRO = readOnly || isPastSlot(slot)}
      <tr
        class:row-closure={!!slot.closure}
        class:row-cancelled={slot.isCancelled}
        class:row-past={isPastSlot(slot)}
      >
        <td class="date-col date">
          <div class="date-top">
            <span class="date-label">{formatDayWeekday(slot.date)}</span>
            {#if slot.closure}
              <span class="tag">{slot.closure.label}</span>
            {:else if holiday}
              <span class="tag">Férié</span>
            {/if}
          </div>
          <div class="date-bottom">
            {#if !slot.closure && !slot.isCancelled}
              <span class="count" class:warn={understaffed}>
                {filled}/{slot.requiredCount}
              </span>
            {/if}
            {@render slotActions(slot, rowRO)}
          </div>
        </td>

        {#if slot.closure}
          <td class="span-cell" colspan={columnCount}>Fermé — {slot.closure.label}</td>
        {:else if slot.isCancelled}
          <td class="span-cell" colspan={columnCount}>Samedi fermé pour tout le monde</td>
        {:else}
          {#each columns as i (i)}
            {@const a = slot.assignments[i]}
            {@const srcSel = !!a && isSwapSrc(slot.id, a.member.id)}
            <td
              class="cell"
              class:absent={a?.absence}
              class:swap-src={srcSel}
              style={a ? highlightStyle(a.member.id, srcSel) : ''}
            >
              {@render memberControl(slot, a, i, rowRO)}
              {#if a?.absence}<span class="absence-tag">Absent</span>{/if}
            </td>
          {/each}
        {/if}
      </tr>
    {/each}
  {/if}
{/snippet}

<!-- Un mois (en-tête repliable + cartes), version liste mobile. -->
{#snippet mobileGroup(group: { key: string; label: string; slots: SlotWithAssignments[] })}
  {@const open = monthOpen(group.key)}
  <button type="button" class="m-month" onclick={() => toggleMonth(group.key)}>
    <span class="chevron">{open ? '▾' : '▸'}</span>
    {group.label}
    <span class="month-count">
      {group.slots.length} samedi{group.slots.length > 1 ? 's' : ''}
    </span>
  </button>
  {#if open}
    {#each group.slots as slot (slot.id)}
      {@const holiday = isGenevaHoliday(slot.date)}
      {@const filled = slot.assignments.filter((a) => !a.absence).length}
      {@const understaffed = !slot.isCancelled && !slot.closure && filled < slot.requiredCount}
      {@const rowRO = readOnly || isPastSlot(slot)}
      <div
        class="m-card"
        class:m-closure={!!slot.closure}
        class:m-cancelled={slot.isCancelled}
        class:m-past={isPastSlot(slot)}
      >
        <div class="m-head">
          <strong class="m-date">{formatDayWeekday(slot.date)}</strong>
          <div class="m-tags">
            {#if slot.closure}
              <span class="tag">{slot.closure.label}</span>
            {:else if holiday}
              <span class="tag">Férié</span>
            {/if}
            {#if slot.isCancelled}<span class="tag cancel">Annulé</span>{/if}
            {#if !slot.closure && !slot.isCancelled}
              <span class="count" class:warn={understaffed}>{filled}/{slot.requiredCount}</span>
            {/if}
          </div>
          {@render slotActions(slot, rowRO)}
        </div>

        {#if slot.closure}
          <p class="m-span">Fermé — {slot.closure.label}</p>
        {:else if slot.isCancelled}
          <p class="m-span">Samedi fermé pour tout le monde</p>
        {:else}
          <div class="m-members">
            {#each columns as i (i)}
              {@const a = slot.assignments[i]}
              {@const srcSel = !!a && isSwapSrc(slot.id, a.member.id)}
              <span
                class="m-chip"
                class:absent={a?.absence}
                class:swap-src={srcSel}
                style={a ? highlightStyle(a.member.id, srcSel) : ''}
              >
                {@render memberControl(slot, a, i, rowRO)}
                {#if a?.absence}<span class="absence-tag">Absent</span>{/if}
              </span>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
{/snippet}

<div class="toolbar">
  <Select.Root type="multiple" bind:value={highlightMemberIds}>
    <Select.Trigger class="filter">{highlightLabel}</Select.Trigger>
    <Select.Content class="scroll-cap">
      {#each members as m (m.id)}
        <Select.Item value={m.id} label={m.name} />
      {/each}
    </Select.Content>
  </Select.Root>

  {#if canSwap}
    <Button variant={swapMode ? 'default' : 'outline'} size="sm" onclick={toggleSwapMode}>
      {#if swapMode}
        ✕ Quitter l’échange
      {:else}
        <ArrowLeftRightIcon aria-hidden="true" /> Échanger
      {/if}
    </Button>
  {/if}
</div>

{#if showStats && members.length > 0}
  <section class="stats">
    <button type="button" class="stats-toggle" onclick={() => (statsOpen = !statsOpen)}>
      <span class="chevron">{statsOpen ? '▾' : '▸'}</span>
      Statistiques — samedis par personne
      <span class="stats-meta">moy. {statAvg} · min {statMin} · max {statMax}</span>
    </button>
    {#if statsOpen}
      <ul class="stats-body">
        {#each statRows as r (r.id)}
          {@const on = highlightMemberIds.includes(r.id)}
          <li>
            <button
              type="button"
              class="stat-row"
              class:on
              onclick={() => toggleStatHighlight(r.id)}
            >
              <span class="stat-name">{r.name}</span>
              <span class="stat-bar">
                <span
                  class="stat-fill"
                  style="width: {(r.n / statMax) * 100}%; background: {on
                    ? `var(--hl-bar-${hlColor(r.id)})`
                    : 'var(--primary)'};"
                ></span>
              </span>
              <span class="stat-n">{r.n}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

{#if highlightMemberIds.length > 0}
  <div class="legend">
    {#each highlightMemberIds as id (id)}
      {@const m = members.find((x) => x.id === id)}
      {#if m}
        <span class="legend-chip">
          <span class="swatch" style="background: var(--hl-bar-{hlColor(id)});"></span>
          {m.name}
          <button
            type="button"
            class="legend-remove"
            aria-label="Retirer {m.name} de la surbrillance"
            onclick={() => removeHighlight(id)}>×</button
          >
        </span>
      {/if}
    {/each}
  </div>
{/if}

{#if swapMode}
  <p class="swap-hint">
    {swapSource
      ? `${swapSource.name} sélectionné·e — clique un membre d’un autre samedi, ou re-clique ${swapSource.name} pour annuler.`
      : 'Clique un membre, puis un membre d’un autre samedi pour les échanger. Re-clique « Quitter l’échange » pour sortir.'}
  </p>
{/if}

{#if slots.length === 0}
  <p class="muted">Aucun samedi dans cette saison.</p>
{:else}
  <!-- ─── Desktop : tableau dense ───────────────────────────────────────── -->
  <div class="pt-desktop">
    <div class="table-surface">
      <div class="table-scroll">
        <table>
          <tbody>
            {#if pastGroups.length > 0}
              <tr class="month-row">
                <td colspan={columnCount + 1}>
                  <button type="button" class="month-toggle" onclick={() => (showPast = !showPast)}>
                    <span class="chevron">{showPast ? '▾' : '▸'}</span>
                    {pastSlotCount} samedi{pastSlotCount > 1 ? 's' : ''} passé{pastSlotCount > 1
                      ? 's'
                      : ''}
                  </button>
                </td>
              </tr>
              {#if showPast}
                {#each pastGroups as group (group.key)}
                  {@render desktopGroup(group)}
                {/each}
              {/if}
            {/if}
            {#each futureGroups as group (group.key)}
              {@render desktopGroup(group)}
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ─── Mobile : liste de cartes blanches ─────────────────────────────── -->
  <div class="pt-mobile">
    {#if pastGroups.length > 0}
      <button type="button" class="m-month" onclick={() => (showPast = !showPast)}>
        <span class="chevron">{showPast ? '▾' : '▸'}</span>
        {pastSlotCount} samedi{pastSlotCount > 1 ? 's' : ''} passé{pastSlotCount > 1 ? 's' : ''}
      </button>
      {#if showPast}
        {#each pastGroups as group (group.key)}
          {@render mobileGroup(group)}
        {/each}
      {/if}
    {/if}
    {#each futureGroups as group (group.key)}
      {@render mobileGroup(group)}
    {/each}
  </div>
{/if}

{#if !readOnly}
  <!-- Formulaires cachés pilotés par les handlers de cellule (assign / set / remove / swap). -->
  <form
    bind:this={assignFormEl}
    method="POST"
    action="?/assign"
    use:enhance={toastEnhance({ success: null })}
    hidden
  >
    <input type="hidden" name="slotId" value={fSlotId} />
    <input type="hidden" name="memberId" value={fMemberId} />
  </form>
  <form
    bind:this={setFormEl}
    method="POST"
    action="?/setMember"
    use:enhance={toastEnhance({ success: null })}
    hidden
  >
    <input type="hidden" name="slotId" value={fSlotId} />
    <input type="hidden" name="memberId" value={fMemberId} />
    <input type="hidden" name="newMemberId" value={fNewMemberId} />
  </form>
  <form
    bind:this={removeFormEl}
    method="POST"
    action="?/remove"
    use:enhance={toastEnhance({ success: null })}
    hidden
  >
    <input type="hidden" name="slotId" value={fSlotId} />
    <input type="hidden" name="memberId" value={fMemberId} />
  </form>
{/if}

{#if canSwap}
  <form
    bind:this={swapFormEl}
    method="POST"
    action="?/swap"
    use:enhance={toastEnhance({ success: 'Échange effectué.' })}
    hidden
  >
    <input type="hidden" name="slotAId" value={fSlotAId} />
    <input type="hidden" name="memberAId" value={fMemberAId} />
    <input type="hidden" name="slotBId" value={fSlotBId} />
    <input type="hidden" name="memberBId" value={fMemberBId} />
  </form>

  <!-- Confirmation de l'échange (résumé avant soumission). -->
  <AlertDialog.Root
    open={pendingSwap !== null}
    onOpenChange={(o) => {
      if (!o) pendingSwap = null
    }}
  >
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Confirmer l’échange</AlertDialog.Title>
        <AlertDialog.Description>
          {#if pendingSwap}
            Échanger ces deux samedis :
          {/if}
        </AlertDialog.Description>
      </AlertDialog.Header>
      {#if pendingSwap}
        <div class="swap-summary">
          <div class="swap-row">
            <strong>{pendingSwap.a.name}</strong>
            <span class="swap-when">{formatDayWeekday(pendingSwap.a.date)}</span>
          </div>
          <ArrowLeftRightIcon class="swap-icon" aria-hidden="true" />
          <div class="swap-row">
            <strong>{pendingSwap.b.name}</strong>
            <span class="swap-when">{formatDayWeekday(pendingSwap.b.date)}</span>
          </div>
        </div>
      {/if}
      <AlertDialog.Footer>
        <AlertDialog.Cancel type="button">Annuler</AlertDialog.Cancel>
        <button type="button" class={buttonVariants({ variant: 'default' })} onclick={confirmSwap}>
          Échanger
        </button>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}

<style>
  .toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .legend-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    background: var(--bg-sidebar);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    font-size: var(--text-small);
    color: var(--text-main);
  }
  .swatch {
    width: 12px;
    height: 12px;
    border-radius: var(--radius-pill);
    flex-shrink: 0;
  }
  .legend-remove {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: var(--text-body);
    line-height: 1;
    padding: 0;
  }
  .legend-remove:hover {
    color: var(--danger);
  }
  .swap-hint {
    margin: 0 0 var(--space-3);
    font-size: var(--text-small);
    color: var(--text-muted);
  }
  .muted {
    color: var(--text-muted);
  }

  /* ─── Panneau stats « samedis par personne » ────────────────────────────── */
  .stats {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    margin-bottom: var(--space-4);
    overflow: hidden;
  }
  .stats-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    border: none;
    background: var(--bg-sidebar);
    cursor: pointer;
    padding: var(--space-2) var(--space-3);
    text-align: left;
    color: var(--text-main);
    font-family: inherit;
    font-size: var(--text-small);
    font-weight: var(--weight-semibold);
  }
  .stats-toggle:hover {
    color: var(--text-main);
    background: var(--bg-hover);
  }
  .stats-meta {
    margin-left: auto;
    font-weight: var(--weight-normal);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .stats-body {
    list-style: none;
    margin: 0;
    padding: var(--space-2) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .stat-row {
    display: grid;
    grid-template-columns: minmax(6rem, 9rem) 1fr 2rem;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    font-size: var(--text-small);
    color: var(--text-main);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    text-align: left;
  }
  .stat-row:hover {
    background: var(--bg-hover);
  }
  .stat-row.on {
    background: var(--bg-sidebar);
    font-weight: var(--weight-semibold);
  }
  .stat-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stat-bar {
    height: 0.5rem;
    background: var(--bg-sidebar);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }
  .stat-fill {
    display: block;
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width var(--dur-fast) var(--ease-out-strong);
  }
  .stat-n {
    text-align: right;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .stat-row.on .stat-n {
    color: var(--text-main);
  }

  /* Bascule des deux layouts (comme DataTable : seuil 640px). */
  .pt-mobile {
    display: none;
  }
  @media (max-width: 639px) {
    .pt-desktop {
      display: none;
    }
    .pt-mobile {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
  }

  /* ─── Desktop : surface + tableau ───────────────────────────────────── */
  .table-surface {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }
  .table-scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-small);
  }
  td {
    text-align: left;
    padding: var(--space-2) var(--space-3);
    white-space: nowrap;
  }
  tbody tr {
    border-bottom: 1px solid var(--border);
  }
  tbody tr:last-child {
    border-bottom: 0;
  }

  /* Colonne Date figée à gauche pendant le scroll horizontal. */
  .date-col {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--bg-card);
  }
  .date {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .date-top {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .date-bottom {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 1.75rem;
  }
  .date-label {
    color: var(--text-main);
    font-weight: var(--weight-semibold);
    font-size: var(--text-body);
    text-transform: capitalize;
  }
  .count {
    font-size: var(--text-label);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .count.warn {
    color: var(--warning);
    font-weight: var(--weight-bold);
  }
  .tag {
    font-size: var(--text-label);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--warning);
    background: var(--warning-light);
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
  }
  .tag.cancel {
    color: var(--danger);
    background: var(--danger-light);
  }

  /* En-tête de mois (repliable) — desktop et mobile partagent ces sous-classes. */
  .month-row td {
    background: var(--bg-sidebar);
    padding: 0;
  }
  .month-toggle,
  .m-month {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    border: none;
    background: var(--bg-sidebar);
    cursor: pointer;
    padding: var(--space-2) var(--space-3);
    text-align: left;
    color: var(--text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    font-family: inherit;
    border-radius: var(--radius-sm);
  }
  .month-toggle:hover,
  .m-month:hover {
    color: var(--text-main);
  }
  .chevron {
    color: var(--text-muted);
  }
  .month-count {
    text-transform: none;
    letter-spacing: normal;
    font-weight: var(--weight-normal);
    color: var(--text-muted);
  }

  /* Lignes spéciales : fonds différenciés. */
  .row-closure {
    background: var(--warning-light);
  }
  .row-closure .date-col {
    background: var(--warning-light);
  }
  .row-cancelled {
    background: var(--bg-sidebar);
    color: var(--text-muted);
  }
  .row-cancelled .date-col {
    background: var(--bg-sidebar);
  }
  .row-cancelled .date-label {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  .row-past {
    opacity: 0.55;
  }
  .span-cell {
    color: var(--text-muted);
    font-style: italic;
  }

  /* Cellules membre. */
  .cell {
    vertical-align: middle;
  }
  .cell.swap-src,
  .m-chip.swap-src {
    background: var(--warning-light);
    box-shadow: inset 0 0 0 2px var(--warning);
  }
  .cell.absent .name,
  .cell.absent :global(.cell-trigger),
  .m-chip.absent .name,
  .m-chip.absent :global(.cell-trigger) {
    text-decoration: line-through;
    opacity: 0.7;
  }
  .name {
    color: var(--text-main);
  }
  .empty {
    color: var(--text-muted);
  }
  .cell-btn {
    width: 100%;
    text-align: left;
    border: 1px solid var(--border);
    background: var(--bg-card);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    cursor: pointer;
    color: var(--text-main);
    font-size: var(--text-small);
  }
  .cell-btn:hover {
    background: var(--bg-hover);
  }
  .cell-btn.swap-disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .cell-btn.swap-disabled:hover {
    background: var(--bg-card);
  }

  /* Récapitulatif d'échange dans le modal de confirmation. */
  .swap-summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: var(--space-3) 0;
  }
  .swap-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    text-align: center;
    color: var(--text-main);
  }
  .swap-when {
    font-size: var(--text-small);
    color: var(--text-muted);
    text-transform: capitalize;
  }
  :global(.swap-icon) {
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .absence-tag {
    margin-left: var(--space-1);
    font-size: var(--text-label);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--danger);
    background: var(--danger-light);
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
  }

  /* ─── Mobile : cartes blanches par samedi ───────────────────────────── */
  .m-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .m-card.m-closure {
    background: var(--warning-light);
  }
  .m-card.m-cancelled .m-date {
    text-decoration: line-through;
    color: var(--text-muted);
  }
  .m-card.m-past {
    opacity: 0.6;
  }
  .m-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .m-date {
    font-size: var(--text-h3);
    color: var(--text-main);
    text-transform: capitalize;
  }
  .m-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-right: auto;
  }
  .m-span {
    margin: 0;
    color: var(--text-muted);
    font-style: italic;
    font-size: var(--text-small);
  }
  .m-members {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .m-chip {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-left: var(--space-2);
    border-radius: var(--radius-sm);
  }

  /* Triggers de Select compacts dans les cellules. */
  :global(.cell-trigger) {
    width: 100%;
    min-width: 7rem;
    height: auto;
    min-height: 2rem;
  }
  :global(.cell-trigger.empty) {
    color: var(--text-muted);
  }
  /* Hauteur max + scroll pour les longues listes de membres. */
  :global(.scroll-cap) {
    max-height: 18rem;
  }
</style>
