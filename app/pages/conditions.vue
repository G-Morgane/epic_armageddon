<script setup lang="ts">
/**
 * Conditions d'utilisation. Exigée par Google pour publier la connexion
 * Google, et utile au site : c'est le seul endroit qui pose les règles du
 * compte, du partage de listes et de la modération.
 */
const urlSite = useUrlSite()

useSeoMeta({
  title: 'Conditions d\'utilisation',
  description: 'Les règles d\'usage du site Epic Armageddon FR : compte, listes d\'armée, partage, modération.',
  ogTitle: 'Conditions d\'utilisation (Epic Armageddon FR)',
  ogDescription: 'Règles d\'usage du site, du compte et des listes d\'armée.',
  ogUrl: urlSite('/conditions'),
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
          <span class="text-gray-300">Conditions d'utilisation</span>
        </nav>

        <h1 class="text-3xl font-bold sm:text-4xl md:text-5xl">Conditions d'utilisation</h1>
        <div class="mt-4 h-1 w-48 rounded-full bg-gradient-to-r from-gold to-transparent md:w-96" />
        <p class="mt-4 text-sm text-gray-500">Dernière mise à jour : {{ MAJ }}</p>

        <div class="mt-10 space-y-12 text-base leading-relaxed text-gray-400">
          <section>
            <p>
              Epic Armageddon.fr est un site de fans, gratuit, tenu par des bénévoles pour la
              communauté francophone du jeu. Utiliser le site, c'est accepter ce qui suit.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Un site non officiel</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              Le site n'est ni édité, ni approuvé, ni soutenu par Games Workshop. Epic, Epic
              Armageddon, Warhammer 40,000 et les noms, illustrations et symboles associés
              appartiennent à Games Workshop Ltd. Ils sont repris ici sans intention de nuire au
              droit d'auteur de leur propriétaire, dans un cadre communautaire et non commercial.
            </p>
            <p class="mt-4">
              Les règles, codex et documents publiés ici sont écrits ou compilés par la communauté.
              Ils n'ont aucune valeur officielle. En cas de doute sur une règle, le document de
              référence de Games Workshop fait foi.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Ton compte</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              Le compte est gratuit et facultatif : il ne sert qu'à retrouver tes listes d'armée et
              tes favoris. Tu te connectes avec ton adresse email ou avec ton compte Google.
            </p>
            <ul class="mt-4 space-y-2 pl-5">
              <li class="list-disc">Un compte par personne, avec une adresse email dont tu disposes réellement.</li>
              <li class="list-disc">
                Ton pseudo est visible des autres membres : choisis-en un qui ne soit ni insultant,
                ni trompeur sur ton identité.
              </li>
              <li class="list-disc">
                Ne partage pas tes liens de connexion, ils valent accès à ton compte.
              </li>
              <li class="list-disc">
                Tu peux demander la suppression de ton compte à tout moment, sans avoir à te justifier.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Tes listes d'armée</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              Les listes que tu construis restent les tiennes. Le site les stocke pour te les
              restituer, rien de plus : elles ne sont ni exploitées, ni republiées ailleurs.
            </p>
            <p class="mt-4">
              Une liste est privée tant que tu n'en génères pas de lien de partage. Ce lien la rend
              consultable par toute personne qui le détient, sans compte : ne mets donc dans le nom
              d'une liste rien que tu ne voudrais pas voir circuler.
            </p>
            <p class="mt-4">
              Le site fait de son mieux pour conserver tes listes, sans garantie. Exporte en PDF ce
              à quoi tu tiens, notamment avant un tournoi.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Usage correct</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">Sont interdits, et entraînent la suppression du contenu ou du compte :</p>
            <ul class="mt-3 space-y-2 pl-5">
              <li class="list-disc">les contenus haineux, injurieux, illégaux ou destinés à harceler quelqu'un ;</li>
              <li class="list-disc">l'usurpation de l'identité d'un autre membre ou d'un organisateur ;</li>
              <li class="list-disc">
                les tentatives d'accès aux comptes ou aux données d'autrui, et toute manœuvre visant
                à dégrader le service ;
              </li>
              <li class="list-disc">
                l'aspiration automatisée du contenu du site, et sa réutilisation commerciale.
              </li>
            </ul>
            <p class="mt-4">
              La modération est assurée à la main par les administrateurs. Un contenu signalé peut
              être retiré sans préavis, et un compte suspendu en cas d'abus répété.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Disponibilité et responsabilité</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              Le site est fourni tel quel, sans garantie de disponibilité ni d'exactitude. Il peut
              être interrompu, modifié ou arrêté, notamment parce qu'il repose sur des bénévoles et
              sur des services tiers gratuits. Sa responsabilité ne saurait être engagée pour une
              partie perdue, une liste refusée en tournoi ou une donnée disparue.
            </p>
            <p class="mt-4">
              Les liens vers des sites tiers et les événements annoncés par la communauté sont
              publiés de bonne foi, sans contrôle de notre part sur ce qui s'y passe.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-bold text-gray-200">Évolutions</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <p class="mt-6">
              Ces conditions peuvent changer avec le site. La date en haut de page indique la
              dernière version. Le droit français s'applique.
            </p>
            <p class="mt-4">
              Une question, un signalement, une demande de retrait : écris sur le Discord de la
              communauté.
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
              Voir aussi la
              <NuxtLink to="/confidentialite" class="text-gold hover:underline">politique de confidentialité</NuxtLink>.
            </p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
