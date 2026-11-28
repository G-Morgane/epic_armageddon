<script setup lang="ts">
/**
 * Page exigée par Google pour publier la connexion Google, et par le RGPD dès
 * lors que le site tient des comptes. Elle décrit ce que le site stocke
 * réellement : si une table, un cookie ou un prestataire change, la page doit
 * changer avec.
 */
const urlSite = useUrlSite()

useSeoMeta({
  title: 'Confidentialité',
  description: 'Ce que le site Epic Armageddon FR collecte, pourquoi, combien de temps, et comment faire supprimer son compte.',
  ogTitle: 'Confidentialité (Epic Armageddon FR)',
  ogDescription: 'Données collectées, durée de conservation et suppression de compte.',
  ogUrl: urlSite('/confidentialite'),
})

const MAJ = '23 septembre 2026'
const DISCORD = 'https://discord.com/invite/3ukn8Cumc5'
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-t from-yellow-900/15 via-surface to-surface" />
    <div class="absolute inset-0" style="background: radial-gradient(ellipse at top left, rgba(200,160,82,0.08) 0%, transparent 60%)" />

    <div class="relative z-10">
      <div class="mx-auto max-w-3xl px-4 pb-24 pt-20">
        <nav class="mb-8 text-sm text-gray-500">
          <NuxtLink to="/" class="hover:text-gold">Accueil</NuxtLink>
          <span class="mx-2">/</span>
          <span class="text-gray-300">Confidentialité</span>
        </nav>

        <h1 class="text-3xl font-bold sm:text-4xl md:text-5xl">Confidentialité</h1>
        <div class="mt-4 h-1 w-48 rounded-full bg-gradient-to-r from-gold to-transparent md:w-96" />
        <p class="mt-4 text-sm text-gray-500">Dernière mise à jour : {{ MAJ }}</p>

        <div class="mt-10 space-y-12 text-base leading-relaxed text-gray-400">
          <section>
            <p>
              Epic Armageddon.fr est un site communautaire tenu par des bénévoles. Il ne vend rien,
              ne diffuse aucune publicité et ne mesure pas son audience. Aucune donnée n'est cédée
              ni revendue à qui que ce soit.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Ce que le site conserve</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              <strong class="text-gray-200">Sans compte</strong>, rien n'est conservé : la consultation
              des règles, des codex et des événements ne demande aucune donnée.
            </p>

            <p class="mt-4">
              <strong class="text-gray-200">Avec un compte</strong>, le site conserve :
            </p>
            <ul class="mt-3 space-y-2 pl-5">
              <li class="list-disc">
                <strong class="text-gray-300">Ton adresse email</strong>, qui sert d'identifiant et reçoit
                les liens de connexion. Elle n'est jamais affichée aux autres membres.
              </li>
              <li class="list-disc">
                <strong class="text-gray-300">Ton pseudo</strong>, si tu en choisis un. C'est la seule
                information de ton compte visible publiquement.
              </li>
              <li class="list-disc">
                <strong class="text-gray-300">Tes listes d'armée</strong> : leur nom, leur contenu et,
                si tu en génères un, leur code de partage.
              </li>
              <li class="list-disc">
                <strong class="text-gray-300">Tes codex favoris.</strong>
              </li>
              <li class="list-disc">
                <strong class="text-gray-300">La date de création du compte</strong> et ton rôle
                (membre ou administrateur).
              </li>
            </ul>

            <p class="mt-4">
              Si tu te connectes avec Google, Google transmet au site ton adresse email, ton nom et
              ton avatar. Seule l'adresse email est utilisée. Le site ne reçoit jamais ton mot de
              passe Google et n'a accès à aucun autre service de ton compte Google.
            </p>

            <p class="mt-4">
              Il n'y a ni historique de navigation, ni profilage, ni décision automatisée. Les
              journaux techniques de nos hébergeurs peuvent contenir ton adresse IP quelques jours,
              le temps de détecter une panne ou un abus, et rien n'y est rattaché à ton compte.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Cookies</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              Deux cookies, tous deux strictement nécessaires au fonctionnement, donc sans bandeau
              de consentement :
            </p>
            <ul class="mt-3 space-y-2 pl-5">
              <li class="list-disc">
                le cookie de session, qui te garde connecté d'une page à l'autre ;
              </li>
              <li class="list-disc">
                un cookie d'une heure qui mémorise la page à rouvrir après ta connexion.
              </li>
            </ul>
            <p class="mt-4">
              Aucun cookie publicitaire, aucun cookie de mesure d'audience, aucun traceur tiers.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Qui d'autre voit ces données</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              Le site s'appuie sur trois prestataires techniques, qui hébergent les données pour son
              compte et n'en font aucun autre usage :
            </p>
            <ul class="mt-3 space-y-2 pl-5">
              <li class="list-disc">
                <strong class="text-gray-300">Supabase</strong> : base de données, comptes et envoi des
                liens de connexion.
              </li>
              <li class="list-disc">
                <strong class="text-gray-300">Vercel</strong> : hébergement du site.
              </li>
              <li class="list-disc">
                <strong class="text-gray-300">Cloudflare</strong> : stockage des documents mis à
                disposition sur le site.
              </li>
            </ul>
            <p class="mt-4">
              Les administrateurs du site peuvent voir la liste des comptes et leur adresse email,
              pour la modération et le support. Personne d'autre.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Ce qui est public</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              Tes listes d'armée sont privées par défaut. Si tu génères un lien de partage, toute
              personne disposant de ce lien peut consulter la liste, sans avoir besoin de compte.
              Supprime la liste ou son lien pour y couper l'accès.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Combien de temps</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              Tant que ton compte existe. Sa suppression efface ton profil, tes listes et tes favoris,
              immédiatement et définitivement. Les listes que tu as partagées par lien disparaissent
              avec.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Tes droits</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              Tu peux à tout moment consulter et corriger ton pseudo depuis ton compte, demander une
              copie de tes données, ou demander la suppression de ton compte. Écris sur le Discord de
              la communauté, la demande est traitée à la main.
            </p>
            <a
              :href="DISCORD"
              target="_blank"
              rel="noopener"
              class="mt-6 inline-block rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-gold-light"
            >
              Nous contacter sur Discord
            </a>
            <p class="mt-6 text-sm">
              Si une demande reste sans réponse, tu peux saisir la CNIL
              (<a href="https://www.cnil.fr" target="_blank" rel="noopener" class="text-gold hover:underline">cnil.fr</a>).
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Évolutions</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              Cette page suit le site : si une fonctionnalité future change ce qui est collecté, elle
              sera mise à jour et la date en haut de page modifiée.
            </p>
            <p class="mt-4">
              Voir aussi les
              <NuxtLink to="/conditions" class="text-gold hover:underline">conditions d'utilisation</NuxtLink>.
            </p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
