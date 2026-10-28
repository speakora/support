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

#### Vue éducatrice (`educ-*.png`, guide de l'éducatrice)

Le guide de l'éducatrice montre le portail vu par le rôle **éducateur**
(menu sans Équipe/Code QR). Ajouter au même appel :

```bash
EDUC_EMAIL=... EDUC_PASSWORD=... \
KID_ID=<enfant démo> REPORT_ID=<rapport brouillon de cet enfant> \
```

- `EDUC_EMAIL`/`EDUC_PASSWORD` : compte démo avec le rôle éducateur (à créer
  une fois depuis le compte admin : Équipe → Ajouter un membre, rôle
  Éducateur(trice), puis compléter l'inscription depuis le courriel
  d'invitation). Ses données doivent aussi pouvoir apparaître publiquement.
- `KID_ID` : un enfant de démo avec observations et grille remplies
  (captures `educ-grille.png` et `educ-generer.png`).
- `REPORT_ID` : un rapport **brouillon** de cet enfant (capture
  `educ-modifier.png`).

Sans `EDUC_EMAIL`, la passe est sautée et les `educ-*.png` existantes sont
conservées.

**Confidentialité : le masquage est automatique.** Avant chaque capture, le
script remplace tout ce qui ressemble à une adresse courriel par un bloc plein
(`maskSensitiveData` dans `screenshots.mjs`). Il n'y a donc plus rien à flouter
à la main pour `admin-equipe.png`, et le masquage couvre aussi le courriel du
parent dans les inscriptions en attente et le bloc destinataires du dialogue
d'envoi. Le masquage porte sur les nœuds texte, par motif — pas sur des
sélecteurs CSS — pour ne pas dépendre de la mise en page de chaque page.

Deux captures échappent encore au script :

- `admin-envoi-dialogue.png` et `admin-envoi.png` — se prennent depuis la page
  d'un rapport **envoyé** : dialogue « Envoyer aux parents » sans confirmer,
  puis « Voir le courriel envoyé ». Masquer le courriel du destinataire avant
  de publier.
- `admin-parametres.png` — ajouter le cercle rouge autour de l'icône de profil
  en haut à droite.

### Application mobile (émulateur + adb)

Lancer un émulateur (`flutter emulators --launch Pixel_8_API_35`), puis
`flutter run` dans `speakora_FE`, se connecter au compte démo et capturer
avec `adb exec-out screencap -p > images/<nom>.png` :

- `app-connexion.png` — écran de connexion (formulaire Login)
- `app-mes-enfants.png` — liste des enfants du groupe
- `app-enregistrement.png` — enregistrement en cours (bouton d'arrêt rouge);
  déclencher l'enregistrement sur un enfant de test, puis **supprimer
  l'observation parasite** créée en l'arrêtant
- `app-observations.png` — observations d'un enfant avec filtres et statuts

## Règle d'entretien

Quand une fonctionnalité visible change dans `speakora_admin` ou
`speakora_FE`, mettre à jour le guide correspondant ici dans la même séance
de travail, puis rafraîchir les captures concernées.
