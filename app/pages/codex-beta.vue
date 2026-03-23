<script setup lang="ts">
import type { Army, ArmyVersion } from '~/types/database'

type ArmyWithVersion = Army & { army_versions: ArmyVersion[] }

const activeTab = ref<'all' | 'beta' | 'experimental'>('all')

const { data: betaArmies } = await useFetch<ArmyWithVersion[]>('/api/armies', {
  query: { status: 'beta' },
})

const { data: experimentalArmies } = await useFetch<ArmyWithVersion[]>('/api/armies', {
  query: { status: 'experimental' },
})

const factionLabels: Record<string, string> = {
  imperium: 'Imperium',
  chaos: 'Chaos',
  xenos: 'Xenos',
}

const factionOrder = ['imperium', 'chaos', 'xenos']

function groupByFaction(armies: ArmyWithVersion[]) {
  const groups: Record<string, ArmyWithVersion[]> = {}
  for (const army of armies) {
    if (!groups[army.faction]) groups[army.faction] = []
    groups[army.faction].push(army)
  }
  return factionOrder
    .filter(f => groups[f]?.length)
    .map(f => ({ faction: f, label: factionLabels[f], armies: groups[f] }))
}

const currentArmies = computed(() => {
  if (activeTab.value === 'beta') return betaArmies.value ?? []
  if (activeTab.value === 'experimental') return experimentalArmies.value ?? []
  return [...(betaArmies.value ?? []), ...(experimentalArmies.value ?? [])]
})
const currentGroups = computed(() => groupByFaction(currentArmies.value))

const tabColor = computed(() =>
  activeTab.value === 'beta' ? 'amber' : 'purple',
)
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0 bg-gradient-to-t from-amber-900/15 via-surface to-surface" />
    <EmberParticles />

    <div class="relative z-10">
      <!-- Header -->
      <div class="mx-auto max-w-6xl px-4 pb-16 pt-20">
        <nav class="mb-8 text-sm text-gray-500">
          <NuxtLink to="/" class="hover:text-gold">Accueil</NuxtLink>
          <span class="mx-2">/</span>
          <span class="text-gray-300">Codex Bêta & Expérimentaux</span>
        </nav>

        <h1 class="text-4xl font-bold md:text-6xl">Codex Bêta & Expérimentaux</h1>
        <div class="mt-4 h-1 w-96 rounded-full bg-gradient-to-r from-gold to-transparent" />

        <div class="mt-8 max-w-3xl space-y-4 text-sm leading-relaxed text-gray-400">
          <p>
            Vous retrouverez ici l'ensemble des livres d'armées en cours de test et ceux proposés par la communauté EA-FR.
          </p>
          <p>
            Les codex <span class="font-semibold text-amber-400">« bêtas »</span> sont le fruit d'une analyse de la part d'un Groupe de travail et ont pour objectif de devenir des livres d'armées validés. Ils sont mis à la disposition de la communauté afin d'avoir des retours de jeu, et ainsi pouvoir consolider leur jouabilité avant d'être proposés au Board pour leur officialisation définitive. Ces codex peuvent être joués en tournois si l'organisateur les y autorise.
          </p>
          <p>
            Les codex <span class="font-semibold text-purple-400">« expérimentaux »</span> sont les codex créés par la communauté et ne sont généralement pas acceptés en tournois. Ils n'ont pas été validés par le Board et leur équilibrage n'est pas assuré.
          </p>
          <p class="rounded-lg border border-gold/15 bg-gold/5 p-3 text-gold/80">
            <strong>Note importante :</strong> ces codex sont à l'état de draft (des coquilles peuvent exister) et sont susceptibles d'évoluer sans préavis en fonction des travaux des GT ou de leur propriétaire. Leur suivi et leur mise à jour se fait prioritairement via notre Discord.
          </p>
          <p>
            Si vous testez un codex « Bêta » ou « Expérimental », n'hésitez pas à nous faire part de vos retours via notre
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSeZWwQAxHoMaXRFeoi56yDNqC9vDaw42JeY9L9QJ_KhEUAZ8g/viewform" target="_blank" rel="noopener" class="text-gold underline underline-offset-2 hover:text-gold-light">formulaire</a>
            ou sur
            <a href="https://discord.com/invite/3ukn8Cumc5" target="_blank" rel="noopener" class="text-gold underline underline-offset-2 hover:text-gold-light">Discord</a>.
          </p>
        </div>

        <!-- Tab switch -->
        <div class="mt-10 inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1 backdrop-blur-sm">
          <button
            :class="[
              'rounded-lg px-6 py-2.5 text-sm font-semibold transition-all',
              activeTab === 'all'
                ? 'bg-gold/15 text-gold shadow-sm'
                : 'text-gray-400 hover:text-gray-200',
            ]"
            @click="activeTab = 'all'"
          >
            Tous
            <span class="ml-2 rounded-full bg-gold/10 px-2 py-0.5 text-xs">
              {{ (betaArmies?.length ?? 0) + (experimentalArmies?.length ?? 0) }}
            </span>
          </button>
          <button
            :class="[
              'rounded-lg px-6 py-2.5 text-sm font-semibold transition-all',
              activeTab === 'beta'
                ? 'bg-amber-500/15 text-amber-400 shadow-sm'
                : 'text-gray-400 hover:text-gray-200',
            ]"
            @click="activeTab = 'beta'"
          >
            Bêta
            <span class="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs">
              {{ betaArmies?.length ?? 0 }}
            </span>
          </button>
          <button
            :class="[
              'rounded-lg px-6 py-2.5 text-sm font-semibold transition-all',
              activeTab === 'experimental'
                ? 'bg-purple-500/15 text-purple-400 shadow-sm'
                : 'text-gray-400 hover:text-gray-200',
            ]"
            @click="activeTab = 'experimental'"
          >
            Expérimentaux
            <span class="ml-2 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs">
              {{ experimentalArmies?.length ?? 0 }}
            </span>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="mx-auto max-w-6xl px-4 pb-20">
        <!-- Description -->
        <p v-if="activeTab === 'all'" class="mb-8 text-sm text-gray-500">
          Toutes les listes en cours de développement.
        </p>
        <p v-else-if="activeTab === 'beta'" class="mb-8 text-sm text-gray-500">
          Listes en phase de test avancée, proches d'une validation officielle.
        </p>
        <p v-else class="mb-8 text-sm text-gray-500">
          Listes créées par la communauté, en phase de test préliminaire.
        </p>

        <!-- Empty -->
        <div v-if="!currentGroups.length" class="py-20 text-center text-gray-500">
          Aucun codex dans cette catégorie.
        </div>

        <!-- Faction groups -->
        <div v-for="group in currentGroups" :key="group.faction" class="mb-10">
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">{{ group.label }}</h3>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a
              v-for="army in group.armies"
              :key="army.id"
              :href="army.army_versions?.[0]?.pdf_url"
              target="_blank"
              rel="noopener"
              :class="[
                'group flex items-center gap-4 rounded-xl border p-4 backdrop-blur-sm transition-all',
                army.status === 'beta'
                  ? 'border-amber-500/10 bg-white/[0.04] hover:border-amber-500/25 hover:bg-white/[0.07]'
                  : 'border-purple-500/10 bg-white/[0.03] hover:border-purple-500/25 hover:bg-white/[0.06]',
              ]"
            >
              <div
                :class="[
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border',
                  army.status === 'beta'
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-purple-500/20 bg-purple-500/5',
                ]"
              >
                <span
                  :class="[
                    'font-heading text-lg',
                    army.status === 'beta' ? 'text-amber-400/50' : 'text-purple-400/50',
                  ]"
                >
                  {{ army.name[0] }}
                </span>
              </div>
              <div>
                <p
                  :class="[
                    'font-semibold text-gray-200 transition-colors',
                    army.status === 'beta' ? 'group-hover:text-amber-400' : 'group-hover:text-purple-400',
                  ]"
                >
                  {{ army.name }}
                </p>
                <p class="text-xs text-gray-500">
                  REV {{ army.army_versions?.[0]?.version }}
                </p>
              </div>
              <svg class="ml-auto h-4 w-4 shrink-0 text-gray-600 transition-colors group-hover:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
