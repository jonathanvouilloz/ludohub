<script lang="ts">
  import { Calendar, Popover } from 'bits-ui'
  import CalendarIcon from '@lucide/svelte/icons/calendar'
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import {
    DateFormatter,
    type DateValue,
    getLocalTimeZone,
    parseDate,
  } from '@internationalized/date'
  import { buttonVariants } from '$lib/components/ui/button/index.js'
  import { cn } from '$lib/utils/cn.js'

  let {
    value = $bindable(''),
    name,
    id,
    placeholder = 'Choisir une date',
    minValue,
  }: {
    value?: string
    name?: string
    id?: string
    placeholder?: string
    minValue?: string
  } = $props()

  const df = new DateFormatter('fr-CH', { dateStyle: 'long' })

  // `value` = string `YYYY-MM-DD` soumise dans le formulaire ; `dv` = représentation
  // calendrier interne (DateValue) pilotée par le Calendar.
  let dv = $state<DateValue | undefined>(value ? parseDate(value) : undefined)
  let open = $state(false)

  // Borne minimale (ex. date de début pour un picker « fin de plage »).
  const minDv = $derived(minValue ? parseDate(minValue) : undefined)

  // Mois affiché par le calendrier quand aucune valeur n'est encore choisie.
  // Initialisé via l'effet ci-dessous ; quand `dv` est posé, Calendar suit son mois.
  let calPlaceholder = $state<DateValue | undefined>(undefined)

  $effect(() => {
    value = dv ? dv.toString() : ''
  })

  // Quand la borne min change et qu'aucune valeur n'est posée, ouvrir sur ce mois.
  $effect(() => {
    if (minDv && !dv) calPlaceholder = minDv
  })

  // Si la valeur devient antérieure à la borne min → on l'efface (cohérence form).
  $effect(() => {
    if (minDv && dv && dv.compare(minDv) < 0) dv = undefined
  })
</script>

<input type="hidden" {name} {value} />
<Popover.Root bind:open>
  <Popover.Trigger
    {id}
    class={cn(
      buttonVariants({ variant: 'outline' }),
      'w-full justify-start gap-2 font-normal',
      !dv && 'text-muted-foreground',
    )}
  >
    <CalendarIcon class="size-4" />
    {dv ? df.format(dv.toDate(getLocalTimeZone())) : placeholder}
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      sideOffset={4}
      class="bg-popover text-popover-foreground ring-foreground/10 z-50 rounded-md p-3 shadow-md ring-1"
    >
      <Calendar.Root
        type="single"
        bind:value={dv}
        bind:placeholder={calPlaceholder}
        minValue={minDv}
        weekdayFormat="short"
        locale="fr-CH"
        onValueChange={() => (open = false)}
        class="select-none"
      >
        {#snippet children({ months, weekdays })}
          <div class="mb-2 flex items-center justify-between">
            <Calendar.PrevButton
              class={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'size-7')}
            >
              <ChevronLeftIcon class="size-4" />
            </Calendar.PrevButton>
            <Calendar.Heading class="text-sm font-medium capitalize" />
            <Calendar.NextButton
              class={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'size-7')}
            >
              <ChevronRightIcon class="size-4" />
            </Calendar.NextButton>
          </div>

          {#each months as month (month.value)}
            <Calendar.Grid class="w-full border-collapse">
              <Calendar.GridHead>
                <Calendar.GridRow class="flex">
                  {#each weekdays as day (day)}
                    <Calendar.HeadCell
                      class="text-muted-foreground w-9 text-center text-xs font-normal capitalize"
                    >
                      {day.slice(0, 2)}
                    </Calendar.HeadCell>
                  {/each}
                </Calendar.GridRow>
              </Calendar.GridHead>
              <Calendar.GridBody>
                {#each month.weeks as weekDates (weekDates)}
                  <Calendar.GridRow class="mt-1 flex w-full">
                    {#each weekDates as date (date)}
                      <Calendar.Cell {date} month={month.value} class="p-0 text-center">
                        <Calendar.Day
                          class={cn(
                            buttonVariants({ variant: 'ghost' }),
                            'size-9 rounded-md border-transparent p-0 text-sm font-normal',
                            'data-today:bg-accent data-today:text-accent-foreground',
                            'data-selected:bg-primary data-selected:text-primary-foreground data-selected:hover:bg-primary data-selected:hover:text-primary-foreground',
                            'data-outside-month:text-muted-foreground/40 data-outside-month:pointer-events-none',
                            'data-disabled:text-muted-foreground/40 data-disabled:pointer-events-none',
                          )}
                        />
                      </Calendar.Cell>
                    {/each}
                  </Calendar.GridRow>
                {/each}
              </Calendar.GridBody>
            </Calendar.Grid>
          {/each}
        {/snippet}
      </Calendar.Root>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
