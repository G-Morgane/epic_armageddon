<script setup lang="ts">
const { profile, logout, isSuperAdmin } = useAuth()
</script>

<template>
  <div class="min-h-screen bg-surface">
    <!-- Admin header -->
    <header class="border-b border-gold/10 bg-surface-light">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div class="flex items-center gap-6">
          <NuxtLink to="/admin" class="font-heading text-lg font-bold text-gold">
            EA Admin
          </NuxtLink>
          <nav class="flex gap-1">
            <NuxtLink
              to="/admin"
              class="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-surface-lighter hover:text-gold"
              active-class="!bg-surface-lighter !text-gold"
            >
              Armées
            </NuxtLink>
            <NuxtLink
              to="/admin/documents"
              class="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-surface-lighter hover:text-gold"
              active-class="!bg-surface-lighter !text-gold"
            >
              Documents
            </NuxtLink>
            <NuxtLink
              to="/admin/events"
              class="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-surface-lighter hover:text-gold"
              active-class="!bg-surface-lighter !text-gold"
            >
              Événements
            </NuxtLink>
            <NuxtLink
              v-if="isSuperAdmin"
              to="/admin/users"
              class="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-surface-lighter hover:text-gold"
              active-class="!bg-surface-lighter !text-gold"
            >
              Utilisateurs
            </NuxtLink>
          </nav>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-400">{{ profile?.display_name ?? profile?.email }}</span>
          <span class="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">
            {{ profile?.role === 'super_admin' ? 'Super Admin' : 'Admin' }}
          </span>
          <button
            class="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:text-red-400"
            @click="logout"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </header>

    <!-- Content -->
    <main class="mx-auto max-w-7xl px-4 py-8">
      <slot />
    </main>
  </div>
</template>
