// =============================================================
//  VTC KEMS 78 – Serveur Express
//  - sert le site (dossier public/)
//  - calcule les prix   : POST /api/estimation
//  - reçoit les réservations et envoie les e-mails (Brevo) : POST /api/reservation
// =============================================================

const express = require('express');
const path = require('path');
const tarifs = require('./tarifs');

const app = express();
const PORT = process.env.PORT || 3000;

// Render place le site derrière un proxy : nécessaire pour connaître la vraie IP du visiteur
app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
//  Outils de calcul
// -------------------------------------------------------------

// Distance à vol d'oiseau entre deux points GPS (en km)
function distanceVolOiseau(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Renvoie 'orly', 'cdg' ou null selon la position du point
function aeroportProche(point) {
  for (const [code, a] of Object.entries(tarifs.aeroports)) {
    if (distanceVolOiseau(point, a) <= a.rayonKm) return code;
  }
  return null;
}

// Département à partir du code postal (ex. "78000" -> "78")
function departement(point) {
  return String(point.postcode || '').slice(0, 2);
}

// Distance et durée par la route via OSRM (service gratuit OpenStreetMap).
// En cas de panne, on estime à partir de la distance à vol d'oiseau.
async function itineraire(depart, arrivee) {
  const url =
    'https://router.project-osrm.org/route/v1/driving/' +
    `${depart.lon},${depart.lat};${arrivee.lon},${arrivee.lat}?overview=false`;
  try {
    const rep = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await rep.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes.length) throw new Error(data.code);
    return {
      km: data.routes[0].distance / 1000,
      minutes: Math.round(data.routes[0].duration / 60),
      approximatif: false,
    };
  } catch (err) {
    console.warn('OSRM indisponible, estimation approximative :', err.message);
    const km = distanceVolOiseau(depart, arrivee) * 1.35; // la route est ~35 % plus longue
    return { km, minutes: Math.round((km / 40) * 60), approximatif: true };
  }
}

// Calcule le prix d'une course
async function calculerPrix(depart, arrivee) {
  const trajet = await itineraire(depart, arrivee);
  const km = Math.round(trajet.km * 10) / 10;

  // 1) Forfait aéroport ?
  const aeroDepart = aeroportProche(depart);
  const aeroArrivee = aeroportProche(arrivee);
  // Un seul des deux côtés doit être un aéroport (Orly ↔ CDG = calcul au km)
  if ((aeroDepart || aeroArrivee) && !(aeroDepart && aeroArrivee)) {
    const aeroport = aeroDepart || aeroArrivee;
    const autreCote = aeroDepart ? arrivee : depart;
    const zone = tarifs.forfaits[departement(autreCote)];
    if (zone && km <= tarifs.forfaitDistanceMaxKm) {
      return {
        prix: zone[aeroport],
        type: 'forfait',
        detail: `Forfait ${zone.nom} ↔ ${aeroport === 'orly' ? 'Orly' : 'CDG'}`,
        km,
        minutes: trajet.minutes,
        approximatif: trajet.approximatif,
      };
    }
  }

  // 2) Sinon : calcul au kilomètre
  const k = tarifs.kilometre;
  const prix = Math.max(k.minimum, Math.round(k.priseEnCharge + km * k.prixParKm));
  return {
    prix,
    type: 'kilometre',
    detail: `${k.priseEnCharge} € + ${String(km).replace(".", ",")} km × ${k.prixParKm.toFixed(2).replace('.', ',')} €`,
    km,
    minutes: trajet.minutes,
    approximatif: trajet.approximatif,
  };
}

// Vérifie qu'un point envoyé par le navigateur est valide
function pointValide(p) {
  return (
    p &&
    typeof p.label === 'string' &&
    p.label.length > 2 &&
    p.label.length < 200 &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    p.lat > 41 && p.lat < 52 && // France métropolitaine
    p.lon > -5.5 && p.lon < 10
  );
}

// Échappe le texte saisi par le client avant de l'insérer dans un e-mail HTML
function echapper(texte) {
  return String(texte ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// -------------------------------------------------------------
//  Anti-spam simple : 5 réservations max par IP toutes les 15 min
// -------------------------------------------------------------
const compteurs = new Map();
function tropDeDemandes(ip) {
  const maintenant = Date.now();
  const fenetre = 15 * 60 * 1000;
  const liste = (compteurs.get(ip) || []).filter((t) => maintenant - t < fenetre);
  liste.push(maintenant);
  compteurs.set(ip, liste);
  return liste.length > 5;
}

// -------------------------------------------------------------
//  E-mail via l'API Brevo (gratuite).
//  On n'utilise pas le SMTP classique car l'offre gratuite de Render
//  bloque les ports SMTP (25, 465, 587). L'API Brevo passe par HTTPS.
// -------------------------------------------------------------
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || tarifs.entreprise.email; // expéditeur validé dans Brevo
const MAIL_TO = process.env.MAIL_TO || tarifs.entreprise.email; // qui reçoit les réservations

if (!BREVO_API_KEY) {
  console.warn('⚠️  BREVO_API_KEY non définie : les e-mails ne seront pas envoyés.');
}

async function envoyerEmail({ a, nomExpediteur, repondreA, sujet, html }) {
  const rep = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: nomExpediteur, email: MAIL_FROM },
      to: [{ email: a }],
      replyTo: { email: repondreA },
      subject: sujet,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!rep.ok) throw new Error(`Brevo ${rep.status} : ${await rep.text()}`);
}

function formaterDate(dateISO) {
  const [a, m, j] = dateISO.split('-');
  return `${j}/${m}/${a}`;
}

// -------------------------------------------------------------
//  Routes de l'API
// -------------------------------------------------------------

// Infos publiques (tarifs, coordonnées) pour l'affichage du site
app.get('/api/infos', (req, res) => {
  res.json({
    entreprise: tarifs.entreprise,
    kilometre: tarifs.kilometre,
    forfaits: tarifs.forfaits,
    aeroports: tarifs.aeroports,
  });
});

// Estimation du prix
app.post('/api/estimation', async (req, res) => {
  const { depart, arrivee } = req.body || {};
  if (!pointValide(depart) || !pointValide(arrivee)) {
    return res.status(400).json({ erreur: 'Adresse de départ ou d’arrivée invalide.' });
  }
  try {
    res.json(await calculerPrix(depart, arrivee));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Impossible de calculer le prix pour le moment.' });
  }
});

// Réservation
app.post('/api/reservation', async (req, res) => {
  const b = req.body || {};

  // Champ piège invisible : seuls les robots le remplissent
  if (b.siteweb) return res.json({ ok: true, emailEnvoye: false });

  if (tropDeDemandes(req.ip)) {
    return res.status(429).json({ erreur: 'Trop de demandes. Merci de nous appeler directement.' });
  }

  // Validation des champs
  const erreurs = [];
  if (!pointValide(b.depart)) erreurs.push('adresse de départ');
  if (!pointValide(b.arrivee)) erreurs.push('adresse d’arrivée');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) erreurs.push('date');
  if (!/^\d{2}:\d{2}$/.test(b.heure || '')) erreurs.push('heure');
  const passagers = Number(b.passagers);
  const bagages = Number(b.bagages);
  if (!(passagers >= 1 && passagers <= tarifs.entreprise.passagersMax)) erreurs.push('passagers');
  if (!(bagages >= 0 && bagages <= tarifs.entreprise.bagagesMax)) erreurs.push('bagages');
  const nom = String(b.nom || '').trim().slice(0, 80);
  const telephone = String(b.telephone || '').trim().slice(0, 30);
  const email = String(b.email || '').trim().slice(0, 120);
  const commentaire = String(b.commentaire || '').trim().slice(0, 600);
  if (nom.length < 2) erreurs.push('nom');
  if (!/^[+\d][\d\s.-]{8,}$/.test(telephone)) erreurs.push('téléphone');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erreurs.push('e-mail');

  // La date ne doit pas être passée (marge d'un jour pour les fuseaux horaires)
  const hier = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (b.date && b.date < hier) erreurs.push('date (passée)');

  if (erreurs.length) {
    return res.status(400).json({ erreur: 'Merci de vérifier : ' + erreurs.join(', ') + '.' });
  }

  // On recalcule le prix côté serveur (on ne fait jamais confiance au prix envoyé)
  let estimation;
  try {
    estimation = await calculerPrix(b.depart, b.arrivee);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erreur: 'Erreur de calcul du prix. Merci de nous appeler.' });
  }

  const reference =
    'KEMS-' + b.date.replace(/-/g, '').slice(2) + '-' +
    Math.random().toString(36).slice(2, 6).toUpperCase();

  const lignes = [
    ['Référence', reference],
    ['Date', `${formaterDate(b.date)} à ${b.heure}`],
    ['Départ', b.depart.label],
    ['Arrivée', b.arrivee.label],
    ['Distance', `${estimation.km} km (≈ ${estimation.minutes} min)`],
    ['Prix', `${estimation.prix} € — ${estimation.detail}`],
    ['Passagers', passagers],
    ['Bagages', bagages],
    ['Client', nom],
    ['Téléphone', telephone],
    ['E-mail', email],
    ['Commentaire', commentaire || '—'],
  ];
  const tableau =
    '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' +
    lignes
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 12px;color:#777;vertical-align:top">${k}</td>` +
          `<td style="padding:6px 12px;font-weight:bold">${echapper(v)}</td></tr>`
      )
      .join('') +
    '</table>';

  const nomSite = `${tarifs.entreprise.nom} – ${tarifs.entreprise.slogan}`;
  let emailEnvoye = false;
  if (BREVO_API_KEY) {
    try {
      // E-mail pour le chauffeur ("Répondre" écrit directement au client)
      await envoyerEmail({
        a: MAIL_TO,
        nomExpediteur: `Site ${tarifs.entreprise.nom}`,
        repondreA: email,
        sujet: `🚘 Nouvelle réservation ${formaterDate(b.date)} ${b.heure} — ${estimation.prix} €`,
        html: `<h2 style="font-family:Arial">Nouvelle demande de réservation</h2>${tableau}`,
      });
      emailEnvoye = true;
      // Accusé de réception pour le client
      await envoyerEmail({
        a: email,
        nomExpediteur: nomSite,
        repondreA: tarifs.entreprise.email,
        sujet: `Votre demande de réservation ${reference} a bien été reçue`,
        html:
          `<p style="font-family:Arial">Bonjour ${echapper(nom)},</p>` +
          `<p style="font-family:Arial">Merci pour votre demande. Je vous confirme la course très rapidement ` +
          `par téléphone ou par e-mail. Voici le récapitulatif :</p>${tableau}` +
          `<p style="font-family:Arial">Pour toute question : ${tarifs.entreprise.telephone}</p>` +
          `<p style="font-family:Arial">${echapper(nomSite)}</p>`,
      });
    } catch (err) {
      console.error('Échec de l’envoi de l’e-mail :', err.message);
    }
  }

  console.log(`Réservation ${reference} — ${nom} — ${estimation.prix} € — e-mail : ${emailEnvoye}`);
  res.json({ ok: true, emailEnvoye, reference, ...estimation });
});

app.listen(PORT, () => {
  console.log(`✅ Site VTC KEMS 78 démarré sur http://localhost:${PORT}`);
});
