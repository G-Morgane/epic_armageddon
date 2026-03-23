<script setup lang="ts">
const communities = [
  {
    name: 'Discord',
    description: 'Le cœur de la communauté EA-FR. Discutez stratégie, trouvez des adversaires, suivez les mises à jour des codex et participez aux événements.',
    url: 'https://discord.com/invite/3ukn8Cumc5',
    color: 'indigo',
    icon: 'discord',
  },
  {
    name: 'Facebook — Groupe',
    description: 'Le groupe Facebook de la communauté francophone. Partagez vos parties, vos peintures et retrouvez les annonces.',
    url: 'https://www.facebook.com/groups/1448912561955629',
    color: 'blue',
    icon: 'facebook',
  },
  {
    name: 'Facebook — Page officielle',
    description: 'La page officielle Epic Armageddon.fr pour suivre l\'actualité de la communauté.',
    url: 'https://www.facebook.com/EpicArmageddon.Fr/',
    color: 'blue',
    icon: 'facebook',
  },
  {
    name: 'Forum',
    description: 'Le forum historique de la communauté EA-FR. Archives de discussions, rapports de bataille et ressources.',
    url: 'https://epic-fr.niceboard.com/',
    color: 'amber',
    icon: 'forum',
  },
]
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0 bg-gradient-to-t from-yellow-900/15 via-surface to-surface" />
    <div class="absolute inset-0" style="background: radial-gradient(ellipse at top left, rgba(200,160,82,0.08) 0%, transparent 60%)" />
    <EmberParticles />

    <div class="relative z-10">
      <!-- Header -->
      <div class="mx-auto max-w-6xl px-4 pb-16 pt-20">
        <nav class="mb-8 text-sm text-gray-500">
          <NuxtLink to="/" class="hover:text-gold">Accueil</NuxtLink>
          <span class="mx-2">/</span>
          <span class="text-gray-300">Communauté</span>
        </nav>

        <h1 class="text-4xl font-bold md:text-6xl">Communauté</h1>
        <div class="mt-4 h-1 w-96 rounded-full bg-gradient-to-r from-gold to-transparent" />

        <div class="mt-8 max-w-3xl space-y-4 text-base leading-relaxed text-gray-400">
          <p>
            La communauté francophone d'Epic Armageddon est particulièrement active et accueillante. Que vous soyez un vétéran ou un nouveau joueur, vous trouverez toujours quelqu'un pour vous aider à vous lancer ou organiser une partie.
          </p>
          <p>
            Trouvez des joueurs et commencez à jouer !
          </p>
        </div>
      </div>

      <!-- Community links -->
      <div class="mx-auto max-w-6xl px-4 pb-20">
        <div class="grid gap-6 md:grid-cols-2">
          <a
            v-for="community in communities"
            :key="community.name"
            :href="community.url"
            target="_blank"
            rel="noopener"
            class="group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.04] backdrop-blur-sm transition-all hover:border-gold/20 hover:bg-white/[0.07]"
          >
            <div class="flex items-start gap-5 p-6">
              <!-- Icon -->
              <div
                :class="[
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
                  community.color === 'indigo' && 'bg-indigo-500/10 group-hover:bg-indigo-500/20',
                  community.color === 'blue' && 'bg-blue-500/10 group-hover:bg-blue-500/20',
                  community.color === 'amber' && 'bg-amber-500/10 group-hover:bg-amber-500/20',
                ]"
              >
                <!-- Discord -->
                <svg v-if="community.icon === 'discord'" class="h-7 w-7 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                <!-- Facebook -->
                <svg v-if="community.icon === 'facebook'" class="h-7 w-7 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <!-- Forum -->
                <svg v-if="community.icon === 'forum'" class="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                </svg>
              </div>

              <!-- Content -->
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-100 transition-colors group-hover:text-gold">
                  {{ community.name }}
                </h3>
                <p class="mt-2 text-sm leading-relaxed text-gray-400">
                  {{ community.description }}
                </p>
                <div class="mt-4 flex items-center gap-2 text-sm text-gold opacity-0 transition-opacity group-hover:opacity-100">
                  Rejoindre
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </div>
              </div>
            </div>
          </a>
        </div>

        <!-- Map -->
        <div class="mt-16">
          <h2 class="text-2xl font-bold md:text-3xl">Carte des joueurs</h2>
          <p class="mt-2 text-sm text-gray-400">Retrouvez les joueurs Epic Armageddon près de chez vous.</p>
          <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

          <div class="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <iframe
              src="https://umap.openstreetmap.fr/fr/map/zygo67_563297?scaleControl=false&miniMap=false&scrollWheelZoom=true&zoomControl=true&editMode=disabled&moreControl=false&searchControl=false&tilelayersControl=false&embedControl=false&datalayersControl=false&onLoadPanel=none&captionBar=false#6/46.973/3.186"
              class="h-[500px] w-full"
              frameborder="0"
              allowfullscreen
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
