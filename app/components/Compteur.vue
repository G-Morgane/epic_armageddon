<script setup lang="ts">
/**
 * Compteur à boutons.
 *
 * Les flèches natives d'un `input[type=number]` font quelques pixels, n'ont
 * aucune cible au doigt, et la molette y change la valeur par accident au
 * moment où l'on fait défiler la liste. Ici deux boutons pleins, et la saisie
 * directe reste possible quand le nombre est grand.
 */
const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  /** `null` : pas de plafond */
  max?: number | null
  /** ce que l'on compte, pour les lecteurs d'écran */
  libelle?: string
}>(), { min: 0, max: null, libelle: '' })

const emit = defineEmits<{ 'update:modelValue': [valeur: number] }>()

const champ = ref<HTMLInputElement | null>(null)
const borner = (n: number) => Math.max(props.min, props.max === null ? n : Math.min(props.max, n))
const auMin = computed(() => props.modelValue <= props.min)
const auMax = computed(() => props.max !== null && props.modelValue >= props.max)

function decaler(pas: number) {
  const n = borner(props.modelValue + pas)
  if (n !== props.modelValue) emit('update:modelValue', n)
}
function saisir(e: Event) {
  emit('update:modelValue', borner(parseInt((e.target as HTMLInputElement).value || '0', 10) || 0))
}
/**
 * Le parent borne parfois plus serré que nous (le reste d'un choix partagé entre
 * plusieurs unités). Sa valeur ne changeant alors pas, le champ garderait la
 * saisie refusée à l'écran : il reprend la valeur retenue quand on le quitte.
 */
function resynchroniser() {
  if (champ.value) champ.value.value = String(props.modelValue)
}
</script>

<template>
  <div class="inline-flex shrink-0 items-stretch overflow-hidden rounded border border-white/15 bg-surface">
    <button type="button" class="pas" :disabled="auMin" :aria-label="`Retirer : ${libelle}`" @click="decaler(-1)">−</button>
    <input
      ref="champ"
      type="text"
      inputmode="numeric"
      class="w-9 border-x border-white/10 bg-transparent text-center text-sm tabular-nums text-stone-100 focus:outline-none"
      :class="modelValue ? '' : 'text-stone-500'"
      :value="modelValue"
      :aria-label="libelle || undefined"
      @input="saisir"
      @blur="resynchroniser"
    >
    <button type="button" class="pas" :disabled="auMax" :aria-label="`Ajouter : ${libelle}`" @click="decaler(1)">+</button>
  </div>
</template>

<style scoped>
.pas { @apply px-2 text-sm leading-none text-stone-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-stone-700 disabled:hover:bg-transparent disabled:hover:text-stone-700; }
</style>
