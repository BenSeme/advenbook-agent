// UI languages = the book languages the AdvenBook MCP supports.
export type Lang = "en" | "fr" | "es" | "de" | "it" | "eu";

export const LANGS: Lang[] = ["fr", "en", "es", "de", "it", "eu"];

const dict = {
  subtitle: {
    fr: "Vos sorties, transformées en livre imprimé — sans trier ni écrire.",
    en: "Your outings, turned into a printed book — without the sorting and writing.",
    es: "Tus salidas, convertidas en un libro impreso, sin ordenar ni escribir.",
    de: "Deine Touren als gedrucktes Buch — ohne Sortieren und Schreiben.",
    it: "Le tue uscite, trasformate in un libro stampato, senza ordinare né scrivere.",
    eu: "Zure irteerak, liburu inprimatu bihurtuta, ordenatu eta idatzi gabe.",
  },
  placeholder: {
    fr: "Parlez ou écrivez… ex. Mon été dans les Pyrénées",
    en: "Speak or type… e.g. My summer in the Pyrenees",
    es: "Habla o escribe… ej. Mi verano en los Pirineos",
    de: "Sprich oder tippe… z. B. Mein Sommer in den Pyrenäen",
    it: "Parla o scrivi… es. La mia estate sui Pirenei",
    eu: "Hitz egin edo idatzi… ad. Nire uda Pirinioetan",
  },
  speak: { fr: "Parler", en: "Speak", es: "Hablar", de: "Sprechen", it: "Parla", eu: "Hitz egin" },
  stop: { fr: "Arrêter", en: "Stop", es: "Parar", de: "Stopp", it: "Stop", eu: "Gelditu" },
  transcribing: { fr: "Transcription…", en: "Transcribing…", es: "Transcribiendo…", de: "Transkribiere…", it: "Trascrizione…", eu: "Transkribatzen…" },
  send: { fr: "Envoyer", en: "Send", es: "Enviar", de: "Senden", it: "Invia", eu: "Bidali" },
  working: { fr: "Je travaille…", en: "Working…", es: "Trabajando…", de: "Einen Moment…", it: "Lavoro…", eu: "Laneean…" },
  addGpx: { fr: "Ajouter un GPX", en: "Add a GPX", es: "Añadir un GPX", de: "GPX hinzufügen", it: "Aggiungi un GPX", eu: "Gehitu GPX bat" },
  addPhotos: { fr: "Ajouter des photos", en: "Add photos", es: "Añadir fotos", de: "Fotos hinzufügen", it: "Aggiungi foto", eu: "Gehitu argazkiak" },
  dropHint: {
    fr: "Glissez vos fichiers ici, ou touchez les boutons. Sur iPhone, la photothèque Apple s’ouvre ; sur Android, la galerie (Google Photos inclus).",
    en: "Drop files here, or tap the buttons. On iPhone your Apple Photos library opens; on Android, your gallery (Google Photos included).",
    es: "Suelta los archivos aquí o toca los botones. En iPhone se abre Fotos de Apple; en Android, tu galería (con Google Fotos).",
    de: "Dateien hierher ziehen oder die Buttons tippen. Auf dem iPhone öffnet sich Apple Fotos, auf Android die Galerie (inkl. Google Fotos).",
    it: "Trascina qui i file o tocca i pulsanti. Su iPhone si apre Foto di Apple; su Android, la galleria (con Google Foto).",
    eu: "Arrastatu fitxategiak hona edo sakatu botoiak. iPhonean Apple Argazkiak irekitzen da; Androiden, galeria (Google Argazkiak barne).",
  },
  createWithMine: {
    fr: "Créer le livre avec mes sorties",
    en: "Create the book with my outings",
    es: "Crear el libro con mis salidas",
    de: "Buch mit meinen Touren erstellen",
    it: "Crea il libro con le mie uscite",
    eu: "Sortu liburua nire irterekin",
  },
  remove: { fr: "Retirer", en: "Remove", es: "Quitar", de: "Entfernen", it: "Rimuovi", eu: "Kendu" },
  analysePhotos: {
    fr: "Choisir les meilleures photos (IA)",
    en: "Pick the best photos (AI)",
    es: "Elegir las mejores fotos (IA)",
    de: "Beste Fotos wählen ( KI )",
    it: "Scegli le foto migliori (IA)",
    eu: "Aukeratu argazkirik onenak (AA)",
  },
  cropUpload: {
    fr: "Recadrer (SAM) + envoyer les gardées",
    en: "Crop (SAM) + upload the keepers",
    es: "Recortar (SAM) + subir las elegidas",
    de: "Zuschneiden (SAM) + Auswahl hochladen",
    it: "Ritaglia (SAM) + carica le scelte",
    eu: "Moztu (SAM) + igo aukeratuak",
  },
  outingsTitle: { fr: "Vos sorties pour le livre", en: "Your outings for the book", es: "Tus salidas para el libro", de: "Deine Touren fürs Buch", it: "Le tue uscite per il libro", eu: "Zure irteerak libururako" },
  ticked: { fr: "cochées", en: "ticked", es: "marcadas", de: "ausgewählt", it: "selezionate", eu: "hautatuta" },
  on: { fr: "sur", en: "of", es: "de", de: "von", it: "su", eu: "/" },
  toHighlight: { fr: "à mettre en valeur", en: "to highlight", es: "a destacar", de: "Highlights", it: "da valorizzare", eu: "nabarmentzekoak" },
  showList: { fr: "Voir / modifier la liste", en: "View / edit the list", es: "Ver / editar la lista", de: "Liste ansehen / ändern", it: "Vedi / modifica la lista", eu: "Ikusi / aldatu zerrenda" },
  hideList: { fr: "Masquer la liste", en: "Hide the list", es: "Ocultar la lista", de: "Liste ausblenden", it: "Nascondi la lista", eu: "Ezkutatu zerrenda" },
  continueSelected: { fr: "Continuer avec la sélection", en: "Continue with selected", es: "Continuar con la selección", de: "Mit Auswahl weiter", it: "Continua con la selezione", eu: "Jarraitu hautaketarekin" },
  skipCreate: { fr: "Sans questions, créer maintenant", en: "Skip questions, create now", es: "Sin preguntas, crear ahora", de: "Ohne Fragen, jetzt erstellen", it: "Senza domande, crea ora", eu: "Galderarik gabe, sortu orain" },
  bookReady: { fr: "Votre brouillon de livre est prêt", en: "Your book draft is ready", es: "Tu borrador de libro está listo", de: "Dein Buchentwurf ist fertig", it: "La bozza del libro è pronta", eu: "Zure liburu zirriborroa prest dago" },
  openBook: { fr: "Ouvrir mon livre", en: "Open my book", es: "Abrir mi libro", de: "Mein Buch öffnen", it: "Apri il mio libro", eu: "Ireki nire liburua" },
  orderBook: { fr: "Commander mon livre", en: "Order my book", es: "Pedir mi libro", de: "Mein Buch bestellen", it: "Ordina il mio libro", eu: "Eskatu nire liburua" },
  coverTitle: {
    fr: "Votre couverture — touchez celle que vous aimez",
    en: "Your cover — tap the one you love",
    es: "Tu portada: toca la que te guste",
    de: "Dein Cover — tippe auf dein Lieblingsbild",
    it: "La tua copertina: tocca quella che ami",
    eu: "Zure azala: sakatu gustukoena",
  },
  coverChosen: { fr: "Couverture choisie", en: "Cover chosen", es: "Portada elegida", de: "Cover gewählt", it: "Copertina scelta", eu: "Azala aukeratuta" },
  coverPick: { fr: "Choisir cette couverture", en: "Choose this cover", es: "Elegir esta portada", de: "Dieses Cover wählen", it: "Scegli questa copertina", eu: "Aukeratu azal hau" },
  coverIntro: {
    fr: "Voici vos plus belles photos composées en couverture, avec votre titre. Touchez celle que vous préférez : c’est elle qui ouvrira votre livre.",
    en: "Here are your best photos composed as covers, with your title. Tap the one you prefer: it will open your book.",
    es: "Aquí están tus mejores fotos compuestas como portada, con tu título. Toca la que prefieras: abrirá tu libro.",
    de: "Hier sind deine schönsten Fotos als Cover komponiert, mit deinem Titel. Tippe auf dein Lieblingsbild: Es wird dein Buch eröffnen.",
    it: "Ecco le tue foto migliori composte come copertina, con il tuo titolo. Tocca quella che preferisci: aprirà il tuo libro.",
    eu: "Hona hemen zure argazkirik onenak azal gisa konposatuta, zure izenburuarekin. Sakatu gustukoena: zure liburua irekiko du.",
  },
  orderNote: {
    fr: "Commander : compte créé en un clic, puis paiement sécurisé Stripe sur advenbook.com. Aucune carte ni adresse ne vous sera demandée ici.",
    en: "Ordering: account created in one click, then secure Stripe payment on advenbook.com. No card or address will ever be asked here.",
    es: "Pedir: cuenta creada en un clic, luego pago seguro con Stripe en advenbook.com. Aquí nunca se pedirá tarjeta ni dirección.",
    de: "Bestellen: Konto mit einem Klick erstellt, dann sichere Stripe-Zahlung auf advenbook.com. Hier werden nie Karte oder Adresse abgefragt.",
    it: "Ordinare: account creato in un clic, poi pagamento sicuro Stripe su advenbook.com. Qui non verranno mai chiesti carta o indirizzo.",
    eu: "Eskatzea: kontua klik batean sortuta, gero Stripe ordainketa segurua advenbook.com-en. Hemen ez da inoiz txartelik edo helbiderik eskatuko.",
  },
  aboutPages: { fr: "pages environ", en: "about pages", es: "páginas aprox.", de: "ca. Seiten", it: "pagine circa", eu: "orrialde gutxi gorabehera" },
  estPrice: { fr: "Prix estimé", en: "Estimated price", es: "Precio estimado", de: "Geschätzter Preis", it: "Prezzo stimato", eu: "Kalkulatutako prezioa" },
  draftNote: {
    fr: "C’est un brouillon — vous le commandez sur advenbook.com, rien n’est payé.",
    en: "This is a draft — you order it on advenbook.com, nothing is paid yet.",
    es: "Es un borrador: lo pides en advenbook.com, aún no se paga nada.",
    de: "Das ist ein Entwurf — bestellt wird auf advenbook.com, noch nichts bezahlt.",
    it: "È una bozza: si ordina su advenbook.com, nulla è pagato.",
    eu: "Zirriborroa da: advenbook.com-en eskatzen da, ezer ez da ordaindu.",
  },
  connectTitle: { fr: "Connecter Strava — 3 étapes", en: "Connect your Strava — 3 steps", es: "Conectar Strava — 3 pasos", de: "Strava verbinden — 3 Schritte", it: "Collega Strava — 3 passi", eu: "Konektatu Strava — 3 urrats" },
  foundBook: {
    fr: "Je retrouve votre livre « {title} » ({n} sorties). On continue celui-ci, ou on en commence un nouveau ?",
    en: "I found your book “{title}” ({n} outings). Shall we continue it, or start a new one?",
    es: "Encontré tu libro «{title}» ({n} salidas). ¿Seguimos con este o empezamos uno nuevo?",
    de: "Ich habe dein Buch „{title}“ gefunden ({n} Touren). Machen wir damit weiter oder fangen wir ein neues an?",
    it: "Ho ritrovato il tuo libro «{title}» ({n} uscite). Continuiamo questo o ne iniziamo uno nuovo?",
    eu: "Zure «{title}» liburua aurkitu dut ({n} irteera). Honekin jarraitu, edo berri bat hasi?",
  },
  continueBookBtn: { fr: "Continuer ce livre", en: "Continue this book", es: "Continuar este libro", de: "Dieses Buch weiterführen", it: "Continua questo libro", eu: "Jarraitu liburu honekin" },
  newBookBtn: { fr: "Commencer un nouveau livre", en: "Start a new book", es: "Empezar un libro nuevo", de: "Ein neues Buch beginnen", it: "Inizia un libro nuovo", eu: "Hasi liburu berri bat" },
  orderedBadge: { fr: "Déjà commandé — il ne peut plus changer", en: "Already ordered — it can no longer change", es: "Ya pedido: ya no puede cambiar", de: "Bereits bestellt — nicht mehr änderbar", it: "Già ordinato: non può più cambiare", eu: "Eskaera egina: ezin da gehiago aldatu" },
  orderedNote: {
    fr: "Pour la suite, on peut créer un nouveau volume avec vos nouvelles sorties.",
    en: "For what comes next, we can create a new volume with your new outings.",
    es: "Para continuar, podemos crear un nuevo volumen con tus nuevas salidas.",
    de: "Für die Fortsetzung können wir einen neuen Band mit deinen neuen Touren erstellen.",
    it: "Per continuare, possiamo creare un nuovo volume con le tue nuove uscite.",
    eu: "Jarraitzeko, liburuki berri bat sor dezakegu zure irteera berriekin.",
  },
  outingsWord: { fr: "sorties", en: "outings", es: "salidas", de: "Touren", it: "uscite", eu: "irteera" },
  connectBtn: { fr: "1. Connecter Strava", en: "1. Connect Strava", es: "1. Conectar Strava", de: "1. Strava verbinden", it: "1. Collega Strava", eu: "1. Konektatu Strava" },
  connectedBtn: { fr: "2. C’est connecté — continuer", en: "2. I’ve connected — continue", es: "2. Ya está conectado — continuar", de: "2. Verbunden — weiter", it: "2. Collegato — continua", eu: "2. Konektatuta — jarraitu" },
  connectStep1: {
    fr: "Cliquez « {connect} » ci-dessous et autorisez sur Strava. Cette page est celle d’AdvenBook : elle ne vous ramènera pas ici toute seule.",
    en: "Click “{connect}” below and authorise on Strava. That page is AdvenBook’s — it will not bring you back here by itself.",
    es: "Toca «{connect}» abajo y autoriza en Strava. Esa página es de AdvenBook: no te traerá de vuelta aquí sola.",
    de: "Klicke unten auf „{connect}“ und autorisiere bei Strava. Diese Seite gehört AdvenBook — sie bringt dich nicht von selbst hierher zurück.",
    it: "Tocca «{connect}» qui sotto e autorizza su Strava. Quella pagina è di AdvenBook: non ti riporterà qui da sola.",
    eu: "Sakatu behean «{connect}» eta baimendu Stravan. Orri hori AdvenBook-ena da: ez zaitu hona berez itzuliko.",
  },
  connectStep2: {
    fr: "Revenez ici : en haut de votre navigateur, cliquez l’autre onglet (« AdvenBook Agent ») — ou fermez l’onglet Strava avec son ×. Cette page reste ouverte en dessous, rien n’est perdu.",
    en: "Come back here: at the top of your browser, click the other tab (“AdvenBook Agent”) — or close the Strava tab with its ×. This page stays open underneath, nothing is lost.",
    es: "Vuelve aquí: arriba en tu navegador, toca la otra pestaña («AdvenBook Agent») o cierra la pestaña de Strava con su ×. Esta página sigue abierta debajo, no se pierde nada.",
    de: "Komm hierher zurück: Klicke oben im Browser auf den anderen Tab („AdvenBook Agent“) — oder schließe den Strava-Tab mit seinem ×. Diese Seite bleibt darunter offen, nichts geht verloren.",
    it: "Torna qui: in alto nel browser, tocca l’altra scheda («AdvenBook Agent») o chiudi la scheda Strava con la sua ×. Questa pagina resta aperta sotto, non si perde nulla.",
    eu: "Itzuli hona: nabigatzailearen goialdean, sakatu beste fitxa («AdvenBook Agent») edo itxi Strava fitxa bere ×-rekin. Orri hau azpian irekita geratzen da, ezer ez da galtzen.",
  },
  connectStep3: {
    fr: "Cliquez « {connected} ». Je lirai alors vos sorties.",
    en: "Click “{connected}”. I’ll then read your outings.",
    es: "Toca «{connected}». Entonces leeré tus salidas.",
    de: "Klicke auf „{connected}“. Dann lese ich deine Touren.",
    it: "Tocca «{connected}». Allora leggerò le tue uscite.",
    eu: "Sakatu «{connected}». Orduan zure irteerak irakurriko ditut.",
  },
  copyConnectLink: { fr: "Copier le lien de connexion", en: "Copy the connect link", es: "Copiar el enlace de conexión", de: "Verbindungslink kopieren", it: "Copia il link di connessione", eu: "Kopiatu konexio esteka" },
  linkCopied: { fr: "Lien copié", en: "Link copied", es: "Enlace copiado", de: "Link kopiert", it: "Link copiato", eu: "Esteka kopiatuta" },
  connectCopiedNote: {
    fr: "La nouvelle page a été bloquée par votre navigateur : le lien est copié. Ouvrez-le dans Chrome ou Safari, autorisez Strava, puis revenez ici et cliquez « C’est connecté ».",
    en: "Your browser blocked the new page: the link is copied. Open it in Chrome or Safari, authorise Strava, then come back here and click “I’ve connected”.",
    es: "Tu navegador bloqueó la nueva página: el enlace está copiado. Ábrelo en Chrome o Safari, autoriza Strava, vuelve aquí y toca «Ya está conectado».",
    de: "Dein Browser hat die neue Seite blockiert: Der Link ist kopiert. Öffne ihn in Chrome oder Safari, autorisiere Strava, komm dann hierher zurück und klicke „Verbunden“.",
    it: "Il tuo browser ha bloccato la nuova pagina: il link è copiato. Aprila in Chrome o Safari, autorizza Strava, poi torna qui e tocca «Collegato».",
    eu: "Zure nabigatzaileak orri berria blokeatu du: esteka kopiatuta dago. Ireki Chrome edo Safarin, baimendu Strava, itzuli hona eta sakatu «Konektatuta».",
  },
  connectNote: {
    fr: "Lien valable 24 heures. Si la lecture échoue, l’autorisation n’est peut-être pas terminée : reconnectez-vous, puis cliquez à nouveau sur continuer.",
    en: "Link valid 24 hours. If reading fails, the authorisation may not have finished — reconnect, then click continue again.",
    es: "Enlace válido 24 horas. Si la lectura falla, quizá la autorización no terminó: vuelve a conectarte y toca continuar otra vez.",
    de: "Link 24 Stunden gültig. Wenn das Lesen fehlschlägt, ist die Autorisierung vielleicht nicht fertig — erneut verbinden und wieder auf Weiter klicken.",
    it: "Link valido 24 ore. Se la lettura fallisce, l’autorizzazione potrebbe non essere finita: ricollegati e tocca di nuovo continua.",
    eu: "Esteka 24 orduz baliozkoa. Irakurketak huts egiten badu, baliteke baimena ez amaitu izana: konektatu berriro eta sakatu jarraitu berriz.",
  },
  resumeTitle: { fr: "Strava : connexion détectée", en: "Strava: connection found", es: "Strava: conexión detectada", de: "Strava: Verbindung gefunden", it: "Strava: connessione trovata", eu: "Strava: konexioa aurkitu da" },
  resumeBtn: { fr: "Continuer — lire mes sorties", en: "Continue — read my outings", es: "Continuar — leer mis salidas", de: "Weiter — meine Touren lesen", it: "Continua — leggi le mie uscite", eu: "Jarraitu — irakurri nire irteerak" },
  forgetBtn: { fr: "Oublier cette connexion", en: "Forget this connection", es: "Olvidar esta conexión", de: "Verbindung vergessen", it: "Dimentica questa connessione", eu: "Ahaztu konexio hau" },
  hintIPhone: {
    fr: "Vous êtes sur iPhone : « Ajouter des photos » ouvre directement votre photothèque Apple. Glissez-déposez aussi vos fichiers ici.",
    en: "You are on iPhone: “Add photos” opens your Apple Photos library directly. You can also drop files here.",
    es: "Estás en iPhone: «Añadir fotos» abre tu fototeca de Apple directamente. También puedes soltar archivos aquí.",
    de: "Du bist auf einem iPhone: „Fotos hinzufügen“ öffnet direkt deine Apple-Fotothek. Dateien kannst du auch hierher ziehen.",
    it: "Sei su iPhone: «Aggiungi foto» apre direttamente la tua libreria Foto di Apple. Puoi anche trascinare qui i file.",
    eu: "iPhonean zaude: «Gehitu argazkiak» sakatzean Apple Argazkiak irekiko da. Fitxategiak hona ere arrasta ditzakezu.",
  },
  hintAndroid: {
    fr: "Vous êtes sur Android : « Ajouter des photos » ouvre votre galerie (Google Photos inclus). Glissez-déposez aussi vos fichiers ici.",
    en: "You are on Android: “Add photos” opens your gallery (Google Photos included). You can also drop files here.",
    es: "Estás en Android: «Añadir fotos» abre tu galería (con Google Fotos). También puedes soltar archivos aquí.",
    de: "Du bist auf Android: „Fotos hinzufügen“ öffnet deine Galerie (inkl. Google Fotos). Dateien kannst du auch hierher ziehen.",
    it: "Sei su Android: «Aggiungi foto» apre la tua galleria (con Google Foto). Puoi anche trascinare qui i file.",
    eu: "Androiden zaude: «Gehitu argazkiak» sakatzean galeria irekiko da (Google Argazkiak barne). Fitxategiak hona ere arrasta ditzakezu.",
  },
  hintDesktop: {
    fr: "Glissez vos fichiers ici, ou touchez les boutons pour les choisir sur cet appareil.",
    en: "Drop your files here, or tap the buttons to pick them on this device.",
    es: "Suelta tus archivos aquí o toca los botones para elegirlos en este dispositivo.",
    de: "Dateien hierher ziehen oder über die Buttons auf diesem Gerät auswählen.",
    it: "Trascina qui i file o tocca i pulsanti per sceglierli su questo dispositivo.",
    eu: "Arrastatu fitxategiak hona edo sakatu botoiak gailu honetan aukeratzeko.",
  },
  netError: {
    fr: "Désolé — je n’ai pas pu joindre le serveur. Vérifiez votre connexion, puis réessayez.",
    en: "Sorry — I couldn’t reach the server. Check your connection and try again.",
    es: "Perdón — no pude contactar el servidor. Revisa tu conexión e inténtalo de nuevo.",
    de: "Entschuldigung — der Server war nicht erreichbar. Bitte Verbindung prüfen und erneut versuchen.",
    it: "Scusa — non sono riuscito a contattare il server. Controlla la connessione e riprova.",
    eu: "Barkatu — ezin izan dut zerbitzariarekin konektatu. Egiaztatu konexioa eta saiatu berriro.",
  },
  serverError: {
    fr: "Désolé — ",
    en: "Sorry — ",
    es: "Perdón — ",
    de: "Entschuldigung — ",
    it: "Scusa — ",
    eu: "Barkatu — ",
  },
} as const;

export type DictKey = keyof typeof dict;

export function t(lang: Lang, key: DictKey): string {
  return dict[key][lang] ?? dict[key].en;
}

export type DeviceKind = "iphone" | "android" | "desktop";

/** Free, local detection from the user agent — no network, no cost. */
export function detectDevice(userAgent: string): DeviceKind {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iphone";
  if (/android/i.test(userAgent)) return "android";
  return "desktop";
}

export function detectLangFromText(text: string): Lang | null {
  const s = ` ${text.toLowerCase()} `;
  const count = (re: RegExp) => (s.match(re) ?? []).length;
  const scores: Record<Lang, number> = {
    fr: count(/\b(je|vous|mon|mes|les|des|une|est|fait|livre|sorties|avec|dans|pour|bonjour|merci|été)\b/g),
    es: count(/\b(yo|mi|mis|los|las|una|quiero|libro|salidas|con|para|gracias|verano|carreras)\b/g),
    it: count(/\b(io|mio|mie|gli|una|voglio|libro|uscite|con|per|grazie|estate|corse)\b/g),
    de: count(/\b(ich|mein|meine|und|das|buch|touren|mit|für|danke|sommer|läufe)\b/g),
    eu: count(/\b(nire|eta|dut|liburu|irteerak|uda|eskerrik|nahi)\b/g),
    en: count(/\b(i|my|the|and|want|book|outings|with|for|thanks|summer|runs)\b/g),
  };
  const best = (Object.entries(scores) as [Lang, number][]).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
}

export function fmtDistance(km: number | undefined, lang: Lang): string {
  if (km == null) return "";
  if (lang === "en") return `${(km * 0.621371).toFixed(1)} mi`;
  return `${km} km`;
}

export function fmtElevation(m: number | undefined, lang: Lang): string {
  if (m == null) return "";
  if (lang === "en") return `${Math.round(m * 3.28084)} ft`;
  return `${m} m D+`;
}

export function fmtPrice(price: unknown, lang: Lang): string | null {
  if (price == null) return null;
  if (typeof price === "number" || typeof price === "string") return String(price);
  if (typeof price === "object") {
    const p = price as Record<string, unknown>;
    const chosen = lang === "en" ? (p.usd ?? p.eur) : (p.eur ?? p.usd);
    if (chosen != null) return String(chosen);
    const amount = p.amount ?? p.price ?? p.total;
    if (amount != null) return `${amount} ${p.currency ?? ""}`.trim();
  }
  return null;
}
