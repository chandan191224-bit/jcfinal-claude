"""Shot list: every image in the video, in order, tied to the narration paragraph it plays under.

P[paragraph_id] = [prompt, prompt, ...]. One image every ~3.5 seconds of narration.
Image files are numbered in shot order: 001, 002, ...
Run `python3 video/tools/build_prompts.py` to regenerate prompts.md and shots.json.
"""

STYLE = (
    "photorealistic cinematic film still, historical epic movie scene, realistic people and "
    "period-accurate costumes, natural skin texture, dramatic natural lighting, shot on 35mm "
    "lens, shallow depth of field, rich detail, 8k, 16:9 widescreen, not cartoon, not anime, "
    "not illustration, no text, no letters, no watermark"
)

# Recurring characters: the same description every time keeps their look consistent.
PRITHVIRAJ = "young Rajput king Prithviraj Chauhan with a thin moustache, saffron turban with a jewel, gold-trimmed armor"
GHORI = "Afghan sultan Muhammad Ghori with a dark beard, dark green robes and a pointed steel helmet"
AIBAK = "Turkish general Qutbuddin Aibak with a short beard, conical steel helmet and red cloak"
ALAUDDIN = "Sultan Alauddin Khilji with a thick black beard, white jewelled turban and purple robes"
GHIYAS = "elderly Sultan Ghiyasuddin Tughlaq with a grey beard and blue robes"
MBT = "Sultan Muhammad bin Tughlaq with an intense face, black beard, dark blue robes and gold turban"
FIROZ = "kind old Sultan Firoz Shah Tughlaq with a white beard and green robes"
TIMUR = "fierce Central Asian conqueror Timur with a forked beard and fur-lined armor"
BABUR = "Mughal king Babur with a short beard and a fur-trimmed Central Asian cap"
HUMAYUN = "Mughal emperor Humayun with a thin beard, white turban with a feather and a gentle bookish face"
SHERSHAH = "Afghan ruler Sher Shah Suri with a full beard, steel helmet and green cloak"
HEMU = "Indian general Hemu with a moustache, white turban and steel armor"
SHAHJAHAN = "Mughal emperor Shah Jahan with a full black beard, jewelled turban and golden robes"
JAHANARA = "Mughal princess Jahanara in an elegant pink and gold dress with a light veil"
NADIR = "Persian ruler Nadir Shah with a big black beard, tall red Persian hat and armor"
ZAFAR = "frail 82-year-old Mughal emperor Bahadur Shah Zafar with a long white beard, simple white robes and white cap"

P = {}

# ---------------- HOOK ----------------
P[1] = [
    "A procession of kings from different eras (Rajput, Sultan, Mughal, British) walking toward a golden throne on a hill above medieval Delhi, golden hour, epic",
    "Close-up of a jewelled crown being placed on a king's head in a grand hall, crowds bowing, triumphant",
    f"The {ZAFAR} sitting alone in a tiny bare room with one small window, dim blue light, deep sadness",
    "A small patch of bare earth under a lonely tree in a foreign land, a single fallen flower, soft rain, melancholy",
]
P[2] = [
    "An ancient riverside city of white palaces beside the Yamuna, mythic glow, morning mist, wide view",
    "Silhouettes of invading armies on horseback cresting a hill above a medieval city, dramatic red sky",
    "Modern Delhi skyline at dusk with high-rises, highways and metro lines, millions of lights",
    "A medieval city on fire at night seen from a distant hill, orange smoke rising into a starry sky, tragic, no gore",
    "Time-lapse style scene of a ruined city rebuilding itself, new walls and domes rising from ruins, hopeful sunrise",
]
P[3] = [
    "Dreamlike skyline of Delhi through the ages: Qutub Minar, Red Fort, Jama Masjid domes, India Gate and a metro train together under a glowing sunset, birds flying",
    "Ruins of several ancient forts and walls scattered across the same landscape of Delhi, aerial drone shot at sunset",
    "A storyteller's old map of Delhi unrolling on a wooden table with a lamp, compass and quill, unreadable labels",
]

# ---------------- BEGINNING ----------------
P[4] = [
    "An old leather-bound history book opening by itself, pages fluttering, golden dust rising from the pages",
    "Camera diving into the pages of a glowing book that turn into an ancient landscape, magical transition",
]
P[5] = [
    "Ancient untouched river plain of North India thousands of years ago, tall grass, grazing deer, morning mist",
    "Early humans arriving at a riverbank and looking at the land with wonder, simple clothes, sunrise",
    "The wide calm Yamuna river flowing through green plains, fishing boats, birds, peaceful",
    "Ancient villagers drawing water and farming fields beside the Yamuna, cows, mud houses",
    "Wooden boats carrying goods on the Yamuna, early river trade, warm afternoon",
    "Rocky Aravalli ridge hills covered with thorny scrub forest beside the plain, wide shot",
    "The rocky ridge seen as a natural stone wall protecting a small settlement behind it, guards on rocks",
    "Aerial drone shot of ancient dirt trade roads from four directions meeting at a riverside settlement, caravans visible",
    "Bullock carts and caravans meeting at a busy crossroads market near the river, travellers from many lands",
]
P[6] = [
    "Misty dense forest beside a river, the faint glowing outline of a grand ancient city appearing like a vision",
]
P[7] = [
    "Five ancient Indian princes (the Pandavas) in simple royal attire leaving a great palace city, sad farewell",
    "The five princes standing at the edge of a huge dark dense forest by the Yamuna, back view, determination",
    "Dense wild Khandava forest with giant trees, wild animals, dark green shadows",
    "The princes and workers clearing the forest, trees falling, sunlight breaking through",
    "A magnificent ancient city of white stone and gold being built by the river, elephants hauling stone, flags",
    "The finished mythic city of Indraprastha glowing at sunset, palaces, gardens and river ghats",
    "The old stone walls and great gateway of Purana Qila fort in Delhi today, golden afternoon",
    "A small early-1900s village of mud houses and huts inside the walls of an old fort, villagers and cows, nostalgic",
]
P[8] = [
    "An old fort under brooding clouds at dawn, mysterious atmosphere",
    "Indian archaeologists in hats arriving at an old fort with tools and measuring poles, sunny day",
    "Archaeologists carefully digging deep rectangular trenches, brushes, buckets, sieves",
    "An archaeologist's hand brushing soil off an ancient object that begins to glow, wonder",
]
P[9] = [
    "Wall of an excavation trench showing many distinct soil layers stacked on top of each other, pottery, bricks and coins embedded in different layers, documentary photo",
    "Pre-Mauryan village life: simple huts, potters at wheels, cattle, early iron tools",
    "Mauryan era city with wooden palaces and stone pillars, soldiers and citizens",
    "Kushana era traders with coins and caravans, Central Asian clothing, busy market",
    "Gupta, Rajput, Sultanate and Mughal eras shown as a quick sequence of stacked buildings on the same land",
    "Double exposure of an ancient family and a modern family standing on the same spot, cinematic",
    "An ancient circular terracotta ring well uncovered in an excavation pit, archaeologists looking down into it",
    "Close-up of ancient grey pottery shards painted with simple black lines, laid on a cloth with a brush",
    "An ancient potter painting black patterns on grey clay pots, oil lamp, centuries before Christ",
]
P[10] = [
    "Soil in an excavation glowing softly as if holding memories, magical",
    "Emperor Ashoka in Mauryan royal robes and turban standing on a hill over a peaceful green land, serene",
]
P[11] = [
    "1960s South Delhi: a rocky area with a huge boulder, construction workers and old trucks",
    "A road contractor in a white shirt and workers placing dynamite next to the big boulder",
    "The contractor suddenly stopping, staring at strange carved lines on the rock, surprise",
    "Close-up of ancient Brahmi script carved into weathered rock, unreadable, sunlight",
    "Two Indian archaeologists in 1960s clothes running toward the rock with notebooks",
    "The archaeologists kneeling beside the rock tracing the carved script with their fingers, excited",
    "Ancient scene: Mauryan stone carvers chiselling Ashoka's message onto a rock, officials watching",
    "Emperor Ashoka's messengers reading the edict aloud to villagers gathered around the rock",
    "The inscribed rock today, protected under a small shelter with an iron railing in a quiet Delhi park",
]
P[12] = [
    "Time passing over an ancient landscape, centuries flowing like clouds, transition",
    "Golden age of the Gupta empire: scholars teaching under trees, students with palm-leaf manuscripts",
    "Gupta-era artisans carving beautiful stone sculptures and a temple, glowing warm atmosphere",
    "Scientists of today in a modern lab looking amazed at an old photo of an iron pillar",
]
P[13] = [
    "Low-angle dramatic view of the ancient Iron Pillar of Delhi standing tall in a stone courtyard against a vast blue sky",
]
P[14] = [
    "The Iron Pillar with a human figure beside it for scale, it towers over him, bright daylight",
    "Heavy iron being forged by ancient blacksmiths, sparks flying, glowing furnace",
    "The Iron Pillar under blazing summer sun, heat shimmer",
    "The Iron Pillar in heavy monsoon rain, water streaming down its smooth dark surface",
    "The Iron Pillar in thick winter fog at dawn, still unrusted",
    "Close-up of the smooth dark surface of the pillar with an ancient carved inscription, unreadable script",
    "A Gupta emperor (Chandragupta II) in royal robes with a bow, standing proudly, golden aura",
]
P[15] = [
    "A medieval craftsman climbing to the pillar with a chisel in hand, curious villagers watching",
    "Close-up of a hand carving a short line of unreadable script onto the iron pillar, sparks of light",
]
P[16] = [
    "Carved script on dark iron glowing golden as if revealing a secret, close-up, mystical",
    "Historians in an old study comparing an inscription rubbing with calendars and books by lamplight",
    "King Anangpal Tomar, a Rajput king with a moustache, turban and royal robes, pointing over a hill toward land for a new city",
    "Surveyors marking the outline of a new city with ropes and stakes on rocky ground",
    "A young medieval town named Dhillika rising, first houses and temples, sunrise",
]
P[17] = [
    "Workers building high rubble stone walls along rocky Aravalli hills",
    "The strong medieval fort Lal Kot on the hills, soldiers on the walls, banners, wide shot",
    "Sunrise breaking over the walls of the first fort of Delhi, golden rays, epic",
]
P[18] = [
    "A village grandmother telling a folk tale to children at night around a fire, cozy",
    "The Rajput king supervising workers hammering a tall iron pillar deep into the ground in a courtyard",
    "An old court astrologer with a long beard and scrolls warning the king in a lamp-lit hall",
    "The king looking at the pillar with doubt and suspicion, frowning",
    "Workers pulling the iron pillar up from the ground at the king's order",
    "The pillar tilting loosely in its hole, courtiers gasping in shock, dramatic",
    "The astrologer shaking his head sadly, the king realizing his mistake",
    "Ancient stone inscriptions in a museum hall, scholars examining them, unreadable script",
    "An old stone slab inscription in a Rajasthan village, Bijolia, sunset",
]
P[19] = [
    "The desert fort city of Ajmer with powerful Chauhan kings in court",
    "A large Chauhan army on horses and elephants marching from desert hills toward Delhi, banners, dust",
    "The Chauhan banner being raised over the walls of Lal Kot",
    f"Heroic portrait of {PRITHVIRAJ}, bow on his shoulder, confident gaze, sunset behind him",
]
P[20] = [
    f"{PRITHVIRAJ} looking at plans of a bigger fort with his architects",
    "Massive thick stone walls with many gates being built around a medieval city, scaffolding, workers",
    "The completed fort city Qila Rai Pithora from above, thick walls encircling homes and temples",
]
P[21] = [
    "Dawn over a medieval North Indian city, temple bells ringing, priests and devotees",
    "A busy medieval bazaar with grain sacks and colorful cloth, merchants and families",
    "A horse market with traders inspecting fine horses, dust and sunlight",
    "Farmers ploughing green fields with oxen beside the Yamuna, fort walls in the distance",
    "Children playing near the thick city walls while guards stand above, safe and happy",
    "Families sleeping peacefully at night inside the city walls, moonlight, sense of safety",
]
P[22] = [
    "The open plain of Tarain with two great armies facing each other, epic wide shot",
    f"{PRITHVIRAJ} leading a cavalry charge, banners flying, no gore",
    f"{GHORI} wounded, falling back on his horse, his soldiers retreating",
    "The Afghan army fleeing across the plain into a dust cloud at sunset",
]
P[23] = [
    "A medieval city celebrating victory at night with oil lamps, music and dancing on rooftops",
    "Happy townspeople releasing lanterns into the sky, everyone smiling, peaceful night",
]

# ---------------- MID ----------------
P[24] = [
    "The celebrating city at night as enormous dark storm clouds roll in from the horizon, ominous",
    "An hourglass with sand falling over a map of Delhi, centuries passing, symbolic",
    "Workers rebuilding a burnt medieval city, smoke still rising from ruins behind them",
    f"A giant shadowy silhouette of a Turkish sultan in the clouds above Delhi",
    "A giant shadowy silhouette of a Mughal emperor in the clouds above Delhi",
    "A giant shadowy silhouette of a British officer with a pith helmet in the clouds above Delhi, the darkest of all",
]
P[25] = [
    "Seasons changing over a battlefield plain, one year passing, time-lapse feel",
    f"{GHORI} leading a huge army of Turkish and Afghan cavalry across a plain, far larger than before",
    "The second battle of Tarain, Rajput army overwhelmed, dust and chaos, no gore",
    f"{PRITHVIRAJ} defeated and captured, head bowed, sorrowful sunset",
    f"{AIBAK} kneeling loyally before {GHORI}, being given command",
    f"{AIBAK} riding on horseback through the great stone gate of Lal Kot, soldiers behind him",
]
P[26] = [
    "A new green-and-gold sultanate banner rising over the stone walls of a medieval fort at dawn",
]
P[27] = [
    f"{GHORI} riding away toward the mountains of Afghanistan with his guards",
    "A royal funeral procession in the mountains, banners lowered, mourning",
    f"{AIBAK} sitting on a throne in a medieval court, nobles bowing, torchlight",
    "Broken iron chains lying on a marble floor before a throne, symbolic of a slave becoming king",
    f"A line of later sultans standing behind {AIBAK}, the Slave dynasty, portrait style",
]
P[28] = [
    "The Quwwat-ul-Islam mosque being built from carved stone pillars, workers carrying columns",
    "Ruins of temples with carved stones being carted away, somber mood",
    "Medieval inscription on a stone gateway being read by a scholar, unreadable script",
    "The colonnade of the Quwwat-ul-Islam mosque made of richly carved temple pillars, soft light",
    "Close-up of carved bells, chains and flowers on an old stone pillar, tourists photographing it today",
]
P[29] = [
    f"{AIBAK} laying the foundation stone of a tower, priests and courtiers watching",
    "Qutub Minar half-built with wooden scaffolding, workers carrying red sandstone blocks",
    "Sultan Iltutmish, Aibak's son-in-law with a dark beard, inspecting the rising tower",
    "A lightning bolt striking the top of the tall minaret during a storm",
    f"{FIROZ} ordering workers to repair the top storeys of the minaret",
    "A spiral stone staircase winding upward inside a tower, light from small windows",
    "Qutub Minar today, tall fluted red sandstone tower against a blue sky, tourists below, low angle",
]
P[30] = [
    "A royal caravan moving the court from Lahore to Delhi, elephants and carts, wide landscape",
    "Sultan Iltutmish crowned in Delhi, nobles bowing, Delhi as the new capital",
    "A royal court where everyone turns to look in surprise at a woman walking toward the throne",
    "Razia Sultan, a brave woman ruler with a turban-like headdress and armor, sitting on the throne of Delhi with a sword",
    "Razia Sultan riding an elephant in a procession, people amazed, bold",
    "Powerful nobles whispering and plotting in a dark corridor of the palace, tense",
    "Razia alone in a dark hall surrounded by shadows of plotting nobles, isolated",
    "A battle at dusk, Razia's small army against rebel nobles, no gore",
    "An empty throne with a fallen crown in a dim hall, the end of a reign",
]
P[31] = [
    "A peaceful city gate, guards turning to look at the horizon in alarm",
    "A distant horizon with a gigantic dust storm of riders approaching, ominous orange sky",
]
P[32] = [
    "Endless Mongol horsemen with bows riding across the open steppe, fur hats, banners",
    "A portrait of Genghis Khan on a throne in a yurt, descendants standing beside him",
    "An old parchment map of Asia on a table lit by candles, Mongol arrows and daggers laid across it",
    "Mongol riders on a mountain pass looking down at the plains of Hindustan",
]
P[33] = [
    f"{ALAUDDIN} standing on the city walls, fierce and determined, army behind him",
    "Mongol cavalry raiding villages in Punjab, villagers fleeing, smoke, no gore",
    "Mongol army camped around the walls of medieval Delhi at night, campfires to the horizon",
    f"{ALAUDDIN} in his army camp with tents, war council",
    "The army camp slowly turning into a new walled city, workers building walls, transformation",
    "The new city of Siri with its walls and gates, the second city after Qila Rai Pithora",
]
P[34] = [
    "A huge standing army of soldiers and horses being fed and paid, treasury chests",
    f"{ALAUDDIN} thinking deeply over a scroll of numbers, candlelight",
    f"{ALAUDDIN} on his throne giving orders, scribes writing price lists on scrolls",
    "A medieval Delhi grain market with fixed prices, shopkeepers weighing grain on balance scales",
    "A cloth market with officers checking the price of colorful fabrics",
    "A horse market with officials recording the price of each horse",
    "Government officers watching shopkeepers, a strict officer catching a trader cheating on weight",
    "Huge state granaries full of grain sacks, workers storing grain",
    "Ordinary people buying food at the same low price while the Mongol army threatens outside, calm",
]
P[35] = [
    "A new sultan's banner of the Tughlaq dynasty rising over Delhi",
    "A misty mysterious medieval city, fog and crows on the walls, intrigue",
]
P[36] = [
    f"{GHIYAS} looking over plans for a huge fort",
    "The massive sloping stone walls of Tughlaqabad fort on a rocky hill, dramatic clouds",
    "Hazrat Nizamuddin Auliya, a Sufi saint in simple white robes seen from behind, beside a stepwell under construction",
    "Workers building a stepwell at night by oil lamps for the saint, devoted",
    "Royal soldiers stopping the workers and forcing them to go to the fort, tense",
    "The Sufi saint calmly raising his hand and speaking, spiritual glow, seen from behind",
    "Tughlaqabad fort in ruins with wild grass and goats grazing, desolate",
    "A shepherd with goats among the broken walls of Tughlaqabad at sunset",
]
P[37] = [
    f"{GHIYAS} returning from Bengal with his army, victorious",
    "A royal messenger delivering a threatening letter to the saint's humble lodge",
    "The saint seen from behind smiling calmly, a disciple writing the reply",
    "A grand wooden welcome pavilion at a royal camp outside Delhi, festive",
    "The wooden pavilion collapsing in a cloud of dust, people running, dramatic, no gore",
]
P[38] = [
    f"{MBT} on his throne with a map, pointing far to the south",
    "A long dusty road stretching through dry Deccan land toward distant hills, aerial view",
    "Royal heralds announcing the order in Delhi's streets, shocked citizens",
    "Huge line of families, carts and animals marching on a dusty road toward a far-off fort, hot sun",
    "Exhausted travellers resting under a lone tree, some unable to go on, sorrowful, no gore",
    "Daulatabad fort on a steep conical rocky hill in the Deccan at sunset",
    f"{MBT} changing his mind, frustrated, ordering everyone back",
    "The same people walking back toward Delhi, tired and angry",
]
P[39] = [
    "Silver coins being swapped for copper coins at a royal mint",
    "Piles of shiny copper token coins on a table",
    "People secretly making fake copper coins at night by candlelight in a small home, tense",
    "A market flooded with mountains of copper coins, merchants refusing them, chaos",
]
P[40] = [
    f"{FIROZ} founding a new city on the banks of the Yamuna",
    "The riverside city Firozabad with palaces, gardens and a mosque, boats on the river",
    "The ruins of Feroz Shah Kotla today, old arches and a pyramid-like structure, pigeons",
    f"{FIROZ} admiring an ancient Ashokan pillar in a village near Ambala",
    "The pillar wrapped in cotton and silk being lowered carefully by hundreds of workers",
    "The pillar on a giant 42-wheel cart pulled by hundreds of men along a road",
    "The pillar loaded onto a large boat floating down the Yamuna toward Delhi",
    "The Ashokan pillar standing on top of the Kotla ruins today, blue sky",
]
P[41] = [
    "A tired aging sultan slumped on his throne, crown slipping, dim hall",
    "Dark clouds gathering over a fading medieval city, colors draining, a lamp going out",
]
P[42] = [
    f"{TIMUR} leading his huge army through snowy mountains toward India",
    f"{TIMUR}'s army at the gates of Delhi in winter, cold blue light, menacing",
    "The Delhi army scattering in panic before Timur's cavalry, war elephants turning back, no gore",
    f"{TIMUR} in his tent giving a terrible order, generals shocked, dark shadows",
    "A vast crowd of captives under a grey sky, grim and sorrowful, no gore",
    "Soldiers carrying away loot, gold and treasure from Delhi's houses",
    "Medieval Delhi burning at night, smoke over rooftops, tragic painterly mood, no gore",
]
P[43] = [
    "An old chronicler writing in a book by candlelight with a grave face",
    "A completely deserted ruined city in grey silence, empty streets, not a single bird in the sky",
]
P[44] = [
    f"{TIMUR}'s army leaving with camels loaded with treasure, the ruined city behind",
    "Sayyid dynasty rulers in a modest court, the empire much smaller",
    "The domed tombs of the Lodi dynasty in a green garden, soft afternoon light",
    "Joggers and families walking in Lodi Garden today among the old tombs",
    "Sultan Sikandar Lodi in his court deciding to move the capital",
    "A royal caravan leaving Delhi for Agra, elephants and camels on a road, the old city behind",
]
P[45] = [
    "A weakened Delhi with thin guards on crumbling walls",
    f"{BABUR} on horseback on a Central Asian mountain pass looking south toward India, sunset",
]
P[46] = [
    "A Mughal royal banner unfurling in the wind over a battlefield at dawn",
    f"Portrait of {BABUR} in armor, confident, the start of a new empire",
]
P[47] = [
    "The plain of Panipat in 1526 with two armies facing each other",
    "Mughal cannons firing clouds of smoke, gunners loading, dramatic",
    "Sultan Ibrahim Lodi's huge army with war elephants panicking at the cannon noise, no gore",
    f"{BABUR} watching victory from his horse, banners raised",
    f"{BABUR} entering Delhi as the new ruler, citizens watching",
]
P[48] = [
    f"{BABUR} passing on his crown to his son {HUMAYUN}",
    f"{HUMAYUN} overseeing construction of a new city Dinpanah by the river, architects with plans",
    f"{SHERSHAH} rising in Bihar, leading a strong army",
    f"Battle in 1540, {HUMAYUN} defeated and fleeing on horseback, no gore",
    f"{HUMAYUN} wandering in the desert with a few loyal followers, exile",
    f"{SHERSHAH} building his own city Shergarh on the ruins of Dinpanah",
    "The great gateway of Purana Qila today with a lake in front, boats, evening",
]
P[49] = [
    f"{HUMAYUN} in Persia during his long years of exile, hoping to return",
    f"{HUMAYUN} returning victorious to Delhi on horseback in 1555, people lining the streets",
    "The octagonal red sandstone Sher Mandal library tower inside Purana Qila",
    f"{HUMAYUN} reading books in his library, stacks of manuscripts",
    f"{HUMAYUN} on the steep narrow stone staircase at dusk, books in his arm, hearing the call to prayer",
    "A foot slipping on a stone step, books flying in the air, dramatic, no gore",
    "Books and a royal turban lying on old stone stairs at dusk, no person visible, sad",
    "Mourners in the palace, candles, a royal funeral",
]
P[50] = [
    "A Mughal queen in mourning planning a tomb with architects",
    "Humayun's Tomb, red sandstone and white marble mausoleum with a white dome in a garden with water channels, golden hour",
    "The Taj Mahal at dawn reflecting in the water, similar design to Humayun's Tomb",
]
P[51] = [
    "A 13-year-old Mughal prince (young Akbar) sitting uncertainly on a big throne",
    "Bairam Khan, a guardian general, standing protectively beside the young prince",
    f"{HEMU} watching from the shadows, determined, a map behind him",
]
P[52] = [
    "A humble merchant family's house in Rewari, a young boy looking at the world with ambition",
    f"{HEMU} rising through the ranks, commanding soldiers in the Sur court",
    f"{HEMU} riding a huge war elephant at the head of an army with hundreds of elephants",
    "Battle near Tughlaqabad, Mughal troops fleeing, Hemu victorious, no gore",
    f"{HEMU} crowned in Delhi with the title Vikramaditya, crowds cheering",
    "Chaotic battlefield of Panipat 1556 with dust and arrows, elephants scattering, no gore",
    f"{HEMU} struck by an arrow near his eye, falling back in his howdah, dramatic, no gore",
    "The leaderless army scattering in the dust, a dark ending",
]
P[53] = [
    "Emperor Akbar as a grown man in the red sandstone courtyards of Fatehpur Sikri",
    "Akbar's grand court in Agra fort with nobles and scholars",
    "A Mughal emperor looking at an old parchment map of Hindustan with his finger on Delhi",
]
P[54] = [
    f"{SHAHJAHAN} standing on the banks of the Yamuna holding plans of a new city, sunrise",
    "Thousands of workers laying the foundations of Shahjahanabad, busy construction",
    "Old Delhi today, crowded lanes, rickshaws, old havelis",
    "The Red Fort's red sandstone walls rising beside the Yamuna under construction",
    "The Red Fort completed in 1648, flags flying, majestic wide shot",
]
P[55] = [
    f"{JAHANARA} designing a bazaar on paper with architects, intelligent and graceful",
    "A long Mughal bazaar with a canal flowing down the middle, shops on both sides",
    "A pool in the middle of the bazaar reflecting the full moon, magical night",
    f"{JAHANARA} watching from a balcony as moonlight makes the whole bazaar shine, lanterns",
    "Chandni Chowk today, crowded and colorful, with the Red Fort in the distance",
]
P[56] = [
    "Thousands of workers building the Jama Masjid, red sandstone and white marble domes rising",
    "The completed Jama Masjid with its three white domes and minarets, people in the vast courtyard",
]
P[57] = [
    "Rich bustling Shahjahanabad: crowded bazaar with silk, spices and jewels, elephants",
    "European travellers in 17th-century clothes amazed at the wealth of Delhi, writing in journals",
    "Craftsmen making jewellery, carpets and inlaid marble in workshops",
    "Poets reciting in a candlelit mushaira gathering, audience applauding",
    "Caravans of merchants arriving at the gates of Delhi from distant lands",
]
P[58] = [
    "A single candle flame flickering in a dark Mughal palace hall, about to be blown out",
]
P[59] = [
    "The aged Emperor Aurangzeb with a white beard on his deathbed, 1707, somber",
    "A Mughal crown being passed from one hand to another over an empty throne, close-up",
    "Nobles whispering and plotting behind pillars of a dusty Mughal court, decline",
    "News of Delhi's wealth travelling on a messenger's horse across mountains toward Persia",
]
P[60] = [
    f"{NADIR} leading the Persian army through mountain passes",
    "Battle of Karnal 1739, Persian cavalry defeating the Mughal army, no gore",
    f"Emperor Muhammad Shah welcoming {NADIR} into the Red Fort with ceremony, uneasy smiles",
    "A rumour spreading through Delhi's alleys at night, people whispering in doorways",
    "Night riots in Old Delhi streets with torches, people running, chaos, no gore",
    "Persian soldiers ambushed in a narrow alley at night, shadows and torches, no gore",
]
P[61] = [
    "Dawn on 22 March over Chandni Chowk, an eerie red sky",
    "A small golden-domed mosque (Sunehri Masjid) in Chandni Chowk with soldiers gathering",
    f"{NADIR} sitting on the roof of the golden-domed mosque, cold expression",
    f"Close-up of {NADIR}'s hand slowly drawing his sword from its sheath, chilling",
    "Old Delhi streets under a blood-red sky, doors shut, smoke, tragic, no gore",
]
P[62] = [
    "The jewelled Peacock Throne with golden peacocks glittering in the palace",
    "The glowing Koh-i-Noor diamond in a soldier's hand",
    "A long caravan of camels and elephants carrying treasure out of Delhi toward Persia",
]
P[63] = [
    "Ahmad Shah Abdali, an Afghan ruler with a turban, leading raiders toward Delhi",
    "Afghan raiders galloping through the ruined gates of Delhi, smoke behind, no gore",
    "A plundered empty palace with broken furniture and torn curtains",
    "The sad poet Mir Taqi Mir writing by candlelight in a ruined house",
    "A once-grand Delhi street now deserted and broken, weeds growing",
]
P[64] = [
    "A weak Mughal emperor on a faded throne, courtiers ignoring him",
    "Maratha general Mahadji Shinde in a Maratha turban on horseback, strong and proud",
    "Mahadji Shinde escorting the old Mughal emperor Shah Alam II on an elephant back into Delhi",
    "Shah Alam II sitting on the throne again, Maratha soldiers guarding him",
    "Delhi townspeople joking and laughing at a tea stall about the tiny empire",
    "An old parchment map with a tiny area around Delhi marked in red ink, a weak emperor's hand on it, unreadable labels",
    "A short dusty road from the walls of Delhi to a small village with fields, ironic emptiness, wide shot",
]
P[65] = [
    "A big East India Company sailing ship arriving at an Indian port, merchants unloading crates",
    "British company officials counting money and looking at a map of India greedily",
]
P[66] = [
    "Silhouettes of British redcoat soldiers in a line on a hill at sunset",
]
P[67] = [
    "Battle of Delhi 1803 near Patparganj: British troops in red coats fighting Maratha soldiers by the Yamuna, smoke, no gore",
    "General Lake in a British uniform on horseback, victorious",
    "The British flag rising over Delhi's walls",
    "An old Mughal emperor in the Red Fort receiving a small bag of money from a British officer as a pension, humiliation",
    "The old emperor alone in his huge fading palace, pigeons and dust",
]
P[68] = [
    "Dawn sky turning blood red over the Red Fort, ominous calm before a storm",
]
P[69] = [
    "Sepoys in Meerut breaking their chains and rising in revolt, determined faces",
    "Indian sepoy soldiers on horses galloping across a bridge of boats over the Yamuna toward the Red Fort at sunrise",
    "Sepoys arriving below the walls of the Red Fort shouting up to the palace",
    f"The {ZAFAR} looking out from a palace window, surprised",
    f"The {ZAFAR} on his throne surrounded by excited sepoys asking him to lead them",
    f"The {ZAFAR} writing poetry at his desk with a quill, a gentle man",
    "Several towns burning at night across the plains of North India, seen from a hill, revolt spreading",
]
P[70] = [
    "British army camped on the Delhi Ridge, tents and cannons, siege",
    "Rebels defending the old city walls, determined, no gore",
    "British cannons firing at the walls near Kashmiri Gate, walls breaking, smoke",
    "Street to street fighting in the narrow lanes of old Delhi, smoke and dust, no gore",
    "The British flag raised again over the Red Fort, ruined city around",
]
P[71] = [
    "Grim British officers deciding punishments in a tent, revenge mood",
    "Silhouettes of gallows against a grey sky, sorrowful, no gore",
    "Empty Old Delhi neighbourhoods, families being forced out with their belongings",
    "The old Khooni Darwaza stone gateway at dusk, dark and haunting",
    f"The {ZAFAR} being taken away as a prisoner on a bullock cart by British soldiers",
    "A ship sailing away from India toward Burma on a grey sea",
]
P[72] = [
    "A small wooden room in Rangoon with rain outside the window",
    f"The {ZAFAR}, now very weak, lying on a simple cot, a lamp beside him",
    "A lamp flame going out in a dark room, the end of an era",
    f"The {ZAFAR} writing his last verses on paper by a small window",
    "A simple unmarked grave under a tree in Rangoon, fallen leaves, soft rain",
]
P[73] = [
    "Grand British colonial buildings of Calcutta with horse carriages",
    "British officials in Calcutta looking at a large map of India pointing at Delhi in the centre, unreadable labels",
    "The faded Red Fort and old Delhi seen from afar, still carrying a great name",
]
P[74] = [
    "The grand 1911 Delhi Durbar arena with a domed pavilion, thousands of people, elephants, flags",
    "King George V and Queen Mary in royal robes on golden thrones at the Durbar",
    "The king standing and making an announcement, the huge crowd gasping",
    "Angry protests in Calcutta streets after the Partition of Bengal, crowds with banners",
    "A British official tracing a line on an old map of India from Calcutta to Delhi, close-up, unreadable labels",
    "A pin placed on Delhi in the centre of an old map of India, candlelight, close-up",
    "A British royal crown resting on an old map of India over Delhi, dramatic still life",
]
P[75] = [
    "British architects Edwin Lutyens and Herbert Baker in suits with blueprints on Raisina Hill",
    "Empty rocky land of Raisina Hill with wind in the grass and survey flags, 1912",
    "Thousands of Indian workers building the grand domed Viceroy's House",
    "The Viceroy's House (Rashtrapati Bhavan) with its great dome and columns at golden hour",
    "Long grand corridors and many rooms inside the palace, a lost visitor wandering",
    "North Block and South Block buildings with domes facing each other on the hill",
    "A long straight boulevard leading from the hill to India Gate, aerial view",
    "India Gate memorial arch at dusk, glowing, honouring soldiers of the first world war",
]
P[76] = [
    "February 1931 inauguration ceremony of New Delhi with British officials and decorated stage",
    "Lord Irwin in viceroy uniform giving a speech",
    "Aerial view of New Delhi's grand avenues with old ruins visible in the distance, 1931",
    "New Delhi's wide tree-lined avenues with old cars and bicycles, 1930s",
]
P[77] = [
    "Indian protesters with tricolour flags gathering in Delhi, freedom movement",
    "A royal elephant procession in Chandni Chowk with a puff of smoke from a bomb thrown at the viceroy's howdah, crowds startled, no gore",
    "Rash Behari Bose-like young revolutionary escaping into the crowd, mysterious",
    "Two young Indian revolutionaries (one wearing a hat) in the legislative assembly hall throwing leaflets in the air, smoke behind them",
    "Bhagat Singh with a hat and moustache shouting a slogan with a raised fist, defiant",
    "Leaflets floating down over shocked British officials in the assembly hall",
]
P[78] = [
    "Night of 14 August 1947, Delhi streets full of people with lamps waiting for midnight",
    "Midnight in the Constituent Assembly hall, Jawaharlal Nehru in a white cap and achkan with a rose speaking at a microphone",
    "A clock striking twelve, fireworks bursting over Delhi",
    "Crowds celebrating independence on Delhi streets, joyful tears",
    "The Indian tricolour being raised over the Red Fort, huge happy crowd, morning sun",
    "Split image: the same Red Fort in 1857 with the old emperor taken away, and in 1947 with the tricolour flying",
    "The tricolour waving over the Red Fort ramparts in the wind, close-up",
]
P[79] = [
    "Celebration lights in Delhi, but smoke rising on the horizon, mixed emotions",
    "A British official's hand drawing a line in ink across a map of Punjab, close-up, unreadable labels",
]
P[80] = [
    "A crowded refugee train with people on the roof crossing a dusty plain at dusk, silhouettes",
]
P[81] = [
    "Hindu and Sikh families leaving their homes in Punjab with bundles, looking back sadly",
    "Long caravans of refugee families with bullock carts walking along a road, dust",
    "Crowded railway platform in Delhi with refugees arriving, families searching for each other",
    "Muslim families in Delhi leaving their homes with belongings, heartbroken",
    "Two trains passing each other in opposite directions, both crowded with refugees",
    "Tired refugee children sleeping on luggage at a station, tender and sad",
]
P[82] = [
    "A small 1940s Delhi with low buildings, calm",
    "Rows of tents and new houses spreading outwards from the city, aerial view",
    "Rows of new houses and tents spreading quickly across open land around Delhi, aerial view, 1950",
    "Crowded streets of 1951 Delhi with many new faces",
]
P[83] = [
    "Kings building grand monuments long ago, then the same monuments today",
    "Refugee tents inside the walls of Purana Qila, families cooking, children playing",
    "Refugee tents in the gardens of Humayun's Tomb, washing lines, hope amid hardship",
    "New refugee colonies being built in 1950s Delhi, rows of simple brick houses",
    "Families moving into new homes, a woman hanging a curtain, smiling",
    "A refugee man running a handcart stall selling food in a busy 1950s market",
    "A small shop growing into a busy store over the years, transformation",
    "Punjabi food stalls in a Delhi market today, delicious food, crowds",
    "Bustling Lajpat Nagar market today, colorful clothes and shoppers",
]
P[84] = [
    "The garden of Birla House at dusk with flowers on the path, solemn mood",
    "Mahatma Gandhi, a frail old man with round glasses and a white shawl, walking with a stick toward the prayer crowd",
    "The crowd at the prayer meeting looking toward him with love, no violence",
    "A pair of round glasses and sandals left on the path with marigold flowers, deep sorrow",
    "Delhi in mourning, huge silent crowds, people weeping, soft rain",
]
P[85] = [
    "1950s New Delhi government buildings with old cars and bicycles on wide roads",
    "Leaders signing documents in a government office, 1956, Delhi becomes a Union Territory",
    "Officials studying a large map of India with Delhi circled in red, government office, 1950s",
    "Parliament of India debating, members raising hands, 1991",
    "The Delhi Legislative Assembly building with lawns, new legislators arriving, 1993",
    "Delhi citizens voting for their own assembly, happy faces",
]
P[86] = [
    "1982 Asian Games opening ceremony in a big stadium with fireworks and athletes",
    "New flyovers being built across Delhi roads, 1980s cars and buses",
    "A family gathered excitedly around a new colour television in a 1980s living room",
]
P[87] = [
    "A sudden dark cloud over Delhi in 1984, shock",
    "A newspaper being dropped in shock on a doorstep, 1984, no readable text",
    "A Delhi neighbourhood at dawn after violence, smoke in the distance, empty and silent, no gore",
    "Hundreds of candles burning at a quiet memorial at night, grieving Sikh families with heads bowed",
    "An old Sikh man with a white beard holding a photo of a loved one, tears, respectful",
    "A quiet gurdwara at dusk with soft light, healing and remembrance",
]
P[88] = [
    "24 December 2002, the first Delhi Metro train arriving at an elevated station, excited passengers",
    "Passengers enjoying a clean metro coach, school kids and office workers",
    "Metro lines spreading across Delhi like glowing veins on a map, aerial view",
    "A crowded modern metro station at rush hour, lakhs of travellers",
]
P[89] = [
    "The new Indian Parliament building with its modern triangular design, bright day",
    "Inside the new Parliament chamber, grand and modern",
    "Bharat Mandapam convention centre with flags of many nations, G20 summit",
    "World leaders arriving at the G20 summit in Delhi, cameras and flags, no recognizable faces",
    "Voters in a long queue at a Delhi polling booth in 2025, showing ink-marked fingers",
    "Election results celebration with saffron colours and crowds in Delhi streets",
    "The Delhi Secretariat building with a new government at work, morning",
]

# ---------------- CONCLUSION ----------------
P[90] = [
    "Aerial view of modern Delhi as a gigantic city stretching to the horizon, highways and high-rises at dusk",
    "A massive crowd of ordinary people in a modern Delhi street, very dense, energetic",
    "Night satellite view of North India with Delhi as a massive glowing patch of lights",
    "The ghost of an invading army fading away over Delhi while grey smog creeps in",
    "Delhi's skyline wrapped in smog with a drop of dirty water in the foreground, symbolic",
]
P[91] = [
    "Winter morning in Delhi, thick grey smog covering everything, the sun a pale disc",
    "Traffic and factories releasing smoke, crop fires burning in fields far away",
    "India Gate wrapped in thick smog, people wearing masks",
    "Children wearing masks going to school in the smog",
    "A warning board and air quality monitor glowing on a Delhi street, no readable text",
    "An old boatman looking sadly at the polluted Yamuna at dawn, ancient ghats behind him",
    "Toxic white foam floating on the Yamuna river like snow near Kalindi Kunj bridge",
    "Local people standing at the riverbank looking at the foam, worried",
    "A grand ribbon-cutting ceremony for river projects with officials and decorations",
    "Workers and machines cleaning and rebuilding the Yamuna riverfront, new green banks planted",
    "A clean blue Yamuna imagined in the future with gardens and boats, hopeful vision",
]
P[92] = [
    f"Old paintings of {TIMUR}, {NADIR} and a British officer hanging in a dusty museum hall",
    "Delhi choking under smoke, garbage and crowds, a heavy dark cloud",
    "Double exposure of old Delhi forts and monuments over the modern Delhi skyline, cinematic",
    "Ancient ruins in the foreground and modern Delhi towers rising behind them at sunrise",
    "A young child on a rooftop in old Delhi looking at a hazy sunrise, kites in the sky, quiet hope",
    "The Qutub Minar, Red Fort and India Gate at sunrise with the sky slowly clearing, final shot",
]

SHOTS = [(pid, prompt) for pid in sorted(P) for prompt in P[pid]]
