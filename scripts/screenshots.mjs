/**
 * Capture les captures d'écran du portail d'administration pour les guides.
 *
 * Usage :
 *   ADMIN_URL=http://localhost:4001 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/screenshots.mjs
 *
 * Variables optionnelles (passe « vue éducatrice » du guide de l'éducatrice) :
 *   EDUC_EMAIL / EDUC_PASSWORD  compte démo avec le rôle éducateur
 *   KID_ID                      enfant de démo (observations + grille remplies)
 *   REPORT_ID                   rapport brouillon de cet enfant (onglet Modifier)
 * Sans EDUC_EMAIL, la passe éducatrice est sautée.
 *
 * Prérequis : npm install (dans scripts/), et le portail + backend en marche.
 * Les images sont écrites dans ../images/ avec les noms référencés par les guides.
 *
 * Les captures de l'application mobile (app-*.png) se font à la main depuis un
 * émulateur ou un téléphone — voir README.md.
 */
import { chromium } from 'playwright';

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:4001';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const EDUC_EMAIL = process.env.EDUC_EMAIL;
const EDUC_PASSWORD = process.env.EDUC_PASSWORD;
const KID_ID = process.env.KID_ID;
const REPORT_ID = process.env.REPORT_ID;

if (!EMAIL || !PASSWORD) {
  console.error('ADMIN_EMAIL et ADMIN_PASSWORD sont requis.');
  process.exit(1);
}

// Chaque entrée : nom du fichier (sans extension) → chemin dans le portail.
// Garder les noms synchronisés avec les <img> des guides.
const SHOTS = [
  { name: 'admin-dashboard', path: '/dashboard' },
  { name: 'admin-enfants', path: '/dashboard/kids' },
  { name: 'admin-groupes', path: '/dashboard/groups' },
  { name: 'admin-rapports', path: '/dashboard/all-reports' },
  { name: 'admin-equipe', path: '/dashboard/team' },
  { name: 'admin-qrcode', path: '/dashboard/qrcode' },
  { name: 'admin-parametres', path: '/account/settings' },
  // 'admin-envoi' (preuve d'envoi) demande un reportId : capturer à la main
  // depuis /dashboard/print/sent-email/<reportId> d'un rapport envoyé.
];

const browser = await chromium.launch();
let failures = 0;

const imagePath = (name) => new URL(`../images/${name}.png`, import.meta.url).pathname;

// Force le portail en français (les guides référencent les libellés français).
// Deux clés : 'app-settings' (réglages de l'app) et 'i18nextLng' (cache du
// détecteur de langue, prioritaire au démarrage).
function forceFrench() {
  const KEY = 'app-settings';
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    /* valeur corrompue : on repart à neuf */
  }
  localStorage.setItem(KEY, JSON.stringify({ ...settings, language: 'fr' }));
  localStorage.setItem('i18nextLng', 'fr');
}

async function newFrenchPage() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(forceFrench);
  return page;
}

async function login(page, email, password) {
  await page.goto(`${ADMIN_URL}/auth/auth0/sign-in`);
  await page.fill('input[name="emailOrUsername"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// Confidentialité : masquage automatique des données personnelles.
//
// Avant chaque capture, on remplace dans le DOM tout ce qui ressemble à une
// adresse courriel par un rectangle plein. On masque par motif (et non par
// sélecteur CSS) parce que les courriels apparaissent à plusieurs endroits :
// colonne de la section Équipe, invitations en attente, courriel du parent
// dans la liste des inscriptions en attente, et bloc destinataires du dialogue
// d'envoi. Un sélecteur par page en oublierait forcément un.
//
// Le remplacement se fait sur les nœuds texte (feuilles), pas sur innerHTML :
// cela préserve la structure React et évite de casser la mise en page.
// ---------------------------------------------------------------------------
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const REDACTED = '••••••@••••••';

async function maskSensitiveData(page) {
  const masked = await page.evaluate(
    ({ pattern, replacement }) => {
      const re = new RegExp(pattern, 'g');
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

      // On collecte d'abord : modifier le DOM pendant le parcours fausse le
      // TreeWalker.
      const targets = [];
      let node = walker.nextNode();
      while (node) {
        if (re.test(node.nodeValue)) targets.push(node);
        re.lastIndex = 0;
        node = walker.nextNode();
      }

      // Remplacement par un <span> opaque plutôt que par du texte : les points
      // de suspension se lisaient comme un simple encadré pointillé, alors que
      // ce bloc plein ne laisse deviner ni la longueur ni la forme de l'adresse.
      for (const textNode of targets) {
        const frag = document.createDocumentFragment();
        let last = 0;
        const text = textNode.nodeValue;

        re.lastIndex = 0;
        let match = re.exec(text);
        while (match) {
          if (match.index > last) {
            frag.appendChild(document.createTextNode(text.slice(last, match.index)));
          }
          const block = document.createElement('span');
          block.textContent = replacement;
          block.style.cssText = [
            'background:#2b2b2b',
            'color:#2b2b2b',
            'border-radius:3px',
            'padding:1px 4px',
            'user-select:none',
          ].join(';');
          frag.appendChild(block);
          last = match.index + match[0].length;
          match = re.exec(text);
        }

        if (last < text.length) {
          frag.appendChild(document.createTextNode(text.slice(last)));
        }
        textNode.parentNode?.replaceChild(frag, textNode);
      }
      return targets.length;
    },
    { pattern: EMAIL_RE.source, replacement: REDACTED }
  );

  return masked;
}

// 2 essais : juste après la connexion, la première navigation peut être
// interrompue par la redirection de l'app (net::ERR_ABORTED).
//
// Le masquage fait partie du chemin de capture : impossible d'oublier une
// image, contrairement à la retouche manuelle qu'il remplace.
async function capture(page, name, fn) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await fn();
      await new Promise((r) => setTimeout(r, 800)); // laisse finir animations/chargements
      const count = await maskSensitiveData(page);
      if (count > 0) console.log(`  masqué ${count} courriel(s) dans ${name}`);
      return true;
    } catch (err) {
      if (attempt === 2) {
        failures += 1;
        console.error(`✗ ${name} : ${err.message}`);
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Passe admin : page d'inscription + pages du portail (compte démo admin).
// ---------------------------------------------------------------------------
const page = await newFrenchPage();

// Page d'inscription : publique, à capturer avant la connexion (une fois
// connecté, les pages /auth redirigent vers le tableau de bord).
// Double visite obligatoire : au premier chargement, l'app réinitialise
// 'app-settings' aux valeurs par défaut (langue 'en') car la valeur injectée
// n'a pas de champ version; à la navigation suivante, le script d'init
// fusionne 'fr' dans des réglages désormais valides.
await page.goto(`${ADMIN_URL}/auth/auth0/sign-up`, { waitUntil: 'networkidle' });
await page.goto(`${ADMIN_URL}/auth/auth0/sign-up`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await maskSensitiveData(page);
await page.screenshot({ path: imagePath('admin-inscription') });
console.log('✓ admin-inscription.png');

console.log(`Connexion à ${ADMIN_URL}…`);
await login(page, EMAIL, PASSWORD);
console.log('Connecté.');

for (const shot of SHOTS) {
  const ok = await capture(page, shot.name, async () => {
    await page.goto(`${ADMIN_URL}${shot.path}`, { waitUntil: 'networkidle' });
  });
  if (ok) {
    await page.screenshot({ path: imagePath(shot.name) });
    console.log(`✓ ${shot.name}.png`);
  }
}

// Fiche d'un enfant, onglet Rapports : pas adressable sans identifiant, donc
// capturée seulement si KID_ID est fourni.
if (KID_ID) {
  const ok = await capture(page, 'admin-enfant-rapports', async () => {
    await page.goto(`${ADMIN_URL}/dashboard/kids/${KID_ID}?tab=reports`, {
      waitUntil: 'networkidle',
    });
  });
  if (ok) {
    await page.screenshot({ path: imagePath('admin-enfant-rapports') });
    console.log('✓ admin-enfant-rapports.png');
  }
} else {
  console.log('KID_ID absent : admin-enfant-rapports sautée.');
}

await page.close();

// ---------------------------------------------------------------------------
// Passe éducatrice : mêmes pages vues avec le rôle éducateur (menu sans
// Équipe/Code QR) + écrans du flux de rapport, pour le guide de l'éducatrice.
// ---------------------------------------------------------------------------
if (EDUC_EMAIL && EDUC_PASSWORD) {
  const educ = await newFrenchPage();
  console.log(`Connexion éducatrice à ${ADMIN_URL}…`);
  await login(educ, EDUC_EMAIL, EDUC_PASSWORD);
  console.log('Connectée.');

  if (await capture(educ, 'educ-dashboard', async () => {
    await educ.goto(`${ADMIN_URL}/dashboard`, { waitUntil: 'networkidle' });
  })) {
    await educ.screenshot({ path: imagePath('educ-dashboard') });
    console.log('✓ educ-dashboard.png');
  }

  if (KID_ID) {
    if (await capture(educ, 'educ-grille', async () => {
      await educ.goto(`${ADMIN_URL}/dashboard/kids/${KID_ID}?tab=grille`, { waitUntil: 'networkidle' });
    })) {
      await educ.screenshot({ path: imagePath('educ-grille') });
      console.log('✓ educ-grille.png');
    }

    // Dialogue « Générer un rapport de développement » : ouvert depuis
    // l'onglet Rapports, capturé, puis refermé avec Échap.
    if (await capture(educ, 'educ-generer', async () => {
      await educ.goto(`${ADMIN_URL}/dashboard/kids/${KID_ID}?tab=reports`, { waitUntil: 'networkidle' });
      await educ.getByRole('button', { name: 'Générer un rapport' }).first().click();
      await educ.getByRole('dialog').waitFor();
    })) {
      await educ.screenshot({ path: imagePath('educ-generer') });
      await educ.keyboard.press('Escape');
      console.log('✓ educ-generer.png');
    }
  } else {
    console.log('KID_ID absent : educ-grille et educ-generer sautées.');
  }

  if (KID_ID && REPORT_ID) {
    // L'onglet Modifier du rapport n'est pas adressable par URL : on clique.
    if (await capture(educ, 'educ-modifier', async () => {
      await educ.goto(`${ADMIN_URL}/dashboard/kids/${KID_ID}/reports/${REPORT_ID}`, { waitUntil: 'networkidle' });
      await educ.getByRole('tab', { name: 'Modifier' }).click();
    })) {
      await educ.screenshot({ path: imagePath('educ-modifier') });
      console.log('✓ educ-modifier.png');
    }
  } else {
    console.log('REPORT_ID absent : educ-modifier sautée.');
  }

  await educ.close();
} else {
  console.log('EDUC_EMAIL absent : passe éducatrice sautée (educ-*.png inchangées).');
}

await browser.close();
console.log(failures ? `Terminé avec ${failures} échec(s).` : 'Terminé — toutes les captures sont à jour.');
process.exit(failures ? 1 : 0);
