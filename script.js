// =============================================================
//  VTC KEMS 78 – Logique du site (navigateur)
// =============================================================

const API_ADRESSE = 'https://data.geopf.fr/geocodage/search';

let infos = null; // tarifs + coordonnées, chargés depuis le serveur
let estimation = null; // dernier prix calculé
const points = { depart: null, arrivee: null }; // adresses choisies

const $ = (id) => document.getElementById(id);

// -------------------------------------------------------------
//  1. Chargement des informations (tarifs, téléphone…)
// -------------------------------------------------------------
async function chargerInfos() {
  const rep = await fetch('/api/infos');
  infos = await rep.json();
  const e = infos.entreprise;

  // Textes dynamiques
  const textes = {
    telephone: e.telephone,
    email: e.email,
    vehicule: e.vehicule,
    passagersMax: e.passagersMax,
    bagagesMax: e.bagagesMax,
    paiements: e.paiements.join(', ') + '. Facture disponible sur demande.',
  };
  document.querySelectorAll('[data-texte]').forEach((el) => {
    el.textContent = textes[el.dataset.texte];
  });

  // Liens téléphone / WhatsApp / e-mail
  const liens = {
    tel: `tel:${e.telephoneLien}`,
    whatsapp: `https://wa.me/${e.whatsapp}?text=${encodeURIComponent('Bonjour, je souhaite réserver une course.')}`,
    mail: `mailto:${e.email}`,
  };
  document.querySelectorAll('[data-lien]').forEach((el) => {
    el.href = liens[el.dataset.lien];
  });

  // Listes passagers et bagages
  remplirSelect($('passagers'), 1, e.passagersMax, 1);
  remplirSelect($('bagages'), 0, e.bagagesMax, 1);

  // Tableau des forfaits
  $('tableau-forfaits').innerHTML = Object.entries(infos.forfaits)
    .map(([dep, z]) => `<tr><td>${z.nom} (${dep})</td><td>${z.orly} €</td><td>${z.cdg} €</td></tr>`)
    .join('');

  const k = infos.kilometre;
  $('formule-km').textContent = `${k.priseEnCharge} € + ${formatEuro(k.prixParKm)} / km`;
  $('minimum-km').textContent = `Course minimum : ${k.minimum} €.`;
}

function remplirSelect(select, min, max, defaut) {
  select.innerHTML = '';
  for (let i = min; i <= max; i++) {
    select.add(new Option(String(i), String(i), i === defaut, i === defaut));
  }
}

function formatEuro(n) {
  return n.toFixed(2).replace('.', ',') + ' €';
}

// -------------------------------------------------------------
//  2. Autocomplétion des adresses (Base Adresse Nationale)
// -------------------------------------------------------------
function brancherAutocompletion(cle) {
  const input = $(cle);
  const liste = $(`suggestions-${cle}`);
  let resultats = [];
  let actif = -1;
  let minuteur = null;
  let requete = 0;

  input.addEventListener('input', () => {
    // L'adresse tapée ne correspond plus à une adresse choisie
    points[cle] = null;
    input.classList.remove('valide');
    effacerEstimation();
    clearTimeout(minuteur);
    const q = input.value.trim();
    if (q.length < 3) return vider();
    minuteur = setTimeout(() => chercher(q), 250);
  });

  async function chercher(q) {
    const numero = ++requete;
    // lat/lon : privilégie les résultats proches de Paris
    const url = `${API_ADRESSE}?q=${encodeURIComponent(q)}&limit=6&lat=48.85&lon=2.35`;
    try {
      const rep = await fetch(url);
      const data = await rep.json();
      if (numero !== requete) return; // une recherche plus récente est en cours
      resultats = (data.features || []).map((f) => ({
        label: f.properties.label,
        contexte: f.properties.context || '',
        postcode: f.properties.postcode || '',
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      }));
      afficher();
    } catch {
      vider();
    }
  }

  function afficher() {
    actif = -1;
    liste.innerHTML = '';
    resultats.forEach((r, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.innerHTML = `${echapper(r.label)}<small>${echapper(r.contexte)}</small>`;
      // mousedown plutôt que click : se déclenche avant la perte de focus
      li.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        choisir(i);
      });
      liste.appendChild(li);
    });
  }

  function choisir(i) {
    const r = resultats[i];
    if (!r) return;
    definirPoint(cle, r);
    vider();
  }

  function vider() {
    resultats = [];
    actif = -1;
    liste.innerHTML = '';
  }

  // Navigation au clavier dans la liste
  input.addEventListener('keydown', (ev) => {
    const items = liste.querySelectorAll('li');
    if (!items.length) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      actif = (actif + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.classList.toggle('actif', i === actif));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      choisir(actif >= 0 ? actif : 0);
    } else if (ev.key === 'Escape') {
      vider();
    }
  });

  input.addEventListener('blur', () => setTimeout(vider, 150));
}

function definirPoint(cle, point) {
  points[cle] = point;
  const input = $(cle);
  input.value = point.label;
  input.classList.add('valide');
  input.classList.remove('invalide');
  effacerEstimation();
}

// Boutons raccourcis "✈ Orly" / "✈ CDG"
function brancherRaccourcis() {
  document.querySelectorAll('.puce[data-aeroport]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const a = infos.aeroports[btn.dataset.aeroport];
      definirPoint(btn.dataset.cible, {
        label: a.nom,
        postcode: btn.dataset.aeroport === 'orly' ? '94390' : '95700',
        lat: a.lat,
        lon: a.lon,
      });
    });
  });

  $('inverser').addEventListener('click', () => {
    const d = points.depart;
    const a = points.arrivee;
    const vd = $('depart').value;
    const va = $('arrivee').value;
    points.depart = a;
    points.arrivee = d;
    $('depart').value = va;
    $('arrivee').value = vd;
    $('depart').classList.toggle('valide', !!a);
    $('arrivee').classList.toggle('valide', !!d);
    effacerEstimation();
  });
}

// -------------------------------------------------------------
//  3. Estimation du prix
// -------------------------------------------------------------
function effacerEstimation() {
  estimation = null;
  $('resultat').hidden = true;
  $('form-resa').hidden = true;
  $('btn-estimer').hidden = false;
}

$('form-trajet').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erreur = $('erreur-trajet');
  erreur.hidden = true;

  for (const cle of ['depart', 'arrivee']) {
    if (!points[cle]) {
      $(cle).classList.add('invalide');
      erreur.textContent = 'Choisissez chaque adresse dans la liste proposée (ou utilisez les boutons Orly / CDG).';
      erreur.hidden = false;
      return;
    }
  }

  const btn = $('btn-estimer');
  btn.disabled = true;
  btn.textContent = 'Calcul en cours…';
  try {
    const rep = await fetch('/api/estimation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depart: points.depart, arrivee: points.arrivee }),
    });
    const data = await rep.json();
    if (!rep.ok) throw new Error(data.erreur);

    estimation = data;
    $('res-prix').textContent = data.prix;
    $('res-detail').textContent = data.detail;
    $('res-trajet').textContent =
      `${String(data.km).replace('.', ',')} km · environ ${data.minutes} min` +
      (data.approximatif ? ' (distance estimée)' : '');
    $('resultat').hidden = false;
    $('form-resa').hidden = false;
    btn.hidden = true;
    $('resultat').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    erreur.textContent = err.message || 'Le calcul a échoué. Réessayez ou appelez-nous.';
    erreur.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Calculer le prix';
  }
});

// -------------------------------------------------------------
//  4. Réservation
// -------------------------------------------------------------
const CLE_CLIENT = 'kems78-client';

// Pré-remplit les coordonnées d'un client qui a déjà réservé
function prefillClient() {
  try {
    const c = JSON.parse(localStorage.getItem(CLE_CLIENT) || 'null');
    if (c) {
      $('nom').value = c.nom || '';
      $('telephone').value = c.telephone || '';
      $('email').value = c.email || '';
    }
  } catch {
    /* stockage indisponible : on ignore */
  }
}

function memoriserClient(c) {
  try {
    localStorage.setItem(CLE_CLIENT, JSON.stringify(c));
  } catch {
    /* stockage indisponible : on ignore */
  }
}

function dateDuJour() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

$('modifier-trajet').addEventListener('click', () => {
  effacerEstimation();
  $('carte-resa').scrollIntoView({ behavior: 'smooth' });
});

$('form-resa').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const erreur = $('erreur-resa');
  erreur.hidden = true;

  const donnees = {
    depart: points.depart,
    arrivee: points.arrivee,
    date: $('date').value,
    heure: $('heure').value,
    passagers: Number($('passagers').value),
    bagages: Number($('bagages').value),
    nom: $('nom').value.trim(),
    telephone: $('telephone').value.trim(),
    email: $('email').value.trim(),
    commentaire: $('commentaire').value.trim(),
    siteweb: $('siteweb').value,
  };

  // Vérifications côté navigateur
  const manque = [];
  if (!donnees.date) manque.push('la date');
  if (!donnees.heure) manque.push("l'heure");
  if (donnees.nom.length < 2) manque.push('votre nom');
  if (!/^[+\d][\d\s.-]{8,}$/.test(donnees.telephone)) manque.push('un téléphone valide');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donnees.email)) manque.push('un e-mail valide');
  if (manque.length) {
    erreur.textContent = 'Merci d’indiquer ' + manque.join(', ') + '.';
    erreur.hidden = false;
    return;
  }
  const quand = new Date(`${donnees.date}T${donnees.heure}`);
  if (quand < new Date(Date.now() + 30 * 60 * 1000)) {
    erreur.textContent = 'La prise en charge doit être au moins 30 minutes après maintenant. Pour une course immédiate, appelez-nous.';
    erreur.hidden = false;
    return;
  }

  const btn = $('btn-reserver');
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';
  try {
    const rep = await fetch('/api/reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donnees),
    });
    const data = await rep.json();
    if (!rep.ok) throw new Error(data.erreur);

    memoriserClient({ nom: donnees.nom, telephone: donnees.telephone, email: donnees.email });
    afficherConfirmation(donnees, data);
  } catch (err) {
    erreur.textContent = err.message || 'L’envoi a échoué. Réessayez ou contactez-nous sur WhatsApp.';
    erreur.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Réserver ma course';
  }
});

function afficherConfirmation(d, r) {
  const [a, m, j] = d.date.split('-');
  const message =
    `Bonjour, je souhaite réserver une course (réf. ${r.reference}) :\n` +
    `📅 ${j}/${m}/${a} à ${d.heure}\n` +
    `📍 Départ : ${d.depart.label}\n` +
    `🏁 Arrivée : ${d.arrivee.label}\n` +
    `👥 ${d.passagers} passager(s), ${d.bagages} bagage(s)\n` +
    `💶 Prix annoncé : ${r.prix} €\n` +
    `👤 ${d.nom} – ${d.telephone}` +
    (d.commentaire ? `\n📝 ${d.commentaire}` : '');

  $('conf-ref').textContent = r.reference;
  $('conf-texte').textContent = r.emailEnvoye
    ? `Votre demande m’a bien été transmise et un récapitulatif part à ${d.email}. Je vous confirme la course très rapidement.`
    : 'Votre demande est enregistrée, mais l’e-mail n’a pas pu partir. Envoyez-la sur WhatsApp pour être sûr qu’elle me parvienne.';
  $('conf-whatsapp').href = `https://wa.me/${infos.entreprise.whatsapp}?text=${encodeURIComponent(message)}`;

  $('form-trajet').hidden = true;
  $('resultat').hidden = true;
  $('form-resa').hidden = true;
  $('confirmation').hidden = false;
  $('carte-resa').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('nouvelle-resa').addEventListener('click', () => {
  $('confirmation').hidden = true;
  $('form-trajet').hidden = false;
  $('form-trajet').reset();
  $('commentaire').value = '';
  points.depart = null;
  points.arrivee = null;
  document.querySelectorAll('.valide').forEach((el) => el.classList.remove('valide'));
  effacerEstimation();
});

// -------------------------------------------------------------
//  Utilitaires et démarrage
// -------------------------------------------------------------
function echapper(t) {
  const div = document.createElement('div');
  div.textContent = t;
  return div.innerHTML;
}

$('annee').textContent = new Date().getFullYear();
$('date').min = dateDuJour();
$('date').value = dateDuJour();
brancherAutocompletion('depart');
brancherAutocompletion('arrivee');
prefillClient();
chargerInfos()
  .then(brancherRaccourcis)
  .catch(() => {
    $('erreur-trajet').textContent = 'Le site rencontre un problème de connexion. Appelez-nous directement.';
    $('erreur-trajet').hidden = false;
  });
