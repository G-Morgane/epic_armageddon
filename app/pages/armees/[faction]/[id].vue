<script setup lang="ts">
import type { Army, ArmyVersion } from '~/types/database'

type ArmyWithVersions = Army & { army_versions: ArmyVersion[] }

const route = useRoute()
const id = route.params.id as string

const { data: army, status } = await useFetch<ArmyWithVersions>(`/api/armies/${id}`)

const currentVersion = computed(() =>
  army.value?.army_versions?.find(v => v.is_current),
)

const olderVersions = computed(() =>
  army.value?.army_versions?.filter(v => !v.is_current) ?? [],
)

useSeoMeta({
  title: () => army.value?.name ?? 'Armée',
  description: () => army.value ? `Codex ${army.value.name} — Téléchargez le PDF (REV ${currentVersion.value?.version ?? '?'}). Liste d'armée Epic Armageddon.` : '',
  ogTitle: () => army.value ? `${army.value.name} — Epic Armageddon FR` : 'Armée',
  ogDescription: () => army.value?.quote ?? `Codex ${army.value?.name} pour Epic Armageddon.`,
  ogUrl: () => `https://www.epicarmageddon.fr/armees/${army.value?.faction}/${army.value?.id}`,
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
    <!-- Loading -->
    <div v-if="status === 'pending'" class="text-center text-gray-400">
      Chargement...
    </div>

    <template v-else-if="army">
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

        <div class="flex-1">
          <span
            class="inline-block rounded-full border px-3 py-0.5 text-xs font-semibold uppercase tracking-wider"
            :class="factionBadgeColors[army.faction]"
          >
            {{ army.faction }}
          </span>
          <h1 class="mt-2 text-3xl font-bold sm:text-4xl md:text-5xl">{{ army.name }}</h1>
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

      <!-- Current version - download card -->
      <div v-if="currentVersion" class="mt-12">
        <h2 class="text-2xl font-bold">Version actuelle</h2>
        <div class="mt-4 overflow-hidden rounded-lg border border-gold/20 bg-surface-light">
          <div class="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-gold/10">
                <svg class="h-6 w-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p class="font-semibold text-gray-200">
                  Codex {{ army.name }}
                </p>
                <div class="mt-1 flex items-center gap-3 text-sm text-gray-400">
                  <span class="rounded bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold">
                    REV {{ currentVersion.version }}
                  </span>
                  <span>
                    Publié le {{ new Date(currentVersion.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }}
                  </span>
                </div>
                <p v-if="currentVersion.changelog" class="mt-2 text-sm text-gray-500">
                  {{ currentVersion.changelog }}
                </p>
              </div>
            </div>
            <a
              :href="currentVersion.pdf_url"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-2 rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-surface transition-colors hover:bg-gold-light"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Télécharger le PDF
            </a>
          </div>
        </div>
      </div>

      <!-- Older versions -->
      <div v-if="olderVersions.length" class="mt-12">
        <h2 class="text-2xl font-bold">Versions précédentes</h2>
        <p class="mt-2 text-sm text-gray-500">
          Les anciennes versions sont conservées à titre d'archive.
        </p>
        <div class="mt-4 divide-y divide-gold/10 rounded-lg border border-gold/10 bg-surface-light/30">
          <div
            v-for="version in olderVersions"
            :key="version.id"
            class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="flex items-center gap-3">
              <svg class="h-5 w-5 shrink-0 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <div>
                <div class="flex items-center gap-3">
                  <span class="rounded bg-surface-lighter px-2 py-0.5 text-xs text-gray-400">
                    REV {{ version.version }}
                  </span>
                  <span class="text-sm text-gray-500">
                    {{ new Date(version.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }}
                  </span>
                </div>
                <p v-if="version.changelog" class="mt-1 text-sm text-gray-500">
                  {{ version.changelog }}
                </p>
              </div>
            </div>
            <a
              :href="version.pdf_url"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-2 text-sm text-gold hover:text-gold-light"
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
    </template>
  </div>
</template>
