// =============================================================
//  TARIFS ET INFORMATIONS DE L'ENTREPRISE
//  C'est le seul fichier à modifier pour changer vos prix.
//  Après modification : enregistrez, puis redéployez le site
//  (import du zip ou push GitHub selon votre hébergement).
// =============================================================

module.exports = {
  entreprise: {
    nom: 'VTC KEMS 78',
    slogan: 'Chauffeur Privé',
    telephone: '+33 6 13 98 46 56', // affiché sur le site
    telephoneLien: '+33613984656', // utilisé pour le bouton "Appeler"
    whatsapp: '33613984656', // format international sans "+" ni espaces
    email: 'kemolivier@yahoo.com', // reçoit les réservations
    vehicule: 'Toyota Prius',
    passagersMax: 4,
    bagagesMax: 4,
    paiements: ['Carte bancaire', 'Espèces', 'Virement (professionnels)'],
    adresse: '24 rue de Migneaux, 78300 Poissy', // affichée dans le pied de page
    ville: 'Poissy',
    // Adresse publique du site (sans / final). Sert au référencement
    // (sitemap, balises de partage). À adapter à votre nom de domaine.
    siteUrl: 'https://vtckems78.fr',
    // Lien vers votre fiche Google (bouton "Voir tous les avis").
    // Laissez vide si vous n'en avez pas encore.
    lienAvisGoogle: '',
  },

  // Photos du site, à placer dans le dossier public/images/
  // Laissez une valeur vide pour masquer l'emplacement.
  photos: {
    vehicule: 'images/vehicule.jpg', // votre Toyota Prius (extérieur)
    interieur: 'images/interieur.jpg', // l'habitacle
    chauffeur: 'images/chauffeur.jpg', // vous, en tenue
  },

  // Avis clients : uniquement de VRAIS avis, avec l'accord du client.
  // note : de 1 à 5. Ajoutez-en autant que vous voulez.
  avis: [
    // { nom: 'Prénom N.', note: 5, date: '2026-10', texte: 'Ponctuel, voiture impeccable…', trajet: 'Poissy → CDG' },
  ],

  // Calcul au kilomètre (tous les trajets hors forfait)
  kilometre: {
    priseEnCharge: 8, // €
    prixParKm: 1.35, // €
    minimum: 25, // € : prix minimum d'une course
  },

  // Au-delà de cette distance, le forfait aéroport ne s'applique plus
  // et le prix est calculé au km (évite les pertes sur les trajets très longs,
  // par ex. Rambouillet → CDG).
  forfaitDistanceMaxKm: 70,

  // Forfaits aéroport par département de départ (ou d'arrivée), en euros.
  // Valables dans les deux sens.
  forfaits: {
    '75': { nom: 'Paris', orly: 38, cdg: 52 },
    '92': { nom: 'Hauts-de-Seine', orly: 45, cdg: 60 },
    '93': { nom: 'Seine-Saint-Denis', orly: 50, cdg: 40 },
    '94': { nom: 'Val-de-Marne', orly: 35, cdg: 55 },
    '91': { nom: 'Essonne', orly: 40, cdg: 72 },
    '78': { nom: 'Yvelines', orly: 55, cdg: 78 },
    '95': { nom: "Val-d'Oise", orly: 62, cdg: 50 },
    '77': { nom: 'Seine-et-Marne', orly: 62, cdg: 58 },
  },

  // Position des aéroports et rayon (en km) dans lequel une adresse
  // est considérée comme "à l'aéroport".
  aeroports: {
    orly: { nom: 'Aéroport de Paris-Orly', lat: 48.7262, lon: 2.3652, rayonKm: 3 },
    cdg: { nom: 'Aéroport Paris-Charles de Gaulle', lat: 49.0097, lon: 2.5479, rayonKm: 4 },
  },
};
