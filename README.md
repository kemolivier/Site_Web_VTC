# VTC KEMS 78 – Chauffeur Privé

Site de réservation VTC : estimation d'un prix fixe (forfaits Orly/CDG par département, ou calcul au km), puis réservation envoyée par e-mail (Brevo) et par WhatsApp.

## Structure

```
vtc-kems-78/
├── package.json      → dépendances (Express uniquement) et commandes
├── server.js         → serveur : calcul des prix, réservations, envoi des e-mails
├── tarifs.js         → VOS TARIFS ET COORDONNÉES (le seul fichier à modifier)
├── .env.example      → modèle des réglages secrets
└── public/
    ├── index.html    → la page du site (réservation, tarifs, avis, FAQ, contact)
    ├── favicon.svg   → l'icône du site
    ├── images/       → vos photos (voir section 5)
    ├── mentions-legales.html → mentions légales et politique de confidentialité
    ├── style.css     → le design (noir, bleu nuit, or)
    └── script.js     → autocomplétion des adresses, estimation, formulaire
```

## 1. Créer le compte Brevo (envoi des e-mails, gratuit)

1. Créez un compte sur https://www.brevo.com (offre gratuite).
2. **Expéditeurs** : ajoutez et validez `kemolivier@yahoo.com` (vous recevez un code par e-mail).
3. **SMTP & API → Clés API** : créez une clé et copiez-la (elle commence par `xkeysib-`).

> Comme Yahoo est une messagerie gratuite, Brevo remplace l'adresse d'expédition par l'une des siennes. C'est normal : le bouton « Répondre » écrit quand même au bon destinataire.

## 2. Tester sur votre ordinateur

Prérequis : [Node.js](https://nodejs.org) version 20.6 ou plus récente.

```bash
npm install
cp .env.example .env      # puis collez votre clé Brevo dans .env
npm run dev
```

Ouvrez http://localhost:3000.

## 3. Mettre le code sur GitHub

1. Créez un dépôt vide sur https://github.com/new (par exemple `vtc-kems-78`).
2. Dans le dossier du projet :

```bash
git init
git add .
git commit -m "Site VTC KEMS 78"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/vtc-kems-78.git
git push -u origin main
```

Le fichier `.env` n'est **jamais** envoyé sur GitHub (il est exclu par `.gitignore`).

## 4. Mettre le site en ligne (Hostinger ou Render)

**Hostinger (offre Business/Unlimited ou Cloud)** : hPanel → Sites web → Ajouter un site web → *Node.js web app* → importez le zip du projet (ou reliez GitHub). Build `npm install`, démarrage `npm start`, puis ajoutez les variables d'environnement `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_TO`. Le certificat SSL (HTTPS) est fourni automatiquement.

**Render (gratuit)**

1. Créez un compte sur https://render.com avec votre compte GitHub.
2. **New → Web Service** → choisissez le dépôt `vtc-kems-78`.
3. Réglages :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : Free (ou Starter pour éviter la mise en veille)
4. Onglet **Environment** : ajoutez `BREVO_API_KEY`, `MAIL_FROM` et `MAIL_TO`.
5. Cliquez sur **Deploy**. Votre site est disponible à l'adresse `https://vtc-kems-78.onrender.com` (le nom exact dépend de votre service).

Chaque `git push` sur GitHub redéploie automatiquement le site.

**Bon à savoir sur l'offre gratuite** : le site se met en veille après une période sans visite, et le visiteur suivant attend alors environ 30 secondes. L'offre payante (Starter) supprime cette attente.

## 5. Ajouter vos photos et vos avis clients

**Photos** : déposez trois images JPG dans `public/images/` avec exactement ces noms :
`vehicule.jpg` (votre Prius, vue extérieure), `interieur.jpg` (l'habitacle) et `chauffeur.jpg` (vous, en tenue).
Format conseillé : 1200 × 900 pixels, moins de 300 Ko chacune (compressez-les sur squoosh.app).
Tant qu'une photo manque, son emplacement est simplement masqué.

**Avis clients** : dans `tarifs.js`, section `avis`, ajoutez une ligne par avis, **uniquement de vrais avis** et avec l'accord du client :

```js
{ nom: 'Sophie M.', note: 5, date: '2026-10', texte: 'Ponctuel, voiture impeccable.', trajet: 'Poissy → CDG' },
```

Si vous avez une fiche Google Business Profile, collez son lien d'avis dans `lienAvisGoogle` : un bouton « Laisser un avis sur Google » apparaîtra.

**Nom de domaine** : dans `tarifs.js`, mettez votre vraie adresse dans `siteUrl` (par exemple `https://vtckems78.fr`), puis remplacez `https://vtckems78.fr` par la même adresse dans `public/index.html` (balises `canonical`, `og:` et données structurées). Ces adresses servent au référencement Google.

## 6. Modifier vos tarifs

Ouvrez `tarifs.js`, changez les montants, puis :

```bash
git commit -am "Mise à jour des tarifs"
git push
```

## Services externes utilisés (gratuits, sans clé)

- Autocomplétion des adresses : API Géoplateforme de l'IGN (Base Adresse Nationale)
- Distance et durée : OSRM / OpenStreetMap. En cas d'indisponibilité, le site estime la distance automatiquement et l'indique au client.
