// Ambient, non-quest conversation for Snapshot Grove residents.
//
// This intentionally lives outside snapshot_grove_content.ts and
// snapshot_complete_port.ts so the established Road Ahead/tutorial dialogue is
// not rewritten by lore-polish passes.

export const SNAPSHOT_GROVE_AMBIENT_DIALOGUE_VERSION =
  "snapshot-grove-ambient-dialogue-v1" as const;

// Tuple order is relationship progression:
// [neutral acquaintance, familiar neighbor, trusted friend].
export const SNAPSHOT_GROVE_AMBIENT_DIALOGUE: Readonly<
  Record<string, readonly [string, string, string]>
> = {
  jackie: [
    "The west road post is leaning again. When a marker shifts here, I check the ground before blaming weather or vandals.",
    "Most arrivals apologize for being lost. I would rather they admit it early than march confidently into a Muck pocket.",
    "If the Grove and Harthmere ever trust the same road signs, I may finally get an evening without counting travelers twice.",
  ],
  billy: [
    "I replaced three parcel markers on Old Grove Road, and the middle one still points somewhere different whenever the air shimmers.",
    "Bridge running sounds grand until you spend a morning pulling a cart wheel from mud with yesterday's lunch as leverage.",
    "Harthmere needs a dependable runner, and I intend to become one as soon as everyone forgets the scenic-detour incident.",
  ],
  ranger_jane: [
    "Mosslawn's birds stop in layers: songbirds first, then crows. When both go quiet, I move the safe-zone stakes inward.",
    "A Mucker leaves obvious damage, but displaced deer and fresh claw marks tell me where the next trouble will begin.",
    "I am mapping a ranger cordon toward Harthmere so one moving Muck edge cannot cut both settlements off at once.",
  ],
  luis: [
    "Genesis Crossroads breaks carts in wonderfully repeatable ways, which is the closest a mechanic gets to good news.",
    "A Grove repair kit must fit Harthmere stonework too; otherwise every border turns one useful tool into two expensive ones.",
    "I can repair almost anything that moves. People remain difficult because they object when I ask where the squeaking started.",
  ],
  taye: [
    "Muck dulls red paint before blue, so I inspect warning signs by color instead of waiting for the letters to vanish.",
    "A good road symbol must make sense to a frightened traveler who cannot read and has no time to ask for translation.",
    "I am comparing Grove marks with Harthmere carvings; the two places disagree on nearly everything except the shape of danger.",
  ],
  alexis: [
    "Lovely Locks sees travelers after the road has argued with every seam, buckle, and hopeful choice they made that morning.",
    "Boots promise distance and gloves promise work. I mend clothing carefully because people notice when those promises fail.",
    "One day this shop will outfit caravans all the way to Harthmere, with dignity that survives both mud and border questions.",
  ],
  sil: [
    "Mosslawn carries a low note after sunset. It is too steady for insects and too deep for any instrument I know.",
    "Road songs keep directions inside the breath; frightened people remember a chorus after they have forgotten a lecture.",
    "Harthmere's old bell stories may explain the tone here, but I will not turn a resemblance into truth without listening longer.",
  ],
  dimmi: [
    "Shutter Cove gives honest fish and dishonest photographs. My latest plate shows a bridge the shoreline refuses to admit exists.",
    "I repair traps and cameras for the same reason: both fail when a small part shifts where the eye does not expect it.",
    "The atlas marks only verified ground in ink; impossible places stay in pencil until a second lens and a second witness agree.",
  ],
  doc: [
    "Muck exposure changes roots, steel, and skin differently, which is why one dramatic cure would be a dangerously convenient lie.",
    "I learned medicine by keeping injured people alive first and discussing credentials after their bleeding had stopped.",
    "Harthmere calls much of this superstition and the Biomes call it contamination; both labels become excuses when observation is harder.",
  ],
  old_coop: [
    "This road has worn four names and six sets of signs. The ditch beside it has remained exactly where careless feet find it.",
    "Map pins are useful until the air shifts or the battery dies; a traveler should also know the bent oak and the dry-stone wall.",
    "I keep old keys because buildings change owners faster than locks change habits, and because throwing away a mystery invites trouble.",
  ],
  buddy: [
    "Greeting routine stable. Warning routine partially stable. Joke routine misplaced, but apparently still activating at unfortunate times.",
    "Genesis Crossroads contains seven repairable faults and one argument between signs. I am not authorized to repair the argument.",
    "I was built to repeat instructions, yet damaged memory has made choosing which instruction matters feel unexpectedly important.",
  ],
  mucked_robot: [
    "SERVICE ROUTE CONTINUES. ROAD COORDINATES DISAGREE. ASSISTANCE MUST BE DELIVERED TO THE LOCATION THAT IS NO LONGER HERE.",
    "WARNING: HELPFUL INSTRUCTION LOOP HAS EXCEEDED SAFE GEOGRAPHY. DO NOT STAND BETWEEN THIS UNIT AND ITS OBSOLETE DESTINATION.",
    "MEMORY REPORT: THE PATH WAS CLEAR. THE PATH IS CLEAR. THE PATH HAS NEVER EXISTED. SERVICE TASK REMAINS ACTIVE.",
  ],
  rosalyn: [
    "I restock the fountain table before dawn because a labeled satchel prevents more panic than a heroic search after dark.",
    "New travelers lose items by confusing what they carry, what they store, and what they merely marked on a map.",
    "Jackie watches the road; I make sure the people she brings back understand enough of the Grove to avoid becoming her next rescue.",
  ],
  guild_clerk_nia: [
    "A guild charter is not friendship written formally; it is a record of permissions for the day friendship becomes complicated.",
    "Harthmere guilds respect witnessed work, while Grove groups favor speed. I am trying to teach each place the other's useful habit.",
    "The quickest way to ruin a shared bank is to call every member trusted before anyone has defined what trust allows.",
  ],
  grove_banker_merl: [
    "A locking ledger should be boring. Excitement around a vault usually means someone skipped a count or misunderstood a promise.",
    "I teach storage before lending because a person who cannot account for three tools should not begin by borrowing a fourth.",
    "Harthmere sent me to keep Grove accounts orderly, though the Grove keeps reminding me that order must still make room for emergencies.",
  ],
  mira_grove_land_steward: [
    "A purchased plot is not permission to block a road, bury a boundary stake, or make drainage everyone else's problem.",
    "The Grove needs homes and workshops, but every foundation must begin with cleared Muck and an honest reading of the ground.",
    "Harthmere masons ask about stone; Grove builders ask about speed. A durable settlement needs both questions answered.",
  ],
  gus_the_baker: [
    "The road deserves bread before sunrise, because emergencies are rude enough without asking people to face them hungry.",
    "I pay gardeners and runners in coin when I can, crusts always, and gossip only after checking whether it will spoil faster than milk.",
    "Harthmere Market may have grander ovens, but the Grove fountain knows exactly how many loaves disappear before the first bell.",
  ],
  fern_the_grower: [
    "These herb beds survive because Gus trades ash, Doc trades advice, and gatherers remember that roots are not an endless resource.",
    "I pay by the basket, but I inspect by the stem; uprooted young growth costs the Grove more than a generous handful earns.",
    "A steady herb route to Harthmere would turn favors into supply, which is healthier for plants and friendships alike.",
  ],
  kit_the_courier: [
    "Every parcel has two weights: what is inside and how urgently the sender insists it must arrive. Only one belongs on my route sheet.",
    "I learned these paths between Lovely Locks and the fountain, where a short delivery can still cross three people's emergencies.",
    "My future courier guild will pay runners reliably and forbid shortcuts whose only recommendation is that no survivor has complained.",
  ],
  mel_the_handyman: [
    "Genesis Crossroads keeps a list of small repairs everyone intends to finish next week; my notebook is where those promises become dates.",
    "A borrowed tool returns clean, sharp, and on time, or the next traveler learns why generosity needs a ledger.",
    "Once Luis and I have enough spare parts, this crossroads may finally gain a repair shop instead of a permanent pile of almost-useful metal.",
  ],
  rin_the_forager: [
    "The Muck edge moves by finger-widths until the morning it moves by yards, so I never teach a harvest line as if it were permanent.",
    "I walked these safe paths barefoot to feel the ground change; newcomers should keep their boots on and follow my stakes instead.",
    "A good foraging route leaves enough behind for regrowth and enough notes behind for the next person to return alive.",
  ],
  carlo_the_cook: [
    "Festival food must survive a crowded fountain, a delayed runner, and at least one customer who forgot they already ate.",
    "I pay extra for a skewer delivered intact because the distance between a hot meal and dropped ingredients is mostly careful hands.",
    "A catering route to Harthmere Market would let both towns share dishes before they attempt to share opinions.",
  ],
};

export function snapshotGroveAmbientLineForNpc(
  npcId: string,
  likeability: number
): string | undefined {
  const lines = SNAPSHOT_GROVE_AMBIENT_DIALOGUE[npcId];
  if (!lines) {
    return undefined;
  }
  // Match the existing Grove likeability thresholds without coupling this
  // data-only module to quest state.
  return lines[likeability >= 2 ? 2 : likeability >= 1 ? 1 : 0];
}
