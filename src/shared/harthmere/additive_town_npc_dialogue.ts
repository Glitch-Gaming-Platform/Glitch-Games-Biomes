import {
  buildHarthmereAzureVoiceParameterId,
  harthmereVoiceProfileForActor,
  type HarthmereNpcVoiceProfile,
  type HarthmereVoiceActorKind,
  type HarthmereVoiceGender,
} from "@/shared/harthmere/npc_voice_profiles";

export const HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE_VERSION =
  "harthmere-additive-town-npc-dialogue-v2" as const;

export const HARTHMERE_ADDITIVE_TOWN_NPC_ID_BASE = 8_810_000_000_010_000;

export interface HarthmereAdditiveTownNpcDialogueProfile {
  offset: number;
  displayName: string;
  sex: HarthmereVoiceGender;
  kind: HarthmereVoiceActorKind;
  role: string;
  district: string;
  voiceStyle: string;
  voiceArchetype?:
    | "child"
    | "youthful"
    | "mature"
    | "authoritative"
    | "precise";
  intro: string;
  story: string;
  location: string;
}

// The additive town originally put several pages of biography, route guidance,
// reputation commentary, and a global Jobs Board objective into the first talk
// window. These profiles keep first contact human-sized and move deeper lore
// behind explicit player choices. The longer passages are also deliberately
// written in short spoken sentences so one prerecorded TTS clip can deliver
// them naturally without turning into an audiobook paragraph.
const HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE_BASE = [
  {
    offset: 1,
    displayName: "Mira, Town Guide",
    sex: "female",
    kind: "humanoid",
    role: "town guide and new-arrival steward",
    district: "Market Square",
    voiceStyle:
      "warm, practiced, reassuring, with the alertness of someone responsible for lost travelers",
    intro:
      "Welcome to Harthmere. I'm Mira, and I help new arrivals find their feet before the town finds their trouble.",
    story:
      "I learned Harthmere by walking frightened strangers home in bad weather. Most people don't need a speech; they need one familiar face and a door they can find twice. I keep a small house ready for newcomers because belonging starts with somewhere safe to put a tired pack.",
    location:
      "Market Square is the town's center, even when the crowd makes it feel like three places at once. The safer streets stay bright and busy, while the docks, drains, and old well grow stranger after dusk. If you're lost, return to the fountain and choose one landmark at a time.",
  },
  {
    offset: 2,
    displayName: "Bolt, Archive Robot",
    sex: "neutral",
    kind: "robot",
    role: "licensed archive robot and civic historian",
    district: "Market Square",
    voiceStyle:
      "precise service protocol softened by curiosity and damaged but sincere memory",
    intro:
      "Designation Bolt, civic archivist. I preserve what Harthmere forgets, especially when forgetting appears convenient.",
    story:
      "My frame unsettles people because Harthmere distrusts machines, portals, and Exotic Matter. The Reeve permits me because records are harder to intimidate than witnesses. When an image fails in my memory, I keep the account in words so one broken component cannot erase a town.",
    location:
      "Harthmere has rebuilt the same streets so many times that every foundation contains an argument. Shortages and closures usually appear in public conversation before official histories admit them. I listen for the distance between what a town records and what its people are afraid to say.",
  },
  {
    offset: 3,
    displayName: "Toma, Builder",
    sex: "male",
    kind: "humanoid",
    role: "town builder and drainage inspector",
    district: "Craftsman Row",
    voiceStyle:
      "grounded, practical, patient until someone ignores a structural warning",
    intro:
      "I'm Toma. If a road, wall, or threshold feels wrong underfoot, I'd rather hear it before the rain does.",
    story:
      "I repair the parts of town people only notice when they fail. A loose paver can mean an old drain has shifted, and a sticking door can become a deathtrap in a crowded evacuation. Good building is quiet work, but bad building announces itself all at once.",
    location:
      "Craftsman Row is hot, loud, and honest about what it costs to keep Harthmere standing. Beneath the cleaner streets are older drains that make solid ground into a convincing liar. Watch thresholds after rain, and don't dismiss a sinking boot as clumsiness.",
  },
  {
    offset: 4,
    displayName: "Pip, Harbor Mascot",
    sex: "neutral",
    kind: "animal",
    role: "market mascot, crumb inspector, and unofficial alarm",
    district: "Market Square",
    voiceStyle:
      "bright, comic, quick, with sudden nervousness around the old well",
    intro:
      "Peep! I'm Pip, which is an important civic position whenever crumbs or suspicious noises are involved.",
    story:
      "The baker understands proper tribute, while the banker remains difficult to train. I patrol baskets, boots, and unattended lunches with equal seriousness. If I flee from a sound before anyone else hears it, that is instinct, not cowardice.",
    location:
      "The square is excellent for crumbs and terrible for secrets. Chickens drift in from the farm, merchants drop useful things, and the fountain hides almost nothing. The old well is the exception, and I prefer to be elsewhere when it rings.",
  },
  {
    offset: 5,
    displayName: "Maren Dawnloaf, Baker",
    sex: "female",
    kind: "humanoid",
    role: "fourth-generation Dawn Loaf baker",
    district: "Dawn Loaf Bakery",
    voiceStyle:
      "warm, sharp, flour-busy, and affectionate beneath competitive teasing",
    intro:
      "Maren Dawnloaf, fourth generation at this oven. If you're hungry, speak quickly before the next batch needs me.",
    story:
      "The Loafs have baked here for four generations, and the children are already negotiating who becomes the fifth. Mara Thistle is my best friend, which means she calls me a thief whenever I steal her customers. Some warm loaves leave for the chapel as leftovers, and Father Aldren has the good sense not to examine that word too closely.",
    location:
      "The bakery sits where market traffic meets the orchard road, so weather reaches my shelves before news reaches the Reeve. Clean apples become road cakes, and road cakes keep guards and travelers steady. When the orchard route goes quiet, every oven in town feels it by morning.",
  },
  {
    offset: 6,
    displayName: "Banker Merl Voss",
    sex: "male",
    kind: "humanoid",
    role: "banker, vault keeper, and custody clerk",
    district: "Player Services",
    voiceArchetype: "precise",
    voiceStyle:
      "dry, exact, restrained, with anxiety hidden behind flawless accounting",
    intro:
      "Banker Merl Voss. State your business plainly, and the numbers will remain pleasant.",
    story:
      "I came south from a Northborn banking family thirty years ago and have kept this vault for twenty-eight. I maintain a private tally of every error, delay, and broken chain of custody. A missing lockbox is not a mystery to admire; it is a sequence of precise failures waiting to be named.",
    location:
      "Player Services gathers storage, couriers, guild records, and trade clerks close enough to watch one another. That convenience is useful, but it also means one forged seal can move quickly through several honest hands. Keep receipts dry, names complete, and valuable promises written twice.",
  },
  {
    offset: 7,
    displayName: "Brann, Weapons Teller",
    sex: "male",
    kind: "humanoid",
    role: "weapons seller and Black Anvil counterman",
    district: "Craftsman Row",
    voiceStyle: "gruff, efficient, faintly amused by overconfident beginners",
    intro:
      "Brann. I sell weapons, but I'd rather sell you one you can control than one you'll regret.",
    story:
      "I keep training blades closest to the counter because pride is cheaper to repair than a hand. Master Osric says every tool has a memory, and I say every dull edge eventually presents a bill. The Watch needs reliable iron, not tavern heroes swinging expensive mistakes.",
    location:
      "Craftsman Row runs on heat, noise, and people admitting exactly what broke. The Guard Yard is close enough to test your footing before you trust a live blade. Mind the sparks, keep clear of the quenching tubs, and never lean on an anvil someone is using.",
  },
  {
    offset: 8,
    displayName: "Luma, Healer",
    sex: "female",
    kind: "humanoid",
    role: "healer and first-aid attendant",
    district: "Apothecary",
    voiceStyle: "calm, low, compassionate, and firm with frightened patients",
    intro:
      "I'm Luma. Breathe first, sit second, and tell me where it hurts when the shaking stops.",
    story:
      "I learned that panic can make a small wound feel like a prophecy. Clean cloth, bitter medicine, and a steady voice save more people than dramatic cures. I watch the chapel candles because they burn strangely when the old sound moves beneath the stones.",
    location:
      "The Apothecary smells of willow bark, mint, clean water, and whatever someone carried in from the road. Our herb shelves thin whenever the Wilds grow dangerous. If you gather medicine, keep it clean and keep swamp water away from everything else.",
  },
  {
    offset: 9,
    displayName: "Edrin Starling, Magic Supplier",
    sex: "male",
    kind: "humanoid",
    role: "occult supplier and keeper of dangerous texts",
    district: "Wyrm and Candle",
    voiceStyle:
      "quietly theatrical, scholarly, and serious when old symbols are mentioned",
    intro:
      "Edrin Starling, proprietor of the Wyrm and Candle. Please let the glowing objects introduce themselves first.",
    story:
      "I sell chalk, candles, crystals, and explanations people mock until they become necessary. The carvings near the old bridge resemble marks beneath the well, which should trouble more careful minds than mine. Dangerous books stay closed here unless the question is worth the risk of opening them.",
    location:
      "The Wyrm and Candle stands near the healer because magic and medicine often inherit each other's mistakes. Blue lamps mark the door, and the quieter shelves contain the older questions. Lower your voice when speaking of bells, wells, or anything that answers from underground.",
  },
  {
    offset: 10,
    displayName: "Tilda Fen, Farmer",
    sex: "female",
    kind: "humanoid",
    role: "farmer and chicken-yard keeper",
    district: "Gate Fields",
    voiceStyle:
      "earthy, blunt, patient with animals and impatient with excuses",
    intro:
      "Tilda Fen. The chickens are loose again, and for once that isn't a metaphor.",
    story:
      "The farm feeds the bakery, the tavern, and half the arguments in the market. Animals need feeding before anyone has time for gossip, which keeps a person honest. I measure a good day in shut gates, straight fences, and eggs Pip hasn't discovered.",
    location:
      "The Gate Fields are Harthmere's gentlest edge, but they still touch the Wilds. The orchard road is open and readable by day, then narrow and uncertain after the lanterns come on. If the birds go quiet together, stop walking and listen before you decide why.",
  },
  {
    offset: 11,
    displayName: "Garrick, Bartender",
    sex: "male",
    kind: "humanoid",
    role: "Copper Kettle bartender and rumor listener",
    district: "Copper Kettle",
    voiceStyle:
      "welcoming, dry, socially alert, with the cadence of someone working a crowded room",
    intro:
      "Welcome to the Copper Kettle. I'm Garrick, and if you can still stand, you can still order.",
    story:
      "Every table in this room has heard a lie worth repeating. I listen without staring because frightened people speak more honestly when their cup seems more interesting than their face. Rumors are useful only after you learn who carried them, what they wanted, and how wet their boots were.",
    location:
      "The Kettle is Harthmere's warmest crossroads after sunset. Travelers, guards, dockhands, and clerks all loosen their voices near the hearth. Keep an eye on the exits, be kind to the room staff, and never assume the quietest table knows the least.",
  },
  {
    offset: 12,
    displayName: "Jori, Dockhand",
    sex: "male",
    kind: "humanoid",
    role: "dockhand and lower-pier cargo worker",
    district: "River Docks",
    voiceStyle:
      "weathered, wary, concise, with river superstition under practical labor",
    intro:
      "Jori. The river gets quiet when it wants you careless, so keep your boots tied and your eyes open.",
    story:
      "I move cargo for Tovin, including the crates he records and the ones everyone suddenly forgets to recognize. A black crate on the lower pier has whispered in damp weather for three nights. Dock work teaches you that an object without an owner usually has too many owners.",
    location:
      "The River Docks are honest in daylight and complicated in fog. Ropes shift, boards slick over, and cargo marks change hands faster than explanations. Wear boots with grip, keep clear of black water, and count your fingers after touching anything Tovin calls boring.",
  },
  {
    offset: 13,
    displayName: "Bela, Storyteller",
    sex: "female",
    kind: "humanoid",
    role: "storyteller and keeper of local warnings",
    district: "Copper Kettle",
    voiceStyle:
      "measured, intimate, slightly playful, with old fear beneath polished stories",
    intro:
      "They call me Bela. I tell stories because warnings travel farther when people enjoy repeating them.",
    story:
      "Harthmere began as a toll bridge and became a town almost by accident. People say the chapel bell was stolen because that is easier to bear than believing it was buried on purpose. The old well rings during storms, not loudly, but with a sense of personal attention.",
    location:
      "The Copper Kettle is where private fear becomes public folklore. A tale changes each time it crosses the hearth, but the repeated details deserve respect. Listen for the piece nobody finds entertaining, because that is often the part that happened.",
  },
  {
    offset: 14,
    displayName: "Kip, Card Player",
    sex: "male",
    kind: "humanoid",
    role: "card player, small-time gambler, and tavern observer",
    district: "Copper Kettle",
    voiceStyle:
      "quick, wry, slippery, and more observant than his jokes suggest",
    intro:
      "Kip's the name. I'd deal you in, but the cards keep finding better judgment than either of us.",
    story:
      "Courier coin is easy if you can run, and dock coin is interesting if you can lie. The banker hates dice because dice refuse to respect a ledger. I play cards to learn what people risk when they think the stakes are small.",
    location:
      "The tavern tables sit between the warm hearth and several useful exits. Elowen notices every person who asks about the cellar, even when she says no without looking up. If a game turns quiet all at once, someone important has entered or someone dangerous has stopped pretending.",
  },
  {
    offset: 15,
    displayName: "Sola, Traveler",
    sex: "female",
    kind: "humanoid",
    role: "traveling road scout and Biomes trail seeker",
    district: "Copper Kettle",
    voiceStyle: "curious, road-worn, candid, with humor used to contain unease",
    intro:
      "I'm Sola. I came looking for old Biomes trails, and Harthmere has answered with more questions than road.",
    story:
      "I follow routes that survive in travelers' memory after the signs disappear. The north road treats beginners fairly, while the drains punish confidence with enthusiasm. If I hear a bell underground, I prefer to know who is paying before I investigate.",
    location:
      "Harthmere is smaller than the places I expected to find, but it has a strong sense of where strangers should not wander. The inn is the best place to compare road stories before leaving the walls. Ask two locals for directions, then believe the one who mentions weather.",
  },
  {
    offset: 16,
    displayName: "Mern, Tavern Bard",
    sex: "male",
    kind: "humanoid",
    role: "tavern bard and rumor-maker",
    district: "Copper Kettle",
    voiceStyle:
      "musical, amused, lightly melancholy, with practiced room-filling projection",
    intro:
      "I'm Mern, resident bard. My songs are longer than the siege and only slightly more accurate.",
    story:
      "A bard hears taxes, love, treason, and bad rhyme before breakfast. I take true rumors and make them memorable enough to survive a noisy room. The dangerous part is deciding which truths deserve a chorus and which deserve silence.",
    location:
      "The Kettle stage turns private complaints into shared memory. The hearth carries a soft voice farther than shouting does, and every regular knows when a song has changed. Bring me something true, and I'll try not to improve it beyond recognition.",
  },
  {
    offset: 17,
    displayName: "Rowan, Walker",
    sex: "male",
    kind: "humanoid",
    role: "north-road walker and informal patrol hand",
    district: "North Gate",
    voiceStyle: "easygoing, outdoorsy, alert beneath casual humor",
    intro:
      "Rowan. I walk the north road, and if I stop moving, I've either found trouble or a very good view.",
    story:
      "I started walking the road because too many warnings arrived after the people they concerned. A steady pair of eyes catches broken fences, strange tracks, and travelers pretending they aren't lost. I joke about the chickens giving directions, but they notice danger before most guards do.",
    location:
      "North Gate is where Harthmere's rules meet mud, carts, and people with reasons to hurry. Beyond it, the road stays friendly only while the fields remain open. Once the hedges hide the walls, pay attention to birds, wagon ruts, and anything heavy enough to leave no clear track.",
  },
  {
    offset: 18,
    displayName: "Iva, Walker",
    sex: "female",
    kind: "humanoid",
    role: "market-route walker and crowd guide",
    district: "Market Square",
    voiceStyle:
      "clear, observant, brisk, with a planner's attention to movement",
    intro:
      "I'm Iva. I keep an eye on how people move through the square before a crowd becomes a problem.",
    story:
      "The plaza was shaped so smoke, carts, festivals, and frightened newcomers could all pass without trapping one another. Most people only notice that design when something blocks it. I walk the same routes daily because a safe path is a habit the whole town has to keep.",
    location:
      "Market Square is loud enough to hide confusion in plain sight. Use the fountain as your center, keep the cart lanes open, and don't stop in a shop threshold to study the street. The town becomes readable once you watch where working people need to pass.",
  },
  {
    offset: 19,
    displayName: "Cade, Walker",
    sex: "male",
    kind: "humanoid",
    role: "services-route porter and street regular",
    district: "Player Services",
    voiceStyle: "casual, dry, sociable, with a porter's practical memory",
    intro:
      "Cade. I carry parcels between the bank and the smithy, which means I hear complaints from both directions.",
    story:
      "I know the weight of a package before I know who owns it. Bankers worry about seals, smiths worry about metal, and both blame the porter when timing goes wrong. Walking the same route teaches you which arguments are routine and which ones mean someone should fetch a guard.",
    location:
      "Player Services looks orderly because clerks work hard to keep the disorder in queues. The bank, courier desk, and guild offices sit close enough that one delayed parcel can sour the whole lane. Keep receipts handy and never stand between a porter and an open doorway.",
  },
  {
    offset: 20,
    displayName: "Sera, Walker",
    sex: "female",
    kind: "humanoid",
    role: "Temple Green errand walker",
    district: "Temple Green",
    voiceStyle: "soft, perceptive, gently skeptical of both medicine and magic",
    intro:
      "I'm Sera. I run errands between the healer and the chapel, where mistakes become remedies or mysteries.",
    story:
      "The healer fixes what can be measured, and the magic shop carefully causes questions nobody can measure yet. I carry notes between them because people recover faster when pride stops guarding information. The chapel's quiet days worry me more than its crowded ones.",
    location:
      "Temple Green is calm on purpose, with clean paths, pale stone, and enough space for grief to breathe. The chapel, apothecary, and grave path sit closer together than most visitors realize. Speak softly here, but don't confuse softness with ignorance.",
  },
  {
    offset: 21,
    displayName: "Tess, Walker",
    sex: "female",
    kind: "humanoid",
    role: "market errand runner",
    district: "Market Square",
    voiceStyle:
      "young, quick, funny, and proud of knowing the useful shortcuts",
    intro:
      "Tess. I run market errands, and yes, the bakery smells better than the archive.",
    story:
      "Small market work doesn't pay much, but it teaches you who needs what before they ask. I can cross the square with bread, ink, and a sealed message without mixing any of them up. Bolt knows I prefer the bakery, though I maintain there is no need to document it.",
    location:
      "The fastest route through the square changes with carts, chickens, and whoever is arguing near the fountain. Side lanes save time until rain turns them into mud. Watch the workers rather than the signs when you need to know which path is actually open.",
  },
  {
    offset: 22,
    displayName: "Niko, Walker",
    sex: "male",
    kind: "humanoid",
    role: "bank-lane messenger",
    district: "Player Services",
    voiceStyle: "mild, understated, amused by official seriousness",
    intro:
      "Niko. I carry messages near the bank and try not to make eye contact with disappointed coins.",
    story:
      "Merl Voss can frown at a ledger until the ink improves its posture. I move messages between people who believe urgency becomes respectable when sealed with wax. The trick is knowing which envelope is truly important and which sender merely owns expensive stationery.",
    location:
      "The bank lane is mostly stone, quiet voices, and people checking their pockets twice. Couriers cut through quickly, while everyone else learns the patience of a proper queue. If someone asks you to hold an unmarked parcel, discover their name before you discover its weight.",
  },
  {
    offset: 23,
    displayName: "Pera, Walker",
    sex: "female",
    kind: "humanoid",
    role: "residential caretaker and newcomer neighbor",
    district: "Residential District",
    voiceStyle:
      "neighborly, teasing, practical, with quiet pride in ordinary homes",
    intro:
      "I'm Pera. I keep an eye on the newcomer house, mostly to make sure its residents eventually find the door.",
    story:
      "A home doesn't need to be grand to make a traveler stand differently. I air the rooms, check the hearth, and leave useful notes where exhausted people might actually see them. Upstairs is for feeling important; downstairs is for remembering where you put your boots.",
    location:
      "The residential streets sit just far enough from the square to hear the town without being swallowed by it. Fog sometimes settles low between the houses and makes familiar corners feel misplaced. Keep one warm window or painted door in mind, and the lane will bring you back.",
  },
  {
    offset: 24,
    displayName: "Olan, Walker",
    sex: "male",
    kind: "humanoid",
    role: "magic-shop lane regular",
    district: "Wyrm and Candle",
    voiceStyle: "curious, cautious, dryly humorous around magical hazards",
    intro:
      "Olan. I walk the magic-shop lane and maintain a strict policy against humming back at crystals.",
    story:
      "The glowing roof was meant to be a landmark, though Edrin treats it as an invitation to questions. I carry lamp oil and chalk because magical shops run on very ordinary supplies between extraordinary mistakes. Curiosity is useful here, provided it arrives with manners and insulated gloves.",
    location:
      "The lane between the magic shop and Temple Green grows blue at dusk from Edrin's lamps. Strange light makes distances look shorter than they are, especially in rain. Stay on the clean stones, and let the shopkeeper touch anything that appears eager to meet you.",
  },
  {
    offset: 25,
    displayName: "Rin, Walker",
    sex: "female",
    kind: "humanoid",
    role: "farm-lane walker and animal helper",
    district: "Gate Fields",
    voiceStyle: "bright, practical, fond of animals, and unbothered by mud",
    intro:
      "I'm Rin. I help Tilda with the animals, which mostly means negotiating with creatures that already decided.",
    story:
      "Chickens are small, loud, and completely committed to their own importance. Tilda pays in eggs and blunt wisdom, both of which travel well. I prefer animal trouble to people trouble because animals rarely pretend the gate was already open.",
    location:
      "The farm lanes are broad enough to see weather coming and narrow enough for every loose hen to become public news. Mud gathers near the irrigation ditches after rain. Keep the orchard on your left when returning to town, and listen if the livestock all turn toward the same sound.",
  },
  {
    offset: 26,
    displayName: "Dax, Walker",
    sex: "male",
    kind: "humanoid",
    role: "Craftsman Row laborer",
    district: "Craftsman Row",
    voiceStyle:
      "plainspoken, energetic, with workshop humor and a healthy respect for guards",
    intro:
      "Dax. I haul supplies around Craftsman Row and hit practice dummies when the supplies start talking back.",
    story:
      "The weapons shop sits near the bank because repairs and payment enjoy arguing at close range. I move coal, scrap, and finished work where stronger people somehow cannot. The Guard Yard keeps legal targets for anyone who needs to learn the difference between force and control.",
    location:
      "Craftsman Row gets hotter and louder toward the forge. Watch for carts backing from narrow sheds, leather stretched across walkways, and quenching water nobody wants kicked over. The tavern is where everyone goes after pretending the day's work was easy.",
  },
  {
    offset: 27,
    displayName: "Sergeant Bram Holt",
    sex: "male",
    kind: "humanoid",
    role: "North Gate watch sergeant",
    district: "North Gate",
    voiceStyle:
      "tired authority, clipped watch discipline, and guarded paternal warmth",
    intro:
      "Bram Holt, sergeant of the gate. State your name and business, and I'll decide how much patience the road left you.",
    story:
      "I came to Harthmere as a recruit and have kept this gate for twenty-three years. I buried my wife, raised a sick daughter, and learned that law feels different when medicine costs more than honesty. I don't excuse what I've compromised, but I still measure every choice by who might not survive a cleaner conscience.",
    location:
      "North Gate is a threshold, not a welcome mat. Carts, papers, tolls, refugees, and danger all arrive through the same opening, so the Watch has to judge quickly without becoming cruel. Beyond the fields, the Wilds grow older than our rules and much less interested in them.",
  },
  {
    offset: 28,
    displayName: "Mara Thistle",
    sex: "female",
    kind: "humanoid",
    role: "market stallholder and practical gossip network",
    district: "Market Square",
    voiceStyle:
      "loud, quick, funny, suspicious of cheats, and warm toward working people",
    intro:
      "Mara Thistle. Buy something, ask something, or move aside for somebody prepared to do both.",
    story:
      "This stall belonged to my mother and hers before that, and Edrik Vane will own it over my dead body. I raised two sons here after fever took my husband, so I know the cost of every dishonest price. Maren Dawnloaf is my best friend and a thief, which is to say she steals customers and returns them well fed.",
    location:
      "Market Square tells on everyone eventually. Bread, bank, blade, and blessing are the four stops that make the town feel smaller and safer. Learn who watches the scales, who watches the crowd, and who watches the person doing the watching.",
  },
  {
    offset: 29,
    displayName: "Master Osric Vale",
    sex: "male",
    kind: "humanoid",
    role: "fifth-generation blacksmith and repair master",
    district: "Craftsman Row",
    voiceStyle:
      "low, economical, forge-worn, with emotion held behind exact craft language",
    intro:
      "Osric Vale. Tell me what broke, how it broke, and how long you need the repair to last.",
    story:
      "The Vale forge has passed through five generations, and Luth will be the sixth if he chooses to stay. I fought as a caravan guard when I was young, then learned making sound steel was harder and more useful than swinging it. My family kept one old bell secret for generations, and I have spent years dreading the day someone finally asked the right question.",
    location:
      "The Black Anvil is the hottest room on Craftsman Row and the quietest place in town when the hammer stops. Every hinge, plow, shield, and blade here is expected to survive panic as well as weather. If a sound from the forge carries too cleanly beneath the street, don't assume the echo came from us.",
  },
  {
    offset: 30,
    displayName: "Elowen Pike",
    sex: "female",
    kind: "humanoid",
    role: "Copper Kettle innkeeper and keeper of rooms and secrets",
    district: "Copper Kettle",
    voiceStyle:
      "warm, no-nonsense, intimate without prying, and quietly grief-shaped",
    intro:
      "Elowen Pike, love. Order something warm, then decide whether you need a room, an ear, or both.",
    story:
      "I've kept the Copper Kettle for thirty-three years, since long before grief taught me how quietly trouble enters a room. I hold beds for travelers and secrets for friends, and I only confuse the two on purpose. Father Aldren forgets to eat when fear gets hold of him, so I send warmth toward the chapel whether he asks or not.",
    location:
      "The Kettle is Harthmere's place to stop moving without becoming alone. The hearth draws in guards, dockhands, merchants, and people who don't want their names repeated. If you need truth, bring a witness, a place, and a reason someone might lie.",
  },
  {
    offset: 31,
    displayName: "Father Aldren",
    sex: "male",
    kind: "humanoid",
    role: "chapel priest and reluctant keeper of bell lore",
    district: "Temple Green",
    voiceArchetype: "mature",
    voiceStyle:
      "soft, careful, sleep-deprived, with faith strained but not broken",
    intro:
      "Father Aldren Mell. You're welcome to sit, light a candle, or ask the question everyone else avoids.",
    story:
      "I served beneath Mother Halene and inherited her chapel, her unfinished notes, and more of her fear than I understood. The missing bell was not stolen, though I spent years wishing that simpler story were true. Faith has not given me certainty, but it has made pretending ignorance feel increasingly like a sin.",
    location:
      "Temple Green was built for quiet grief, clean paths, and the ordinary work of mercy. Beneath the chapel are older stones, older promises, and a sound I cannot quite hear or stop. Light a candle before leaving town, not because roads obey prayer, but because people sometimes need to admit they hope to return.",
  },
  {
    offset: 32,
    displayName: "Reeve Caldus Merrow",
    sex: "male",
    kind: "humanoid",
    role: "hereditary reeve and civic ruler",
    district: "Noble Rise",
    voiceArchetype: "authoritative",
    voiceStyle:
      "controlled, educated, politically careful, with anxiety beneath formal restraint",
    intro:
      "Reeve Caldus Merrow. Harthmere's problems are rarely simple, despite how confidently people present them.",
    story:
      "My family has held this office for generations, and I have spent twenty-one years learning what inherited authority cannot solve. Order is expensive, but chaos sends its bill in funerals. I have compromised with merchants, taxes, and my own fear, and I am no longer certain which compromises kept the town alive.",
    location:
      "Noble Rise is cleaner, quieter, and more observant than the rest of Harthmere. Ledgers, permits, gardens, and polite voices conceal the same pressures visible in the muddy streets below. The bridge and chapel can both be seen from here, which makes their cracks difficult to ignore.",
  },
  {
    offset: 33,
    displayName: "Nessa Crowe",
    sex: "female",
    kind: "humanoid",
    role: "Mudden Ward guide, rat-catcher, and underways scout",
    district: "Mudden Ward",
    voiceStyle: "street-wise, quick, defensive, funny until old fear surfaces",
    intro:
      "Nessa Crowe. I know the drains, the rats, and the parts of town respectable boots pretend not to touch.",
    story:
      "I grew up in Mudden Ward, where the Reeve's attention arrives after the water and leaves before the repairs. I fell into the old well as a child and heard a woman's voice tell me what slept beneath the chapel. People call that a story because believing a Ward girl would force them to change something.",
    location:
      "Mudden Ward is tight, patched, human, and better organized than outsiders notice. The drains flood, doors stick, and children learn which alleys stay dry before they learn formal street names. Bring a light near the old well, keep a knife for practical problems, and leave room for one assumption to be wrong.",
  },
  {
    offset: 34,
    displayName: "Tovin Reed",
    sex: "male",
    kind: "humanoid",
    role: "dockmaster and river-cargo authority",
    district: "River Docks",
    voiceStyle:
      "weathered, terse, protective, with fear disguised as procedural irritation",
    intro:
      "Tovin Reed, dockmaster. The river takes what it takes, and I prefer not to help it choose.",
    story:
      "I grew up on barges and have balanced legal cargo, merchant pressure, and river favors for fourteen years. My daughter dreams of a woman beneath the water, and I believe her more than I want to. Bram and I share an understanding about medicine and silence that neither of us intends to explain.",
    location:
      "The docks are busy by day and suspicious by night. Fog hides distance, wet timber hides bad footing, and an ownerless crate is usually surrounded by interested liars. Keep your hands out of black water and never trust a manifest more than the people who unloaded it.",
  },
  {
    offset: 35,
    displayName: "Lysa, Cloth Merchant",
    sex: "female",
    kind: "humanoid",
    role: "cloth merchant and market observer",
    district: "Market Square",
    voiceStyle:
      "bright, appraising, socially sharp, with a merchant's polished speed",
    intro:
      "Lysa. I sell burgundy for market days, gray wool for honest work, and hoods for complicated histories.",
    story:
      "Cloth tells people what to expect before a mouth opens. I learned to read wealth, labor, grief, and attempted invisibility in seams and wear marks. The Merchant Compact adores rules until a rule costs one of its own members money.",
    location:
      "My stall sits where market dust reaches every bolt of cloth by afternoon. Craftsman Row handles dyes and heavier work, while the square handles taste and gossip. Choose fabric for the life you actually live, not the one you plan to describe.",
  },
  {
    offset: 36,
    displayName: "Perrin, Moneylender",
    sex: "male",
    kind: "humanoid",
    role: "private moneylender and keeper of personal debts",
    district: "Player Services",
    voiceStyle:
      "smooth, quiet, unsettlingly patient, and precise about leverage",
    intro:
      "Perrin. The bank stores valuables; I store promises people were certain they could keep.",
    story:
      "Debt only feels lighter than iron while it remains someone else's. I remember who borrowed for hunger, who borrowed for vanity, and who intends never to repay either. A missing lockbox is a tragedy, but a missing ledger can become an opportunity for everyone willing to be dishonest at once.",
    location:
      "Player Services gathers respectable finance beside less respectable need. Stone counters and clean chairs make every arrangement look safer than it is. Read every name, date, and consequence before your urgency becomes somebody else's property.",
  },
  {
    offset: 37,
    displayName: "Old Jory",
    sex: "male",
    kind: "humanoid",
    role: "orchard elder and keeper of farm memory",
    district: "Orchard Lane",
    voiceStyle:
      "old, rambling, dry, with practical truth hidden inside country sayings",
    intro:
      "Old Jory. Apples grow sweeter near old trouble, though nobody thanks the trouble for its contribution.",
    story:
      "I've watched Orchard Lane survive riots, late frosts, and officials who thought trees followed proclamations. The roots remember changes in water and soil before people find language for them. Bring Maren good apples and she'll send you away heavier, provided you listen when I tell you which trees have gone quiet.",
    location:
      "Orchard Lane looks gentle because danger prefers pretty approaches. By day the rows are open, warm, and full of birds; by night every scarecrow acquires opinions. Watch the fruit skin, the animal noise, and how quickly road dust sticks to your boots.",
  },
  {
    offset: 38,
    displayName: "Mirel, Gravekeeper",
    sex: "female",
    kind: "humanoid",
    role: "chapel gravekeeper and burial-ground watcher",
    district: "Temple Green",
    voiceStyle:
      "low, solemn, unsentimental, with restrained supernatural unease",
    intro:
      "Mirel, gravekeeper. The dead tolerate visitors better than thieves, liars, or anyone who whistles near the crypt.",
    story:
      "I keep names legible and graves closed, which is more work than either promise suggests. Wet footprints have crossed dry soil lately, and nobody living admits they made them. A missing bell is unfortunate; a buried bell beneath consecrated ground is a different kind of problem.",
    location:
      "The grave path leaves Temple Green and grows colder before the trees truly begin. Memorial ribbons mark the tended ground, while older stones lean toward the Gravewood. Don't take coins, charms, flowers, or bones from any grave, even when no witness appears to object.",
  },
  {
    offset: 39,
    displayName: "Rusk, Toll Clerk",
    sex: "male",
    kind: "humanoid",
    role: "North Gate toll clerk",
    district: "North Gate",
    voiceStyle:
      "nervous, bureaucratic, dryly funny, and eager to redirect anger upward",
    intro:
      "Rusk, toll clerk. I collect legal copper and receive illegal quantities of personal criticism.",
    story:
      "I write the numbers because someone must be blamed in neat handwriting. The bridge tax is legal, which is not the same as popular or wise. Sergeant Holt occasionally glares a fee into becoming negotiable, and I occasionally fail to notice that happening.",
    location:
      "The toll booth sits beneath the gate where carts, mud, livestock, and tempers form one patient line. Keep papers ready before reaching the window. If a threat must be delivered, the office with better curtains is uphill and delighted to receive correspondence.",
  },
  {
    offset: 40,
    displayName: "Sable, Smuggler",
    sex: "female",
    kind: "humanoid",
    role: "smuggler and underways contact",
    district: "Mudden Ward",
    voiceStyle:
      "guarded, clipped, intimate, and quietly amused by lawful certainty",
    intro:
      "Sable. Honest folk call them drains; everyone else knows a door doesn't need hinges.",
    story:
      "I learned the underways from people who needed medicine, food, or distance more than official permission. Clean work comes with witnesses, while useful work usually prefers a quieter entrance. The old well has bars for a reason, but safety was never the only reason.",
    location:
      "The alleys near Mudden Ward change character after rain and after dark. Some routes flood, some routes are watched, and some routes remember older town walls. Don't follow chalk marks you didn't see being made, and don't ask a stranger to repeat a name they carefully avoided giving.",
  },
  {
    offset: 42,
    displayName: "Town Crier Pell",
    sex: "male",
    kind: "humanoid",
    role: "town crier and public-notice reader",
    district: "Market Square",
    voiceStyle:
      "projecting, theatrical, cheerful in public and sharper in private",
    intro:
      "Pell, town crier! I make sure Harthmere hears the news, including the parts Reeve Hall calls unnecessary volume.",
    story:
      "A crier learns which announcements make people stop, laugh, or quietly leave the square. I read daily writs, missing notices, festival hours, and official denials with equal breath. The chapel bell remains missing, and the administration remains committed to describing that as old information.",
    location:
      "The fountain carries a strong voice across Market Square without forcing everyone into one doorway. Morning crowds want prices, evening crowds want scandal, and festival crowds mostly want permission to cheer. If the square suddenly stops listening, something more interesting than news has arrived.",
  },
  {
    offset: 43,
    displayName: "Courier Anwen",
    sex: "female",
    kind: "humanoid",
    role: "town courier and seal expert",
    district: "Player Services",
    voiceStyle:
      "fast, clear, disciplined, and impatient with unnecessary delay",
    intro:
      "Courier Anwen. I run because everyone else waits, and the mail shouldn't suffer for it.",
    story:
      "I've carried Harthmere's letters for nine years without losing a parcel. I can smell forged noble wax, recognize three kinds of chapel seal in the dark, and still deliver evidence of fraud to the address written on it. The mail has to remain trustworthy even when the people using it are not.",
    location:
      "Player Services is a knot of bank records, guild papers, auction slips, and people asking whether anything arrived for them. I know every street, alley, and shortcut worth trusting. If a package whispers, bring it to Tovin and forget you heard my name attached to the advice.",
  },
  {
    offset: 44,
    displayName: "Drill Instructor Hal",
    sex: "male",
    kind: "humanoid",
    role: "Guard Yard drill instructor",
    district: "Guard Yard",
    voiceStyle:
      "loud, commanding, jovial beneath discipline, and fiercely opposed to bullying",
    intro:
      "Hal, drill instructor. Show me your feet, your target, and whether you can stop before you hit a friend.",
    story:
      "I've trained recruits for the better part of twenty winters and buried enough fools to dislike decorative bravery. During the Bridge Tax Riot, I refused an order to charge the crowd, and I have never regretted it. If a Mudden child needs boots in winter, I occasionally become careless with a few coins near the cobbler.",
    location:
      "The Guard Yard is for learning control where mistakes bruise instead of kill. Dummies, marked lanes, and quartermasters all exist because enthusiasm needs boundaries. Keep your stance wide, your eyes forward, and your weapon away from anyone who isn't also trying to hit you.",
  },
  {
    offset: 45,
    displayName: "Bounty Clerk Rowan",
    sex: "male",
    kind: "humanoid",
    role: "bounty clerk and threat registrar",
    district: "Guard Yard",
    voiceStyle:
      "official, dry, unhurried, with gallows humor kept carefully professional",
    intro:
      "Rowan, bounty clerk. I classify danger by distance, proof, and how loudly survivors complain afterward.",
    story:
      "Rats count, bandits count more, and grave robbers count only if they're still breathing when the Watch arrives. I keep names, threat descriptions, and payment terms exact because vague danger gets desperate people killed. A first bounty should teach judgment before it teaches greed.",
    location:
      "The bounty desk sits near the training yard so confidence can be tested before it leaves town. Watch reports arrive stained with rain, mud, and sometimes blood. Read the threat, understand the required proof, and don't turn a capture order into a corpse because it felt simpler.",
  },
  {
    offset: 46,
    displayName: "Sister Maelle",
    sex: "female",
    kind: "humanoid",
    role: "chapel healer and junior cleric",
    district: "Temple Green",
    voiceStyle:
      "bright, compassionate, morally clear, with concern she tries not to dramatize",
    intro:
      "Sister Maelle Frenn. If you need water, bandages, or mercy, ask before pride makes the decision for you.",
    story:
      "I left a prosperous southern family to enter the chapel, then came north six years ago to serve Father Aldren. He's the finest teacher I've known and a frightened man pretending exhaustion explains everything. I keep emergency blessing kits ready because faith is more useful when someone has already packed the bandages.",
    location:
      "Temple Green is meant to feel calm enough for people to tell the truth. The chapel door stays close to medicine, memorials, and the road out of town because mercy rarely arrives as one tidy need. The old stones carry a history our newer prayers have not fully understood.",
  },
  {
    offset: 47,
    displayName: "Ysabet Fenlow",
    sex: "female",
    kind: "humanoid",
    role: "master apothecary and alchemist",
    district: "Apothecary",
    voiceArchetype: "mature",
    voiceStyle:
      "older, clinical, exact, unsentimental, with deep care expressed through competence",
    intro:
      "Ysabet Fenlow. The correct dose is the difference between a remedy, a poison, and an inquiry from the Watch.",
    story:
      "My father taught me herbs, and I have kept this apothecary for more than thirty-five years. People call medicine suspicious until they need it, then call failure witchcraft when a body cannot be saved. Lately I dream of an enormous woman beneath the river, which is not a symptom I enjoy admitting.",
    location:
      "The Green Mortar depends on clean water, careful labels, and plants gathered without swamp rot. Fever tea needs willow bark and mint, while stranger ailments require ingredients from places sensible people avoid. Never mix a river vial with a road vial simply because both appear clear.",
  },
  {
    offset: 48,
    displayName: "Garrik Fen",
    sex: "male",
    kind: "humanoid",
    role: "carpenter and structural repair master",
    district: "Craftsman Row",
    voiceStyle:
      "cheerful, practical, incapable of keeping a harmless secret, suddenly serious about structural danger",
    intro:
      "Garrik Fen, carpenter. I build crates, bridges, and confidence, though only two of those reliably bear weight.",
    story:
      "I have four children, one wife, one workshop, and no proven ability to keep a secret. Wood tells me where stone has shifted because doors complain before walls admit anything. The cracks beneath Harthmere form patterns like a great slow tone, and I would be happier if I were wrong.",
    location:
      "Craftsman Row leaves sawdust, sparks, hide scraps, and useful noise in every doorway. My yard handles frames, signs, carts, and the bridges nobody thanks until one fails. If a beam begins humming without wind, step away and fetch someone who believes you.",
  },
  {
    offset: 49,
    displayName: "Helna Voss",
    sex: "female",
    kind: "humanoid",
    role: "leatherworker and clothing repairer",
    district: "Craftsman Row",
    voiceStyle:
      "sharp-eyed, dry, brisk, with affection hidden inside exact criticism",
    intro:
      "Helna Voss. Boots, belts, straps, and waterskins keep this town moving when iron can't.",
    story:
      "I came south with my brother Merl and chose leather because it tells the truth under strain. I can read class, travel, and bad decisions in a pair of boots before the wearer says a word. Noble clothes arrive for quiet repairs after suspicious nights, and I keep a private memory of every torn seam.",
    location:
      "My shop sits where forge heat dries leather quickly and road mud returns just as quickly. The stable owes me coin, the bank calls it a process, and I call it theft with chairs. Bring hides clean, salted, and cut by someone who respected the animal enough not to waste it.",
  },
  {
    offset: 50,
    displayName: "Selka Weaver",
    sex: "female",
    kind: "humanoid",
    role: "weaver, tailor, and civic banner maker",
    district: "Craftsman Row",
    voiceStyle:
      "observant, restrained, socially incisive, with a weaver's patient rhythm",
    intro:
      "Selka. Cloth tells class, work, and fear before most mouths decide what story to use.",
    story:
      "I weave guild banners, baker's aprons, guard trim, and hoods for people with too much history. Color is Harthmere's quiet language: red and black for authority, green shutters for money, and patched indigo for a Ward that gets repaired last. I remember Nessa Crowe more clearly than either of us finds comfortable.",
    location:
      "The weaving rooms sit beyond the loudest forge work where threads can stay clean. Dyed cloth hangs across the lane and turns every wind into a signal. Look up before carrying a torch, and look twice before assuming a patched garment belongs to a poor person.",
  },
  {
    offset: 51,
    displayName: "Ferry Master Wren",
    sex: "male",
    kind: "humanoid",
    role: "ferry master of the Brell river line",
    district: "River Docks",
    voiceStyle:
      "river-worn, measured, fatalistic without surrendering professional care",
    intro:
      "Wren of the Brell ferry line. We travel when the river permits, not when confidence demands.",
    story:
      "My family ran this water before the bridge belonged to anyone's taxes. Tovin and I argue over manifests because two careful people can still fear different failures. Fog makes fools brave, and the river tends to notice bravery before wisdom.",
    location:
      "The ferry landing changes with current, flood, and whatever the Briarfen sends downstream. Keep your hands out of black water and your weight centered when boarding. If the bells sound farther away than they should, wait for clearer weather.",
  },
  {
    offset: 52,
    displayName: "Mudden Child Lio",
    sex: "male",
    kind: "humanoid",
    role: "Mudden Ward child and tunnel-rumor collector",
    district: "Mudden Ward",
    voiceArchetype: "child",
    voiceStyle: "young, wary, quick, trying to sound braver than he feels",
    intro:
      "I'm Lio. Nessa says strangers are fine if they look lost enough to be useful.",
    story:
      "The drains have voices, but grown-ups call them echoes because that lets them sleep. I know the rat-catcher songs and which steps stay dry when the Ward floods. If you find a red ribbon near the well, leave it where it is and don't ask me who tied it.",
    location:
      "Mudden Ward has better hiding places than rich streets because nobody planned them. Laundry lines mark safe yards, plank paths mark deep mud, and every dog knows which strangers belong. Don't follow a child into a tunnel unless an adult knows both your names.",
  },
  {
    offset: 53,
    displayName: "Washerwoman Cale",
    sex: "female",
    kind: "humanoid",
    role: "washerwoman and quiet witness to town life",
    district: "Mudden Ward",
    voiceStyle: "tired, direct, humane, with sharp observational humor",
    intro:
      "Cale. Laundry tells the truth in blood, river mud, perfume, and ash.",
    story:
      "Nobles pay extra to pretend stains don't have histories. I wash guard shirts, inn sheets, work aprons, and the clothing people wore on nights they won't discuss. The Ward floods first and gets repaired last, so if you want to help, bring soup before speeches.",
    location:
      "The wash lanes run beside drainage channels that behave badly after rain. Lines of cloth turn narrow yards into rooms, and every basin has already worked harder than it should. Step around the clean water, mind the plank walks, and don't mistake patched homes for careless ones.",
  },
  {
    offset: 54,
    displayName: "Tax Clerk Iven",
    sex: "male",
    kind: "humanoid",
    role: "permit and tax clerk",
    district: "Noble Rise",
    voiceStyle:
      "weary, procedural, dry, with rebellion limited to excellent phrasing",
    intro:
      "Iven, tax clerk. Permits require a stamp, a fee, and patience measured in geologic time.",
    story:
      "The Reeve is officially available through procedures designed to preserve his unavailability. I process property records, bridge complaints, trade fees, and every citizen convinced their case is the first exception. Bureaucracy can protect people, but it can also become a locked door built entirely from polite language.",
    location:
      "Reeve Hall is cleaner than the streets it governs and quieter than the problems entering it. Keep copies of every document and note who accepted the original. Complaints about the bridge tax belong upstairs, where the curtains are better and the expectations should remain low.",
  },
  {
    offset: 55,
    displayName: "Noble Servant Rose",
    sex: "female",
    kind: "humanoid",
    role: "Reeve Hall household servant",
    district: "Noble Rise",
    voiceStyle:
      "polished, discreet, quietly sardonic, and careful about who might overhear",
    intro:
      "Rose. I keep Reeve Hall polished enough that visitors can admire the brass instead of the tension.",
    story:
      "Servants know which doors are locked, which locks are decorative, and which arguments resume after guests leave. Everyone downstairs pretends not to hear the protests, while everyone upstairs pretends the windows are thick enough. I value discretion, but not the kind that asks a household to forget its own conscience.",
    location:
      "Noble Rise is trimmed, swept, and arranged to make authority look effortless. Gardens hide service paths, polished doors hide crowded workrooms, and clean stone carries footsteps clearly. If you need privacy, avoid rooms with more than one mirror.",
  },
  {
    offset: 56,
    displayName: "Guard Quartermaster Tarrow",
    sex: "male",
    kind: "humanoid",
    role: "Watch quartermaster and equipment keeper",
    district: "Guard Yard",
    voiceStyle:
      "blunt, inventory-minded, stern, with affection expressed as proper maintenance",
    intro:
      "Tarrow, quartermaster. If it has a point, edge, strap, or dent, I count it.",
    story:
      "Watch equipment becomes missing property the moment someone says they only borrowed it. Osric repairs serious damage, while I determine whether the damage came from duty, stupidity, or an ambitious mixture. A well-kept buckle has saved more guards than half the speeches given in this yard.",
    location:
      "The stores sit beside the drill lanes so damaged gear travels a short and embarrassing distance. Return equipment clean, report every crack, and never hide blood beneath fresh oil. The Watch can forgive wear; it cannot plan around lies.",
  },
  {
    offset: 57,
    displayName: "Traveling Merchant Ossa",
    sex: "female",
    kind: "humanoid",
    role: "traveling merchant and road-supply seller",
    district: "Market Edge",
    voiceStyle:
      "bright, persuasive, road-wise, and cheerfully realistic about poor planning",
    intro:
      "Ossa. Today I sell rope, chalk, whistles, maps, and optimism by the yard.",
    story:
      "I follow festivals, road openings, and arguments large enough to attract customers. Bridge Day brings better stock when the routes stay clear, and empty shelves when bandits disagree. A merchant survives by knowing what travelers forgot before they admit forgetting it.",
    location:
      "The market edge is where caravans unpack before the square decides what everything is worth. Watch the loudest disagreement if you cannot afford a compass. Keep rope dry, chalk wrapped, and enough coin aside to return by a safer road.",
  },
  {
    offset: 58,
    displayName: "Food Vendor Marae",
    sex: "female",
    kind: "humanoid",
    role: "street-food vendor",
    district: "Market Square",
    voiceStyle: "warm, fast, teasing, with the rhythm of serving a lunch rush",
    intro:
      "Marae. Hot onions, seed cakes, and cider, all cheap enough to regret twice.",
    story:
      "I feed the people who become unbearable when they skip lunch. Guards, couriers, traders, and adventurers all make wiser decisions with something warm in hand. A good meal is a minor blessing with a better smell and a much shorter sermon.",
    location:
      "My stall catches fountain mist, market smoke, and every hungry traveler crossing the square. Eat before taking the long road or the longer argument. Keep the lane clear while chewing, because carts respect neither appetite nor heroism.",
  },
  {
    offset: 59,
    displayName: "Guild Registrar Wyne",
    sex: "female",
    kind: "humanoid",
    role: "guild registrar and charter keeper",
    district: "Player Services",
    voiceStyle:
      "formal, intelligent, faintly lonely, with patient authority over foolish names",
    intro:
      "Registrar Wyne. Guild names must be legible, non-treasonous, and not already claimed by someone louder.",
    story:
      "I know every charter in three river regions and most of the arguments that produced them. A guild becomes real when its promises survive the first shared bank, disputed build, and absent leader. Crests cost extra because artists eat, despite repeated attempts by founders to classify enthusiasm as payment.",
    location:
      "The registry sits among banks and couriers because organizations quickly become paperwork with friends attached. Bring clear ranks, permissions, and a name everyone can still tolerate after a month. Recruitment notices belong on the public wall, not on my chair.",
  },
  {
    offset: 60,
    displayName: "Auction Clerk Pellam",
    sex: "male",
    kind: "humanoid",
    role: "auction clerk and trade-listing official",
    district: "Player Services",
    voiceStyle:
      "precise, clipped, professionally skeptical, and dry about buyer remorse",
    intro:
      "Pellam, auction clerk. Listing fees first, complaints second, regret by appointment.",
    story:
      "I turn other people's optimism into numbered lots and enforce disclosure when possible. Prices teach consequences faster than lectures, especially when a bidder mistakes rarity for usefulness. Haunted cargo is permitted only when the haunting is described accurately and priced with appropriate shame.",
    location:
      "The auction lane sits close to storage because buyers enjoy discovering weight after ownership. Read condition notes, inspect seals, and decide your limit before the room becomes exciting. A raised hand is still a promise even when attached to poor judgment.",
  },
  {
    offset: 61,
    displayName: "Rat Catcher Dima",
    sex: "male",
    kind: "humanoid",
    role: "rat catcher and drain watcher",
    district: "Mudden Ward",
    voiceStyle:
      "rough, philosophical, street-wise, and comfortable with unpleasant truths",
    intro:
      "Dima. Rats are honest criminals; they bite, steal, and run without writing laws about it.",
    story:
      "Nessa knows the drains, and I know which drains seem to know us back. Rat work repeats because rats are punctual and town repairs are not. I watch nests for scraps, sickness, and anything the animals carried up from deeper stone.",
    location:
      "The old drains cross beneath Mudden Ward in layers no living clerk has fully mapped. Water marks show safe height, chalk shows recent passage, and silence shows nothing useful at all. Wear gloves, carry a light, and don't corner an animal unless you understand its other exits.",
  },
  {
    offset: 62,
    displayName: "Bell-Witness Ora",
    sex: "female",
    kind: "humanoid",
    role: "elder witness to the buried bell",
    district: "Old Well",
    voiceArchetype: "mature",
    voiceStyle:
      "old, quiet, unwavering, with memory arriving as sound before explanation",
    intro:
      "Ora. I heard the bell at dawn, and disbelief hasn't made the stones any quieter.",
    story:
      "The sound came from beneath the square, not from the empty chapel frame. People dismiss an old woman until the ground sings under their own feet. I remember bronze, rain, and a third ring that felt less like sound than an answer.",
    location:
      "The Old Well sits near the market edge where ordinary noise makes strange sounds easier to ignore. Candles sometimes mark the safer approach, though no light makes the bars welcoming. Don't go alone after the third ring, and don't answer anything that uses your name from below.",
  },
  {
    offset: 63,
    displayName: "Apple Picker Ren",
    sex: "male",
    kind: "humanoid",
    role: "orchard picker and road-food supplier",
    district: "Orchard Lane",
    voiceStyle:
      "young, earthy, dryly funny, with careful attention to weather and fruit",
    intro:
      "Ren. I pick clean apples for the bakery and let the haunted-looking ones become someone else's expertise.",
    story:
      "Apple skin tells me about rain, insects, bruising, and sometimes trouble below the roots. Old Jory says trees remember, while I say they mostly drop evidence on my head. Sticky fruit goes to the healer before it goes anywhere near Maren's oven.",
    location:
      "Orchard Lane is pretty enough to make travelers careless. Keep to the rows with birdsong, watch for fruit falling without wind, and leave the deeper roots alone after dark. The road back to town stays safer when the lanterns remain visible between the trunks.",
  },
  {
    offset: 64,
    displayName: "Stablehand Corin",
    sex: "male",
    kind: "humanoid",
    role: "stablehand and road-animal keeper",
    district: "Gate Fields",
    voiceStyle:
      "patient, practical, gently humorous, and more respectful of animals than titles",
    intro:
      "Corin, stablehand. Feed the mule before judging it; the same advice improves most guards.",
    story:
      "I match animals to roads because every route asks a different question of a horse. A ferry landing needs calm feet, a farm route needs patience, and the Wilds need an animal willing to refuse its rider. Horses feel wrong ground before people do, especially near the chapel side of town.",
    location:
      "The stable yard opens toward farms, road posts, and river approaches. Keep gates latched, tack dry, and feed measured before a long ride. If every animal turns its head toward the same distant place, believe them before investigating it.",
  },
  {
    offset: 65,
    displayName: "River Knots Lookout",
    sex: "male",
    kind: "humanoid",
    role: "River Knots lookout and dockside fence",
    district: "River Docks",
    voiceStyle:
      "low, guarded, clipped, with dangerous humor and selective honesty",
    intro:
      "Pretty docks, ugly secrets. You can call me the lookout until you've earned a better answer.",
    story:
      "I watch cargo that respectable people prefer not to see changing hands. Tovin calls some crates boring because saying more would require trust, courage, or paperwork. Better stories arrive after sunset, though most of them charge interest.",
    location:
      "The dock shadows begin where public lanterns stop reflecting cleanly. Blue knot marks indicate friends, traps, or old paint depending on who asks. Count your fingers after touching strange cargo, and never stand with black water at your back.",
  },
  {
    offset: 66,
    displayName: "Chapel Choir Child",
    sex: "female",
    kind: "humanoid",
    role: "chapel choir child and candle helper",
    district: "Temple Green",
    voiceArchetype: "child",
    voiceStyle:
      "young, soft, sincere, with fear expressed through careful observation",
    intro:
      "I sing in the chapel choir. We sing softer now, because Father Aldren listens to the echoes between notes.",
    story:
      "Father says silence can be holy, but I think some silences are frightened. Sister Maelle lets me light candles when I promise not to drip wax on the floor. The missing bell still feels present when everyone reaches the place in the hymn where it should answer.",
    location:
      "The chapel sounds different before sunrise, when the grass is wet and no carts cross the square. Colored window light moves over the floor as the day begins. Children hear small changes because grown-ups are busy deciding which sounds deserve belief.",
  },
  {
    offset: 67,
    displayName: "Forge Apprentice Luth",
    sex: "male",
    kind: "humanoid",
    role: "Black Anvil apprentice and self-taught scholar",
    district: "Craftsman Row",
    voiceArchetype: "youthful",
    voiceStyle:
      "quiet, thoughtful, earnest, with confidence appearing when discussing craft or language",
    intro:
      "Luth. I've apprenticed under Master Osric for eight years, and I still earn every step past nails and hinges.",
    story:
      "Bram found me at the gate when I was eleven, and Osric gave me a home before I understood how much that meant. I read three languages, two poorly, and sometimes dream in a fourth I cannot place. A small spiral sigil appears in those memories, so anything bearing it comes to me quietly.",
    location:
      "The forge side bench is where beginner work becomes reliable work. Heat rewards patience, metal remembers careless force, and Osric hears a bad strike before anyone sees it. Keep books away from sparks and secrets away from people who confuse curiosity with ownership.",
  },
  {
    offset: 68,
    displayName: "Bakery Apprentice Noll",
    sex: "male",
    kind: "humanoid",
    role: "Dawn Loaf bakery apprentice",
    district: "Dawn Loaf Bakery",
    voiceArchetype: "youthful",
    voiceStyle:
      "young, cheerful, self-deprecating, and eager to turn mistakes into competence",
    intro:
      "Noll. I burned the first batch, underbaked the second, and named the third progress.",
    story:
      "Maren says road bread must be hard enough to travel and soft enough to forgive. I am learning that ovens punish guessing more efficiently than teachers do. Good apples help, especially the kind that haven't fought back, whispered, or grown suspicious fur.",
    location:
      "Dawn Loaf is warm before the square wakes and hotter than good judgment by midday. Flour makes the floor slick, cooling racks make the aisle narrow, and hungry guards make every delay public. Follow the smell, stay clear of the oven mouth, and never touch a loaf Maren is still evaluating.",
  },
  {
    offset: 69,
    displayName: "Market Guard Sen",
    sex: "male",
    kind: "humanoid",
    role: "market guard and crowd watcher",
    district: "Market Square",
    voiceStyle:
      "steady, observant, low-drama, with command reserved for moments that need it",
    intro:
      "Sen, market guard. Keep the path clear, your hands visible, and your panic proportional.",
    story:
      "I spot trouble by watching who stops watching the stalls. Pilgrims, carts, performers, and thieves all use the same square, so crowd safety begins before anyone shouts. I prefer a quiet warning to a heroic arrest, but I keep the whistle ready for people who mistake restraint for inattention.",
    location:
      "Market Square handles more movement than its watch ledger can describe. The fountain is the safest rally point unless a crowd has already claimed it. If violence starts, stand behind stone, leave cart lanes open, and help only if you know exactly what help requires.",
  },
] as const;

interface HarthmereAdditiveTownWorldContext {
  story: string;
  location: string;
}

// These are spoken additions, not encyclopedia entries. Each person connects
// the wider conflict to the work, neighborhood, class pressure, or private
// worry they would actually live with. Writer-only truths stay out of their
// mouths, while visible facts such as Harthmere's prohibition, the sealed
// deposits, the Collective, the Merchant Compact, refugees, and faction
// tensions can surface naturally.
const WORLD_CONTEXT_BY_OFFSET: Readonly<
  Record<number, HarthmereAdditiveTownWorldContext>
> = {
  1: {
    story:
      "More newcomers arrive on foot now, some after a Biome failed and some because Harthmere will not open a portal for them.",
    location:
      "At the gate, active Exotic Matter cells are sealed or turned back; inside the walls, every road is meant to stay real beneath your feet.",
  },
  2: {
    story:
      "My license requires an ordinary power core, regular inspections, and no connection to a Biome network.",
    location:
      "Because Harthmere has no anchors, a new crack or impossible echo cannot be dismissed as routine portal drift.",
  },
  3: {
    story:
      "We build without anchor braces or Exotic Matter tools, so every wall has to carry its own honest weight.",
    location:
      "Beyond the farms, sealed workings climb toward the antimatter range, watched by people who know exactly what outsiders would pay to open them.",
  },
  4: {
    story:
      "The guards worry about violet-glowing boxes, but I usually notice the unpleasant humming before they do.",
    location:
      "There is no portal hum in this square, only carts, feet, wings, and occasionally something ringing where nothing should ring.",
  },
  5: {
    story:
      "Local flour matters here because Harthmere refuses the pocket farms and portal supply lines other towns depend upon.",
    location:
      "When the Compact raises grain prices or the bridge closes, bread is the first place ordinary families feel the argument.",
  },
  6: {
    story:
      "Outside investors have offered fortunes for claims beneath Harthmere, and every offer becomes dangerous the moment someone inside town considers signing it.",
    location:
      "The Merchant Compact calls contracts sacred, which is admirable until a mining promise and a hungry debtor appear on the same page.",
  },
  7: {
    story:
      "Cold steel and black powder are lawful here; a weapon powered by Exotic Matter is contraband no matter how elegant the case.",
    location:
      "Confiscated core weapons go to the Watch, while dependable iron comes back here to be sharpened, repaired, and trusted again.",
  },
  8: {
    story:
      "Travelers from failing Biomes sometimes arrive with lost hours, borrowed memories, or weather burns that make no medical sense.",
    location:
      "Harthmere may distrust where those injuries came from, but the injured still receive clean cloth and a place to breathe.",
  },
  9: {
    story:
      "Old magic and Exotic Matter are not the same thing, however eagerly frightened officials place them in one locked cabinet.",
    location:
      "Anchor parts are forbidden inside the walls, but charms, prayer, alchemy, and older mysteries remain matters of argument rather than automatic arrest.",
  },
  10: {
    story:
      "These fields are more than supper; they are proof the town can live without food grown in a private sky and delivered through a gate.",
    location:
      "Every repaired fence and full grain cart makes Harthmere harder to starve into surrender over the antimatter beneath its hills.",
  },
  11: {
    story:
      "Collective visitors, anti-Biome pilgrims, displaced families, and Compact factors all drink beneath this roof, usually without throwing the first cup.",
    location:
      "The hearth is neutral ground until someone starts praising portals, condemning refugees, or asking what the sealed mountains are worth.",
  },
  12: {
    story:
      "A live Exotic Matter cell can buy a dockhand a new life and cost the town a border incident before sunrise.",
    location:
      "The Watch inspects cargo for forbidden cores, the Compact inspects it for unpaid fees, and the River Knots inspect everyone doing the inspecting.",
  },
  13: {
    story:
      "Harthmere was founded by people who believed a real, difficult world was safer than paradise held open by fuel nobody fully understood.",
    location:
      "The cruel joke is that the largest supply of antimatter components lies under the very kingdom that refuses to sell them.",
  },
  14: {
    story:
      "Half the private games in this room are really wagers on whether the Collective, the Compact, or the crown bends first over the sealed deposits.",
    location:
      "When war rumors rise, the careful players stop betting on cards and start buying flour, lamp oil, and road horses.",
  },
  15: {
    story:
      "Outside Harthmere, a person can cross a province through a bright doorway; here, the road and the weather still get a vote.",
    location:
      "Travelers carrying active cores must surrender them at the border, so the inn often receives people angrier about their luggage than their journey.",
  },
  16: {
    story:
      "There are proud songs about Harthmere refusing false worlds, bitter songs about the taxes that paid for that pride, and quiet songs the Compact dislikes.",
    location:
      "A chorus can turn a border policy into courage, propaganda, or a riot depending on who joins in and who paid for the first verse.",
  },
  17: {
    story:
      "I have walked beside refugees from vanished homes and beside inspectors searching their packs for the technology that once kept those homes alive.",
    location:
      "North Gate must keep forbidden matter out without treating every frightened traveler as an enemy, and we do not always succeed at both.",
  },
  18: {
    story:
      "The square's broad lanes were tested by festivals, fire drills, and the Bridge Tax Riot, when a crowd learned how quickly civic order can become a trap.",
    location:
      "Compact officers favor straight processions, the Watch favors clear sightlines, and market families favor having enough room to leave either one.",
  },
  19: {
    story:
      "Since the antimatter dispute sharpened, ordinary parcels share the road with foreign offers, Watch seizures, and contracts nobody admits requesting.",
    location:
      "A sealed case from the Collective receives more attention here than ten crates of honest iron, even when all eleven weigh the same.",
  },
  20: {
    story:
      "I have carried messages for people displaced by broken Biomes and for priests who fear Harthmere is becoming too proud of refusing them.",
    location:
      "Temple Green is where the town's certainty softens, because grief looks much the same whether it arrived by river, road, or failed portal.",
  },
  21: {
    story:
      "Small errands reveal large trouble early: lamp oil disappears, flour rises, and suddenly every merchant claims the border tension is somebody else's fault.",
    location:
      "The Compact can make scarcity look like arithmetic, but market families know when numbers are being used to hide a choice.",
  },
  22: {
    story:
      "Some sealed letters offer lawful trade, while others offer enough money to make a respectable family forget why the antimatter shafts were closed.",
    location:
      "Collective wax is not illegal, but it travels through this lane with guards nearby and fewer jokes than ordinary post.",
  },
  23: {
    story:
      "I have aired rooms for families whose private worlds failed, and the first thing they ask is whether the floor will still exist in the morning.",
    location:
      "Harthmere homes are cramped, drafty, and stubbornly attached to the same earth as their neighbors, which can feel like poverty or mercy depending on what you lost.",
  },
  24: {
    story:
      "Edrin is permitted to sell a hundred strange things, but one working anchor part can bring the Watch through the door before the lamps finish flickering.",
    location:
      "The lane survives by keeping a clear difference between old craft, honest illusion, and machinery fed by forbidden matter.",
  },
  25: {
    story:
      "Harthmere trusts soil and breeding more than climate rooms, fabricated meat, or livestock raised beneath a private sun.",
    location:
      "The animals do not care about the Collective or the crown, but shortages from their quarrel reach the feed bins quickly enough.",
  },
  26: {
    story:
      "Coal dust, sore backs, and real iron are the price of refusing the clean, powerful machines used beyond the border.",
    location:
      "Craftsman Row takes pride in that choice, though pride does not make the air cleaner or the work lighter.",
  },
  27: {
    story:
      "My orders forbid active Exotic Matter inside the walls, but they do not permit me to forget that many people carrying it are refugees, not invaders.",
    location:
      "The Collective wants access, smugglers want profit, and frightened families want through; all three arrive at the same gate wearing road dust.",
  },
  28: {
    story:
      "The Merchant Compact contains honest traders, patient thieves, and men who would sell mining rights beneath their own mothers if the seal looked proper.",
    location:
      "Market arguments about weights and grain often conceal the larger question of who profits if Harthmere is pressured into opening the deposits.",
  },
  29: {
    story:
      "I choose iron because it can fail without tearing open distance, and because a broken hinge should never become a question about time.",
    location:
      "The sealed shaft heads beyond town were built with ordinary stone and steel, then guarded from people carrying very modern promises.",
  },
  30: {
    story:
      "I have hidden debtors from Compact collectors, refugees from angry patriots, and once a Collective clerk who discovered conscience at an inconvenient hour.",
    location:
      "People argue about Biomes as freedom or corruption until someone who lost a home sits beside someone ordered to keep those homes running.",
  },
  31: {
    story:
      "Saint Verena teaches attention, not fear, so I will not call every machine wicked merely because Harthmere finds certainty comforting.",
    location:
      "The chapel supports the ban on dangerous anchors while still offering candles, food, and burial rites to those harmed by the world outside it.",
  },
  32: {
    story:
      "Harthmere's refusal to mine is not a slogan I can revise when the treasury thins; it is the promise on which the kingdom expects this town to stand.",
    location:
      "Collective envoys want access, the Compact wants leverage, Mudden Ward wants repairs, and every answer I give one of them becomes a cost paid by another.",
  },
  33: {
    story:
      "Noble Rise speaks of saving reality, the Compact speaks of sacred bargains, and Mudden Ward still floods while both finish talking.",
    location:
      "The Kin care less about grand arguments than whether refugees share food, children stay dry, and no landlord turns a crisis into an eviction.",
  },
  34: {
    story:
      "Every live cell smuggled upriver gives the Collective one accusation, the Watch one seizure, and the Knots one more reason to distrust both.",
    location:
      "The river keeps Harthmere supplied without portals, which makes these docks a lifeline, a customs line, and a battlefield fought mostly with ink.",
  },
  35: {
    story:
      "These days I can spot a Collective functionary, a Compact creditor, and a family newly escaped from a failed Biome before any of them speak.",
    location:
      "Market fashion grows plainer when war rumors rise, because people buy wool for journeys and save burgundy for a future they still expect to have.",
  },
  36: {
    story:
      "Speculators lend against imagined mining wealth, then leave local families holding very real debt when Harthmere refuses to open the ground.",
    location:
      "The Compact may praise a bargain, but desperation can sign a name long before judgment catches up.",
  },
  37: {
    story:
      "The oldest trees were already here when the first surveyors marked the antimatter range and promised the town would grow rich by cutting into it.",
    location:
      "Some roots bend away from the sealed workings, which is either sensible botany or the sort of warning officials dislike paying to hear.",
  },
  38: {
    story:
      "I tend graves from the tax riot, border skirmishes, failed journeys, and private worlds that returned their owners too late for saving.",
    location:
      "Whatever banner people carried in life, the earth receives them without asking whether they served Harthmere, the Compact, or the Collective.",
  },
  39: {
    story:
      "The fee schedule includes livestock, trade carts, firearms, and enough special rules for forbidden cells to make a smuggler miss simpler crimes.",
    location:
      "A Collective credential does not cancel Harthmere law, though it does produce longer conversations and better-quality threats.",
  },
  40: {
    story:
      "I will move medicine, hungry people, and inconvenient truth, but I will not carry a live core for someone hoping to start a war and call it commerce.",
    location:
      "The River Knots break laws for passage, not every principle for profit, which is why the Compact's inner circle dislikes us.",
  },
  42: {
    story:
      "Official notices praise Harthmere's resolve, announce new inspections, and avoid explaining how close resolve and fear can sound through a speaking horn.",
    location:
      "Warnings about forbidden matter draw cheers from some citizens and silence from families who once depended on a Biome to survive.",
  },
  43: {
    story:
      "I carry mining proposals from foreign houses, refusals from the Reeve, and private Compact replies that were never meant to share the same satchel.",
    location:
      "Messages from the Collective are lawful correspondence, but nobody leaves one unattended near a stove or a curious clerk.",
  },
  44: {
    story:
      "Refusing the crowd during the tax riot taught me that defending Harthmere and obeying every powerful man in it are not the same duty.",
    location:
      "We train for smugglers, frightened crowds, and the war everyone claims to be preventing while sharpening weapons for it.",
  },
  45: {
    story:
      "A courier hiding one cell to keep a sick child alive is not the same problem as a buyer mapping the sealed deposits for an army.",
    location:
      "Good law names the danger precisely; bad law lets poverty, contraband, and treason become one convenient accusation.",
  },
  46: {
    story:
      "I have treated people who fled failing Biomes and people injured protesting them, and pain has never asked me which side deserved mercy.",
    location:
      "The Chapel Circle supports Harthmere's caution but resists turning caution into cruelty toward outsiders, machines, or the desperate.",
  },
  47: {
    story:
      "More patients now report missing minutes and memories that belong to unfamiliar rooms, symptoms officials prefer to blame on travel or grief.",
    location:
      "Harthmere has no anchors of its own, so every case of time-sickness arriving here carries a story from beyond the walls.",
  },
  48: {
    story:
      "A Harthmere house has no invisible anchor holding it square; if the frame stands, wood, stone, and the hands that joined them deserve the credit.",
    location:
      "That makes the new humming cracks harder to dismiss, because no portal machine is available to take the blame.",
  },
  49: {
    story:
      "Refugees arrive in clothes made for impossible climates, while Collective visitors arrive pretending their fine boots have never touched mud.",
    location:
      "Leather goods matter in a town that walks, rides, and rows instead of stepping through a doorway to somewhere else.",
  },
  50: {
    story:
      "Harthmere can raise one banner against Exotic Matter and still remain five factions arguing over who carries the pole and who pays for the cloth.",
    location:
      "Red and black may represent authority, but patched indigo tells you which citizens survive when authority spends its attention elsewhere.",
  },
  51: {
    story:
      "The ferry is slower than a portal and considerably less likely to return you with three missing days or somebody else's rainstorm.",
    location:
      "River travel keeps the town connected without Exotic Matter, so every safe crossing weakens the argument that Harthmere must surrender to survive.",
  },
  52: {
    story:
      "Rich people argue about the Collective and the buried fuel; in the Ward, we argue about whose roof leaks and then fix it together.",
    location:
      "The Mudden Kin say we are already saved because we have one another, which sounds less foolish when the grand systems fail first.",
  },
  53: {
    story:
      "I wash the road from refugee coats, soot from Watch uniforms, and expensive ink from people who swear the Compact never stains its hands.",
    location:
      "The cost of Harthmere's principles reaches Mudden Ward as higher coal, tighter food, and another winter repair postponed for border defenses.",
  },
  54: {
    story:
      "No permit allows antimatter mining inside Harthmere, though foreign petitioners continue submitting increasingly imaginative versions of the same request.",
    location:
      "Collective delegations enter through procedure, Compact influence enters through exceptions, and ordinary citizens wait behind both.",
  },
  55: {
    story:
      "I have served tea while nobles discussed Collective pressure, Compact loyalty, and whether Mudden families could endure one more necessary sacrifice.",
    location:
      "From Noble Rise, the sealed range looks like scenery until an envoy arrives with maps, figures, and an army politely omitted from the proposal.",
  },
  56: {
    story:
      "The stores hold legal powder, honest steel, and a locked shelf of confiscated core weapons nobody enjoys inventorying.",
    location:
      "If the border dispute becomes war, the Watch will defend a ban on miraculous weapons using equipment repaired one buckle at a time.",
  },
  57: {
    story:
      "Harthmere's lack of portals is excellent for road merchants until inspections tighten, bridges close, and every missing crate becomes suspected foreign intrigue.",
    location:
      "Caravans bring news of failing Biomes, hungry settlements, and governments looking toward Harthmere's mountains as if they were already purchased.",
  },
  58: {
    story:
      "Lately I feed more road refugees, extra gate guards, and traders pretending shortages are a clever business opportunity.",
    location:
      "A warm bowl cannot settle the argument over Exotic Matter, but it can stop the argument long enough for two frightened people to hear each other.",
  },
  59: {
    story:
      "Guilds now seek escort charters, border contracts, salvage rights, and occasionally mining access Harthmere has already refused in much grander language.",
    location:
      "A guild may serve the town, the Compact, the Collective, or itself, so the promises in its charter matter before the matching cloaks do.",
  },
  60: {
    story:
      "I have seen forbidden cells listed as violet glass, shrine stones, medical equipment, and once a remarkably energetic paperweight.",
    location:
      "The auction house follows Compact rules, Harthmere law, and profit in that order whenever officials are watching closely.",
  },
  61: {
    story:
      "Rats drag home wire, violet glass, foreign ration tabs, and small truths about what has passed through town without inspection.",
    location:
      "The drains connect rich streets to poor ones beneath every wall, which makes them more honest about Harthmere than most maps.",
  },
  62: {
    story:
      "Outsiders hear the ground and think of the antimatter beneath Harthmere; I heard bronze, sorrow, and something old enough to know the difference.",
    location:
      "The well belongs to the bell mystery, not to every foreign surveyor who hopes a strange sound proves where the deposits lie.",
  },
  63: {
    story:
      "Survey stakes once reached the orchard before townsfolk pulled them up and sent the mining party back toward the bridge.",
    location:
      "The deeper roots run toward sealed ground, and Old Jory says a tree knows when people are considering a profitable mistake.",
  },
  64: {
    story:
      "Horses still matter here because Harthmere chose roads over teleport pads, even when the road is slower, colder, and hungry.",
    location:
      "Some refugees have never ridden farther than a decorative trail inside a Biome, so patience is part of fitting them to a real journey.",
  },
  65: {
    story:
      "The Knots will move medicine past a cruel tariff, but live Exotic Matter attracts buyers who value the cargo more than every person on the dock.",
    location:
      "Blue knots mark a promise of passage, not permission to sell Harthmere's future to the Compact or the Collective.",
  },
  66: {
    story:
      "We are taught that false worlds can vanish, but children from those worlds still need blankets when they reach the chapel.",
    location:
      "Sister Maelle says listening comes before judgment, especially when grown-ups use faith to make fear sound holy.",
  },
  67: {
    story:
      "I study Collective script and old engineering because refusing a machine is wiser when you understand what it was built to do.",
    location:
      "Osric teaches that Harthmere's iron is not morally pure; it is simply a tool whose cost, weight, and failure can be seen.",
  },
  68: {
    story:
      "Road bread matters in a kingdom without portals because every guard, courier, refugee, and stubborn pilgrim has to cross the actual miles.",
    location:
      "When border tension empties the flour bins, nobody at Dawn Loaf mistakes politics for an abstract subject.",
  },
  69: {
    story:
      "I watch for live cores, foreign surveyors, Compact enforcers, and patriots eager to mistake a frightened outsider for all four.",
    location:
      "The square stays safe only if Harthmere can enforce its laws without becoming the monster its enemies already describe.",
  },
};

export const HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE: readonly HarthmereAdditiveTownNpcDialogueProfile[] =
  HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE_BASE.map((profile) => {
    const worldContext = WORLD_CONTEXT_BY_OFFSET[profile.offset];
    if (!worldContext) {
      throw new Error(
        `Missing world context for additive Harthmere NPC offset ${profile.offset}`
      );
    }
    return {
      ...profile,
      story: `${profile.story} ${worldContext.story}`,
      location: `${profile.location} ${worldContext.location}`,
    };
  });

const PROFILE_BY_OFFSET = new Map(
  HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE.map((profile) => [
    profile.offset,
    profile,
  ])
);

export function harthmereAdditiveTownNpcDialogueForOffset(offset: number) {
  return PROFILE_BY_OFFSET.get(offset);
}

export function harthmereAdditiveTownNpcEntityId(offset: number) {
  return HARTHMERE_ADDITIVE_TOWN_NPC_ID_BASE + offset;
}

export function harthmereAdditiveTownNpcVoiceProfile(
  profile: HarthmereAdditiveTownNpcDialogueProfile
): HarthmereNpcVoiceProfile {
  // The general caster also supports monsters and animals by scanning prose.
  // Townspeople naturally mention graves, livestock, ghosts, or rats, so feed
  // it a presentation-focused summary for humanoids rather than allowing a
  // subject in their biography to recast the speaker as a neutral creature.
  const humanoidCastingText = `${profile.role} ${profile.voiceStyle}`
    .replace(
      /\b(robot|sentinel|automaton|construct|cow|sheep|rabbit|livestock|animal|wildlife|mucker|muckling|muckwad|hexer|monster|creature|undead|ghost|wraith|grave|pale|skeleton)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
  const voiceProfile = harthmereVoiceProfileForActor({
    source: "runtime_entity",
    entityId: harthmereAdditiveTownNpcEntityId(profile.offset),
    displayName: profile.displayName,
    role:
      profile.kind === "humanoid"
        ? `${humanoidCastingText} in ${profile.district}`
        : `${profile.role} in ${profile.district}`,
    kind: profile.kind,
    background:
      profile.kind === "humanoid"
        ? humanoidCastingText
        : `${profile.story} ${profile.location}`,
    voiceStyle:
      profile.kind === "humanoid" ? humanoidCastingText : profile.voiceStyle,
    sex: profile.sex,
  });
  if (!profile.voiceArchetype) {
    return voiceProfile;
  }
  return {
    ...voiceProfile,
    deliveryStyle: profile.voiceArchetype,
    voiceParameterId: buildHarthmereAzureVoiceParameterId({
      voiceName: voiceProfile.azureVoiceName,
      gender: voiceProfile.inferredGender,
      actorKind: voiceProfile.actorKind,
      deliveryStyle: profile.voiceArchetype,
      style: voiceProfile.style,
      styleDegree: voiceProfile.styleDegree,
      role: profile.role,
      rate: voiceProfile.rate,
      pitch: voiceProfile.pitch,
      volume: voiceProfile.volume,
      sentenceBreakMs: voiceProfile.sentenceBreakMs,
      actorKey: voiceProfile.actorKey,
    }),
    assignmentRationale:
      `${voiceProfile.assignmentRationale} ` +
      `The authored role uses a ${profile.voiceArchetype} voice archetype.`,
  };
}
