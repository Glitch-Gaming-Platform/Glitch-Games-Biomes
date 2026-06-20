import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES,
} from "@/shared/harthmere/business_customer_simulator";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_content";

// HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED
//
// Standing, in-world CUSTOMER NPCs inside each of the 19 business outposts (the
// owner stands at the counter; these are the patrons). Each is a unique, named
// person with a lore-grounded background, a distinct generated look, and
// dialogue.
//
// LORE ANCHOR — the Biomes Complete Story Treatment (docs/Biomes_Complete_Story_
// Treatment): humanity fled the old cities into private *Biomes* — pocket
// dimensions powered by *Exotic Matter* (negative-mass material that bends
// space). The Bioexodus connected everyone by portals, teleport pads, couriers
// and supply chains, and a worker economy (refineries, biome-maintenance crews,
// designers, farmers, doctors, couriers, hunters, security, sanitation, inns,
// traders, repair, teleport owners, builders, guides, cooks) keeps paradise from
// collapsing. Then the *Muck* appeared — spreading unstable zones birthing
// *Muckers* and *Helixes* — and Biomes began scraping against *time* (tools
// return rusted, ancient soldiers wander courier routes, people suffer "memory
// sickness," Biomes collapse overnight). The game begins in *the Grove*, a
// settlement under pressure. *Harthmere* is the anti-Exotic-Matter kingdom that
// bans Biomes/teleport/robots — the antimatter beneath its land makes war
// inevitable. The player is the exiled scientist who warned that Biomes punch
// holes in reality. These customers are authored against THAT world (Biomes,
// Exotic Matter, the Muck, portals, time-fracture), not a medieval setting.
//
// Mirrors business_owner_npc_seed.ts. Offset band 9701+ (owners 9601-9619;
// muckers 9451-9550; robots 9401+; Grove NPCs 9301+).

export const HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_VERSION =
  "harthmere-business-customer-npc-seed" as const;

export const HARTHMERE_BUSINESS_CUSTOMER_NPC_ID_OFFSET_BASE = 9701;

export interface HarthmereBusinessCustomerNpcSeed {
  customerNpcId: string;
  outpostId: string;
  businessType: string;
  businessName: string;
  displayName: string;
  roleTitle: string;
  faction: string;
  look: string;
  background: string;
  line: string;
  extraLines: string[];
  idOffset: number;
  entityId: BiomesId;
  position: Vec3;
  orientation: Vec2;
  description: string;
}

interface CustomerCopy {
  name: string;
  role: string;
  faction: string;
  look: string;
  background: string;
  line: string;
  extra: string;
}

// Authored customers per outpostId (3 each). Voice: working people of the Grove,
// practical and tired, with the Muck, failing Biomes and fracturing time pressing
// in at the edges.
const HARTHMERE_BUSINESS_CUSTOMER_COPY: Readonly<
  Record<string, readonly CustomerCopy[]>
> = {
  // 1. Exotic Matter refinery
  outpost_refinery_ashline: [
    {
      name: "Cael Ormond",
      role: "Biome owner",
      faction: "Biome owners",
      look: "a soft climate-suit gone shabby at the cuffs, a portable anchor-gauge clipped to the belt",
      background:
        "Cael's pocket-dimension home is starving — its anchor runs on Exotic Matter cells, and the refined fuel keeps getting scarcer and dearer as the Muck spreads.",
      line: "Two stabilized cells for my Biome anchor. My whole home flickers when the charge runs low.",
      extra: "Last week the gravity in my study went sideways for an hour. A home shouldn't do that.",
    },
    {
      name: "Dov Hessel",
      role: "Refinery hand",
      faction: "refinery workers",
      look: "a scorched containment apron, lead-lined gloves, a faint tremor from too many bad batches",
      background:
        "Dov works the cold line and is here off-shift because the last batch came out as hazardous slag instead of clean fuel — and nobody upstairs will say why.",
      line: "Our batch turned to slag again. Yours holding clean? I need to know it's not just us.",
      extra: "Exotic Matter's been unstable all season. The bosses blame the workers. It isn't the workers.",
    },
    {
      name: "Prospector Iva Renn",
      role: "Antimatter scavenger",
      faction: "Muck-edge scavenger",
      look: "field-worn coveralls, a shielded sample case, muck-stains she's stopped trying to scrub",
      background:
        "Iva pulls raw antimatter components from abandoned Biomes at the Muck's edge and sells them to the refinery, one risky haul at a time.",
      line: "Got raw components out of a dead Biome near the Muck. Refinery-grade. What'll you give?",
      extra: "The Muck always pools thickest around the broken homes. Like it's drawn to the holes we left.",
    },
  ],
  // 2. Biome maintenance & repair
  outpost_biome_repair_north: [
    {
      name: "Sera Voll",
      role: "Biome owner",
      faction: "Biome owners",
      look: "a tailored but rumpled house-robe, dark circles, a notebook of timestamped glitches",
      background:
        "Sera's anchor is decaying — her garden Biome leaks winter into the hallway and a tool she dropped last week came back rusted to nothing.",
      line: "My anchor's drifting. Snow in my hall, and a wrench I dropped came back fifty years old. Fix it.",
      extra: "The maintenance guild keeps saying 'anchor decay.' Nobody says why every anchor's decaying at once.",
    },
    {
      name: "Apprentice Rolf Kade",
      role: "Maintenance guild apprentice",
      faction: "Biome Maintenance Guild",
      look: "a guild jumpsuit a size too big, a tool-harness of gauges, an eager nervous energy",
      background:
        "Rolf is learning to chase gravity drift and weather leaks, and is quietly terrified by how many Biomes are failing faster than the guild can patch them.",
      line: "Need calibration rods — the heavy set. I'm on three failing anchors before sundown.",
      extra: "We used to fix one home a week. Now it's three a day. We're losing, and nobody says it.",
    },
    {
      name: "Hadwin Sole",
      role: "Time-leak survivor",
      faction: "the displaced",
      look: "mismatched clothes from two different decades, a thousand-yard stare, hands that won't stay still",
      background:
        "Hadwin walked into his damaged Biome for seven minutes and came out twelve hours later; he's here to have the anchor pulled before it takes more than time from him.",
      line: "Pull the anchor out of my home. I lost twelve hours in there. I won't lose more.",
      extra: "I heard a language inside it. Dead a thousand years. It knew my name. Just... take it out.",
    },
  ],
  // 3. Biome design studio
  outpost_design_glassyard: [
    {
      name: "Patroness Lune Avery",
      role: "Wealthy Biome client",
      faction: "Biome owners",
      look: "iridescent designer silks, a floating display-charm of habitat samples, an impatient elegance",
      background:
        "Lune commissions ever-grander private paradises to outshine her neighbors, and refuses to believe the designer who warned that more anchors mean more cracks.",
      line: "Design me a coast inside a winter inside a garden. Three climates, one home. Spare nothing.",
      extra: "My architect babbled about 'pressure on reality.' I had him replaced. I want beauty, not sermons.",
    },
    {
      name: "Mara Tinsley",
      role: "Biome-collapse survivor",
      faction: "the displaced",
      look: "donated clothes, a single salvaged seedling in a jar, a careful guarded hope",
      background:
        "Mara's family Biome collapsed overnight; she's saving to rebuild something small and safe, and asks for a habitat with the simplest, steadiest anchor that exists.",
      line: "Nothing grand. The simplest habitat you can anchor. Mine fell in overnight. I won't risk grand.",
      extra: "We got out with what we carried. A home shouldn't be able to just... fold up around you.",
    },
    {
      name: "Sketch Nilo",
      role: "Aspiring habitat designer",
      faction: "Grove commoner",
      look: "a charcoal-smeared smock, a slate full of impossible valleys, eyes always somewhere else",
      background:
        "Nilo keeps designing landscapes he's never visited, and has only just realized half the Grove's young designers are drawing the same valley — a side-effect of the dreams the Muck pushes ahead of itself.",
      line: "Can you anchor a place that doesn't exist? I keep drawing this valley. So does everyone lately.",
      extra: "Same valley, same broken tower in it. We've never been there. Why do we all dream the same place?",
    },
  ],
  // 4. Security & defense contractor
  outpost_security_redoubt: [
    {
      name: "Farmholder Bren Oss",
      role: "Rare-foods farmer",
      faction: "Biome owners",
      look: "a weatherproof field-coat, dirt and ozone on his hands, a worried set to his shoulders",
      background:
        "Bren's climate-farm sits near a widening Muck pocket; he hires guns because Muckers have been coming over the fence line and the local robots are running low on Exotic Matter.",
      line: "Four guards for my farm. Muckers are over the fence and the patrol-bot's nearly out of charge.",
      extra: "When the robots run dry, there's nothing between my crop and the Muck but hired steel.",
    },
    {
      name: "Tace Hollin",
      role: "Settlement youth",
      faction: "the displaced",
      look: "lean and wiry, a scavenged stun-baton, boots patched with conveyor belt",
      background:
        "Tace lost a home to a Biome failure and wants contractor work — guarding refineries and farms is the only steady pay left for someone with nothing but nerve.",
      line: "I'll take the routes nobody wants. Muck-edge patrols, night farm watch — name it, I'll guard it.",
      extra: "No home, no Biome, no anchor. Just me. Pay me and I'm the most loyal gun you'll ever hire.",
    },
    {
      name: "Factor Ruel Mast",
      role: "Refinery security buyer",
      faction: "refinery workers",
      look: "a corporate field-jacket, a tablet of contracts, a clipped no-nonsense manner",
      background:
        "Ruel hires defense for an Exotic Matter convoy; with Harthmere's raiders eyeing the fuel and Helixes drawn to the cargo's hum, the route is worth more than the guards.",
      line: "Convoy escort. Exotic Matter cargo. Expect raiders from Harthmere's side and worse from the Muck.",
      extra: "Anti-Biome zealots want the fuel destroyed. The Helixes just want to be near it. Pick your poison.",
    },
  ],
  // 5. Portal transit company
  outpost_portal_eastgate: [
    {
      name: "Courier Jax Tilo",
      role: "Independent courier",
      faction: "courier guild",
      look: "road-dusted transit leathers, a satchel of sealed parcels, restless heels",
      background:
        "Jax pays for a clean jump to beat a rival to the next settlement — and to skip the muck-choked overland roads where couriers keep vanishing.",
      line: "One clean jump east, full charge. The roads aren't safe and the bonus goes to whoever's first.",
      extra: "Three couriers gone on the overland route this month. The portal costs more. It's worth it.",
    },
    {
      name: "Corin Vael",
      role: "District evacuee",
      faction: "the displaced",
      look: "a hood pulled low, a single packed case, a flinch at every portal flare",
      background:
        "Corin's district is destabilizing — weather from a broken neighbor-Biome is bleeding into the streets — and buys a one-way jump anywhere the ground still holds still.",
      line: "One jump out. Anywhere stable. My whole district's raining someone else's weather.",
      extra: "A storm that isn't ours, falling on streets that aren't safe. I'm not waiting to find out why.",
    },
    {
      name: "Operator Wynn Sable",
      role: "Portal owner with link drift",
      faction: "Biome owners",
      look: "a transit-tech's vest, a diagnostic wand, a frown fixed on a readout that won't behave",
      background:
        "Wynn runs a small private portal that's developed link drift — exits are landing minutes and meters off — and wants a stable relay before someone arrives inside a wall.",
      line: "My link's drifting. Exits land short, sometimes late. I need a stable relay before it kills someone.",
      extra: "Yesterday a parcel arrived ten minutes before I sent it. The drift isn't just spatial anymore.",
    },
  ],
  // 6. Biome farming & rare foods
  outpost_rare_foods_southplot: [
    {
      name: "Cook Maven Tay",
      role: "Inn kitchen buyer",
      faction: "settlement worker",
      look: "a flour-dusted apron, a tasting spoon behind the ear, a generous laugh",
      background:
        "Maven buys rare crops grown in impossible climate-farms for the Lanternrest Inn, determined that travelers and Biome-refugees eat one good meal whatever else fails.",
      line: "Your sun-pears and the bittergreen. The inn's full of refugees; they deserve one good plate.",
      extra: "Grown in a farm that's summer year-round. Funny — we can fake a season but can't fix the Muck.",
    },
    {
      name: "Healer Briony Sage",
      role: "Field medic",
      faction: "settlement worker",
      look: "an herb-stained med-coat, a portable analyzer, sharp tired eyes",
      background:
        "Briony needs medicinal plants only the climate-farms can grow, to treat the memory-sickness creeping through the Grove from too much time near broken space.",
      line: "Palethistle and fenroot, all you have. The memory-sickness is spreading faster than the clinic admits.",
      extra: "They forget their own kids' names, then their own. It tracks the Muck. The doctor calls it 'nerves.'",
    },
    {
      name: "Homesick Garr",
      role: "Transplant laborer",
      faction: "the displaced",
      look: "broad salt-cracked hands, a faded badge from a Biome that no longer exists, a faraway slump",
      background:
        "Garr's home-Biome collapsed and took his whole coastal climate with it; he overpays for a southern fruit that tastes like the world he lost.",
      line: "You got moonmelon? Real southern stock? I'll pay anything. Just... one taste of the place I lost.",
      extra: "My whole coast folded into nothing one morning. You can't anchor a memory. I've tried.",
    },
  ],
  // 7. Weapons & tools
  outpost_tools_cinderlane: [
    {
      name: "Guard Roe Hatch",
      role: "Settlement defender",
      faction: "security contractor",
      look: "dented composite armor, a notched photon-blade, a jaw set against fear",
      background:
        "Roe needs his Exotic-Matter blade re-cored before the next patrol; the Muckers hit harder since the Helixes started leading them.",
      line: "Re-core this blade, full charge. The Muck-things don't drop like they used to since the Helixes came.",
      extra: "We lost two on the muck-line last week. Don't repeat that. Just make it cut.",
    },
    {
      name: "Plowman Ude Fent",
      role: "Field laborer",
      faction: "Biome owners",
      look: "stooped, mud to the knees, a snapped harvest tool carried like a wounded thing",
      background:
        "Ude saves for a muck-cutter to clear the corruption eating into his climate-farm one furrow at a time, faster than the maintenance guild can re-anchor the soil.",
      line: "A muck-cutter, the cheapest that still bites. The rot's past my fence and the anchor won't hold it.",
      extra: "Every season the Muck takes another row. Every season the lease costs the same. You do the math.",
    },
    {
      name: "Quiet Sable",
      role: "Anti-Biome runner",
      faction: "Anti-Biome / Harthmere",
      look: "plain non-reflective clothes, a hood, soft boots, a stillness where the light doesn't fall",
      background:
        "Sable runs for Harthmere sympathizers who buy old-fashioned steel and powder — weapons with no Exotic Matter in them — and asks no questions, expecting none in return.",
      line: "Three blades. Cold steel, no cores. Harthmere folk don't touch your Exotic toys. No marks, no ledger.",
      extra: "Your fancy fuel is killing the world. We'll fight it with iron, like people are meant to. Coin's down.",
    },
  ],
  // 8. Magic goods -> Exotic-Matter anomaly wards / charms
  outpost_magic_moonstall: [
    {
      name: "Goodwife Tamsin Lull",
      role: "Worried parent",
      faction: "Grove commoner",
      look: "a careworn wrap, a child's toy clutched for comfort, sleepless shadows",
      background:
        "Tamsin buys an anomaly-ward for her son, who's caught early memory-sickness from a Muck pocket near their home and keeps describing a valley he's never seen.",
      line: "A ward against the memory-sickness. For my boy. He talks of a valley, a broken tower. He's seven.",
      extra: "Every child on our lane describes the same valley now. Tell me that's normal. Please tell me.",
    },
    {
      name: "Scholar Quen Mire",
      role: "Skeptical researcher",
      faction: "Grove commoner",
      look: "field-spectacles, an ink-blotted coat, a meter for testing Exotic-Matter charge",
      background:
        "Quen tests Moonstall's anomaly-wards to debunk them as superstition, and is privately unnerved that the calibrated Exotic-Matter charms genuinely steady a fracturing space.",
      line: "I'll meter your ward before I buy. Most 'charms' are dead crystal and confidence.",
      extra: "Though... the air stops rippling when I carry yours. The readings hold. I dislike not understanding why.",
    },
    {
      name: "Tech Fenn Doral",
      role: "Refinery ward-stocker",
      faction: "refinery workers",
      look: "a charge-tech's vest, ward-stone calluses, a too-serious frown for his age",
      background:
        "Fenn restocks anomaly-wards for the refinery by the dozen; the plant burns through them keeping the unstable Exotic-Matter vats from bending the air around the workers.",
      line: "A dozen wards, the strong charge. The refinery vats eat them faster every week.",
      extra: "Without the wards the air over the vats goes wrong — you see last week through it. Nobody likes that.",
    },
  ],
  // 9. Exploration guide
  outpost_exploration_westtrail: [
    {
      name: "Greenhorn Pip Lark",
      role: "Would-be explorer",
      faction: "Grove commoner",
      look: "shiny new gear, an over-packed pack, the bright fearless eyes of someone who's never met the Muck",
      background:
        "Pip wants a safe route to scavenge a fortune from abandoned Biomes, and hasn't learned that every road out of the Grove now runs past the Muck.",
      line: "The safe route to the dead Biomes! There's salvage out there. I'm going to make my fortune.",
      extra: "Muckers? How bad can they be? ...Oh. That bad. Mark me the long way round, then. Please.",
    },
    {
      name: "Cartographer Nesh Vale",
      role: "Map trader",
      faction: "courier guild",
      look: "rolled charts under each arm, a survey-loupe on a ribbon, ink-cracked fingertips",
      background:
        "Nesh trades route maps and has stopped trusting them — the Muck has crept past where last season's surveys swore it could reach, and some roads now loop in on themselves.",
      line: "I'll trade a fresh chart for your route notes. The old maps lie — the Muck's moved, and so have the roads.",
      extra: "Walked a straight road last week and came back to where I started. Space doesn't sit still out there.",
    },
    {
      name: "Tracker Brael Stoke",
      role: "Muck-edge hunter",
      faction: "Muck-edge scavenger",
      look: "weather-cured gear, a bone-handled blade, a stillness learned from waiting in the reeds",
      background:
        "Brael scouts the Muck edges for the guides, mapping where Muckers and Helixes den so honest crews can route around them.",
      line: "Pay for my edge-survey? I know where the Muck-things den. That's worth coin to anyone heading out.",
      extra: "They're drifting toward the settlements. Slow. Steady. Like something out there is calling them in.",
    },
  ],
  // 10. Custom home / property development (Biome plots)
  outpost_property_keylot: [
    {
      name: "Agent Doll Reese",
      role: "Newlyweds' broker",
      faction: "settlement worker",
      look: "a cheerful broker's vest, a folder of plot-deeds, a betrothal ribbon as a buttonhole",
      background:
        "Doll buys a starter Biome plot for a young couple who want a home of their own before the Muck and the coming war close the maps for good.",
      line: "A small starter plot for a new couple. Dry, sunny, anchor-stable — and well clear of the Muck.",
      extra: "They just want one little world that's theirs. Hard to fault them. Get it anchored before the war.",
    },
    {
      name: "Elder Wat Munn",
      role: "Refugee family elder",
      faction: "the displaced",
      look: "stooped, a shared family coat, a pouch holding three households' pooled savings",
      background:
        "Wat carries the combined coin of three families burned out of failing Biomes, hoping to buy one solid plot of real ground that can't fold up in the night.",
      line: "Three families, one plot. Solid old-fashioned ground — no pocket dimension. We've all lost one of those.",
      extra: "Real soil. Real sky. After three collapses, we're done living inside something that can vanish.",
    },
    {
      name: "Speculator Ovis Grain",
      role: "Land speculator",
      faction: "Biome owners",
      look: "a sleek investor's coat, rings on every finger, a smile that never reaches the deal",
      background:
        "Ovis buys cheap Muck-adjacent plots for a song, betting the refineries will 'cleanse' the corruption someday and the worthless land will boom.",
      line: "The cheap lots. The Muck-edge ones nobody wants. I'll take the lot of them, today, cash.",
      extra: "Everyone fears the Muck, so it's a discount. Someday they clear it, and I own the new frontier. Simple.",
    },
  ],
  // 11. General trader
  outpost_trader_brightcart: [
    {
      name: "Goodwife Pera Stitch",
      role: "Thrifty householder",
      faction: "Grove commoner",
      look: "a much-mended coat, a list checked twice, coin counted twice more",
      background:
        "Pera stretches a shrinking household budget across a market where every shortage — fuel, food, parts — traces back to the Muck and the failing supply lines.",
      line: "Salt, thread, a half-measure of lamp-oil. And don't round up — I'll know if you do.",
      extra: "Prices climb, wages don't. Every shortage starts at the Muck. Funny how it reaches my kitchen.",
    },
    {
      name: "Peddler Lon Carrow",
      role: "Traveling peddler",
      faction: "courier guild",
      look: "a coat of pinned trinkets, a singsong patter, eyes that price you as you pass",
      background:
        "Lon restocks oddments to sell on the road and trades the one thing worth more than goods now — fresh news of which settlements still stand and which roads the Muck has eaten.",
      line: "Restocking the cart — buttons, fuses, ration-tabs. I'll trade you road-news for a discount.",
      extra: "Two settlements gone dark since spring. Not war. Not yet. Just... the Muck, and then quiet.",
    },
    {
      name: "Quartermaster Bel Hask",
      role: "Security supplier",
      faction: "security contractor",
      look: "a contractor's coat, a requisition slate, the harried look of a man short on everything",
      background:
        "Bel bulk-buys rope, cells and rations for the defense yard, supplying a settlement that's quietly arming itself against the Muck on one side and Harthmere on the other.",
      line: "Bulk rope, charge-cells, hard rations. The yard's short on everything except things to guard against.",
      extra: "Muck to the west, anti-Biome raiders to the east. We light the perimeter all night now. So do they.",
    },
  ],
  // 12. Hunter / wild meat (creature parts from dangerous regions)
  outpost_hunter_ridgecooler: [
    {
      name: "Steward Cass Loam",
      role: "Estate provisioner",
      faction: "Biome owners",
      look: "a butcher's apron over fine livery, a tasting blade, a critical eye for marbling",
      background:
        "Cass buys game for a wealthy Biome estate where the owners dine well and toast the Muck as a distant rumor they pay other people to keep distant.",
      line: "Two haunches of ridge-deer. The estate dines tonight whatever's happening past the anchor field.",
      extra: "Inside the Biome it's eternal spring and good wine. Outside, the Muck. They prefer not to look out.",
    },
    {
      name: "Widow Anse Crell",
      role: "Refugee mother",
      faction: "the displaced",
      look: "a thin coat, a basket far too empty, two small hands gripping her skirt",
      background:
        "Anse lost her Biome and her partner to a collapse; she buys whatever scraps she can afford to feed two children through a winter the failing climate-farms can't soften.",
      line: "Whatever's cheap. Bones for broth. Anything. I've two little ones and one collapsed home behind us.",
      extra: "Bless you for the extra. Not many spare a thought for the burned-out. We were Biome folk once too.",
    },
    {
      name: "Hunter Drake Veil",
      role: "Muck-beast hunter",
      faction: "Muck-edge scavenger",
      look: "muck-spattered gear, a heavy harpoon, a fresh scar and a heavier purse",
      background:
        "Drake sells a Muck-twisted beast he downed at the tree-line — the larder buys the meat and the rare Helix-touched parts, and asks the careful questions that mean real fear.",
      line: "Downed a muck-twisted boar at the old wood — Helix-marked. Meat AND parts. Name your best price.",
      extra: "They're changing out there. Bigger. Cleverer. Like the Muck started thinking and they're its hands.",
    },
  ],
  // 13. Medical / doctor (broken-space illness, memory sickness)
  outpost_clinic_greenlamp: [
    {
      name: "Dockhand Mott Rill",
      role: "Injured laborer",
      faction: "courier guild",
      look: "a sweat-soaked transit shirt, an arm cradled wrong, a clenched-teeth grin",
      background:
        "Mott crushed his arm loading an Exotic-Matter convoy and can't miss a shift — the cargo runs are the only work paying enough to outrun a Biome lease.",
      line: "Cargo crate took my arm. Set it fast, doc — I'm on the convoy at dawn or I lose the home I'm renting.",
      extra: "Hauling Exotic Matter all day. Pays well because nobody sane wants near it. My arm agrees.",
    },
    {
      name: "Goodwife Liss Vane",
      role: "Frightened parent",
      faction: "Grove commoner",
      look: "a hastily-thrown coat, a feverish child wrapped close, eyes wide with dread",
      background:
        "Liss brings a child burning with memory-sickness after the family Biome's anchor cracked; the girl dreams aloud of a valley and forgets her mother's face between fevers.",
      line: "She won't wake right. She forgets my face, then talks of a valley she's never seen. What's wrong with her?",
      extra: "Don't tell me it's nerves. Half the lane's children dream the SAME valley. That's not nerves.",
    },
    {
      name: "Veteran Hob Carrick",
      role: "Anomaly-exposed worker",
      faction: "the displaced",
      look: "grey stubble, a salvage-crew jacket, a limp and a flask for it",
      background:
        "Hob worked salvage in broken Biomes too long; the ache is old wounds, but the gaps in his memory are new, and he half-suspects he's left more of himself in those time-leaks than time.",
      line: "The old leg again, doc. And... I keep losing minutes. Patch the leg. The minutes I'll learn to live with.",
      extra: "Worked the dead Biomes ten years. You don't come out the same. Some of me's still in there, I think.",
    },
  ],
  // 14. Teleport owner
  outpost_teleport_returnstone: [
    {
      name: "Factor Ren Dewil",
      role: "Traveling merchant",
      faction: "courier guild",
      look: "a road-worn but costly coat, a strongbox chained to the wrist, a tired briskness",
      background:
        "Ren binds a return-anchor home so the time-fractures buckling the routes can't strand him a week from his family while the Muck closes another road.",
      line: "Bind my return to here. The routes warp without warning now — I won't be stranded a week from home.",
      extra: "Set out two days ago, arrived before I left, by the pad's own clock. The roads don't trust time anymore.",
    },
    {
      name: "Anxious Teo Brack",
      role: "Worried son",
      faction: "Grove commoner",
      look: "a rumpled traveling coat, a crumpled message read a hundred times, white knuckles",
      background:
        "Teo rushes a teleport home to a parent failing from memory-sickness, terrified the Muck-slowed overland roads will cost him the hours he doesn't have.",
      line: "Get me home, fast. My mother's slipping — she's forgetting us. The roads are too slow. Please, the pad.",
      extra: "If the pad drifts even a little... no. Just send me true. I can't afford to land late.",
    },
    {
      name: "Operator Wynn Pell",
      role: "Teleport owner with drift",
      faction: "Biome owners",
      look: "a transit-tech's vest, a calibration wand, a frown fixed on a stubborn readout",
      background:
        "Wynn's private pad has developed drift — riders arrive minutes off and a hand's-width sideways — and wants a clean re-anchor before someone lands inside the wall.",
      line: "My pad's drifting. Riders land late, and off-mark. Re-anchor it before it puts someone in a wall.",
      extra: "A parcel arrived rusted last week. Same parcel I'm about to send. The drift's gone past space now.",
    },
  ],
  // 15. Waste / sanitation / cleanup (Muck contamination, refinery waste)
  outpost_sanitation_clearbarrel: [
    {
      name: "Keeper Mab Crock",
      role: "Alehouse owner",
      faction: "settlement worker",
      look: "a spill-stained apron, ruddy cheeks, a ring of keys and a permanent half-scowl",
      background:
        "Mab hires cleanup before the safety-warden shuts her down — a Muck seep has gotten into her cellar and the air down there shows you yesterday if you stand too long.",
      line: "Muck's seeped into my cellar. Clear it before the warden does and fines me blind. And it's... wrong down there.",
      extra: "Stood in it too long and saw the room as it was a year back. I poured myself a drink and left.",
    },
    {
      name: "Elder Greb Sump",
      role: "Outer-ward speaker",
      faction: "the displaced",
      look: "stooped, muck-caked boots, a petition signed in a hundred shaky marks",
      background:
        "Greb begs cleanup for the refugee ward built on cheap land where a Muck pocket and a leaking refinery drain now run together through the gutters.",
      line: "The ward's drowning in Muck and refinery runoff together. We've signed, we've begged. Will you come?",
      extra: "The Biome estates smell clean air they paid for. We smell the runoff they paid to send our way.",
    },
    {
      name: "Inspector Wick Talley",
      role: "Refinery safety inspector",
      faction: "refinery workers",
      look: "a hazard-orange vest, a sample kit, the patience of a man near his last nerve",
      background:
        "Wick flags a hazardous Exotic-Matter waste pond the refinery 'forgot' to declare — it's drawing Helixes, and the cleanup can't wait for the paperwork.",
      line: "Hazardous waste pond behind the refinery, undeclared. It's pulling Helixes in. Get a crew on it now.",
      extra: "Don't ask what we scooped out of the last one. I'm still not sleeping. Just clear it, today.",
    },
  ],
  // 16. Repair / maintenance person
  outpost_repair_hingehall: [
    {
      name: "Goodwife Nel Boon",
      role: "Householder",
      faction: "Grove commoner",
      look: "a practical coat, a snapped cabinet-hinge held out like evidence, a no-nonsense set to her mouth",
      background:
        "Nel keeps an old-fashioned house running on thrift while the Biome-folk pay for miracles; she brings the small daily breakages a settlement still needs fixed by hand.",
      line: "Cabinet hinge, snapped clean. Fix it cheap. A house runs on the small things still working.",
      extra: "Doors gone crooked all over the lane this month. The anchor-folk say the ground's 'settling.' Settling into what?",
    },
    {
      name: "Apprentice Cob Fenny",
      role: "Refinery rig apprentice",
      faction: "refinery workers",
      look: "burn-spotted sleeves, a busted coolant-rig over one shoulder, an eager-to-please slouch",
      background:
        "Cob lugs a failed coolant rig from the refinery, hoping to fix it before his foreman docks his pay — coolant failures near Exotic Matter are how the bad batches start.",
      line: "Refinery coolant-rig's seized. Mend it before the foreman's back? A warm vat is how the bad batches happen.",
      extra: "I'll owe you. I'm always owing somebody. The whole Grove runs on what it owes the refinery.",
    },
    {
      name: "Host Imel Cray",
      role: "Inn handyman",
      faction: "settlement worker",
      look: "a tool-belt over inn livery, a jammed door-servo in one hand, the patience of the perpetually on-call",
      background:
        "Imel fixes the Lanternrest Inn's failing fixtures, which have been jamming and groaning since the ground started rolling from a Muck-driven anchor failure nearby.",
      line: "The inn's front door-servo keeps jamming. Started when the ground began to shake. Travelers say it's haunted.",
      extra: "Whole inn creaks now, settling crooked. Or being unsettled. The maintenance guild won't say which.",
    },
  ],
  // 17. Food service / restaurant
  outpost_restaurant_redpot: [
    {
      name: "Wanderer Ade Plum",
      role: "Road-worn traveler",
      faction: "the displaced",
      look: "muck-rimmed boots, a half-empty pack, the bottomless hunger of the long-walked",
      background:
        "Ade walked in starving off the muck-road with one collapsed Biome behind and no anchor ahead, with just enough coin for one hot bowl and a hundred rumors to trade.",
      line: "Whatever's in the pot, biggest bowl my coin buys. I've walked since my home folded into nothing.",
      extra: "Road-folk say the Grove's the last settlement still cooking hot meals. I had to come see. It's true.",
    },
    {
      name: "Convoy Crew Three",
      role: "Cargo haulers",
      faction: "courier guild",
      look: "three matching transit vests, scarred knuckles, a shared rough laughter",
      background:
        "A trio off an Exotic-Matter convoy spends thin wages on a hot meal between runs — the one warm hour in a long day of hauling fuel nobody else will touch.",
      line: "Three bowls, three ales, don't water the ale. We hauled live Exotic Matter all day — we've earned it.",
      extra: "Work's steady at least. The fuel always needs moving. Best not to think too hard about where, or why.",
    },
    {
      name: "Widower Sael Munn",
      role: "Lonely regular",
      faction: "Grove commoner",
      look: "a neat but threadbare coat, a fixed corner seat, a slow careful way with a spoon",
      background:
        "Sael eats here nightly since memory-sickness took his wife's mind and then her; he comes for the noise of living people, because the quiet at home has started showing him things.",
      line: "The usual corner, the usual stew. The company's the real meal — the house has gotten too quiet to bear.",
      extra: "When it's quiet, the rooms show me her, younger, before she forgot me. The Muck does that. I'd rather the noise.",
    },
  ],
  // 18. Courier
  outpost_courier_stampspur: [
    {
      name: "Smitten Bly Tarn",
      role: "Lovestruck youth",
      faction: "Grove commoner",
      look: "a hopeful flush, a sealed and re-sealed letter, ink on the fingers from too many drafts",
      background:
        "Bly sends a letter to a sweetheart whose family fled to a stabler settlement when the Muck neared, counting coin against the days a reply might take to cross the failing roads.",
      line: "One letter, handle it gentle — took me all week to find the words. Fastest route you've got, please.",
      extra: "Her folk left when the Muck got close. Said the Grove's no place for the young now. Maybe they're right.",
    },
    {
      name: "Clerk Ott Reedle",
      role: "Refinery clerk",
      faction: "refinery workers",
      look: "an ink-cuffed clerk's coat, a strapped bundle of sealed records, a habit of glancing back",
      background:
        "Ott ships the refinery's records out of the Grove ahead of an inquiry into the hazardous batches — on orders he was told never to write down, never to read.",
      line: "These records, out of the Grove, tonight. No copy. No log of the sending. Refinery business, that's all.",
      extra: "I haven't read them. I won't. Whatever the bad batches really are, it's above my pay to know.",
    },
    {
      name: "Debtor Hul Crannock",
      role: "Struggling tenant",
      faction: "the displaced",
      look: "a frayed collar, a pouch pressed flat, a swallow before every word",
      background:
        "Hul posts coin he can't spare to a Biome-lease holder he can't escape — fall behind on the anchor payments and they cut your home's power, and a powered-down Biome doesn't just go dark.",
      line: "Send this pouch to the lease-holder. All of it. Yes — all of it. Miss a payment and they cut my anchor.",
      extra: "A Biome with no power doesn't just go dark — it starts to fold. I've seen it. I send the coin. Always.",
    },
  ],
  // 19. Hospitality / inn / shelter (displaced families after Biome collapse)
  outpost_hospitality_lanternrest: [
    {
      name: "Mother Esa Pol",
      role: "Refugee-family matriarch",
      faction: "the displaced",
      look: "travel-grey clothes, a smoothed-worn anchor-token from a lost home, a deep weary calm",
      background:
        "Esa shelters her family at the inn after their Biome collapsed overnight; she studies the other guests' faces for the memory-sickness she's learned to spot a town too late.",
      line: "Two rooms and a quiet corner. Our home folded in the night — we got out with the clothes and each other.",
      extra: "I've seen this dreaming look in two settlements now. Both lost their Biomes after. I pray the Grove's the last.",
    },
    {
      name: "Bard Cinta Vey",
      role: "Traveling musician",
      faction: "courier guild",
      look: "a patched motley coat, a battered string-instrument, a quick working smile",
      background:
        "Cinta sings for her supper and finds the Grove a goldmine of grim songs — though she's careful never to sing the one about the scientist who warned the world and was laughed out of it.",
      line: "A room and a corner to play, and I'll fill your common-room. Folk pay well to forget the week they're having.",
      extra: "Won't sing the Exile's song, though — the scientist who warned us. Room goes silent. Bad for tips. Worse for sleep.",
    },
    {
      name: "Quiet Mr. Vahn",
      role: "Man lying low",
      faction: "Anti-Biome / Harthmere",
      look: "unremarkable clothes chosen to be forgotten, a single case, a seat with his back to the wall",
      background:
        "A guest who signs a false name and pays in advance — a Harthmere agent watching the Grove's refineries and portals, gathering what the anti-Exotic-Matter kingdom will need when the war for the antimatter finally comes.",
      line: "A room. Paid up front. Back stairs, road side, if you have it. I keep to myself and notice little.",
      extra: "You've a lot of Exotic Matter moving through this Grove, host. Someone ought to be watching where it goes.",
    },
  ],
};

function entityIdFromOffset(idOffset: number): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + idOffset) as BiomesId;
}

// Spread customers inside the building footprint, inset from the walls and away
// from the owner at the center, on a deterministic ring.
function customerPositionForSite(
  site: {
    groundY: number;
    footprint: { xMin: number; xMax: number; zMin: number; zMax: number };
  },
  index: number,
  count: number
): Vec3 {
  const cx = (site.footprint.xMin + site.footprint.xMax) / 2;
  const cz = (site.footprint.zMin + site.footprint.zMax) / 2;
  const halfW = Math.max(1, (site.footprint.xMax - site.footprint.xMin) / 2 - 2);
  const halfD = Math.max(1, (site.footprint.zMax - site.footprint.zMin) / 2 - 2);
  const angle = (index / Math.max(1, count)) * Math.PI * 2 + Math.PI / 5;
  return [
    Number((cx + Math.cos(angle) * halfW * 0.7).toFixed(3)),
    site.groundY,
    Number((cz + Math.sin(angle) * halfD * 0.7).toFixed(3)),
  ];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export const HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS: readonly HarthmereBusinessCustomerNpcSeed[] =
  (() => {
    const seeds: HarthmereBusinessCustomerNpcSeed[] = [];
    let offset = HARTHMERE_BUSINESS_CUSTOMER_NPC_ID_OFFSET_BASE;
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const site = HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES.find(
        (candidate) => candidate.outpostId === outpost.outpostId
      );
      const copies = HARTHMERE_BUSINESS_CUSTOMER_COPY[outpost.outpostId];
      if (!site || !copies) {
        continue;
      }
      copies.forEach((copy, index) => {
        const idOffset = offset++;
        seeds.push({
          customerNpcId: `customer_${outpost.outpostId}_${slugify(copy.name)}`,
          outpostId: outpost.outpostId,
          businessType: outpost.businessType,
          businessName: outpost.displayName,
          displayName: copy.name,
          roleTitle: copy.role,
          faction: copy.faction,
          look: copy.look,
          background: copy.background,
          line: copy.line,
          extraLines: [copy.extra],
          idOffset,
          entityId: entityIdFromOffset(idOffset),
          position: customerPositionForSite(site, index, copies.length),
          orientation: [0, Number(outpost.position.rot) || 0] as Vec2,
          description: `${copy.name}, ${copy.role} (${copy.faction}). ${copy.look}. ${copy.background}`,
        });
      });
    }
    return seeds;
  })();

export function harthmereBusinessCustomerNpcSeedIds(): BiomesId[] {
  return HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.map((seed) => seed.entityId);
}

const HARTHMERE_BUSINESS_CUSTOMER_ENTITY_ID_SET = new Set<number>(
  HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.map((seed) => Number(seed.entityId))
);

// Customers, like owners, stand on a building FLOOR under a roof — terrain
// grounding must NOT require open sky for them (that would push them onto the
// roof). See harthmere_entity_grounding_manifest.
export function isHarthmereBusinessCustomerNpcEntityId(
  id: BiomesId | number | undefined
): boolean {
  return (
    id !== undefined &&
    HARTHMERE_BUSINESS_CUSTOMER_ENTITY_ID_SET.has(Number(id))
  );
}

export function validateHarthmereBusinessCustomerNpcSeeds(): string[] {
  const errors: string[] = [];
  const ids = new Set<BiomesId>();
  const offsets = new Set<number>();
  const customerIds = new Set<string>();
  const perOutpost = new Map<string, number>();
  for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
    if (ids.has(seed.entityId)) {
      errors.push(`${seed.customerNpcId}:duplicate_entity_id`);
    }
    ids.add(seed.entityId);
    if (offsets.has(seed.idOffset)) {
      errors.push(`${seed.customerNpcId}:duplicate_id_offset`);
    }
    offsets.add(seed.idOffset);
    if (customerIds.has(seed.customerNpcId)) {
      errors.push(`${seed.customerNpcId}:duplicate_customer_id`);
    }
    customerIds.add(seed.customerNpcId);
    if (!seed.displayName.trim() || !seed.line.trim() || !seed.background.trim()) {
      errors.push(`${seed.customerNpcId}:missing_copy`);
    }
    if (!seed.position.every((value) => Number.isFinite(value))) {
      errors.push(`${seed.customerNpcId}:invalid_position`);
    }
    if (seed.idOffset < HARTHMERE_BUSINESS_CUSTOMER_NPC_ID_OFFSET_BASE) {
      errors.push(`${seed.customerNpcId}:offset_below_band`);
    }
    perOutpost.set(seed.outpostId, (perOutpost.get(seed.outpostId) ?? 0) + 1);
  }
  for (const [outpostId, count] of perOutpost) {
    if (count < 2 || count > 5) {
      errors.push(`${outpostId}:customer_count_out_of_range_${count}`);
    }
  }
  return errors;
}
