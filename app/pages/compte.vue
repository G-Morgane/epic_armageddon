<script setup lang="ts">
/** Compte d'un membre : ses listes d'armée, ses codex favoris, son pseudo et sa déconnexion. */
import type { ResumeListe } from '~/composables/useListes'

definePageMeta({ middleware: 'membre' })

const supabase = useSupabase()
const { user, userId, profile, init, fetchProfile, logout } = useAuth()
const listesApi = useListes()
const { favoris, init: initFavoris, basculer } = useFavoris()

useHead({ title: 'Mon compte' })

await init()

const pseudo = ref(profile.value?.display_name ?? '')
const enregistrement = ref(false)
const message = ref('')
const erreur = ref('')

watch(profile, (p) => { if (p && !pseudo.value) pseudo.value = p.display_name ?? '' })

/** Listes et favoris ne bloquent pas le rendu : la page s'affiche, ils arrivent ensuite. */
const listes = ref<ResumeListe[]>([])
const chargement = ref(true)
const erreurContenu = ref('')
const occupe = ref('')

onMounted(async () => {
  try {
    const [mesListes] = await Promise.all([listesApi.lister(), initFavoris()])
    listes.value = mesListes
  } catch (e) {
    erreurContenu.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    chargement.value = false
  }
})

async function supprimerListe(l: ResumeListe) {
  if (!confirm(`Supprimer « ${l.nom} » ? Cette action est définitive.`)) return
  occupe.value = l.id
  try {
    await listesApi.supprimer(l.id)
    listes.value = listes.value.filter((x) => x.id !== l.id)
  } catch (e) {
    erreurContenu.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    occupe.value = ''
  }
}

async function retirerFavori(f: { army_id: string; nom: string; faction: string }) {
  occupe.value = f.army_id
  try {
    await basculer({ id: f.army_id, name: f.nom, faction: f.faction })
  } catch (e) {
    erreurContenu.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    occupe.value = ''
  }
}

async function enregistrer() {
  erreur.value = ''
  message.value = ''
  const valeur = pseudo.value.trim()
  if (valeur.length < 3) {
    erreur.value = 'Le pseudo fait au moins 3 caractères.'
    return
  }
  enregistrement.value = true
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: valeur })
    .eq('id', userId.value!)
  enregistrement.value = false
  if (error) {
    erreur.value = error.code === '23505' ? 'Ce pseudo est déjà pris.' : 'Enregistrement impossible.'
    return
  }
  await fetchProfile()
  message.value = 'Pseudo enregistré.'
}

const dateCourte = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 pb-20 pt-20">
    <h1 class="font-heading text-3xl font-bold text-gold">Mon compte</h1>
    <p class="mt-2 text-sm text-gray-400">{{ user?.email }}</p>

    <p v-if="erreurContenu" class="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{{ erreurContenu }}</p>

    <!-- Mes listes d'armée -->
    <section class="mt-10">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <h2 class="font-heading text-2xl font-bold text-white">Mes armées</h2>
        <NuxtLink to="/codex-test" class="text-sm text-gray-400 underline hover:text-gold">Construire une nouvelle armée</NuxtLink>
      </div>

      <!-- Squelette : les lignes se dessinent en gris plutot que de laisser un vide. -->
      <ul v-if="chargement" class="mt-4 space-y-2" aria-label="Chargement des listes" aria-busy="true">
        <li v-for="n in 3" :key="n" class="animate-pulse rounded-lg border border-white/10 bg-surface-light p-3">
          <div class="flex flex-wrap items-center gap-3">
            <div class="h-4 w-40 rounded bg-white/10" />
            <div class="h-3 w-16 rounded bg-white/5" />
            <div class="ml-auto h-3 w-28 rounded bg-white/5" />
          </div>
          <div class="mt-3 flex gap-2">
            <div class="h-6 w-16 rounded bg-white/5" />
            <div class="ml-auto h-6 w-20 rounded bg-white/5" />
          </div>
        </li>
      </ul>

      <p v-else-if="!listes.length" class="mt-4 rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-stone-400">
        Aucune liste enregistrée. Les listes construites dans le builder s'enregistrent ici, depuis le tiroir « Mes listes ».
      </p>

      <ul v-else class="mt-4 space-y-2">
        <li v-for="l in listes" :key="l.id" class="rounded-lg border border-white/10 bg-surface-light p-3">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <NuxtLink :to="`/builder/${l.codex}?ouvrir=${l.id}`" class="font-heading text-base font-semibold text-white hover:text-gold">{{ l.nom }}</NuxtLink>
            <span class="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-stone-400">{{ l.codex }}</span>
            <span v-if="l.valide === false" class="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-red-300">à corriger</span>
            <span class="ml-auto text-xs text-stone-500">
              <template v-if="l.total !== null">{{ l.total }} / {{ l.limite }} pts · </template>{{ dateCourte(l.updated_at) }}
            </span>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <NuxtLink :to="`/builder/${l.codex}?ouvrir=${l.id}`" class="rounded border border-white/15 px-2 py-1 text-stone-200 hover:bg-white/5">Ouvrir</NuxtLink>
            <span v-if="l.code_partage" class="truncate font-mono text-[11px] text-stone-500">partagée : /builder/{{ l.codex }}?liste={{ l.code_partage }}</span>
            <button
              type="button"
              class="ml-auto rounded border border-red-400/30 px-2 py-1 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              :disabled="occupe === l.id"
              @click="supprimerListe(l)"
            >
              Supprimer
            </button>
          </div>
        </li>
      </ul>
    </section>

    <!-- Mes codex favoris -->
    <section class="mt-12">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <h2 class="font-heading text-2xl font-bold text-white">Mes codex favoris</h2>
        <NuxtLink to="/armees" class="text-sm text-gray-400 underline hover:text-gold">Parcourir les livres d'armées</NuxtLink>
      </div>

      <ul v-if="chargement" class="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Chargement des favoris" aria-busy="true">
        <li v-for="n in 2" :key="n" class="flex animate-pulse items-center gap-3 rounded-lg border border-white/10 bg-surface-light p-3">
          <div class="h-12 w-12 shrink-0 rounded-full bg-white/10" />
          <div class="min-w-0 flex-1 space-y-2">
            <div class="h-4 w-32 rounded bg-white/10" />
            <div class="h-3 w-20 rounded bg-white/5" />
          </div>
        </li>
      </ul>

      <p v-else-if="!favoris.length" class="mt-4 rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-stone-400">
        Aucun codex en favori. L'étoile « Mettre en favori », sur la fiche d'une armée, les range ici.
      </p>

      <ul v-else class="mt-4 grid gap-3 sm:grid-cols-2">
        <li v-for="f in favoris" :key="f.army_id" class="flex items-center gap-3 rounded-lg border border-white/10 bg-surface-light p-3">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/20 bg-surface/50">
            <img v-if="f.cover_image" :src="f.cover_image" :alt="f.nom" class="h-8 w-8 object-contain brightness-0 invert">
            <span v-else class="font-heading text-xl text-gold/30">{{ f.nom[0] }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <NuxtLink :to="`/armees/${f.faction}/${f.army_id}`" class="block truncate font-heading text-base font-semibold text-white hover:text-gold">{{ f.nom }}</NuxtLink>
            <p class="text-xs uppercase tracking-wider text-stone-500">{{ f.faction }}</p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded border border-white/15 px-2 py-1 text-xs text-stone-300 hover:bg-white/5 disabled:opacity-50"
            :disabled="occupe === f.army_id"
            @click="retirerFavori(f)"
          >
            Retirer
          </button>
        </li>
      </ul>
    </section>

    <!-- Réglages -->
    <section class="mt-12 max-w-md">
      <h2 class="font-heading text-2xl font-bold text-white">Réglages</h2>

      <form class="mt-5 space-y-5" @submit.prevent="enregistrer">
        <div v-if="erreur" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{{ erreur }}</div>
        <div v-if="message" class="rounded-lg border border-gold/20 bg-gold/5 p-3 text-sm text-gold">{{ message }}</div>

        <div>
          <label for="pseudo" class="block text-sm font-medium text-gray-300">Pseudo</label>
          <input
            id="pseudo"
            v-model="pseudo"
            type="text"
            maxlength="32"
            class="mt-1 w-full rounded-lg border border-white/10 bg-surface-light px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
            placeholder="Ton pseudo de joueur"
          >
          <p class="mt-2 text-xs text-gray-500">
            Affiché sur les listes que tu partages. Ton email, lui, n'est jamais visible.
          </p>
        </div>

        <button
          type="submit"
          :disabled="enregistrement"
          class="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {{ enregistrement ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </form>

      <div class="mt-10 border-t border-white/10 pt-6">
        <button class="text-sm text-gray-400 underline hover:text-gold" @click="logout('/')">
          Se déconnecter
        </button>
      </div>
    </section>
  </div>
</template>
