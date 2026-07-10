/**
 * Capture les captures d'écran du portail d'administration pour les guides.
 *
 * Usage :
 *   ADMIN_URL=http://localhost:4001 ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/screenshots.mjs
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Force le portail en français (les guides référencent les libellés français).
await page.addInitScript(() => {
  const KEY = 'app-settings';
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    /* valeur corrompue : on repart à neuf */
  }
  localStorage.setItem(KEY, JSON.stringify({ ...settings, language: 'fr' }));
});

console.log(`Connexion à ${ADMIN_URL}…`);
await page.goto(`${ADMIN_URL}/auth/auth0/sign-in`);
await page.fill('input[name="emailOrUsername"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard**', { timeout: 30_000 });
console.log('Connecté.');

let failures = 0;
for (const shot of SHOTS) {
  // 2 essais : juste après la connexion, la première navigation peut être
  // interrompue par la redirection de l'app (net::ERR_ABORTED).
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(`${ADMIN_URL}${shot.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800); // laisse finir les animations/chargements
      await page.screenshot({ path: new URL(`../images/${shot.name}.png`, import.meta.url).pathname });
      console.log(`✓ ${shot.name}.png`);
      break;
    } catch (err) {
      if (attempt === 2) {
        failures += 1;
        console.error(`✗ ${shot.name} (${shot.path}) : ${err.message}`);
      }
    }
  }
}

await browser.close();
console.log(failures ? `Terminé avec ${failures} échec(s).` : 'Terminé — toutes les captures sont à jour.');
process.exit(failures ? 1 : 0);
