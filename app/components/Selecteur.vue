<script setup lang="ts">
/**
 * Liste déroulante maison.
 *
 * Le `<select>` natif ouvre un menu dessiné par le système : fond clair, police
 * de l'OS, aucune prise sur le doré du reste du builder. Ce composant réimplémente
 * le strict nécessaire (clavier, clic extérieur, valeur sélectionnée) pour que le
 * menu ouvert ressemble aux cartes autour de lui.
 */
export type OptionSelecteur = {
  valeur: string
  libelle: string
  /** ce qui s'affiche à droite, en retrait : un coût, une durée… */
  detail?: string
  /** seconde ligne, en petit : stats de l'unité, composition de la formation… */
  stats?: string
  /** infobulle de l'option */
  titre?: string
}

const props = withDefaults(defineProps<{
  options: OptionSelecteur[]
  /** libellé quand rien n'est sélectionné ; reste affiché pour un menu d'action */
  placeholder?: string
  /** occupe toute la largeur disponible */
  bloc?: boolean
  /** menu d'action : ne retient pas le choix, le placeholder reste affiché */
  action?: boolean
  /** ce que le déclencheur affiche tout à droite, à la place du détail de l'option choisie */
  detailActuel?: string
}>(), { placeholder: 'Choisir…', bloc: false, action: false })

const emit = defineEmits<{ choisir: [valeur: string] }>()
/** absent pour un menu d'action : le composant n'affiche alors que le placeholder */
const valeur = defineModel<string | undefined>()

const ouvert = ref(false)
const survol = ref(-1)
const racine = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)

const choisie = computed(() => (props.action ? undefined : props.options.find((o) => o.valeur === valeur.value)))
const libelle = computed(() => choisie.value?.libelle ?? props.placeholder)

function ouvrir() {
  ouvert.value = true
  survol.value = props.action ? 0 : Math.max(0, props.options.findIndex((o) => o.valeur === valeur.value))
  nextTick(() => defiler())
}
function fermer() {
  ouvert.value = false
  survol.value = -1
}
function basculer() { ouvert.value ? fermer() : ouvrir() }

function selectionner(o: OptionSelecteur) {
  if (!props.action) valeur.value = o.valeur
  emit('choisir', o.valeur)
  fermer()
}

/** garde l'option survolée au clavier dans la zone visible du menu */
function defiler() {
  const el = menu.value?.children[survol.value] as HTMLElement | undefined
  el?.scrollIntoView({ block: 'nearest' })
}
function deplacer(pas: number) {
  if (!ouvert.value) return ouvrir()
  const n = props.options.length
  if (!n) return
  survol.value = (survol.value + pas + n) % n
  nextTick(() => defiler())
}
function auClavier(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); deplacer(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); deplacer(-1) }
  else if (e.key === 'Escape') { if (ouvert.value) { e.preventDefault(); fermer() } }
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (!ouvert.value) return ouvrir()
    const o = props.options[survol.value]
    if (o) selectionner(o)
  }
  else if (e.key === 'Tab') fermer()
}

function auClicDehors(e: MouseEvent) {
  if (ouvert.value && racine.value && !racine.value.contains(e.target as Node)) fermer()
}
onMounted(() => document.addEventListener('mousedown', auClicDehors))
onBeforeUnmount(() => document.removeEventListener('mousedown', auClicDehors))
</script>

<template>
  <div ref="racine" class="relative min-w-0" :class="bloc ? 'w-full' : 'inline-block'">
    <button
      type="button"
      class="declencheur"
      :class="ouvert ? 'border-gold ring-1 ring-gold/30' : ''"
      :aria-expanded="ouvert"
      aria-haspopup="listbox"
      @click="basculer"
      @keydown="auClavier"
    >
      <span class="min-w-0 truncate" :class="choisie ? 'text-stone-100' : 'text-stone-400'">{{ libelle }}</span>
      <span v-if="detailActuel ?? choisie?.detail" class="ml-auto shrink-0 text-xs text-gold/80">{{ detailActuel ?? choisie?.detail }}</span>
      <span class="shrink-0 text-[10px] text-gold/70 transition-transform" :class="ouvert ? 'rotate-180' : ''">▾</span>
    </button>

    <Transition name="menu">
      <ul v-if="ouvert" ref="menu" class="menu" role="listbox">
        <li
          v-for="(o, i) in options"
          :key="o.valeur"
          role="option"
          :aria-selected="o.valeur === choisie?.valeur"
          :title="o.titre"
          class="option"
          :class="[i === survol ? 'bg-gold/15' : '', o.valeur === choisie?.valeur ? 'text-gold-light' : 'text-stone-200']"
          @mouseenter="survol = i"
          @click="selectionner(o)"
        >
          <span class="w-3 shrink-0 text-gold">{{ o.valeur === choisie?.valeur ? '✓' : '' }}</span>
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline gap-2">
              <span class="flex-1">{{ o.libelle }}</span>
              <span v-if="o.detail" class="shrink-0 text-xs text-stone-400">{{ o.detail }}</span>
            </span>
            <span v-if="o.stats && o.stats !== o.libelle" class="mt-0.5 block text-[11px] leading-tight text-stone-500">{{ o.stats }}</span>
          </span>
        </li>
        <li v-if="!options.length" class="px-3 py-2 text-xs text-stone-500">Aucun choix disponible.</li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.declencheur {
  @apply flex w-full min-w-0 items-center gap-2 rounded border border-white/15 bg-surface px-2 py-1 text-left
         text-sm text-stone-100 transition-colors hover:border-gold/40 focus:border-gold focus:outline-none;
}
.menu {
  @apply absolute left-0 z-30 mt-1 max-h-72 w-max min-w-full max-w-[min(22rem,80vw)] overflow-y-auto
         overflow-x-hidden rounded-md border border-gold/25 bg-surface-lighter py-1 shadow-xl shadow-black/60;
}
.option {
  @apply flex cursor-pointer items-start gap-2 px-3 py-1.5 text-sm leading-snug;
}
.menu::-webkit-scrollbar { width: 6px; }
.menu::-webkit-scrollbar-thumb { background: rgb(var(--c-gold) / 0.35); border-radius: 3px; }
.menu-enter-active, .menu-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
