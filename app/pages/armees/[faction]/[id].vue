<script setup lang="ts">
import type { Army, ArmyVersion } from '~/types/database'
import { codexDeArmee, type CodexMeta } from '~/utils/codex-armee'

type ArmyWithVersions = Army & { army_versions: ArmyVersion[] }

const route = useRoute()
const id = route.params.id as string

// Les deux appels ne dépendent que de l'URL : les lancer ensemble plutôt que l'un après l'autre.
// `lazy` : le rendu serveur attend toujours les données (les moteurs voient la
// fiche complète), mais une navigation dans le site n'est plus retenue — on
// arrive sur le squelette de la fiche au lieu de rester sur la page précédente.
const [{ data: army, status }, { data: tousCodex }] = await Promise.all([
  useFetch<ArmyWithVersions>(`/api/armies/${id}`, { lazy: true }),
  useFetch<CodexMeta[]>('/api/codex', { lazy: true }),
])

const currentVersion = computed(() =>
  army.value?.army_versions?.find(v => v.is_current),
)

const codex = computed(() => codexDeArmee(tousCodex.value, id, army.value?.name))
const apercuOuvert = ref(false)

/** Historique des publications du codex : chaque REV se retélécharge. */
type VersionCodex = { version: string; changelog: string; publie: string; pdf_url?: string }
// Le slug n'est connu qu'une fois le catalogue arrivé : `watch` relance l'appel
// quand il l'est, sinon la liste resterait vide sur une navigation interne.
const { data: versionsCodex } = useAsyncData(`codex-versions-${id}`, () => {
  const slug = codex.value?.slug
  return slug ? $fetch<VersionCodex[]>(`/api/codex/${slug}/versions`) : Promise.resolve([] as VersionCodex[])
}, { lazy: true, watch: [() => codex.value?.slug], default: (): VersionCodex[] => [] })
/** PDF figé à la publication, sinon composé à la demande. */
const pdfVersion = (v: VersionCodex) => v.pdf_url ?? `/api/codex/${codex.value?.slug}/pdf?version=${encodeURIComponent(v.version)}`
const dateCourte = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Une seule chronologie : les REV du codex dynamique et les PDF déposés à la main. */
type Ligne = { cle: string; source: 'codex' | 'pdf'; version: string; date: string; changelog?: string | null; href: string }
const lignes = computed<Ligne[]>(() => {
  const out: Ligne[] = versionsCodex.value.map(v => ({ cle: `codex-${v.version}`, source: 'codex' as const, version: v.version, date: v.publie, changelog: v.changelog, href: pdfVersion(v) }))
  for (const v of army.value?.army_versions ?? []) out.push({ cle: `pdf-${v.id}`, source: 'pdf', version: v.version, date: v.published_at, changelog: v.changelog, href: v.pdf_url })
  return out.sort((a, b) => +new Date(b.date) - +new Date(a.date))
})
/** Le codex dynamique fait référence dès qu'il existe, même s'il n'a pas encore de version publiée. */
const derniere = computed<Ligne | undefined>(() => {
  if (!codex.value) return lignes.value[0]
  const publiee = versionsCodex.value[0]
  return { cle: 'codex-courant', source: 'codex', version: codex.value.version, date: publiee?.publie ?? '', changelog: publiee?.changelog, href: `/api/codex/${codex.value.slug}/pdf` }
})
const historique = computed(() => lignes.value.filter(l => !(derniere.value && l.source === derniere.value.source && l.version === derniere.value.version)))

const urlSite = useUrlSite()

useSeoMeta({
  title: () => army.value?.name ?? 'Armée',
  description: () => army.value ? `Codex ${army.value.name} — Téléchargez le PDF (REV ${currentVersion.value?.version ?? '?'}). Liste d'armée Epic Armageddon.` : '',
  ogTitle: () => army.value ? `${army.value.name} — Epic Armageddon FR` : 'Armée',
  ogDescription: () => army.value?.quote ?? `Codex ${army.value?.name} pour Epic Armageddon.`,
  ogUrl: () => urlSite(`/armees/${army.value?.faction}/${army.value?.id}`),
})

const factionLabels: Record<string, string> = {
  imperium: 'Armées de l\'Imperium',
  chaos: 'Armées du Chaos',
  xenos: 'Armées Xenos',
}

const factionColors: Record<string, string> = {
  imperium: 'text-yellow-500',
  chaos: 'text-red-500',
  xenos: 'text-emerald-500',
}

const factionBadgeColors: Record<string, string> = {
  imperium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  chaos: 'bg-red-500/10 text-red-500 border-red-500/20',
  xenos: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 pb-16 pt-20">
    <!-- Chargement : le cadre de la fiche se dessine en gris, pour que le clic
         sur une armée mène tout de suite quelque part. -->
    <div v-if="status === 'pending' || status === 'idle'" class="animate-pulse" aria-label="Chargement de l'armée" aria-busy="true">
      <div class="mb-8 h-4 w-64 rounded bg-white/5" />
      <div class="flex flex-col gap-6 md:flex-row md:items-start">
        <div class="h-20 w-20 shrink-0 rounded-full border border-gold/10 bg-white/5 sm:h-32 sm:w-32" />
        <div class="flex-1">
          <div class="h-5 w-24 rounded-full bg-white/5" />
          <div class="mt-3 h-9 w-72 rounded bg-white/10 md:h-12" />
          <div class="mt-3 h-1 w-40 rounded-full bg-gold/20 sm:w-64" />
          <div class="mt-6 h-4 w-full max-w-xl rounded bg-white/5" />
          <div class="mt-2 h-4 w-3/5 max-w-md rounded bg-white/5" />
        </div>
      </div>
      <div class="mt-12 h-7 w-52 rounded bg-white/10" />
      <div class="mt-4 rounded-lg border border-gold/20 bg-surface-light p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-4">
            <div class="h-12 w-12 shrink-0 rounded-lg bg-gold/10" />
            <div class="space-y-2">
              <div class="h-4 w-48 rounded bg-white/10" />
              <div class="h-3 w-64 rounded bg-white/5" />
            </div>
          </div>
          <div class="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
            <div class="h-11 w-full rounded-lg bg-gold/20 sm:w-56" />
            <div class="h-11 w-full rounded-lg bg-white/5 sm:w-56" />
          </div>
        </div>
      </div>
    </div>

    <template v-else-if="army">
      <!-- Illustration du codex en toile de fond : format fixe, jamais recadrée, fondue par un masque -->
      <div v-if="codex?.illustration" class="pointer-events-none fixed inset-x-0 top-[180px] -z-10 flex justify-center">
        <img
          :src="codex.illustration"
          alt=""
          class="h-[500px] w-[400px] object-contain opacity-35 [-webkit-mask-image:radial-gradient(ellipse_closest-side_at_center,#000_15%,transparent_82%)] [mask-image:radial-gradient(ellipse_closest-side_at_center,#000_15%,transparent_82%)] sm:h-[880px] sm:w-[700px]"
        >
      </div>

      <!-- Breadcrumb -->
      <nav class="mb-8 text-sm text-gray-500">
        <NuxtLink to="/" class="hover:text-gold">Accueil</NuxtLink>
        <span class="mx-2">/</span>
        <NuxtLink :to="`/armees/${army.faction}`" class="hover:text-gold">
          {{ factionLabels[army.faction] }}
        </NuxtLink>
        <span class="mx-2">/</span>
        <span class="text-gray-300">{{ army.name }}</span>
      </nav>

      <!-- Header -->
      <div class="flex flex-col gap-6 md:flex-row md:items-start">
        <!-- Icon -->
        <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-gold/20 bg-surface-light/50 sm:h-32 sm:w-32">
          <img
            v-if="army.cover_image"
            :src="army.cover_image"
            :alt="army.name"
            class="h-12 w-12 object-contain brightness-0 invert sm:h-20 sm:w-20"
          >
          <span v-else class="font-heading text-3xl text-gold/30 sm:text-5xl">{{ army.name[0] }}</span>
        </div>

        <div class="min-w-0 flex-1">
          <span
            class="inline-block rounded-full border px-3 py-0.5 text-xs font-semibold uppercase tracking-wider"
            :class="factionBadgeColors[army.faction]"
          >
            {{ army.faction }}
          </span>
          <div class="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
            <h1 class="text-3xl font-bold break-words sm:text-4xl md:text-5xl">{{ army.name }}</h1>
            <BoutonFavori class="shrink-0" :armee="army" />
          </div>
          <div class="mt-3 h-1 w-40 rounded-full bg-gradient-to-r from-gold to-transparent sm:w-64" />
          <blockquote v-if="army.quote" class="mt-6 border-l-2 border-gold/40 pl-5">
            <p class="text-lg italic leading-relaxed text-gray-300">
              « {{ army.quote }} »
            </p>
            <cite v-if="army.quote_author" class="mt-2 block text-sm font-semibold not-italic text-gold">
              — {{ army.quote_author }}
            </cite>
          </blockquote>
        </div>
      </div>

      <!-- Dernière version -->
      <div v-if="derniere" class="mt-12">
        <h2 class="text-2xl font-bold">Dernière version</h2>
        <div class="mt-4 overflow-hidden rounded-lg border border-gold/30 bg-surface-light">
          <div class="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-4">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gold/10">
                <svg class="h-6 w-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-semibold text-gray-200">Codex {{ army.name }}</p>
                  <span
                    class="rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                    :class="derniere.source === 'codex' ? 'bg-gold/10 text-gold' : 'bg-white/5 text-gray-400'"
                  >{{ derniere.source === 'codex' ? 'Codex dynamique' : 'PDF d\'origine' }}</span>
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-400">
                  <span class="rounded bg-surface-lighter px-2 py-0.5 text-xs">REV {{ derniere.version }}</span>
                  <span v-if="derniere.date">Publié le {{ dateCourte(derniere.date) }}</span>
                  <span v-if="derniere.source === 'codex' && codex">{{ codex.unites }} unités · {{ codex.formations }} formations · {{ codex.options }} options</span>
                </div>
                <p v-if="derniere.changelog" class="mt-2 whitespace-pre-line text-sm text-gray-500">{{ derniere.changelog }}</p>
              </div>
            </div>
            <!-- Les deux boutons l'un sous l'autre, meme largeur, cales a droite.
                 `shrink-0` : sans lui le texte du changelog comprime ce bloc et
                 chaque bouton retombe a la largeur de son libelle. -->
            <div class="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
              <button
                v-if="derniere.source === 'codex'"
                type="button"
                class="inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors sm:w-56 bg-gold text-surface hover:bg-gold-light"
                @click="apercuOuvert = true"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Voir le PDF
              </button>
              <a
                v-else
                :href="derniere.href"
                target="_blank"
                rel="noopener"
                class="inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors sm:w-56 bg-gold text-surface hover:bg-gold-light"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Télécharger le PDF
              </a>
              <NuxtLink
                v-if="codex"
                :to="`/builder/${codex.slug}`"
                class="inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors sm:w-56 border border-gold/40 text-gold hover:bg-gold/10"
              >
                Construire mon armée
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Historique -->
      <div v-if="historique.length" class="mt-10">
        <h2 class="text-2xl font-bold">Historique</h2>
        <p class="mt-2 text-sm text-gray-500">
          Les versions précédentes sont conservées à titre d'archive.
        </p>
        <div class="mt-4 divide-y divide-gold/10 rounded-lg border border-gold/10 bg-surface-light/30">
          <div
            v-for="l in historique"
            :key="l.cle"
            class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-3">
                <span
                  class="rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                  :class="l.source === 'codex' ? 'bg-gold/10 text-gold' : 'bg-white/5 text-gray-400'"
                >{{ l.source === 'codex' ? 'Codex dynamique' : 'PDF d\'origine' }}</span>
                <span class="rounded bg-surface-lighter px-2 py-0.5 text-xs text-gray-400">REV {{ l.version }}</span>
                <span class="text-sm text-gray-500">{{ dateCourte(l.date) }}</span>
              </div>
              <p v-if="l.changelog" class="mt-1 whitespace-pre-line text-sm text-gray-500">{{ l.changelog }}</p>
            </div>
            <a
              :href="l.href"
              target="_blank"
              rel="noopener"
              class="inline-flex shrink-0 items-center gap-2 text-sm text-gold hover:text-gold-light"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Télécharger
            </a>
          </div>
        </div>
      </div>

      <!-- Back link -->
      <div class="mt-12">
        <NuxtLink
          :to="`/armees/${army.faction}`"
          class="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gold"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Retour aux {{ factionLabels[army.faction] }}
        </NuxtLink>
      </div>
      <CodexVisionneusePdf v-if="codex" v-model="apercuOuvert" :slug="codex.slug" :nom="codex.nom" />
    </template>
  </div>
</template>
