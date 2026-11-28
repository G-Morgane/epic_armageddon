# Connexion des membres

Compte joueur pour enregistrer ses listes d'armée. Connexion par lien reçu par
email : pas de mot de passe, pas d'inscription séparée, le compte se crée au
premier lien demandé. Les comptes admin gardent leur mot de passe et leur page
`/admin/login`.

## Comment ça marche

| Élément | Où |
|---|---|
| Session | cookie géré par `@nuxtjs/supabase`, lisible au rendu serveur |
| Rôle applicatif | `profiles.role` : `membre`, `admin`, `super_admin` |
| Page de connexion | `/connexion` |
| Retour du lien | `/connexion/retour` (rendu client seul) |
| Compte | `/compte` (mes armées, mes codex favoris, pseudo, déconnexion) |
| Garde de page | `middleware: 'membre'` (connecté) ou `'admin'` (rôle) |
| Garde de route API | `exigerUtilisateur(event)` / `exigerAdmin(event)` |

Les routes serveur ne lisent plus d'en-tête `Authorization` : la session voyage
dans le cookie, `$fetch` l'envoie tout seul.

## Mise en service

### 1. Base

Exécuter `supabase/membres.sql` dans le SQL editor Supabase. **À faire avant**
d'ouvrir `/connexion` au public : sans ce script, le trigger d'origine donne le
rôle `admin` à tout nouveau compte.

Exécuter aussi `supabase/favoris.sql` : sans cette table, l'étoile « Mettre en
favori » d'une fiche d'armée répond une erreur explicite et la section favoris
de `/compte` reste vide.

### 2. SMTP (Resend)

Le mailer intégré de Supabase est limité à quelques emails par heure et n'est
pas prévu pour la production : une connexion par lien magique dessus ne marche
pas.

1. Compte sur resend.com
2. *Domains* → ajouter `epicarmageddon.fr`, coller les enregistrements DNS
   fournis chez le registrar, attendre la vérification
3. *API Keys* → créer une clé
4. Supabase, *Authentication → Emails → SMTP Settings* :

```
Host      smtp.resend.com
Port      587
Username  resend
Password  <clé API Resend>
Sender    connexion@epicarmageddon.fr
Nom       Epic Armageddon FR
```

Le palier gratuit couvre 3 000 emails par mois, 100 par jour. Un email part
seulement quand quelqu'un demande un lien de connexion, pas à chaque visite :
une session dure des semaines. Le seul moment où 100 peut être atteint est le
jour de l'annonce aux joueurs. Si ça arrive, Brevo (`smtp-relay.brevo.com`,
port 587, 300/jour) se substitue en changeant ces quatre champs, sans toucher
au code.

### 3. URLs

*Authentication → URL Configuration* :

- Site URL : `https://www.epicarmageddon.fr`
- Redirect URLs : `https://www.epicarmageddon.fr/**`, `http://localhost:3000/**`,
  `http://localhost:3100/**`

### 4. Gabarit d'email

*Authentication → Emails → Magic Link*. Le gabarit par défaut utilise
`{{ .ConfirmationURL }}`, qui repose sur PKCE : le lien ne fonctionne alors que
dans le navigateur qui l'a demandé. Un lien ouvert sur le téléphone alors que la
demande venait de l'ordinateur échoue.

Le gabarit ci-dessous passe par `token_hash`, que `/connexion/retour` sait
vérifier depuis n'importe quel navigateur :

```html
<h2>Connexion à Epic Armageddon FR</h2>
<p>Clique pour te connecter :</p>
<p><a href="{{ .SiteURL }}/connexion/retour?token_hash={{ .TokenHash }}&type=magiclink">Me connecter</a></p>
<p>Ce lien est valable une heure. Si tu n'as rien demandé, ignore cet email.</p>
```

La page accepte les deux formes : changer le gabarit n'est pas obligatoire pour
que la connexion marche, seulement pour qu'elle marche d'un appareil à l'autre.

## Points à connaître

- **Destination après connexion** : portée par le cookie `ea_suivant`, posé au
  moment de la demande. D'un appareil à l'autre le cookie n'existe pas, le
  membre retombe sur l'accueil.
- **Pseudo** : unique, insensible à la casse, affiché sur les listes partagées.
  L'email n'est jamais exposé.
- **Sauvegarde** : le palier gratuit Supabase n'en fait pas. Les listes des
  membres sont la seule donnée irremplaçable du site : prévoir un `pg_dump`
  planifié.
- **Rôles** : un membre ne peut pas s'écrire `role = 'admin'`, un trigger le
  refuse. Seul un super_admin, ou la clé service, change un rôle.
