<script setup lang="ts">
const currentYear = new Date().getFullYear()

const footerLinks = [
  {
    title: 'Le Jeu',
    links: [
      { label: 'Règles & FAQ', to: '/regles' },
      { label: 'Armées de l\'Imperium', to: '/armees/imperium' },
      { label: 'Armées du Chaos', to: '/armees/chaos' },
      { label: 'Armées Xenos', to: '/armees/xenos' },
    ],
  },
  {
    title: 'Communauté',
    links: [
      { label: 'Événements', to: '/evenements' },
      { label: 'Communauté', to: '/communaute' },
    ],
  },
]

const socialLinks = [
  { label: 'Discord', href: 'https://discord.com/invite/3ukn8Cumc5', icon: 'discord' },
  { label: 'Facebook', href: 'https://www.facebook.com/groups/1448912561955629', icon: 'facebook' },
]
</script>

<template>
  <footer class="border-t border-gold/10 bg-surface-light">
    <div class="mx-auto max-w-7xl px-4 py-12">
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Brand -->
        <div class="lg:col-span-2">
          <span class="font-heading text-xl font-bold text-gold">Epic Armageddon</span>
          <p class="mt-3 max-w-sm text-sm text-gray-400">
            La communauté francophone dédiée à Epic Armageddon. Règles, listes d'armées, événements et plus encore.
          </p>
          <!-- Social links -->
          <div class="mt-5 flex gap-3">
            <a
              v-for="social in socialLinks"
              :key="social.label"
              :href="social.href"
              :aria-label="social.label"
              class="flex h-10 w-10 items-center justify-center rounded-lg border border-gold/20 text-gray-400 transition-colors hover:border-gold hover:text-gold"
              target="_blank"
              rel="noopener"
            >
              <!-- Discord -->
              <svg v-if="social.icon === 'discord'" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              <!-- Facebook -->
              <svg v-if="social.icon === 'facebook'" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
          </div>
        </div>

        <!-- Link columns -->
        <div v-for="group in footerLinks" :key="group.title">
          <h3 class="text-sm !normal-case !tracking-normal font-semibold text-gold">{{ group.title }}</h3>
          <ul class="mt-4 space-y-3">
            <li v-for="link in group.links" :key="link.label">
              <NuxtLink
                :to="link.to"
                class="text-sm text-gray-400 transition-colors hover:text-gold"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="mt-12 border-t border-gold/10 pt-6 text-center text-sm text-gray-500">
        Copyright &copy; {{ currentYear }} Epic Armageddon.fr | Le site "Epic Armageddon.fr" est un projet fan-made communautaire non officiel. Tous droits réservés. Utilisés sans approbation, ni volonté de préjudice ou comme opposition au copyright de Games Workshop LTD.
      </div>
    </div>
  </footer>
</template>
