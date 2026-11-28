<script setup lang="ts">
/**
 * Signalement de bug depuis le builder.
 *
 * Modale pilotée par son `v-model`, comme les autres tiroirs du builder : le
 * déclencheur vit dans le menu d'actions de la page, pas ici. Ce qui compte
 * pour l'admin, c'est que le message arrive accompagné de l'armée, de
 * l'endroit et de la liste au moment du signalement, sans que l'auteur ait à
 * le décrire.
 *
 * Ouvert aux visiteurs : le builder s'utilise sans compte, et un bug rencontré
 * sans session est un bug quand même.
 */
import type { Liste } from '~~/shared/codex/liste'

const props = withDefaults(defineProps<{
  /** écran d'où part le signalement */
  page?: string
  codexSlug?: string
  codexNom?: string
  codexVersion?: string
  faction?: string
  /** liste en cours : copie jointe au signalement, c'est elle qui permet de reproduire */
  liste?: Liste | null
  total?: number | null
  limite?: number | null
  valide?: boolean | null
  /** erreurs de validation affichées au moment du signalement */
  erreurs?: string[]
  /** identifiant serveur de la liste, si elle est enregistrée sur le compte */
  idServeur?: string | null
}>(), { page: 'builder', erreurs: () => [] })

const CATEGORIES = [
  { id: 'points', label: 'Total de points faux' },
  { id: 'formation', label: 'Formation absente ou fausse' },
  { id: 'option', label: 'Option ou amélioration' },
  { id: 'regles', label: "Règle d'armée" },
  { id: 'affichage', label: 'Affichage, ergonomie' },
  { id: 'sauvegarde', label: 'Sauvegarde ou partage' },
  { id: 'pdf', label: 'PDF, impression' },
  { id: 'autre', label: 'Autre' },
]

const EMPLACEMENTS = [
  'Catalogue (colonne de gauche)',
  "Carte d'une formation",
  'Options et améliorations',
  'Totaux et limites',
  'Bilan des erreurs',
  'Sauvegarde, partage, mes listes',
  'PDF, impression',
  'Autre',
]

const utilisateur = useSupabaseUser()
const connecte = computed(() => !!utilisateur.value)

const ouvert = defineModel<boolean>({ default: false })
const envoi = ref(false)
const envoye = ref(false)
const erreur = ref('')

const form = ref({ categorie: 'points', emplacement: '', message: '', email: '' })

/** À chaque ouverture, un formulaire vierge : le précédent envoi n'a plus rien à dire. */
watch(ouvert, (v) => {
  if (!v) return
  form.value = { categorie: 'points', emplacement: '', message: '', email: '' }
  erreur.value = ''
  envoye.value = false
})

function fermer() {
  ouvert.value = false
}

async function envoyer() {
  if (form.value.message.trim().length < 5) {
    erreur.value = 'Décris le problème en quelques mots.'
    return
  }
  envoi.value = true
  erreur.value = ''
  try {
    await $fetch('/api/signalements', {
      method: 'POST',
      body: {
        categorie: form.value.categorie,
        message: form.value.message.trim(),
        emplacement: form.value.emplacement || null,
        email: form.value.email.trim() || null,
        page: props.page,
        url: window.location.href,
        codex: props.codexSlug ?? null,
        codex_nom: props.codexNom ?? null,
        codex_version: props.codexVersion ?? null,
        faction: props.faction ?? null,
        liste_id: props.idServeur ?? null,
        liste_nom: props.liste?.nom ?? null,
        liste_total: props.total ?? null,
        liste_limite: props.limite ?? props.liste?.limite ?? null,
        liste_valide: props.valide ?? null,
        // la copie de la liste part toujours : sans elle un total faux est
        // irreproductible, et la choisir n'était qu'une case de plus à lire
        liste_data: props.liste ?? null,
        liste_erreurs: props.erreurs,
        ecran: `${window.innerWidth}x${window.innerHeight}`,
      },
    })
    envoye.value = true
  } catch (e) {
    erreur.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    envoi.value = false
  }
}

onMounted(() => {
  const echap = (e: KeyboardEvent) => { if (e.key === 'Escape' && ouvert.value) fermer() }
  window.addEventListener('keydown', echap)
  onBeforeUnmount(() => window.removeEventListener('keydown', echap))
})
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="ouvert" class="fixed inset-0 z-[60] bg-black/60" @click="fermer" />
    </Transition>
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 translate-y-2" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="ouvert" class="fixed inset-0 z-[61] flex items-start justify-center overflow-y-auto p-4 sm:items-center" role="dialog" aria-label="Signaler un bug">
        <div class="w-full max-w-xl rounded-lg border border-gold/20 bg-surface shadow-2xl" @click.stop>
          <header class="flex items-center justify-between gap-3 border-b border-gold/10 bg-surface-light px-5 py-3">
            <div class="min-w-0">
              <p class="text-xs uppercase tracking-widest text-gold">Aidez-nous à corriger</p>
              <h2 class="truncate font-heading text-lg font-bold text-white">Signaler un bug</h2>
            </div>
            <button type="button" class="rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white" title="Fermer (Échap)" @click="fermer">✕</button>
          </header>

          <div v-if="envoye" class="px-5 py-8 text-center">
            <p class="font-heading text-lg text-gold">Merci, c'est envoyé.</p>
            <p class="mt-2 text-sm text-stone-400">Le signalement est arrivé avec ton armée et ta liste, on peut reproduire le problème.</p>
            <button type="button" class="mt-5 rounded-md bg-gold px-4 py-1.5 text-sm font-semibold text-surface hover:bg-gold-light" @click="fermer">Fermer</button>
          </div>

          <form v-else class="space-y-4 px-5 py-4" @submit.prevent="envoyer">
            <!-- Ce que l'on joint automatiquement : dit ici pour que personne n'ait à le recopier -->
            <div class="rounded border border-white/10 bg-surface-light px-3 py-2 text-xs text-stone-400">
              <p>
                Joint automatiquement :
                <span v-if="codexNom" class="text-stone-200">{{ codexNom }}<span v-if="codexVersion"> v{{ codexVersion }}</span></span>
                <span v-if="liste" class="text-stone-200"> · liste « {{ liste.nom }} » ({{ total ?? 0 }} pts)</span>
                <span class="text-stone-200"> · la page où tu es</span>
              </p>

              <!--
                Les erreurs en cours partent avec le signalement : autant les
                montrer. Une liste « à corriger » au moment de l'envoi est
                souvent le bug lui-même, et celui qui signale voit alors ce que
                l'admin va lire.
              -->
              <div v-if="erreurs.length" class="mt-2 border-t border-white/10 pt-2">
                <p class="text-red-300">Liste à corriger, {{ erreurs.length }} problème(s) joints :</p>
                <ul class="mt-1 list-inside list-disc space-y-0.5 text-stone-400">
                  <li v-for="(e, i) in erreurs.slice(0, 5)" :key="i">{{ e }}</li>
                  <li v-if="erreurs.length > 5" class="list-none text-stone-500">et {{ erreurs.length - 5 }} autre(s)…</li>
                </ul>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="mb-1 block text-stone-300">Type de problème</span>
                <select v-model="form.categorie" class="champ w-full">
                  <option v-for="c in CATEGORIES" :key="c.id" :value="c.id">{{ c.label }}</option>
                </select>
              </label>
              <label class="block text-sm">
                <span class="mb-1 block text-stone-300">Où, sur la page</span>
                <select v-model="form.emplacement" class="champ w-full">
                  <option value="">Je ne sais pas</option>
                  <option v-for="e in EMPLACEMENTS" :key="e" :value="e">{{ e }}</option>
                </select>
              </label>
            </div>

            <label class="block text-sm">
              <span class="mb-1 block text-stone-300">Que s'est-il passé ?</span>
              <textarea
                v-model="form.message"
                rows="5"
                maxlength="4000"
                class="champ w-full"
                placeholder="Ce que tu attendais, ce que tu as vu, et comment le reproduire."
              />
              <span class="mt-1 block text-right text-xs text-stone-500">{{ form.message.length }} / 4000</span>
            </label>

            <label v-if="!connecte" class="block text-sm">
              <span class="mb-1 block text-stone-300">Ton email (facultatif, pour qu'on puisse te répondre)</span>
              <input v-model="form.email" type="email" class="champ w-full" placeholder="toi@exemple.fr">
            </label>

            <p v-if="erreur" class="rounded border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ erreur }}</p>

            <div class="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button type="button" class="rounded border border-white/15 px-3 py-1.5 text-sm text-stone-300 hover:bg-white/5" @click="fermer">Annuler</button>
              <button
                type="submit"
                class="rounded-md bg-gold px-4 py-1.5 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50"
                :disabled="envoi"
              >
                {{ envoi ? 'Envoi…' : 'Envoyer' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.champ { @apply rounded border border-white/15 bg-surface px-2 py-1.5 text-sm text-stone-100 focus:border-gold focus:outline-none; }
</style>
