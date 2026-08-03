// NATIVE_QUEST_DIALOGUE_EXPRESSION_PLAN
//
// Page-level acting for the original native onboarding quests stored in the
// May 16, 2026 Bikkie snapshot. Text is copied after the live `{break}` split,
// so every tuple maps exactly one visible TalkDialogModalStep page. Props,
// inscriptions, remote robot transmissions, and robot speakers are omitted.

import type { HarthmereCinematicExpression } from "@/shared/cutscene/cinematic_expressions";

export interface HarthmereNativeQuestDialogueActor {
  key: string;
  displayName: string;
  entityId: number;
}

export type HarthmereNativeQuestDialoguePage = readonly [
  text: string,
  expression: HarthmereCinematicExpression,
];

export interface HarthmereNativeQuestDialogueEvent {
  questId: number;
  questName: string;
  stepId: number;
  actor: HarthmereNativeQuestDialogueActor;
  pages: readonly HarthmereNativeQuestDialoguePage[];
}

const JACKIE = {
  key: "jackie",
  displayName: "Jackie",
  entityId: 8_997_551_883_502_307,
} as const;
const BILLY = {
  key: "billy_rhodes",
  displayName: "Billy Rhodes",
  entityId: 7_520_125_886_856_339,
} as const;
const DOC = {
  key: "doc_topper",
  displayName: "Doc Topper",
  entityId: 5_995_152_131_921_980,
} as const;
const HUCK = {
  key: "huck",
  displayName: "Huck",
  entityId: 3_282_862_615_696_657,
} as const;
const MOE = {
  key: "moe_chi",
  displayName: "Moe Chi",
  entityId: 5_995_152_131_921_995,
} as const;
const KEO = {
  key: "keo",
  displayName: "Keo",
  entityId: 5_917_284_064_004_156,
} as const;
const SOPHIA = {
  key: "sophia",
  displayName: "Sophia",
  entityId: 7_976_997_825_186_729,
} as const;
const BUDD = {
  key: "budd_sower",
  displayName: "Budd Sower",
  entityId: 5_061_424_414_825_022,
} as const;
const ANNE = {
  key: "anne_choveigh",
  displayName: "Anne Choveigh",
  entityId: 742_847_586_011_759,
} as const;
const OL_COOP = {
  key: "ol_coop",
  displayName: "Ol' Coop",
  entityId: 8_997_551_883_502_310,
} as const;
const LAURIEL = {
  key: "lauriel",
  displayName: "Lauriel",
  entityId: 2_774_997_429_348_050,
} as const;
const LAWTO = {
  key: "lawto",
  displayName: "Lawto",
  entityId: 7_383_684_493_514_220,
} as const;
const NICO = {
  key: "nico_ballato",
  displayName: "Nico Ballato",
  entityId: 6_514_731_983_358_245,
} as const;

export const HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS = Object.freeze({
  roadAhead: 6_193_612_340_426_932,
  busted: 7_405_046_529_843_322,
  getTheMuckOut: 817_959_262_145_055,
  muckVsMachine: 5_739_496_793_885_069,
  gimmeShelter: 3_741_112_749_915_015,
  hoedown: 570_573_099_459_937,
  parcelPursuit: 5_543_792_977_197_888,
  fishFood: 6_367_954_120_816_499,
  inStorage: 1_543_579_399_492_851,
  breadySetGrow: 4_022_264_711_963_940,
  batteryNotIncluded: 4_902_242_789_258_042,
});

export const HARTHMERE_NATIVE_QUEST_DIALOGUE_EXPRESSION_EVENTS = [
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.roadAhead,
    questName: "The Road Ahead",
    stepId: 3_960_245_896_803_219,
    actor: JACKIE,
    pages: [
      [
        "The name is **Jackie**. I'm glad we found ya before the Muckers did.",
        "relief",
      ],
      ["Who are the Muckers?", "curiosity"],
      ["That's a question we're still trying to answer...", "thinking"],
      [
        "One day, the news is reporting some plants are mysteriously dying...",
        "sadness",
      ],
      [
        "...the next day we're here, in The Grove, fighting to rebuild the world we lost.",
        "determined",
      ],
      [
        "See all these people around? These are the survivors. This is **The Collective**.",
        "rally",
      ],
      ["Most of them ended up here the same way you did.", "sadness"],
      [
        "I take it you don't remember much before I picked ya up?",
        "uncertainty",
      ],
      ["I'll spare you all the details...", "sighing"],
      ["My main concern right now is making sure you're okay.", "determined"],
      [
        "I'm going to go collect a few important items that will help get you back on your feet.",
        "ready",
      ],
      [
        "In the meantime, head out that front gate and meet with **Billy**, The Collective's head of construction.",
        "beckon",
      ],
      [
        "Billy can get you some new clothes and tell you a little bit more about this new world we're living in.",
        "thumbsUp",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.roadAhead,
    questName: "The Road Ahead",
    stepId: 166_072_605_041_642,
    actor: BILLY,
    pages: [
      ["Well 'ello there! I was expecting Jackie, who are ya?", "surprise"],
      ["Right then! Nice to meet ya {username}!", "gratitude"],
      [
        "I'm **Billy**, Head of Construction and expert gravel-putter-downer for these new roads in and out of The Grove.",
        "rally",
      ],
      [
        "These roads are useful for finding your way around this place and the Muckers tend to stay off 'em.",
        "thinking",
      ],
      [
        "Do you see those **purple blocks** behind me? That's **Muckwad**! Go break a few of 'em and I can show ya how to build!",
        "ready",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.roadAhead,
    questName: "The Road Ahead",
    stepId: 5_727_093_030_853_097,
    actor: BILLY,
    pages: [
      ["Not bad, not bad at all!", "thumbsUp"],
      [
        "Ya see, out here the world is covered in Muck so whatever you break will drop that goopy **Muckwad**.",
        "disgust",
      ],
      [
        "**Muckwad** is just one type of block, but our goal at The Collective is to bring this world back to what it once was.",
        "determined",
      ],
      [
        "No matter the block, you can **place** them to build everything from roads like this to massive structures.",
        "checkingEquipment",
      ],
      ["Now, for getting you some new clothes...", "thinking"],
      [
        "We've got a **Clothing Crate** over on that gravel pile just off the road.",
        "beckon",
      ],
      [
        "We keep our supplies elevated like that in case any mangy Mucker comes by with an appetite.",
        "nervousness",
      ],
      [
        "Place your Muckwad blocks to **build steps up to the Clothing Crate** and get yourself a new outfit.",
        "ready",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.roadAhead,
    questName: "The Road Ahead",
    stepId: 573_329_491_246_142,
    actor: BILLY,
    pages: [
      ["Ayoo! Looking sharp there!", "thumbsUp"],
      ["See how handy these blocks can be?", "checkingEquipment"],
      [
        "Some of 'em are harder than others and some require specialized tools to help you chop, mine, or harvest them.",
        "checkingEquipment",
      ],
      [
        "Axes are great for chopping wood. Hoes for harvesting crops, fishing rods for reeling in a gilly, and picks for...",
        "thinking",
      ],
      ["Wait a minute...", "surprise"],
      ["Where is my **Pick**?", "confusion"],
      ["It must be in my bag over there.", "thinking"],
      [
        "Could you jump over to my Toolbag and grab my **Pick** for me?",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.roadAhead,
    questName: "The Road Ahead",
    stepId: 7_786_117_694_089_673,
    actor: BILLY,
    pages: [["Any luck finding my **Pick**?", "curiosity"]],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.roadAhead,
    questName: "The Road Ahead",
    stepId: 954_400_655_493_357,
    actor: BILLY,
    pages: [
      ["My **Pick**! Thank yas!", "gratitude"],
      ["Hmm, how can I repay you?", "thinking"],
      ["Actually, I know just the thing!", "surprise"],
      [
        "One of our **Robots** recently malfunctioned and we scrapped it for parts.",
        "sadness",
      ],
      [
        "Take this **Robot Shell** back to Jackie. They'll know what to do with it.",
        "checkingEquipment",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.roadAhead,
    questName: "The Road Ahead",
    stepId: 5_095_190_214_192_804,
    actor: BILLY,
    pages: [
      [
        "We're going to miss you out here! You're welcome back any time.",
        "gratitude",
      ],
      ["Before you take off... maybe a **quick photo together**?", "comeHere"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.roadAhead,
    questName: "The Road Ahead",
    stepId: 800_042_715_544_807,
    actor: JACKIE,
    pages: [
      ["A **Robot Shell**?", "surprise"],
      ["Did Billy give this to you?", "curiosity"],
      ["You must have really shown him something out there!", "thumbsUp"],
      [
        "When you get your own **robot** you'll be able to place them out into the world to begin building a home.",
        "thinking",
      ],
      [
        "Your **robot** will protect and clear the area of that infectious Muck!",
        "determined",
      ],
      [
        "There you'll be able to farm, fish, build structures, crafting stations, and games to help bring this world back to what it once was.",
        "rally",
      ],
      [
        "I'm a bit worried it's too early for you to be building your own Robot...",
        "nervousness",
      ],
      ["But then again, the Muck ain't gonna clear itself...", "determined"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 310_783_173_745_175,
    actor: JACKIE,
    pages: [
      [
        "Well you've got the **Shell**, now you just need a **Motor** and a **Power Supply**.",
        "checkingEquipment",
      ],
      [
        "Luckily, **Doc** runs the shipping routes south of here and usually has a **Robot Motor Unit** or two kicking around.",
        "thinking",
      ],
      [
        "Head to Doc's Docks and see if you can get a **Robot Motor Unit** off of them.",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 859_994_236_864_492,
    actor: DOC,
    pages: [
      ["Yo, yo, yo! I love seeing new faces around here!", "beckon"],
      [
        "I'm **Doc**, importer exporter extraordinaire. The Collective's go-to for whatever rare goods you need.",
        "salute",
      ],
      ["A **Robot Motor Unit** is what ya after?", "curiosity"],
      ["I should have one or two laying around here...", "thinking"],
      ["How about this...", "thinking"],
      [
        "If you're willing to help us with some of the build projects around here I'll dig around for that **Robot Motor Unit** for ya.",
        "handshake",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 3_346_948_724_689_018,
    actor: DOC,
    pages: [
      [
        "Great! We're going to need a handful of **Logs** to put this place back together.",
        "determined",
      ],
      [
        "If you haven't noticed, most of the trees you come across have been infested with **Muck** and chopping them down doesn't get you much.",
        "disgust",
      ],
      [
        "Shortly after the muckening one of our scientists crafted the first muck-cleansing **Muck Buster**.",
        "thinking",
      ],
      [
        "There was a big shipment of **Muck Busters** coming in from Stoke when the boat got overran by muckfish and capsized.",
        "sadness",
      ],
      ["Swim out and **search the sunken boat** for some of 'em.", "ready"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 1_250_712_772_360_777,
    actor: DOC,
    pages: [["Find anything in the wreckage?", "curiosity"]],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 275_639_178_491_846,
    actor: DOC,
    pages: [
      ["Yowee! How long has this thing been under water?", "shock"],
      [
        "Well, I hate to break it to you, but I don't think this one is going to work.",
        "sadness",
      ],
      [
        "Hmm... the construction actually looks pretty simple.",
        "checkingEquipment",
      ],
      [
        "Go find **Huck** in the Muck and see if they can create a recipe from this for you...",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 6_436_863_915_440_094,
    actor: HUCK,
    pages: [
      ["Huck is tha name, bustin' muck is my game!", "rally"],
      ["What is this you've got here?", "curiosity"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 4_588_014_125_793_446,
    actor: HUCK,
    pages: [
      ["This thing has seen betta' days!", "disgust"],
      ["Let me take a quick look...", "checkingEquipment"],
      ["Yep this should be pretty simple to build yaself.", "thumbsUp"],
      [
        "Ya might just need a few **Muckwad** and a little elbow grease...",
        "thinking",
      ],
      [
        "Here, take this recipe and craft a few **Muck Busters** then come back to me and I'll show ya how to use 'em.",
        "determined",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 7_852_960_194_875_109,
    actor: HUCK,
    pages: [
      ["Bangin' job!", "victory"],
      [
        "If this is ya first time **busting muck** there's a few things ya should know...",
        "thinking",
      ],
      [
        "Underneath tha purple-y gurple-y gunk out there is tha lush, vibrant world we once lived in.",
        "sadness",
      ],
      [
        "If ya place a **Muck Buster** out there it will temporarily cleanse any organic material of tha muck and bring ta life what was there before.",
        "determined",
      ],
      [
        "The Collective is always workin' on ways that we can clear the muck for good but for now these **Muck Busters** will allow us to gather the resources to begin rebuilding.",
        "rally",
      ],
      ["Speaking of...", "thinking"],
      [
        "Head out and find some purple trees, place a **Muck Buster** next to 'em, and grab a few logs... you'll need 'em to make some proper tools!",
        "ready",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 1_815_083_990_296_399,
    actor: HUCK,
    pages: [
      ["Booyah! Nice work out there bustin' and breakin'!", "victory"],
      [
        "After ya **Muck Bust** those trees, ya can use an **Axe** to chop the logs even faster.",
        "checkingEquipment",
      ],
      [
        "If ya don't already have one, let me suggest **handcrafting a Wooden Axe** and using that on any trees ya'v cleansed of tha mucky infestation!",
        "determined",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 6_548_497_782_720_315,
    actor: DOC,
    pages: [
      ["Were you able to gather any logs to help us rebuild?", "curiosity"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 1_517_393_677_536_172,
    actor: DOC,
    pages: [
      ["Just what we need to fix this place up!", "gratitude"],
      [
        "With so much splintered wood around here I think we better get you set up with a pair of shoes...",
        "thinking",
      ],
      ["Take your pick!", "beckon"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 6_620_853_067_071_453,
    actor: DOC,
    pages: [
      ["Aaaaand before ya go...", "thinking"],
      ["Bingo bango bongo! Lookey what I found!", "victory"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 7_134_920_134_933_805,
    actor: DOC,
    pages: [
      ["It's been great having you out here!", "gratitude"],
      [
        "The Collective is full of people like you willing to roll their sleeves up and help out.",
        "rally",
      ],
      ["Jackie is probably wondering where you're at!", "thinking"],
      [
        "You're welcome back here any time, we've always got a handful of things to do around the docks.",
        "salute",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    stepId: 2_564_822_555_755_950,
    actor: JACKIE,
    pages: [
      ["**Robot Shell**... check!", "checkingEquipment"],
      ["**Robot Motor Unit**... check!", "checkingEquipment"],
      ["That only leaves one more part...", "thinking"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.getTheMuckOut,
    questName: "Get the Muck Out",
    stepId: 7_850_203_803_086_744,
    actor: JACKIE,
    pages: [
      [
        "Well you've got the **Shell** and the **Motor** so you just need the **Power Supply**!",
        "checkingEquipment",
      ],
      [
        "The **Power Supply** will keep your Robot's Muck Busting field active and its satellite functional to send and receive transmissions.",
        "thinking",
      ],
      [
        "I reached out to **Moe** who is the Head of Mucker Research for The Collective to see if they had an extra **Robot Power Supply**.",
        "thinking",
      ],
      ["It sounds like we're in luck!", "relief"],
      ["Head over to Moe and ask about that **Robot Power Supply**.", "beckon"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.getTheMuckOut,
    questName: "Get the Muck Out",
    stepId: 1_488_451_563_795_571,
    actor: MOE,
    pages: [
      ["Greetings, {username}...", "salute"],
      ["...and welcome to the Muck.", "beckon"],
      [
        "You must be the reason Jackie was inquiring about a **Robot Power Supply**...",
        "thinking",
      ],
      ["I'm **Moe**, head of Mucker Research for The Collective.", "salute"],
      [
        "Out here we say, **to defeat the Muck, we must first understand the Muck**.",
        "determined",
      ],
      [
        "You'll observe that all around this outpost there are strange plants, a looming purple fog, and an abundance of **Mossy Mucklings**.",
        "curiosity",
      ],
      ["I've got a project I'll need your help wi...", "thinking"],
      ["...pardon me, but do you not have a **Whacker** yet?", "surprise"],
      [
        "Oh my, any researcher worth their weight in Bling keeps a **Whacker** on them at all times.",
        "checkingEquipment",
      ],
      ["It's a tool required for self-defense!", "guard"],
      [
        "Craft this **Wooden Whacker** and give a few Mossy Mucklings a pop then return to me for your project details.",
        "ready",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.getTheMuckOut,
    questName: "Get the Muck Out",
    stepId: 2_185_129_587_403_168,
    actor: MOE,
    pages: [
      [
        "Those **Mossy Mucklings** are fascinating little creatures.",
        "curiosity",
      ],
      [
        "Well, that's not the last you're going to see of them believe me...",
        "uncertainty",
      ],
      [
        "...and I hate to say it but I've seen some things out in the Muck that I wish I never had.",
        "fear",
      ],
      [
        "Choose one of these necklaces I've crafted out of muck-parts... they seem to carry a mysterious power.",
        "checkingEquipment",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.getTheMuckOut,
    questName: "Get the Muck Out",
    stepId: 2_163_078_453_122_381,
    actor: MOE,
    pages: [
      [
        "One of our researchers in the field reported some peculiar **Mucker Statues** popping up all over in Mosslawn.",
        "thinking",
      ],
      [
        "There's believed to be **inscriptions** attached to the statues that may give us some clues about the significance of them.",
        "curiosity",
      ],
      [
        "Seek out the **inscriptions on the Mucker Statues** and let me know what you find.",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.getTheMuckOut,
    questName: "Get the Muck Out",
    stepId: 1_467_778_625_409_403,
    actor: MOE,
    pages: [
      ["**Mukuluku**...", "thinking"],
      ["**Hama Kukalu**...", "thinking"],
      ["**Mugu Gucku Omu**...", "thinking"],
      ["**Kamakama**!", "surprise"],
      [
        "Interesting... these read like onomatopoeia of the sounds the Muckers make.",
        "curiosity",
      ],
      [
        "I'm going to have to run this by my crew to try and translate these messages.",
        "thinking",
      ],
      [
        "For now, head into our research den and ask Keo for a spare **Robot Power Supply**.",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.getTheMuckOut,
    questName: "Get the Muck Out",
    stepId: 7_339_582_224_957_377,
    actor: KEO,
    pages: [
      ["Scratches head...", "scratchingHead"],
      [
        "Well, the **Robot Power Supplies** were just here... and this hole wasn't here...",
        "confusion",
      ],
      [
        "This isn't the first time one of those muckers burrowed in here and yanked some of our stuff.",
        "frustration",
      ],
      [
        "I have no idea where this leads but my guess is that your **Robot Power Supply** is at the end of it!",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.muckVsMachine,
    questName: "Muck vs. Machine",
    stepId: 7_515_302_201_234_813,
    actor: JACKIE,
    pages: [
      ["**Shell**...", "checkingEquipment"],
      ["...check!", "thumbsUp"],
      ["**Motor**...", "checkingEquipment"],
      ["...check! **Power Supply**...", "checkingEquipment"],
      ["...check!", "thumbsUp"],
      [
        "Take these over to **Sophia**, the Head of Robotics in The Collective. They should be expecting you...",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.muckVsMachine,
    questName: "Muck vs. Machine",
    stepId: 4_851_249_541_237_155,
    actor: SOPHIA,
    pages: [
      ["{username}!", "surprise"],
      ["What have you got for me?", "curiosity"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.muckVsMachine,
    questName: "Muck vs. Machine",
    stepId: 731_822_018_871_376,
    actor: SOPHIA,
    pages: [
      ["I'll need a minute to **assemble your Robot**...", "checkingEquipment"],
      ["**Click! Clank! Pop!**", "checkingEquipment"],
      ["And that should be it!", "victory"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.gimmeShelter,
    questName: "Gimme Shelter",
    stepId: 3_766_609_373_923_510,
    actor: SOPHIA,
    pages: [
      [
        "A Robot's primary function is to clear the Muck from an area of land.",
        "thinking",
      ],
      [
        "When the Muck is cleared, it will reveal the rich vegetation and resources that lie beneath that purpley-goo.",
        "determined",
      ],
      [
        "Those resources will now be yours to gather and the clearing a place for you to build upon.",
        "rally",
      ],
      [
        "You can always pick-up and move your Robot if you want to move to a different area or connect with your **team** to build something much more impressive.",
        "handshake",
      ],
      [
        "For now, **Place your Robot** in an area of Muck and bring us one step closer to winning the fight.",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.hoedown,
    questName: "Hoedown",
    stepId: 150_912_450_227_071,
    actor: BUDD,
    pages: [
      [
        "{username}! We've been waiting for yer arrival! What have ya got for me?",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.hoedown,
    questName: "Hoedown",
    stepId: 1_017_797_666_542_679,
    actor: BUDD,
    pages: [
      [
        "Talk about some big ol' juicy **Raspberries**! I think you've got a knack for this!",
        "thumbsUp",
      ],
      [
        "Thank you for yer farmin' service! A little **Bling** to get you off yer feet...",
        "gratitude",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.hoedown,
    questName: "Hoedown",
    stepId: 2_219_584_484_713_446,
    actor: BUDD,
    pages: [
      [
        "One thing to remember, there are **Seed, Fruit, and Vegetable Buyers** all around the world picking up extra flora for research purposes.",
        "thinking",
      ],
      [
        "Go **sell** a few of your Raspberries to my partner **Petunia** nearby.",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.hoedown,
    questName: "Hoedown",
    stepId: 4_126_318_501_836_925,
    actor: BUDD,
    pages: [
      [
        "There's one more thing I'd like to give ya to make your farm over there a little tidier.",
        "thinking",
      ],
      [
        "I use these **Wood Signs** to help myself remember what the heck I'm plantin' where.",
        "checkingEquipment",
      ],
      ["Take this **Wood Sign** and set it up back at your farm.", "beckon"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.fishFood,
    questName: "Fish Food",
    stepId: 2_602_033_844_849_937,
    actor: ANNE,
    pages: [
      ["{username}!", "beckon"],
      ["You've come to the right pond!", "thumbsUp"],
      [
        "We usually keep this pond stocked with a few common fish but it's gotten a bit out of control.",
        "frustration",
      ],
      [
        "Fish are useful for  everything from food, to research, to dyes, to fertilizers...",
        "thinking",
      ],
      ["...oops! I don't want to get ahead of myself.", "embarrassment"],
      [
        "Here, take this **Training Rod** and reel in a few small swimmers in this here pond and I can show you where to sell 'em.",
        "checkingEquipment",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.fishFood,
    questName: "Fish Food",
    stepId: 3_887_890_612_454_850,
    actor: ANNE,
    pages: [
      ["Nicely done there {username}!", "thumbsUp"],
      ["So you've got some fish, now what!?", "curiosity"],
      [
        "There are **Fish Buyers** all around the world picking up extra fish to sell to tradespeople and researchers.",
        "thinking",
      ],
      [
        "Go **sell** a few of your fish to my partner **Goldie** nearby.",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.fishFood,
    questName: "Fish Food",
    stepId: 7_325_800_266_031_323,
    actor: ANNE,
    pages: [
      ["Alright! You've got some **Bling**?", "curiosity"],
      [
        "**Bling** is useful for buying just about anything from anyone.",
        "thinking",
      ],
      ["It's also what keeps your **Robot** powered!", "determined"],
      [
        "Head back to **{robotName}** and feed that extra **Bling** you just picked up into it's power slot.",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.inStorage,
    questName: "In Storage",
    stepId: 4_581_123_146_328_907,
    actor: OL_COOP,
    pages: [
      ["Well 'ello there {username}! Great to meet you in person.", "beckon"],
      [
        "As you saw in my transmission, some **Cobbled Mucklings** stormed down from Muckerhorn and laid waste to my storage!",
        "frustration",
      ],
      [
        "To make **Wood Chests** we need the teeth from the cobbled capers.",
        "thinking",
      ],
      [
        "Head up Muckerhorn and clobber a few of those Cobbled Mucklings then bring me back some **Mucker Teeth**.",
        "ready",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.inStorage,
    questName: "In Storage",
    stepId: 7_454_661_581_970_631,
    actor: OL_COOP,
    pages: [
      ["Before you head up **Muckerhorn**...", "guard"],
      ["...those Cobbled Muckling can give you a real chomp!", "fear"],
      [
        "If you need to **regain your health** after clobbering one or two of 'em, come stand by this **Campfire** next to me.",
        "comeHere",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.inStorage,
    questName: "In Storage",
    stepId: 3_825_871_797_297_435,
    actor: OL_COOP,
    pages: [["Did you get all 6 of those teeth already?", "curiosity"]],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.inStorage,
    questName: "In Storage",
    stepId: 6_931_636_240_808_545,
    actor: OL_COOP,
    pages: [
      ["Aye! These are perfect!", "thumbsUp"],
      [
        "Here, choose one of these... they should make handling those muckers a bit easier.",
        "checkingEquipment",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.inStorage,
    questName: "In Storage",
    stepId: 3_413_791_225_472_651,
    actor: OL_COOP,
    pages: [
      [
        "At this point, your bags are probably overflowing with building and crafting materials.",
        "checkingEquipment",
      ],
      ["Have a chat with **Lauriel**...", "beckon"],
      [
        "They spend a lot of time mining in the heart of Muckerhorn and can probably share a few ways to **increase your storage**.",
        "thinking",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.inStorage,
    questName: "In Storage",
    stepId: 6_746_268_893_281_322,
    actor: LAURIEL,
    pages: [
      ["Storage!?", "surprise"],
      ["You've come to the right place!", "thumbsUp"],
      [
        "My mining partner Lawto has a brilliant recipe for a **Small Chest** that should save you some space.",
        "thinking",
      ],
      [
        "Unfortunately, that **recipe** is at the end of this mine...",
        "frustration",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.inStorage,
    questName: "In Storage",
    stepId: 5_872_492_697_503_026,
    actor: LAWTO,
    pages: [
      ["Where did you come from!?", "surprise"],
      ["Ah! **Lauriel** sent you? Welcome!", "relief"],
      ["You're looking for a **Small Chest Recipe**?", "curiosity"],
      ["Well, look no further!", "thumbsUp"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.inStorage,
    questName: "In Storage",
    stepId: 3_519_223_211_240_927,
    actor: LAWTO,
    pages: [
      [
        "Craft a few of those **Small Chests** on your land and you should be able to stockpile enough resources to last another **Muckergeddon**!",
        "rally",
      ],
      [
        "And here's a little something extra for whatever Muck-fighting machinery you're after!",
        "gratitude",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.breadySetGrow,
    questName: "Bready, Set, Grow",
    stepId: 8_630_262_678_183_348,
    actor: NICO,
    pages: [["You made it! Did you bring that wheat?", "curiosity"]],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.breadySetGrow,
    questName: "Bready, Set, Grow",
    stepId: 7_565_606_351_308_905,
    actor: NICO,
    pages: [
      ["Perfect-o!", "thumbsUp"],
      [
        "This should be enough to keep us fed for at least a few days.",
        "relief",
      ],
      [
        "Here, take the last few loaves I made and snack on them if you find yourself caught in the muck!",
        "gratitude",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.breadySetGrow,
    questName: "Bready, Set, Grow",
    stepId: 8_448_340_820_387_796,
    actor: NICO,
    pages: [
      ["Is this your first time in **Brickleberry**?", "curiosity"],
      [
        "This is The Collective's hub for all things plants, seeds, and trees.",
        "rally",
      ],
      [
        "Would be very worth your while to introduce yourself to a few of the folks around the farm!",
        "beckon",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.batteryNotIncluded,
    questName: "Battery Not Included",
    stepId: 2_952_095_601_518_764,
    actor: SOPHIA,
    pages: [
      ["You here to refill your Robot Pack?", "curiosity"],
      [
        "I just need an **Empty Robot Power Cell** and **250 Bling**...",
        "checkingEquipment",
      ],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.batteryNotIncluded,
    questName: "Battery Not Included",
    stepId: 6_839_297_116_017_197,
    actor: SOPHIA,
    pages: [
      ["One minute...", "checkingEquipment"],
      ["Here you go!", "thumbsUp"],
    ],
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.batteryNotIncluded,
    questName: "Battery Not Included",
    stepId: 3_291_131_791_049_149,
    actor: SOPHIA,
    pages: [
      [
        "I'd recommend you head back to your **Robot** and equip it with your new Power Cell.",
        "beckon",
      ],
    ],
  },
] as const satisfies readonly HarthmereNativeQuestDialogueEvent[];

export const HARTHMERE_NATIVE_QUEST_DIALOGUE_EXCLUSIONS = Object.freeze([
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.parcelPursuit,
    questName: "Parcel Pursuit",
    reason: "The authored presentation is a remote robot transmission.",
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.roadAhead,
    questName: "The Road Ahead",
    reason: "Clothing Crate and Billy's Toolbag are props, not human actors.",
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.busted,
    questName: "Busted",
    reason: "The Muck Buster Crate is a prop, not a human actor.",
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.getTheMuckOut,
    questName: "Get the Muck Out",
    reason: "Statue inscriptions and Spare Robot Parts are props.",
  },
  {
    questId: HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.muckVsMachine,
    questName: "Muck vs. Machine",
    reason: "The assembled/Mucked Robot has no human expression rig.",
  },
]);
