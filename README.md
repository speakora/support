# support.speakora.ca

Centre d'aide Speakora — guides d'utilisation publiés via GitHub Pages.

## Structure

```
index.html                      Landing : choix du guide + contact
guide-educatrice/index.html     Guide de l'app mobile (éducatrices)
guide-administration/index.html Guide du portail web (direction/admin)
styles.css                      Feuille de style partagée (branding speakora.ca)
images/                         Captures d'écran référencées par les guides
scripts/screenshots.mjs         Capture automatique des écrans du portail
```

Site statique, aucun build : pousser sur `main` publie directement.

## Mettre à jour les captures d'écran

### Portail d'administration (automatique)

```bash
cd scripts
npm install                # une seule fois (installe Playwright)
npx playwright install chromium   # une seule fois
ADMIN_URL=http://localhost:4001 \
ADMIN_EMAIL=... ADMIN_PASSWORD=... \
npm run screenshots
```

Utiliser un compte de démo dont les données peuvent apparaître publiquement
(les images sont publiées sur le site). La capture `admin-envoi.png`
(preuve d'envoi) se fait à la main depuis
`/dashboard/print/sent-email/<reportId>` d'un rapport envoyé.

**Après chaque capture** : flouter les courriels visibles dans
`admin-equipe.png` (colonne Courriel) avant de publier — le script écrase
l'image floutée à chaque exécution.

### Application mobile (manuel)

Depuis un émulateur ou un téléphone, capturer et déposer dans `images/` :

- `app-connexion.png` — écran de connexion
- `app-mes-enfants.png` — liste « Mes enfants »
- `app-enregistrement.png` — écran d'enregistrement (transcription en direct)
- `app-observations.png` — observations d'un enfant avec filtres

## Règle d'entretien

Quand une fonctionnalité visible change dans `speakora_admin` ou
`speakora_FE`, mettre à jour le guide correspondant ici dans la même séance
de travail, puis rafraîchir les captures concernées.
