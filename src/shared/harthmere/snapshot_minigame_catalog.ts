import type { MinigameType } from "@/shared/ecs/gen/types";
import type { BiomesId } from "@/shared/ids";

/**
 * The complete native mini-game catalogue in data-snapshot-2026-05-16.
 *
 * The legacy element ids are deliberately checked in. A large part of the
 * abandoned catalogue still has its original flags, checkpoints, arena
 * markers, and entry posts in ECS, but those entities were iced or omitted
 * from the owning MinigameComponent. Keeping the exact ids lets the runtime
 * reconcile those authored objects without scanning the complete world.
 */
export const SNAPSHOT_MINIGAME_CATALOG_SEED_VERSION =
  "snapshot-minigame-catalog-v2" as const;

export const SNAPSHOT_MINIGAME_GENERATED_ENTITY_ID_BASE =
  8_810_000_000_040_000 as BiomesId;

export const SNAPSHOT_MINIGAME_CATALOG_MARKER_ID =
  8_810_000_000_040_999 as BiomesId;

export interface SnapshotMinigameCatalogEntry {
  readonly id: BiomesId;
  readonly kind: MinigameType;
  readonly label: string | null;
  readonly snapshotReady: boolean;
  readonly legacyElementIds: readonly BiomesId[];
}

export const SNAPSHOT_MINIGAME_CATALOG = [
  {
    id: 173652682449625 as BiomesId,
    kind: "simple_race",
    label: "Moss Cave Run",
    snapshotReady: false,
    legacyElementIds: [5815297567964773] as BiomesId[],
  },
  {
    id: 234293301720977 as BiomesId,
    kind: "simple_race",
    label: "Clodhopper Cabins Race",
    snapshotReady: true,
    legacyElementIds: [
      6407921801699487, 29631211700294, 3241516738924216, 6407921801699484,
      234293301720983, 2868714750031446, 3005845241324935, 6128148035543762,
      3333855863714856, 7148012995914888, 3506819448210272, 5099324801872122,
      2286426985495117, 3032030963280627, 5910393084545872, 5206134983532152,
      7786117694093174, 2269888634786488,
    ] as BiomesId[],
  },
  {
    id: 261857219563338 as BiomesId,
    kind: "deathmatch",
    label: null,
    snapshotReady: false,
    legacyElementIds: [1226594344238789] as BiomesId[],
  },
  {
    id: 318363251151418 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 403811396479583 as BiomesId,
    kind: "simple_race",
    label: "Log Hop",
    snapshotReady: false,
    legacyElementIds: [5403906094084636, 3406211148059910] as BiomesId[],
  },
  {
    id: 981275475393753 as BiomesId,
    kind: "simple_race",
    label: "Slip-n-slide",
    snapshotReady: false,
    legacyElementIds: [
      5264708308953939, 981275475393759, 4885704438546155,
    ] as BiomesId[],
  },
  {
    id: 988166454899902 as BiomesId,
    kind: "simple_race",
    label: "Stairway to Heaven",
    snapshotReady: false,
    legacyElementIds: [2271266830715580] as BiomesId[],
  },
  {
    id: 1069480012514906 as BiomesId,
    kind: "simple_race",
    label: "The Run",
    snapshotReady: false,
    legacyElementIds: [
      2032149843344518, 1796478345745006, 2285737887544731, 1307218803944555,
    ] as BiomesId[],
  },
  {
    id: 1305151510105340 as BiomesId,
    kind: "simple_race",
    label: "Moss Cave Run",
    snapshotReady: false,
    legacyElementIds: [
      2768106449881093, 3211885527231936, 6050969065563535,
    ] as BiomesId[],
  },
  {
    id: 1403003418465606 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [
      3187767099115981, 6047523575833442, 185367347535651, 3965758680372044,
    ] as BiomesId[],
  },
  {
    id: 1483627878170490 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 1989425770679543 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 2149985592142873 as BiomesId,
    kind: "simple_race",
    label: "Moss Cave Run",
    snapshotReady: false,
    legacyElementIds: [
      8154785095303533, 7143189310285502, 3185010707330334,
    ] as BiomesId[],
  },
  {
    id: 2161700257233159 as BiomesId,
    kind: "simple_race",
    label: "Temp",
    snapshotReady: false,
    legacyElementIds: [8697105178964656] as BiomesId[],
  },
  {
    id: 2176860412044223 as BiomesId,
    kind: "deathmatch",
    label: null,
    snapshotReady: false,
    legacyElementIds: [8006629036871212] as BiomesId[],
  },
  {
    id: 2303654434145153 as BiomesId,
    kind: "simple_race",
    label: "Slippery Race",
    snapshotReady: false,
    legacyElementIds: [
      6814489589950454, 2617883097611165, 3550921716762018,
    ] as BiomesId[],
  },
  {
    id: 2343622115024742 as BiomesId,
    kind: "spleef",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 2350513094486494 as BiomesId,
    kind: "spleef",
    label: "Muku Muku Madness",
    snapshotReady: false,
    legacyElementIds: [2670254541522447] as BiomesId[],
  },
  {
    id: 2454566884407284 as BiomesId,
    kind: "simple_race",
    label: "Why u mad?",
    snapshotReady: true,
    legacyElementIds: [
      8459366387567947, 7135609232934834, 5456966635987611, 1988736672775042,
      7286521683127338, 2819788795893820,
    ] as BiomesId[],
  },
  {
    id: 2584117298249026 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 2735029748464075 as BiomesId,
    kind: "deathmatch",
    label: null,
    snapshotReady: false,
    legacyElementIds: [2735029748464078, 413458767730648] as BiomesId[],
  },
  {
    id: 2744677119761589 as BiomesId,
    kind: "simple_race",
    label: "Smell Or Eat",
    snapshotReady: false,
    legacyElementIds: [4134587739337] as BiomesId[],
  },
  {
    id: 2841150832183217 as BiomesId,
    kind: "simple_race",
    label: "Let's a Grove!",
    snapshotReady: true,
    legacyElementIds: [
      1650389581154378, 2794981269788134, 5499001610665357, 7456039777864800,
      6714570387756988, 8932087578618744, 7932206458686910, 5240589880842109,
      8975500749229695, 4638318275865366, 5580315168316781, 5523120038782200,
      8577891234273323, 129550413897978, 6981251292935098, 7950812103233809,
      2610303020207574, 3218776506699613, 7797832359178420, 4134587691097,
      2414599203486997, 8573067548650120, 6144686386251374,
    ] as BiomesId[],
  },
  {
    id: 2921775291888929 as BiomesId,
    kind: "simple_race",
    label: "Ahoy Cargo!",
    snapshotReady: true,
    legacyElementIds: [
      8832857474398572, 465830211643022, 4937386784515106, 6992276860074881,
      4129074893626535, 6744890697390087, 6515421081306891, 8848017629223211,
      8616480719261317, 503041500764297, 7498074752583334,
    ] as BiomesId[],
  },
  {
    id: 3027207277652558 as BiomesId,
    kind: "spleef",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 3316628415059675 as BiomesId,
    kind: "simple_race",
    label: "Into The Well",
    snapshotReady: true,
    legacyElementIds: [
      8199576461811440, 5363938413211374, 3564703675689887, 8366338164791701,
      3316628415059681, 4570097579192100, 2853554595214934, 3316628415059678,
      6988142272396961,
    ] as BiomesId[],
  },
  {
    id: 3469608159111041 as BiomesId,
    kind: "spleef",
    label: null,
    snapshotReady: true,
    legacyElementIds: [2637177840104886] as BiomesId[],
  },
  {
    id: 3493726587228184 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 3576418340817025 as BiomesId,
    kind: "simple_race",
    label: "The 5 Lost Snowmen",
    snapshotReady: true,
    legacyElementIds: [
      3674270249162825, 868263412256731, 8610278837790097, 7029488149198961,
      7045337401952785, 8238855044778506, 4230372291757229, 1638674916113028,
    ] as BiomesId[],
  },
  {
    id: 3689430403947357 as BiomesId,
    kind: "simple_race",
    label: "Washed Away",
    snapshotReady: false,
    legacyElementIds: [6691830155527687, 453426448606886] as BiomesId[],
  },
  {
    id: 3806577054800474 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [4866409696050748] as BiomesId[],
  },
  {
    id: 3920967313869666 as BiomesId,
    kind: "spleef",
    label: "Muku Muku Madness",
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 3992633500273883 as BiomesId,
    kind: "deathmatch",
    label: null,
    snapshotReady: false,
    legacyElementIds: [3087847896916914] as BiomesId[],
  },
  {
    id: 4102889171670264 as BiomesId,
    kind: "simple_race",
    label: "Arbre Acrobatics",
    snapshotReady: true,
    legacyElementIds: [
      1100489420089937, 2061781055034800, 4029155691426982, 4955992429062056,
      4696891601292007, 3309048337650753,
    ] as BiomesId[],
  },
  {
    id: 4184891827266119 as BiomesId,
    kind: "simple_race",
    label: "Grove A-Go-Go",
    snapshotReady: false,
    legacyElementIds: [
      6335566517347305, 7187291578846452, 5631308416333930, 8087253496580170,
      2628908664753600, 1559428652255981,
    ] as BiomesId[],
  },
  {
    id: 4480514846182274 as BiomesId,
    kind: "simple_race",
    label: "Slip-n-slide",
    snapshotReady: false,
    legacyElementIds: [
      6574683504674333, 3537828855784163, 569884001513682,
    ] as BiomesId[],
  },
  {
    id: 4616956239528464 as BiomesId,
    kind: "spleef",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 4749952143194049 as BiomesId,
    kind: "simple_race",
    label: "Frozen Throne",
    snapshotReady: true,
    legacyElementIds: [
      6571238014981440, 785571658705927, 6680804588439294, 6680804588439291,
      1099111224234264, 344548973135559, 5523809136759166, 7012949798484833,
      454804644531850, 3177430629970105, 179165466055296, 8903145464901732,
      3981607933178605, 3787971410286263, 7237595728957942,
    ] as BiomesId[],
  },
  {
    id: 4905688278990118 as BiomesId,
    kind: "spleef",
    label: "Mukumuku Madness 2",
    snapshotReady: true,
    legacyElementIds: [
      6091625844395061, 700812611296297, 305270390178903, 86826341234407,
    ] as BiomesId[],
  },
  {
    id: 5091744724459687 as BiomesId,
    kind: "spleef",
    label: "20x20 Spleef",
    snapshotReady: false,
    legacyElementIds: [
      4588014125789108, 8094144476040014, 7590413877369438, 1277587592258230,
      7309951013267809,
    ] as BiomesId[],
  },
  {
    id: 5198554906118910 as BiomesId,
    kind: "spleef",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 5221984236294250 as BiomesId,
    kind: "simple_race",
    label: "Muckerhorn Mines",
    snapshotReady: true,
    legacyElementIds: [
      2936935446704568, 6050969065568344, 2910060626803350, 5939335198284898,
      8363581773006096, 8054865893109770, 5916594966060667, 5018011244219495,
      8810117242141134, 5439050089346560, 543698279562406, 8441449840926890,
      2015611492639168, 5026280419574096, 8810117242141140, 4510146057872670,
      4094619996315858, 5268842896635630, 8914860129964010, 2050066389949107,
      8941734949865228, 2023880667993769, 5568600503231358, 5439050089346566,
      7068766732102472, 5912460378383677,
    ] as BiomesId[],
  },
  {
    id: 5239900782891003 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [
      3167094160730770, 7657945476096485, 6169493912311100, 4655545724516164,
      3167094160730773, 164694409150440,
    ] as BiomesId[],
  },
  {
    id: 5575491482691643 as BiomesId,
    kind: "simple_race",
    label: "High Low Silo ",
    snapshotReady: true,
    legacyElementIds: [
      8553772806155574, 6395518038665949, 2463525157667142, 3393118287085625,
      5130334209449241, 7398844648329475, 2515896601576783, 1322378958763515,
      4007104557148154, 390718535505289, 3016870808462618, 5518296353157107,
      4279987343841263, 390718535505295, 1788898268339702, 6439620307222210,
      1869522728044376, 3393118287085619, 8756367602351271,
    ] as BiomesId[],
  },
  {
    id: 5578936972423542 as BiomesId,
    kind: "simple_race",
    label: "Sewer Pipe Pursuit",
    snapshotReady: true,
    legacyElementIds: [
      183989151647857, 1848160691714053, 1870211825991753, 1843337006090031,
      5082786451162557, 3893403396026138,
    ] as BiomesId[],
  },
  {
    id: 5604433596429517 as BiomesId,
    kind: "spleef",
    label: "Mukumuku Madness",
    snapshotReady: false,
    legacyElementIds: [
      140575981036063, 3142975732616393, 6145375484196720,
    ] as BiomesId[],
  },
  {
    id: 5646468571182380 as BiomesId,
    kind: "spleef",
    label: "Hello",
    snapshotReady: false,
    legacyElementIds: [5204756787635265] as BiomesId[],
  },
  {
    id: 5763615222001558 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [
      5256439133600466, 3080267819510296, 8766014973581888,
    ] as BiomesId[],
  },
  {
    id: 6104718705368977 as BiomesId,
    kind: "spleef",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 6468562420963861 as BiomesId,
    kind: "simple_race",
    label: "King's Trial Temple",
    snapshotReady: true,
    legacyElementIds: [
      4254490719833356, 8561352883563767, 8191996384402656, 4060854196951844,
      5016633048326544, 7525638670430210, 5112417662848027, 1636607622230433,
      8001805351252203,
    ] as BiomesId[],
  },
  {
    id: 6691830155527336 as BiomesId,
    kind: "spleef",
    label: "Spleef in the Sky (40x40)",
    snapshotReady: true,
    legacyElementIds: [
      970939006200471, 6430662033923841, 5607189988213229, 2604790236632899,
      970939006200468,
    ] as BiomesId[],
  },
  {
    id: 6698032037042827 as BiomesId,
    kind: "deathmatch",
    label: null,
    snapshotReady: false,
    legacyElementIds: [3460649885809552] as BiomesId[],
  },
  {
    id: 6734554228191033 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 6749025285062679 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [
      3746625533482352, 8987215414310531, 6562279741643396, 744225781902022,
      6749025285062682,
    ] as BiomesId[],
  },
  {
    id: 7261714157032227 as BiomesId,
    kind: "deathmatch",
    label: null,
    snapshotReady: false,
    legacyElementIds: [1256914653871570] as BiomesId[],
  },
  {
    id: 7271361528278582 as BiomesId,
    kind: "deathmatch",
    label: null,
    snapshotReady: false,
    legacyElementIds: [1266562025117925] as BiomesId[],
  },
  {
    id: 7282387095418521 as BiomesId,
    kind: "simple_race",
    label: "Don't Fall",
    snapshotReady: true,
    legacyElementIds: [
      4238641467067187, 4030533887315493, 8861799588102624, 3628100686735957,
      4238641467067181, 8861799588102618, 1028134135735163, 2977592225526392,
      1028134135735160, 7282387095418515, 8982391728687052, 8982391728687049,
      4238641467067178, 1028134135735157, 625700935155630, 4030533887315490,
      5859399836522294, 6630500438316287, 4238641467067184, 5979991977106716,
      5979991977106719, 8982391728687046, 3819669915779292, 1277587592257864,
      4030533887315487, 2977592225526386,
    ] as BiomesId[],
  },
  {
    id: 7294790858449656 as BiomesId,
    kind: "simple_race",
    label: "TommyDee's Sappy Adventure",
    snapshotReady: false,
    legacyElementIds: [
      396231319071564, 6401030822232224, 8634397265856531,
    ] as BiomesId[],
  },
  {
    id: 7393331864756900 as BiomesId,
    kind: "spleef",
    label: null,
    snapshotReady: false,
    legacyElementIds: [7850203803085325] as BiomesId[],
  },
  {
    id: 7414693901088426 as BiomesId,
    kind: "simple_race",
    label: "Mucker Den Dash",
    snapshotReady: true,
    legacyElementIds: [
      5652670452662882, 7233461141284318, 6518177473091032, 5443873774968983,
      4674151369067032, 5889720146158795, 4624536316941106, 5605122694380296,
      7786117694092283, 84069949444380, 3663933779941952, 751805859309330,
    ] as BiomesId[],
  },
  {
    id: 7692400373406610 as BiomesId,
    kind: "spleef",
    label: "Mukumuku Battle",
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 7730989858431306 as BiomesId,
    kind: "simple_race",
    label: "The Tour",
    snapshotReady: true,
    legacyElementIds: [
      5071760884072382, 6304557109817301, 5691259937688475, 6824136961237669,
      1423676356895988, 4572853971027235, 2542771421522680, 760075034703207,
      1434701924024746, 4338560669311179, 5984815662771229, 3346259626791213,
      8924507501247682,
    ] as BiomesId[],
  },
  {
    id: 7797832359173914 as BiomesId,
    kind: "spleef",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 7859851174331005 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [
      6214285278812461, 4946345057810367, 4093241800418173,
    ] as BiomesId[],
  },
  {
    id: 7923248185386006 as BiomesId,
    kind: "simple_race",
    label: "Grass Race",
    snapshotReady: false,
    legacyElementIds: [
      2180994999725530, 7866053055850921, 3858259400769392,
    ] as BiomesId[],
  },
  {
    id: 8063135068473629 as BiomesId,
    kind: "simple_race",
    label: "Lillypad Leap",
    snapshotReady: true,
    legacyElementIds: [
      4367502783008931, 4462598299584966, 7369902534589261, 1194895838718448,
      4940832274245469, 8286402803031308, 208107579763857, 8548260022587481,
      3923723705657752, 8713643529673456, 5259884623335293, 1365103031428604,
      1365103031428610, 6212907082924517, 1484316976121368,
    ] as BiomesId[],
  },
  {
    id: 8094144476040011 as BiomesId,
    kind: "spleef",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 8285713705082323 as BiomesId,
    kind: "spleef",
    label: "Ants on a Log",
    snapshotReady: false,
    legacyElementIds: [
      7091506964322608, 2000451337819317, 2509005622113108, 1917759584275176,
    ] as BiomesId[],
  },
  {
    id: 8310521231145145 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 8315344916767823 as BiomesId,
    kind: "spleef",
    label: null,
    snapshotReady: false,
    legacyElementIds: [] as BiomesId[],
  },
  {
    id: 8446962624491587 as BiomesId,
    kind: "deathmatch",
    label: null,
    snapshotReady: false,
    legacyElementIds: [7816438003720417] as BiomesId[],
  },
  {
    id: 8593740487030921 as BiomesId,
    kind: "simple_race",
    label: "Grove A-Go-Go",
    snapshotReady: false,
    legacyElementIds: [
      5303297793939830, 2588940983870264, 406567788264453,
    ] as BiomesId[],
  },
  {
    id: 8705374354319614 as BiomesId,
    kind: "simple_race",
    label: "Watt Dangerous Bouldering!",
    snapshotReady: true,
    legacyElementIds: [
      2688860186074113, 2107950617429619, 1083261971435095, 4763045004127021,
      8356001695598365, 4194539198514646, 1760645252546691, 7765444755707351,
      1122540554368237, 1611800096168181, 7770268441330740, 4701715286915567,
    ] as BiomesId[],
  },
  {
    id: 8895565387466113 as BiomesId,
    kind: "simple_race",
    label: null,
    snapshotReady: false,
    legacyElementIds: [
      2690238381962189, 8320857700337500, 5097946605974032,
    ] as BiomesId[],
  },
] satisfies readonly SnapshotMinigameCatalogEntry[];

export const SNAPSHOT_MINIGAME_QUEST_BINDINGS = [
  { minigameId: 4102889171670264 as BiomesId, label: "Arbre Acrobatics" },
  { minigameId: 4184891827266119 as BiomesId, label: "Grove A-Go-Go" },
  { minigameId: 5221984236294250 as BiomesId, label: "Muckerhorn Mines" },
  { minigameId: 5575491482691643 as BiomesId, label: "High Low Silo" },
  { minigameId: 5578936972423542 as BiomesId, label: "Sewer Pipe Pursuit" },
  { minigameId: 7414693901088426 as BiomesId, label: "Mucker Den Dash" },
  { minigameId: 8063135068473629 as BiomesId, label: "Lillypad Leap" },
] as const;

export function snapshotMinigameGeneratedElementId(
  catalogIndex: number,
  offset: number
): BiomesId {
  return (Number(SNAPSHOT_MINIGAME_GENERATED_ENTITY_ID_BASE) +
    catalogIndex * 10 +
    offset) as BiomesId;
}

export function snapshotMinigameGeneratedElementIds(catalogIndex: number) {
  return [1, 2, 3, 4, 5, 6].map((offset) =>
    snapshotMinigameGeneratedElementId(catalogIndex, offset)
  );
}

export function snapshotMinigameCatalogEntityIds() {
  return [
    ...SNAPSHOT_MINIGAME_CATALOG.map((entry) => entry.id),
    ...SNAPSHOT_MINIGAME_CATALOG.flatMap((entry) => entry.legacyElementIds),
    ...SNAPSHOT_MINIGAME_CATALOG.flatMap((_, index) =>
      snapshotMinigameGeneratedElementIds(index)
    ),
    SNAPSHOT_MINIGAME_CATALOG_MARKER_ID,
  ];
}
