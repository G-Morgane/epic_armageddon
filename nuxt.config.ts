// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/sitemap', '@nuxtjs/supabase'],
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
    // Aucune redirection globale : par défaut le module renvoie TOUT le site
    // vers /login. Les accès protégés passent par app/middleware.
    redirect: false,
    // nos types sont écrits à la main dans app/types/database.ts, pas générés
    types: false,
    // Sans ça le client demande le lien en PKCE : le jeton n'est alors
    // vérifiable que dans le navigateur qui l'a demandé, et un lien ouvert
    // depuis le téléphone échoue.
    clientOptions: { auth: { flowType: 'implicit' } },
  },
  site: {
    url: 'https://www.epicarmageddon.fr',
    name: 'Epic Armageddon FR',
  },
  sitemap: {
    exclude: ['/admin/**', '/compte', '/connexion/**'],
  },
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },
  routeRules: {
    // la session se construit dans le navigateur au retour du lien de connexion
    '/connexion/retour': { ssr: false },
  },
  nitro: {
    // Codex YAML (source de vérité) embarqués dans le serveur
    serverAssets: [{ baseName: 'codex', dir: '../content/codex' }],
    // Génération de PDF : Chromium met quelques secondes à démarrer sur Vercel
    vercel: { functions: { maxDuration: 60 } },
  },
  app: {
    head: {
      htmlAttrs: { class: 'dark', lang: 'fr' },
      titleTemplate: '%s — Epic Armageddon FR',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Communauté française Epic Armageddon — Codex d\'armées, règles, FAQ, événements et outils pour le jeu de figurines Epic à l\'échelle 6mm.' },
        { property: 'og:site_name', content: 'Epic Armageddon FR' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'fr_FR' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Inter:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
  runtimeConfig: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: process.env.R2_BUCKET_NAME,
    public: {
      // Démo locale uniquement : contourne la connexion admin pour les écrans Codex (jamais actif en build de prod)
      codexDemoSansAuth: process.env.CODEX_DEMO_SANS_AUTH === '1',
      r2PublicUrl: process.env.R2_PUBLIC_URL,
      siteUrl: 'https://www.epicarmageddon.fr',
    },
  },
})
