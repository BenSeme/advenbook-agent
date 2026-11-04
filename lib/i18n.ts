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
  chooseFolder: { fr: "Choisir un dossier", en: "Choose a folder", es: "Elegir una carpeta", de: "Ordner wählen", it: "Scegli una cartella", eu: "Aukeratu karpeta bat" },
  welcome: {
    fr: "Bonjour ! Dites-moi quel livre vous voulez — par exemple « Mon été dans les Pyrénées ». Vous pouvez parler au micro ou écrire. Sans Strava ? Aucun souci : Garmin, Komoot ou un dossier de fichiers GPX + photos feront l’affaire — glissez-les ci-dessous ou collez un lien Komoot. Pas d’export non plus ? Dites-le-moi : on partira d’une liste que vous me dictez.",
    en: "Hi! Tell me what book you want — e.g. “My summer in the Pyrenees”. Speak or type; I’ll reply in your language. No Strava? No problem: Garmin, Komoot or a folder of GPX files + photos works too — drop them below or paste a Komoot link. No export either? Just say so — we’ll use a list you dictate.",
    es: "¡Hola! Dime qué libro quieres — por ejemplo «Mi verano en los Pirineos». Habla o escribe; respondo en tu idioma. ¿Sin Strava? Sin problema: Garmin, Komoot o una carpeta con archivos GPX + fotos también vale — suéltalos abajo o pega un enlace de Komoot.",
    de: "Hallo! Sag mir, welches Buch du möchtest — z. B. „Mein Sommer in den Pyrenäen“. Sprich oder tippe; ich antworte in deiner Sprache. Kein Strava? Kein Problem: Garmin, Komoot oder ein Ordner mit GPX-Dateien + Fotos geht auch — unten ablegen oder einen Komoot-Link einfügen.",
    it: "Ciao! Dimmi che libro vuoi — ad esempio «La mia estate sui Pirenei». Parla o scrivi; rispondo nella tua lingua. Niente Strava? Nessun problema: Garmin, Komoot o una cartella con file GPX + foto va bene — trascinali qui sotto o incolla un link Komoot.",
    eu: "Kaixo! Esadazu zer liburu nahi duzun — adibidez «Nire uda Pirinioetan». Hitz egin edo idatzi; zure hizkuntzan erantzungo dut. Stravarik ez? Arazorik ez: Garmin, Komoot edo GPX fitxategiak + argazkiak dituen karpeta bat ere balio du — bota behera edo itsatsi Komoot esteka bat.",
  },
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
  continueSelected: { fr: "Continuer — quelques questions", en: "Continue — a few questions", es: "Continuar — algunas preguntas", de: "Weiter — ein paar Fragen", it: "Continua — qualche domanda", eu: "Jarraitu — galdera batzuk" },
  skipCreate: { fr: "Créer le livre maintenant, sans questions", en: "Create the book now, no questions", es: "Crear el libro ahora, sin preguntas", de: "Buch jetzt erstellen, ohne Fragen", it: "Crea il libro ora, senza domande", eu: "Sortu liburua orain, galderarik gabe" },
  stravaDone: { fr: "C’est fait, je me suis connecté à Strava.", en: "Done, I’m connected to Strava.", es: "Listo, ya me he conectado a Strava.", de: "Erledigt, ich bin mit Strava verbunden.", it: "Fatto, mi sono collegato a Strava.", eu: "Eginda, Stravara konektatu naiz." },
  connectedNone: { fr: "Connexion bien reçue, mais je ne vois aucune sortie sur cette période. Dites-moi une autre période (par exemple « toutes mes sorties 2025 »), ou vérifiez que Strava est bien connecté.", en: "Connected, but I can’t see any outing in that period. Tell me another period (e.g. “all my 2025 outings”), or check that Strava is connected.", es: "Conexión recibida, pero no veo ninguna salida en ese periodo. Dime otro periodo (por ejemplo «todas mis salidas de 2025») o comprueba que Strava está conectado.", de: "Verbindung steht, aber ich sehe keine Tour in diesem Zeitraum. Nenne mir einen anderen Zeitraum (z. B. „alle meine Touren 2025“) oder prüfe die Strava-Verbindung.", it: "Collegamento ricevuto, ma non vedo uscite in questo periodo. Dimmi un altro periodo (ad esempio «tutte le mie uscite del 2025») o controlla che Strava sia collegato.", eu: "Konexioa jaso dut, baina ez dut irteerarik ikusten aldi horretan. Esadazu beste aldi bat (adibidez «2025eko irteera guztiak»), edo egiaztatu Strava konektatuta dagoela." },
  connectedList: { fr: "Connexion bien reçue — voici vos {n} sorties. La course principale de chaque jour est cochée, les échauffements sont décochés (recochables). Décochez ce que vous ne voulez pas, puis « Continuer ».", en: "Connected — here are your {n} outings. Each day’s main outing is ticked, warm-ups are unticked (you can tick them again). Untick what you don’t want, then “Continue”.", es: "Conexión recibida: aquí tienes tus {n} salidas. La salida principal de cada día está marcada, los calentamientos desmarcados (puedes volver a marcarlos). Desmarca lo que no quieras y pulsa «Continuar».", de: "Verbunden — hier sind deine {n} Touren. Die Haupttour jedes Tages ist angehakt, Aufwärmrunden nicht (wieder anhakbar). Entferne, was du nicht willst, dann „Weiter“.", it: "Collegato: ecco le tue {n} uscite. L’uscita principale di ogni giorno è selezionata, i riscaldamenti no (puoi riselezionarli). Togli ciò che non vuoi, poi «Continua».", eu: "Konektatuta — hona zure {n} irteerak. Egun bakoitzeko irteera nagusia markatuta dago, beroketak ez (berriro marka ditzakezu). Kendu nahi ez duzuna, eta gero «Jarraitu»." },
  createManualDisplay: { fr: "Créer le livre avec mes {n} sortie(s) ajoutée(s) (GPX/photos).", en: "Create the book with my {n} added outing(s) (GPX/photos).", es: "Crear el libro con mis {n} salida(s) añadida(s) (GPX/fotos).", de: "Buch mit meinen {n} hinzugefügten Tour(en) erstellen (GPX/Fotos).", it: "Crea il libro con le mie {n} uscite aggiunte (GPX/foto).", eu: "Sortu liburua gehitutako nire {n} irteerekin (GPX/argazkiak)." },
  selectionConfirmed: { fr: "Sélection confirmée ({n} sorties).", en: "Selection confirmed ({n} outings).", es: "Selección confirmada ({n} salidas).", de: "Auswahl bestätigt ({n} Touren).", it: "Selezione confermata ({n} uscite).", eu: "Hautaketa berretsita ({n} irteera)." },
  directCreateConfirmed: { fr: "Créer maintenant ({n} sorties, sans questions).", en: "Create now ({n} outings, no questions).", es: "Crear ahora ({n} salidas, sin preguntas).", de: "Jetzt erstellen ({n} Touren, ohne Fragen).", it: "Crea ora ({n} uscite, senza domande).", eu: "Sortu orain ({n} irteera, galderarik gabe)." },
  chooseNextStep: {
    fr: "Continuer garde les sorties cochées et passe à quelques questions facultatives (vos souvenirs), puis à la création. Créer maintenant crée le livre tout de suite, sans questions.",
    en: "Continue keeps the ticked outings and moves to a few optional questions (your memories), then creation. Create now creates the book right away, with no questions.",
    es: "Continuar conserva las salidas marcadas y pasa a unas preguntas opcionales (tus recuerdos), luego a la creación. Crear ahora crea el libro enseguida, sin preguntas.",
    de: "Weiter behält die ausgewählten Touren und geht zu ein paar optionalen Fragen (deine Erinnerungen), dann zur Erstellung. Jetzt erstellen erstellt das Buch sofort, ohne Fragen.",
    it: "Continua mantiene le uscite selezionate e passa a qualche domanda facoltativa (i tuoi ricordi), poi alla creazione. Crea ora crea subito il libro, senza domande.",
    eu: "Jarraitu hautatutako irteerak gorde eta aukerako galdera batzuetara pasatzen da (zure oroitzapenak), gero sorkuntzara. Sortu orain liburua berehala sortzen du, galderarik gabe.",
  },
  tickedByDay: {
    fr: "Course de chaque jour cochée, échauffements décochés — vous pouvez tout valider tel quel, sans ouvrir la liste.",
    en: "Each day's main outing is ticked, warm-ups unticked — you can accept everything as-is, without opening the list.",
    es: "La salida principal de cada día está marcada y los calentamientos desmarcados: puedes aceptarlo todo tal cual, sin abrir la lista.",
    de: "Die Haupttour jedes Tages ist ausgewählt, Aufwärmrunden nicht — du kannst alles so übernehmen, ohne die Liste zu öffnen.",
    it: "L'uscita principale di ogni giorno è selezionata, i riscaldamenti no: puoi accettare tutto così com'è, senza aprire la lista.",
    eu: "Egun bakoitzeko irteera nagusia hautatuta dago, beroketak ez — dena dagoen bezala onar dezakezu, zerrenda ireki gabe.",
  },
  bookReady: { fr: "Votre brouillon de livre est prêt", en: "Your book draft is ready", es: "Tu borrador de libro está listo", de: "Dein Buchentwurf ist fertig", it: "La bozza del libro è pronta", eu: "Zure liburu zirriborroa prest dago" },
  openBook: { fr: "Ouvrir mon livre", en: "Open my book", es: "Abrir mi libro", de: "Mein Buch öffnen", it: "Apri il mio libro", eu: "Ireki nire liburua" },
  orderBook: { fr: "Commander mon livre", en: "Order my book", es: "Pedir mi libro", de: "Mein Buch bestellen", it: "Ordina il mio libro", eu: "Eskatu nire liburua" },
  celebSkip: { fr: "Passer", en: "Skip", es: "Saltar", de: "Überspringen", it: "Salta", eu: "Saltatu" },
  celebClose: { fr: "Fermer", en: "Close", es: "Cerrar", de: "Schließen", it: "Chiudi", eu: "Itxi" },
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
  photoTooLarge: { fr: "Cette photo est trop lourde, elle a été écartée.", en: "This photo is too large, it was skipped.", es: "Esta foto es demasiado grande, se ha omitido.", de: "Dieses Foto ist zu groß, es wurde übersprungen.", it: "Questa foto è troppo grande, è stata saltata.", eu: "Argazki hau handiegia da, saltatu egin da." },
  invalidResponse: { fr: "Le serveur a renvoyé une réponse illisible, réessayez.", en: "The server returned an unreadable reply, please try again.", es: "El servidor devolvió una respuesta ilegible, inténtalo de nuevo.", de: "Der Server hat eine unlesbare Antwort gesendet, bitte erneut versuchen.", it: "Il server ha restituito una risposta illeggibile, riprova.", eu: "Zerbitzariak erantzun irakurgaitza itzuli du, saiatu berriro." },
  photoReadyStatus: { fr: "prête", en: "ready", es: "lista", de: "bereit", it: "pronta", eu: "prest" },
  photoUploadFailed: { fr: "Échec envoi", en: "Upload failed", es: "Error al subir", de: "Upload fehlgeschlagen", it: "Caricamento fallito", eu: "Igoerak huts egin du" },
  croppingUploading: { fr: "Recadrage et envoi…", en: "Cropping and uploading…", es: "Recortando y subiendo…", de: "Zuschneiden und Hochladen…", it: "Ritaglio e caricamento…", eu: "Moztu eta igotzen…" },
  choosingPhotos: { fr: "Choix de vos meilleures photos…", en: "Choosing your best photos…", es: "Eligiendo tus mejores fotos…", de: "Deine besten Fotos werden gewählt…", it: "Scelgo le tue foto migliori…", eu: "Zure argazkirik onenak aukeratzen…" },
  uploadingPhotos: { fr: "Envoi de vos photos en pleine qualité…", en: "Uploading your photos in full quality…", es: "Subiendo tus fotos en calidad completa…", de: "Deine Fotos werden in voller Qualität hochgeladen…", it: "Carico le tue foto in qualità originale…", eu: "Zure argazkiak kalitate osoan igotzen…" },
  analysisFailed: { fr: "Analyse impossible", en: "Analysis failed", es: "Análisis imposible", de: "Analyse nicht möglich", it: "Analisi impossibile", eu: "Analisia ezinezkoa" },
  freePhotos: { fr: "Photos libres", en: "Free photos", es: "Fotos libres", de: "Freie Fotos", it: "Foto libere", eu: "Argazki libreak" },
  outingFallback: { fr: "Sortie", en: "Outing", es: "Salida", de: "Tour", it: "Uscita", eu: "Irteera" },
  readingKomoot: { fr: "Lecture de Komoot…", en: "Reading Komoot…", es: "Leyendo Komoot…", de: "Komoot wird gelesen…", it: "Lettura di Komoot…", eu: "Komoot irakurtzen…" },
  komootFound: { fr: "J’ai trouvé {n} sorties Komoot publiques. Décochez celles que vous ne voulez pas, puis importez la sélection — Garmin, Komoot ou un dossier GPX + photos, tout marche ici, sans Strava.", en: "I found {n} public Komoot outings. Untick the ones you don't want, then import the selection — Garmin, Komoot or a folder of GPX + photos all work here, no Strava needed.", es: "Encontré {n} salidas públicas de Komoot. Desmarca las que no quieras e importa la selección: Garmin, Komoot o una carpeta GPX + fotos, todo funciona aquí, sin Strava.", de: "Ich habe {n} öffentliche Komoot-Touren gefunden. Entferne die unerwünschten und importiere die Auswahl — Garmin, Komoot oder ein Ordner mit GPX + Fotos, alles geht hier, ohne Strava.", it: "Ho trovato {n} uscite pubbliche di Komoot. Togli quelle che non vuoi e importa la selezione: Garmin, Komoot o una cartella GPX + foto, tutto funziona qui, senza Strava.", eu: "{n} Komoot irteera publiko aurkitu ditut. Kendu nahi ez dituzunak eta inportatu hautaketa: Garmin, Komoot edo GPX + argazki karpeta, denak balio du hemen, Strava gabe." },
  komootAdded: { fr: "{n} sortie(s) Komoot ajoutée(s) ci-dessous. Ajoutez vos photos si vous voulez, puis touchez « Créer le livre avec mes sorties ».", en: "{n} Komoot outing(s) added below. Add your photos if you like, then tap “Create the book with my outings”.", es: "{n} salida(s) de Komoot añadida(s) abajo. Añade tus fotos si quieres y toca «Crear el libro con mis salidas».", de: "{n} Komoot-Tour(en) unten hinzugefügt. Füge deine Fotos hinzu, wenn du möchtest, und tippe dann auf „Buch mit meinen Touren erstellen“.", it: "{n} uscite Komoot aggiunte qui sotto. Aggiungi le tue foto se vuoi, poi tocca «Crea il libro con le mie uscite».", eu: "{n} Komoot irteera gehitu dira behean. Gehitu argazkiak nahi baduzu, eta sakatu «Sortu liburua nire irterekin»." },
  komootReadError: { fr: "Komoot : lecture impossible.", en: "Komoot: could not read that link.", es: "Komoot: no se pudo leer ese enlace.", de: "Komoot: Dieser Link konnte nicht gelesen werden.", it: "Komoot: impossibile leggere quel link.", eu: "Komoot: ezin izan da esteka hori irakurri." },
  fileReadError: { fr: "Je n’ai pas pu lire le fichier « {name} » (trace introuvable). Vérifiez que c’est bien un .gpx, .tcx ou .fit Garmin avec des points GPS.", en: "I couldn't read the file “{name}” (no track found). Check that it is a Garmin .gpx, .tcx or .fit file with GPS points.", es: "No pude leer el archivo «{name}» (sin recorrido). Comprueba que sea un archivo Garmin .gpx, .tcx o .fit con puntos GPS.", de: "Die Datei „{name}“ konnte nicht gelesen werden (keine Strecke gefunden). Prüfe, ob es eine Garmin-Datei (.gpx, .tcx oder .fit) mit GPS-Punkten ist.", it: "Non sono riuscito a leggere il file «{name}» (nessuna traccia). Controlla che sia un file Garmin .gpx, .tcx o .fit con punti GPS.", eu: "Ezin izan dut «{name}» fitxategia irakurri (ez dago ibilbiderik). Egiaztatu Garmin .gpx, .tcx edo .fit fitxategia dela, GPS puntuekin." },
  stravaReading: { fr: "Lecture de vos sorties Strava…", en: "Reading your Strava outings…", es: "Leyendo tus salidas de Strava…", de: "Deine Strava-Touren werden gelesen…", it: "Lettura delle tue uscite Strava…", eu: "Zure Strava irteerak irakurtzen…" },
  stravaReadFailed: { fr: "La lecture Strava a échoué. Reconnectez-vous puis cliquez Continuer.", en: "Reading Strava failed. Reconnect, then click Continue.", es: "La lectura de Strava falló. Vuelve a conectarte y toca Continuar.", de: "Das Lesen von Strava ist fehlgeschlagen. Erneut verbinden und auf Weiter klicken.", it: "La lettura di Strava non è riuscita. Ricollegati e tocca Continua.", eu: "Strava irakurketak huts egin du. Konektatu berriro eta sakatu Jarraitu." },
  stravaNetworkError: { fr: "Je n’ai pas pu joindre le serveur pour lire vos sorties. Réessayez dans un instant.", en: "I couldn't reach the server to read your outings. Try again in a moment.", es: "No pude contactar el servidor para leer tus salidas. Inténtalo en un momento.", de: "Der Server war zum Lesen deiner Touren nicht erreichbar. Versuche es gleich erneut.", it: "Non sono riuscito a contattare il server per leggere le tue uscite. Riprova tra poco.", eu: "Ezin izan dut zerbitzariarekin konektatu zure irteerak irakurtzeko. Saiatu berriro une batean." },
  creatingBook: { fr: "Création de votre livre…", en: "Creating your book draft…", es: "Creando tu libro…", de: "Dein Buch wird erstellt…", it: "Creo il tuo libro…", eu: "Zure liburua sortzen…" },
  thinking: { fr: "Je réfléchis…", en: "Thinking…", es: "Pensando…", de: "Einen Moment…", it: "Penso…", eu: "Pentsatzen…" },
  bookCreationFailed: { fr: "La création du livre a échoué — réessayez.", en: "Book creation failed — please try again.", es: "La creación del libro falló, inténtalo de nuevo.", de: "Die Bucherstellung ist fehlgeschlagen — bitte erneut versuchen.", it: "La creazione del libro non è riuscita, riprova.", eu: "Liburuaren sorkuntzak huts egin du, saiatu berriro." },
  bookNetworkError: { fr: "Je n’ai pas pu joindre le serveur pour créer le livre. Réessayez dans un instant.", en: "I could not reach the server to create the book. Please try again.", es: "No pude contactar el servidor para crear el libro. Inténtalo de nuevo.", de: "Der Server war zum Erstellen des Buchs nicht erreichbar. Bitte erneut versuchen.", it: "Non sono riuscito a contattare il server per creare il libro. Riprova.", eu: "Ezin izan dut zerbitzariarekin konektatu liburua sortzeko. Saiatu berriro." },
  photosReadySkipped: { fr: "{ready} photo(s) prête(s), {skipped} écartée(s) — je les place dans le livre.", en: "{ready} photo(s) ready, {skipped} skipped — placing them in the book.", es: "{ready} foto(s) lista(s), {skipped} omitida(s): las coloco en el libro.", de: "{ready} Foto(s) bereit, {skipped} übersprungen — ich platziere sie im Buch.", it: "{ready} foto pronte, {skipped} saltate: le inserisco nel libro.", eu: "{ready} argazki prest, {skipped} saltatuta — liburuan jartzen ditut." },
  photosNoneReady: { fr: "Aucune photo prête, {skipped} écartée(s). Vous pouvez quand même créer le livre sans elles.", en: "No photo ready, {skipped} skipped. You can still create the book without them.", es: "Ninguna foto lista, {skipped} omitida(s). Aún puedes crear el libro sin ellas.", de: "Kein Foto bereit, {skipped} übersprungen. Du kannst das Buch auch ohne sie erstellen.", it: "Nessuna foto pronta, {skipped} saltate. Puoi comunque creare il libro senza di esse.", eu: "Argazkirik ez prest, {skipped} saltatuta. Liburua haiek gabe ere sor dezakezu." },
  seeSortPhotos: { fr: "Voir et trier les photos", en: "See and sort photos", es: "Ver y ordenar las fotos", de: "Fotos ansehen und ordnen", it: "Vedi e ordina le foto", eu: "Ikusi eta ordenatu argazkiak" },
  hidePhotos: { fr: "Masquer les photos", en: "Hide photos", es: "Ocultar las fotos", de: "Fotos ausblenden", it: "Nascondi le foto", eu: "Ezkutatu argazkiak" },
  clearAll: { fr: "Tout retirer", en: "Clear all", es: "Quitar todo", de: "Alle entfernen", it: "Rimuovi tutto", eu: "Kendu dena" },
  keptWord: { fr: "gardée", en: "kept", es: "guardada", de: "behalten", it: "conservata", eu: "gordeta" },
  droppedWord: { fr: "écartée", en: "dropped", es: "descartada", de: "verworfen", it: "scartata", eu: "baztertua" },
  addedWord: { fr: "ajoutée", en: "added", es: "añadida", de: "hinzugefügt", it: "aggiunta", eu: "gehituta" },
  photosCount: { fr: "{n} photo(s)", en: "{n} photo(s)", es: "{n} foto(s)", de: "{n} Foto(s)", it: "{n} foto", eu: "{n} argazki" },
  keptCount: { fr: "{n} gardée(s)", en: "{n} kept", es: "{n} guardada(s)", de: "{n} behalten", it: "{n} conservate", eu: "{n} gordeta" },
  foundTracksPhotos: { fr: "Trouvé {tracks} sortie(s) et {photos} photo(s)", en: "Found {tracks} outing(s) and {photos} photo(s)", es: "Encontradas {tracks} salida(s) y {photos} foto(s)", de: "{tracks} Tour(en) und {photos} Foto(s) gefunden", it: "Trovate {tracks} uscite e {photos} foto", eu: "{tracks} irteera eta {photos} argazki aurkitu dira" },
  unknownDate: { fr: "date inconnue", en: "unknown date", es: "fecha desconocida", de: "unbekanntes Datum", it: "data sconosciuta", eu: "data ezezaguna" },
  photoOuting: { fr: "Sortie de cette photo", en: "Outing for this photo", es: "Salida de esta foto", de: "Tour für dieses Foto", it: "Uscita di questa foto", eu: "Argazki honen irteera" },
  freePhotoOption: { fr: "Photo libre — l’agent la place tout seul", en: "Free photo — the agent places it itself", es: "Foto libre: el agente la coloca solo", de: "Freies Foto — der Agent platziert es selbst", it: "Foto libera: l'agente la posiziona da solo", eu: "Argazki librea — agenteak berak jartzen du" },
  preparingPhotos: { fr: "Préparation en cours…", en: "Preparing…", es: "Preparando…", de: "Wird vorbereitet…", it: "Preparazione…", eu: "Prestatzen…" },
  usePhotosInBook: { fr: "Utiliser ces photos dans le livre", en: "Use these photos in the book", es: "Usar estas fotos en el libro", de: "Diese Fotos im Buch verwenden", it: "Usa queste foto nel libro", eu: "Erabili argazki hauek liburuan" },
  usePhotosNote: { fr: "Un seul toucher : l’IA garde les meilleures, les recadre sans couper le sujet, les envoie, et place elle-même les photos libres (rattachées, pleine page, ou page à part).", en: "One tap: the AI keeps the best, crops them safely, sends them, and places free photos itself (attached, full page, or its own page).", es: "Un toque: la IA guarda las mejores, las recorta sin cortar el sujeto, las envía y coloca las fotos libres (adjuntas, a página completa o en su propia página).", de: "Ein Tippen: Die KI behält die besten, schneidet sie sicher zu, sendet sie und platziert freie Fotos selbst (zugeordnet, ganzseitig oder als eigene Seite).", it: "Un tocco: l'IA tiene le migliori, le ritaglia senza tagliare il soggetto, le invia e posiziona da sola le foto libere (allegate, a pagina intera o su una pagina a parte).", eu: "Ukipen bat: AAk onenak gordetzen ditu, subjektua moztu gabe mozten ditu, bidaltzen ditu eta argazki libreak berak jartzen ditu (erantsita, orrialde osoan edo orrialde bereizian)." },
  shortHintIphone: { fr: "iPhone — la photothèque s’ouvre directement.", en: "iPhone — Photos opens directly.", es: "iPhone: Fotos se abre directamente.", de: "iPhone — Fotos öffnet sich direkt.", it: "iPhone: Foto si apre direttamente.", eu: "iPhone — Argazkiak zuzenean irekitzen da." },
  shortHintAndroid: { fr: "Android — la galerie s’ouvre directement.", en: "Android — your gallery opens directly.", es: "Android: tu galería se abre directamente.", de: "Android — deine Galerie öffnet sich direkt.", it: "Android: la galleria si apre direttamente.", eu: "Android — galeria zuzenean irekitzen da." },
  shortHintDesktop: { fr: "Glissez des fichiers ici, ou utilisez les boutons.", en: "Drop files here, or use the buttons.", es: "Suelta archivos aquí o usa los botones.", de: "Dateien hierher ziehen oder die Buttons nutzen.", it: "Trascina qui i file o usa i pulsanti.", eu: "Arrastatu fitxategiak hona edo erabili botoiak." },
  addFilesLabel: { fr: "Ajouter GPX et photos", en: "Add GPX and photos", es: "Añadir GPX y fotos", de: "GPX und Fotos hinzufügen", it: "Aggiungi GPX e foto", eu: "Gehitu GPX eta argazkiak" },
  photosAddedLabel: { fr: "Photos ajoutées", en: "Added photos", es: "Fotos añadidas", de: "Hinzugefügte Fotos", it: "Foto aggiunte", eu: "Gehitutako argazkiak" },
  highlightBadge: { fr: "À mettre en valeur", en: "Highlight", es: "A destacar", de: "Highlight", it: "Da valorizzare", eu: "Nabarmentzekoa" },
  warmupNote: { fr: "échauffement probable — décoché par défaut", en: "likely warm-up — unticked by default", es: "probable calentamiento: desmarcado por defecto", de: "wahrscheinlich Aufwärmen — standardmäßig nicht ausgewählt", it: "probabile riscaldamento: non selezionato di default", eu: "beroketa probablea — lehenespenez markatu gabe" },
  badgeRace: { fr: "Course officielle", en: "Official race", es: "Carrera oficial", de: "Offizielles Rennen", it: "Gara ufficiale", eu: "Lasterketa ofiziala" },
  badgeRoute: { fr: "Beau tracé", en: "Great route", es: "Buen recorrido", de: "Schöne Strecke", it: "Bel percorso", eu: "Ibilbide polita" },
  badgeElevation: { fr: "Gros dénivelé", en: "Big climb", es: "Gran desnivel", de: "Viele Höhenmeter", it: "Grande dislivello", eu: "Desnibel handia" },
  badgeDistance: { fr: "Longue distance", en: "Long distance", es: "Larga distancia", de: "Lange Distanz", it: "Lunga distanza", eu: "Distantzia luzea" },
  badgePhotos: { fr: "{n} photos", en: "{n} photos", es: "{n} fotos", de: "{n} Fotos", it: "{n} foto", eu: "{n} argazki" },
  copyBookLink: { fr: "Copier le lien du livre", en: "Copy the book link", es: "Copiar el enlace del libro", de: "Buchlink kopieren", it: "Copia il link del libro", eu: "Kopiatu liburuaren esteka" },
  previewNote: { fr: "Si cet aperçu remplace la page de l’agent (navigateur intégré), copiez le lien et ouvrez-le dans Chrome ou Safari — rien n’est perdu, le livre est enregistré.", en: "If this preview replaces the agent page (embedded browser), copy the link and open it in Chrome or Safari — nothing is lost, the book is saved.", es: "Si esta vista previa reemplaza la página del agente (navegador integrado), copia el enlace y ábrelo en Chrome o Safari: no se pierde nada, el libro está guardado.", de: "Wenn diese Vorschau die Agentenseite ersetzt (eingebetteter Browser), kopiere den Link und öffne ihn in Chrome oder Safari — nichts geht verloren, das Buch ist gespeichert.", it: "Se questa anteprima sostituisce la pagina dell'agente (browser integrato), copia il link e aprilo in Chrome o Safari: non si perde nulla, il libro è salvato.", eu: "Aurrebista honek agentearen orria ordezkatzen badu (kapsulatutako nabigatzailea), kopiatu esteka eta ireki Chrome edo Safarin — ezer ez da galtzen, liburua gordeta dago." },
  komootTitle: { fr: "Vos sorties Komoot", en: "Your Komoot outings", es: "Tus salidas de Komoot", de: "Deine Komoot-Touren", it: "Le tue uscite Komoot", eu: "Zure Komoot irteerak" },
  importSelected: { fr: "Importer la sélection ({n})", en: "Import selected ({n})", es: "Importar la selección ({n})", de: "Auswahl importieren ({n})", it: "Importa la selezione ({n})", eu: "Inportatu hautaketa ({n})" },
  distanceLabel: { fr: "distance", en: "distance", es: "distancia", de: "Distanz", it: "distanza", eu: "distantzia" },
  elevationLabel: { fr: "dénivelé", en: "elevation gain", es: "desnivel", de: "Höhenmeter", it: "dislivello", eu: "desnibela" },
  resumeCardBody: { fr: "Si vous avez déjà autorisé Strava sur la page AdvenBook (même si elle a remplacé cette page), cliquez Continuer : je lis vos sorties directement. Sinon, redemandez votre livre dans la conversation pour obtenir un lien de connexion.", en: "If you have already authorised Strava on the AdvenBook page (even if it replaced this page), click Continue: I will read your outings directly. Otherwise, ask for your book again in the conversation to get a connect link.", es: "Si ya autorizaste Strava en la página de AdvenBook (aunque haya reemplazado esta página), toca Continuar: leeré tus salidas directamente. Si no, pide tu libro de nuevo en la conversación para obtener un enlace de conexión.", de: "Wenn du Strava auf der AdvenBook-Seite bereits autorisiert hast (auch wenn sie diese Seite ersetzt hat), klicke auf Weiter: Ich lese deine Touren direkt. Sonst bitte im Gespräch erneut um dein Buch, um einen Verbindungslink zu erhalten.", it: "Se hai già autorizzato Strava sulla pagina AdvenBook (anche se ha sostituito questa pagina), tocca Continua: leggerò le tue uscite direttamente. Altrimenti chiedi di nuovo il tuo libro nella conversazione per ottenere un link di collegamento.", eu: "Strava AdvenBook orrian baimendu baduzu (orri hau ordezkatu badu ere), sakatu Jarraitu: zure irteerak zuzenean irakurriko ditut. Bestela, eskatu berriro liburua elkarrizketan konexio esteka bat lortzeko." },
  continueBookReply: { fr: "C’est noté — on ajoute à ce livre. Cochez vos sorties ci-dessous, puis Continuer ou Créer directement.", en: "Got it — we'll add to that book. Tick your outings below, then Continue or Create directly.", es: "Entendido: añadiremos a ese libro. Marca tus salidas abajo y luego Continuar o Crear directamente.", de: "Verstanden — wir fügen zu diesem Buch hinzu. Wähle unten deine Touren und dann Weiter oder Direkt erstellen.", it: "Ricevuto: aggiungeremo a quel libro. Seleziona le uscite qui sotto, poi Continua o Crea direttamente.", eu: "Ulertuta — liburu horri gehituko diogu. Markatu irteerak behean, eta gero Jarraitu edo Sortu zuzenean." },
  newBookReply: { fr: "C’est noté — un tout nouveau livre. Cochez vos sorties ci-dessous, puis Continuer ou Créer directement.", en: "Got it — a brand-new book. Tick your outings below, then Continue or Create directly.", es: "Entendido: un libro nuevo. Marca tus salidas abajo y luego Continuar o Crear directamente.", de: "Verstanden — ein ganz neues Buch. Wähle unten deine Touren und dann Weiter oder Direkt erstellen.", it: "Ricevuto: un libro nuovo di zecca. Seleziona le uscite qui sotto, poi Continua o Crea direttamente.", eu: "Ulertuta — liburu berri-berria. Markatu irteerak behean, eta gero Jarraitu edo Sortu zuzenean." },
  coverChosenDisplay: { fr: "Photo de couverture choisie ✓", en: "Cover photo chosen ✓", es: "Foto de portada elegida ✓", de: "Coverfoto gewählt ✓", it: "Foto di copertina scelta ✓", eu: "Azaleko argazkia aukeratuta ✓" },
  continuingBookDisplay: { fr: "Je continue mon livre « {title} »", en: "Continuing my book “{title}”", es: "Continúo mi libro «{title}»", de: "Ich führe mein Buch „{title}“ weiter", it: "Continuo il mio libro «{title}»", eu: "Nire «{title}» liburuarekin jarraitzen dut" },
  newBookDisplay: { fr: "Je commence un nouveau livre", en: "Starting a new book", es: "Empiezo un libro nuevo", de: "Ich beginne ein neues Buch", it: "Inizio un libro nuovo", eu: "Liburu berri bat hasten dut" },
  yourMessage: { fr: "Votre message", en: "Your message", es: "Tu mensaje", de: "Deine Nachricht", it: "Il tuo messaggio", eu: "Zure mezua" },
  micStart: { fr: "Parler au micro", en: "Speak into the microphone", es: "Hablar por el micrófono", de: "Ins Mikrofon sprechen", it: "Parla al microfono", eu: "Hitz egin mikrofonoan" },
  micStop: { fr: "Arrêter l'enregistrement", en: "Stop recording", es: "Detener la grabación", de: "Aufnahme stoppen", it: "Ferma la registrazione", eu: "Gelditu grabaketa" },
  transparencyLink: { fr: "Transparence et vos données", en: "Transparency & your data", es: "Transparencia y tus datos", de: "Transparenz & deine Daten", it: "Trasparenza e i tuoi dati", eu: "Gardentasuna eta zure datuak" },
  transcriptionFailed: { fr: "Désolé — la transcription a échoué ({err}). Vous pouvez écrire votre réponse.", en: "Sorry — transcription failed ({err}). Please type your answer instead.", es: "Perdón — la transcripción falló ({err}). Escribe tu respuesta.", de: "Entschuldigung — die Transkription ist fehlgeschlagen ({err}). Bitte tippe deine Antwort.", it: "Scusa — la trascrizione non è riuscita ({err}). Scrivi la tua risposta.", eu: "Barkatu — transkripzioak huts egin du ({err}). Idatzi zure erantzuna." },
  micUnavailable: { fr: "Je n’ai pas accès au micro (autorisation refusée ?). Vous pouvez écrire votre réponse.", en: "I can't access the microphone (permission refused?). Please type your answer.", es: "No puedo acceder al micrófono (¿permiso denegado?). Escribe tu respuesta.", de: "Kein Zugriff aufs Mikrofon (Erlaubnis verweigert?). Bitte tippe deine Antwort.", it: "Non riesco ad accedere al microfono (permesso negato?). Scrivi la tua risposta.", eu: "Ezin dut mikrofonora sartu (baimena ukatua?). Idatzi zure erantzuna." },
} as const;

export type DictKey = keyof typeof dict;

export const DICT_KEYS = Object.keys(dict) as DictKey[];

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
