<script setup lang="ts">
import type { Army, ArmyVersion } from '~/types/database'

type RecentVersion = ArmyVersion & { armies: Army }

const { data: recentVersions } = await useFetch<RecentVersion[]>('/api/armies/recent')
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative h-[75vh] overflow-hidden">
      <!-- Background image -->
      <div class="absolute inset-0">
        <img
          src="/images/hero-bg.jpg"
          alt=""
          class="h-full w-full object-cover"
        >
        <!-- Dark overlay -->
        <div class="absolute inset-0 bg-gradient-to-r from-surface/90 via-surface/60 to-transparent" />
        <div class="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-surface/40" />
      </div>

      <!-- Particles -->
      <div class="absolute inset-0 z-[5]">
        <EmberParticles />
      </div>

      <!-- Content panel - left side -->
      <div class="relative z-10 flex h-[75vh] items-center px-6 md:px-16 lg:px-24">
        <div class="max-w-2xl lg:max-w-3xl xl:max-w-4xl">
          <h1 class="hero-title text-5xl font-bold md:text-7xl lg:text-8xl">
            Epic<br>Armageddon
          </h1>

          <div class="my-8 h-1 w-96 rounded-full bg-gradient-to-r from-gold to-transparent" />

          <!-- Text panel -->
          <div class="relative -ml-6 border border-l-0 border-gold/20 bg-surface/15 p-6 pl-12 backdrop-blur-xl md:-ml-16 md:p-8 md:pl-20 lg:-ml-24 lg:pl-28">
            <p class="mb-4 text-sm font-semibold uppercase tracking-widest text-gold/80">
              Bienvenue sur le site officiel d'EA-FR
            </p>
            <div class="space-y-4 text-sm leading-relaxed text-gray-300 md:text-base">
              <p>
                En 2003, Games Workshop sortait Epic Armageddon, la 4ème version du système Epic en 6mm. Ce jeu de bataille à grande échelle permet aux joueurs d'aligner de formidables armées alliant infanterie, chars, aviation et même les terribles Titans.
              </p>
              <p>
                Bien que le jeu ne soit plus officiellement soutenu par Games Workshop depuis 2011, la communauté internationale – dont la communauté francophone – reste très active et continue de faire vivre le jeu au travers de l'organisation de tournois, l'accueil et l'initiation de nouveaux joueurs grâce à Discord, de mise à jour et création de listes ainsi que de clarification des règles.
              </p>
              <p>
                Par ailleurs plusieurs fabricants de proxies en 6mm comme <a href="https://vanguardminiatures.co.uk/" target="_blank" rel="noopener" class="text-gold hover:text-gold-light underline underline-offset-2">Vanguard Miniatures</a> ou encore <a href="https://www.onslaughtmini.com/" target="_blank" rel="noopener" class="text-gold hover:text-gold-light underline underline-offset-2">Onslaught Miniatures</a> se sont lancés dans l'aventure du 6mm afin de combler les modèles désormais OOP. Les avancées de l'impression 3D permettent aujourd'hui de réaliser des armées toujours plus belles et précises pour un moindre coût !
              </p>
              <p>
                Vous trouverez sur ce site tout le matériel de jeu nécessaire pour vous lancer dans l'aventure d'Epic Armageddon.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom fade -->
      <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-surface to-transparent" />
    </section>

    <!-- Nouveautés -->
    <section v-if="recentVersions?.length" class="mx-auto max-w-6xl px-4 py-20">
      <h2 class="text-3xl font-bold md:text-4xl">Nouveautés</h2>
      <p class="mt-2 text-gray-400">Les dernières mises à jour de codex</p>
      <div class="mt-3 h-1 w-64 rounded-full bg-gradient-to-r from-gold to-transparent" />

      <div class="mt-10 grid gap-6 md:grid-cols-3">
        <NuxtLink
          v-for="rv in recentVersions"
          :key="rv.id"
          :to="`/armees/${rv.armies.faction}/${rv.armies.id}`"
          class="group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:border-gold/20 hover:bg-white/[0.07]"
        >
          <!-- Icon + faction badge -->
          <div class="flex items-center gap-4 border-b border-white/5 p-5">
            <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
              <div
                v-if="rv.armies.cover_image"
                class="recent-icon h-9 w-9"
                :style="{ '--icon-url': `url(${rv.armies.cover_image})` }"
              />
              <span v-else class="font-heading text-xl text-gold/30">{{ rv.armies.name[0] }}</span>
            </div>
            <div>
              <p class="font-semibold text-gray-200 transition-colors group-hover:text-gold">
                {{ rv.armies.name }}
              </p>
              <p class="text-xs capitalize text-gray-500">{{ rv.armies.faction }}</p>
            </div>
          </div>

          <!-- Version info -->
          <div class="p-5">
            <div class="flex items-center gap-3">
              <span class="rounded bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold">
                REV {{ rv.version }}
              </span>
              <span class="text-xs text-gray-500">
                {{ new Date(rv.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }}
              </span>
            </div>
            <p v-if="rv.changelog" class="mt-3 text-sm text-gray-400">{{ rv.changelog }}</p>

            <div class="mt-4 flex items-center gap-2 text-sm text-gold opacity-0 transition-opacity group-hover:opacity-100">
              <span>Voir le codex</span>
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.recent-icon {
  background-color: rgba(255, 255, 255, 0.8);
  mask-image: var(--icon-url);
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-image: var(--icon-url);
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
}

.group:hover .recent-icon {
  background-color: #c8a052;
}

.hero-title {
  text-shadow:
    0 0 20px rgba(200, 160, 82, 0.5),
    0 0 60px rgba(200, 160, 82, 0.2),
    0 0 100px rgba(200, 160, 82, 0.1);
}

</style>
