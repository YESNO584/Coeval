const { chromium } = require('playwright');

// Le sélecteur de fichiers du système ne se pilote pas depuis un test. On le
// remplace par un vrai FileSystemFileHandle, pris dans le magasin privé du
// navigateur : tout le reste — IndexedDB, la survie au rechargement, la
// lecture, l'écriture, les autorisations — reste la vraie mécanique de
// Chromium, et c'est elle qu'on mesure.
const FAUX_SELECTEUR = `
  // Le repère n'est pris qu'au moment du clic : « navigator.storage » n'est
  // pas encore en place quand ce script s'exécute, au tout début du document.
  window.__fichier = async () => {
    const racine = await navigator.storage.getDirectory();
    return racine.getFileHandle('coeval-contributions.json', { create: true });
  };
  window.__ratees = [];
  window.addEventListener('unhandledrejection', (e) => {
    window.__ratees.push(String(e.reason && e.reason.stack || e.reason));
  });
  window.showSaveFilePicker = async () => window.__fichier();
  window.showOpenFilePicker = async () => [await window.__fichier()];
`;

async function lireLeFichier(page) {
  return page.evaluate(async () => {
    const racine = await navigator.storage.getDirectory();
    const repere = await racine.getFileHandle('coeval-contributions.json', { create: true });
    const texte = (await (await repere.getFile()).text()).trim();
    return texte === '' ? null : JSON.parse(texte);
  });
}

async function charger(page, debut, fin) {
  await page.fill('#filtre-debut', debut);
  await page.fill('#filtre-fin', fin);
  for (const c of await page.$$('.case input[type=checkbox]')) {
    if (!(await c.isChecked())) await c.check();
  }
  await page.click('#filtre-charger');
  await page.waitForTimeout(600);
}

(async () => {
  const navigateur = await chromium.launch();
  const contexte = await navigateur.newContext({ viewport: { width: 1100, height: 850 } });
  await contexte.addInitScript(FAUX_SELECTEUR);
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', e => erreurs.push(String(e)));

  const dit = (quoi, valeur) => console.log(`${quoi.padEnd(52)} ${valeur}`);

  // --- Première session : aucun repère ---
  await page.goto('http://127.0.0.1:' + (process.env.PORT || 8732) + '/index.html');
  await page.waitForTimeout(700);
  dit('1. aucune fenêtre à la première ouverture',
      (await page.$$('dialog.dialogue')).length === 0);
  dit('   repère affiché en haut à droite',
      JSON.stringify(await page.textContent('#fichier-travail')));

  await charger(page, '0', '99');
  dit('   barres dessinées', (await page.$$('#frise .entree')).length);

  // Modifier le nom de la première entrée, puis enregistrer.
  await page.click('#frise .entree');
  await page.waitForTimeout(300);
  const avant = await page.inputValue('[data-champ="nom"]');
  await page.fill('[data-champ="nom"]', 'NOM CORRIGÉ');
  await page.dispatchEvent('[data-champ="nom"]', 'change');
  await page.waitForTimeout(200);
  dit('2. le retour est barré', !(await page.$('#barrage[hidden]')));
  await page.click('#barrage .bouton-principal');
  await page.waitForTimeout(800);
  dit('   message après enregistrement',
      JSON.stringify(await page.textContent('#etat')));
  dit('   promesses ratées',
      JSON.stringify(await page.evaluate(() => window.__ratees)).slice(0, 300));
  dit('   sélecteur disponible',
      await page.evaluate(() => typeof window.showSaveFilePicker));
  dit('   état du module',
      JSON.stringify(await page.evaluate(() => Promise.all([
        import('/js/contributions.js'), import('/js/fichier.js'),
      ]).then(([registre, disque]) => ({
        reecriture: disque.reecritureDisponible(), fichier: disque.fichierChoisi(),
        total: registre.total(), nonEnregistrees: registre.nombre(),
      })))));
  dit('   contenu du magasin privé',
      JSON.stringify(await page.evaluate(async () => {
        const racine = await navigator.storage.getDirectory();
        const noms = [];
        for await (const nom of racine.keys()) noms.push(nom);
        return noms;
      })));

  let fichier = await lireLeFichier(page);
  dit('   opérations dans le fichier après 1er enregistrement',
      fichier === null ? 'AUCUN FICHIER' : fichier.operations.length);
  dit('   repère affiché', JSON.stringify(await page.textContent('#fichier-travail')));

  // --- Deuxième session : on recharge la page ---
  await page.reload();
  await page.waitForTimeout(900);
  const fenetre = await page.$('dialog.dialogue');
  dit("3. la fenetre d'accueil s'affiche", fenetre !== null);
  if (fenetre !== null) {
    dit('   son texte', JSON.stringify((await fenetre.textContent()).replace(/\\s+/g, ' ').trim().slice(0, 130)));
    await page.click('dialog.dialogue .bouton-principal');
    await page.waitForTimeout(600);
  }
  dit('   repère repris', JSON.stringify(await page.textContent('#fichier-travail')));

  await charger(page, '0', '99');
  const noms = await page.$$eval('#frise .entree title, #frise .entree text',
    (n) => n.map(e => e.textContent));
  dit('4. la correction est visible sur la frise',
      noms.some(n => n && n.includes('NOM CORRIGÉ')));
  dit("   l'encart le dit",
      JSON.stringify((await page.textContent('#densite')).slice(-120)));

  // Deuxième modification, deuxième enregistrement : le fichier doit cumuler.
  const entrees = await page.$$('#frise .entree');
  await entrees[entrees.length - 1].click();
  await page.waitForTimeout(300);
  await page.fill('[data-champ="detail"]', 'seconde série');
  await page.dispatchEvent('[data-champ="detail"]', 'change');
  await page.waitForTimeout(200);
  await page.click('.bouton-principal');
  await page.waitForTimeout(600);

  fichier = await lireLeFichier(page);
  dit('5. opérations après le 2e enregistrement',
      fichier === null ? 'AUCUN FICHIER' : fichier.operations.length);
  dit('   la 1re série est toujours là',
      fichier !== null && fichier.operations.some(o => o.apres === 'NOM CORRIGÉ'));
  dit('   la 2e série aussi',
      fichier !== null && fichier.operations.some(o => o.apres === 'seconde série'));

  // --- Le clic sur le repère pendant que du travail est en cours ---
  const encore = await page.$$('#frise .entree');
  await encore[0].click();
  await page.waitForTimeout(300);
  await page.fill('[data-champ="detail"]', 'non enregistré');
  await page.dispatchEvent('[data-champ="detail"]', 'change');
  await page.waitForTimeout(200);
  await page.click('#retour-frise').catch(() => {});
  await page.waitForTimeout(200);
  dit('6. le retour reste barré tant que rien n\u2019est enregistré',
      await page.isVisible('#barrage'));
  await page.click('#fichier-travail');
  await page.waitForTimeout(400);
  const alerte = await page.$('dialog.dialogue');
  dit('   le changement de fichier demande confirmation', alerte !== null);
  if (alerte !== null) {
    dit('   son texte',
        JSON.stringify((await alerte.textContent()).replace(/\s+/g, ' ').trim().slice(0, 110)));
    await page.click('dialog.dialogue .bouton-discret');
    await page.waitForTimeout(300);
  }
  dit('   après « Non », le travail est intact',
      JSON.stringify(await page.evaluate(() => Promise.all([
        import('/js/contributions.js'), import('/js/fichier.js'),
      ]).then(([registre, disque]) => ({
        total: registre.total(), nonEnregistrees: registre.nombre(),
        fichier: disque.fichierChoisi(),
      })))));

  // --- Troisième session : repartir de zéro ---
  await page.evaluate(() => import('/js/contributions.js').then(m => m.abandonner()));
  await page.reload();
  await page.waitForTimeout(900);
  const trois = await page.$('dialog.dialogue');
  dit('7. la fenêtre revient à la 3e ouverture', trois !== null);
  if (trois !== null) {
    await page.click('dialog.dialogue .bouton-discret');
    await page.waitForTimeout(400);
  }
  dit('   après « Repartir de zéro », aucun fichier',
      JSON.stringify(await page.textContent('#fichier-travail')));
  dit('   le fichier sur le disque est intact',
      (await lireLeFichier(page)).operations.length);

  dit('8. erreurs JS', erreurs.length === 0 ? 'aucune' : JSON.stringify(erreurs.slice(0, 3)));
  await page.screenshot({ path: process.env.CAPTURE || '/tmp/coeval-edition.png', fullPage: true });
  await navigateur.close();
})();
