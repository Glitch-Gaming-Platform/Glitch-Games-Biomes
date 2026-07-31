# Biomes — Chapter 1: "Identity"
## Writer's Journal

**Status:** Draft 1 — narrative bible, not yet implemented
**Canon parents:** `docs/Biomes_Complete_Story_Treatment.docx`, `docs/harthmere/bibles/*`, `docs/harthmere/snapshot_grove_live_npc_bible.md`
**Chapter scope:** Begins the moment the player finishes **Muck vs. Machine** and ends with the Grove's first political fracture.
**Detail level:** Story-first with implementation hooks (quest IDs, flags, item IDs, world anchors) inline in fenced blocks.

---

## 0. How To Read This Document

This is a **writer's journal**, not a design spec. It is written so that a narrative designer, a quest scripter, and a level designer can all pull what they need out of the same file.

Three kinds of content are marked:

- Plain prose — the story as the player experiences it.
- `> WRITER'S TRUTH:` blockquotes — what is **actually** happening, which the player does not know yet.
- Fenced `hooks` blocks — implementation-facing IDs, flags, anchors, and triggers.

**Spoiler discipline:** anything in a `WRITER'S TRUTH` block must never appear in NPC dialogue, journal text, item descriptions, achievement names, voice lines, or file names shipped to the client before its reveal act. This has bitten us before — quest IDs leak in the network tab.

```hooks
NAMING RULE: do not ship any client-visible string containing
"stillwater", "riverbed", "seven", "anchor_zero", or "ardan_betrayal"
before Act 6. Use opaque codes in Acts 1-5:
  ch1_compound_a   (Stillwater)
  ch1_compound_b   (Riverbed)
  ch1_designation   (Seven)
  ch1_site_prime    (Anchor Zero)
```

---

## 1. Where Chapter 1 Sits

The complete Biomes story is the collapse of the timeline and the war over Harthmere's antimatter. That story is **enormous**, and it cannot start there — the player has no reason to care about a planetary energy dispute in their first three hours.

So Chapter 1 is deliberately small and personal. It asks one question:

> **Who were you, and were the people who told you the answer lying?**

Everything the player learns about Exotic Matter, the Collective, Harthmere, the Muck, and the fracture of time in Chapter 1 is learned **as a side effect of trying to remember their own name.** The politics ride in on the back of the personal mystery.

### Chapter 1's job in the larger arc

| Job | How Chapter 1 does it |
| --- | --- |
| Teach the game | Amnesia makes total tutorialization diegetic — nobody has to pretend the player is a newborn adult |
| Introduce the Grove cast | Act 2 is structurally a "meet everybody" act, but framed as memory-building |
| Establish the Muck as symptom, not pollution | The player is the only person who reads it correctly, and can't say why |
| Introduce Harthmere without going there | Halden Rook comes to the Grove; the bridge is visible but not crossable |
| Prove Biome tech is unstable | Fracture Gates open in the Grove. Twice. The player walks into both |
| Cost the player something real | Chapter 1 ends in a **loss**, not a victory |
| Set up Chapter 2 | The player's own research is now in enemy hands, and they gave it away themselves |

### The tone contract

The Grove is **warm**. That is a weapon. Chapter 1 works only if the player likes the Grove, likes Jackie, likes the little economy of couriers and bakers and repair carts — because the chapter's climax is the player betraying that warmth while believing they are protecting it.

Do not write the Grove as sinister. Write it as a place worth losing.

---

## 2. The Ground Truth (Writer's Eyes Only)

> **WRITER'S TRUTH — the whole chapter in one page.**
>
> The player is **Seven**: the seventh signatory of the Anchor Charter and the lead researcher on Anchor Integrity for the Collective. They did not merely study Biomes. They **built the stabilization model every Biome on Earth runs on.**
>
> Eleven years ago the player's own model started returning results it should not have. Anchors were not just bending space; every anchor was placing a standing load on the local timeline, and the loads were **cumulative and non-local**. One Biome was nothing. Ten thousand was a rounding error. Four hundred million was a structural failure of the present tense.
>
> The player's recommendation was not "regulate." It was **stop. Now. Everything. Until the science catches up.** That recommendation, if published, ends the Collective, ends the Exotic Matter economy, strands hundreds of millions of people in pocket dimensions that would need to be evacuated on foot, and costs a number with too many zeros to say out loud.
>
> The Collective faced a problem with no clean answer:
> - Kill Seven → lose the only mind that could stabilize the system, and create a martyr.
> - Imprison Seven → someone eventually comes looking, and the search itself becomes the story.
> - Let Seven publish → the world ends economically, and possibly literally, in a disorderly way.
>
> **Dr. Lucien "Lou" Ardan** solved it. Not with violence — with medicine. A reversible anterograde/retrograde sequestrant (`ch1_compound_a`, "Stillwater") that makes memory *inaccessible* rather than destroyed. Seven would be committed to a Collective care facility as a patient with a genuine-looking degenerative memory disorder, treated compassionately, documented honestly, and **retrievable** — because Lou always intended to bring Seven back once the political weather changed. In Lou's own mind he is not a villain. He is the man who found the option where nobody died.
>
> **Jackie Halloway** is a Take Terra operative who had spent two years embedded as a Collective Biome-maintenance tech. She learned about the Stillwater order eight hours too late. She got to the facility after the first dose, not before. She could not undo it — so she took Seven out of the building and into the Grove, and she has spent every day since quietly administering `ch1_compound_b` ("Riverbed"), the reversal agent, in half-doses, in tea, in stew, in the medicine she pretends is for something else.
>
> **This is the engine of the chapter.** The person poisoning the player's drink is the person curing them. The person who speaks about the player with warmth and grief and calls them by their true name is the person who erased them.
>
> Memory reconstruction is unreliable *by design and in fact.* The fragments the player recovers are real inputs run through a damaged reconstructor. Lou is present in the true memory of the night — he is the man who carried the player out. He carried them out **after** administering the dose. The reconstruction keeps the rescue and loses the syringe.
>
> By Act 5 the player has recovered enough to go get **Dr. Nadia Sorrel** — their research partner, lost in a test-gate eleven years ago, for whom only four months have passed — and Sorrel is carrying the **unredacted original field ledger**: the raw data, the model, the signatures, and the names of everyone who buried it.
>
> In Act 6 the player, still believing Jackie is drugging them and Lou saved them, **hands Lou the ledger and Sorrel's location.** The consolidation happens roughly ninety seconds too late.
>
> Chapter 1 ends with the player having personally handed the Collective the ability to bury the largest misuse of power in human history — and having to look at Jackie afterward.

---

## 3. The Cast

### 3.1 Returning cast (already in the world)

These already exist as ECS NPCs, labels, or bible entries. Chapter 1 gives them a role rather than inventing new bodies.

| Character | Existing anchor | Chapter 1 role |
| --- | --- | --- |
| **Jackie** | `496, 71, -126` | Deuteragonist. Caretaker, liar-by-omission, TT cell lead. The chapter is really about her. |
| **Billy** | `500, 71, -140` | Comic relief and emotional baseline. Uncomplicated affection. The player's proof the Grove is worth something. |
| **Doc** | Grove field table | Honest, limited, out of his depth. Delivers the *technically correct, catastrophically misleading* lab result in Act 4. |
| **Ranger Jane** | `450, 71, -260` | Reads the land. First to say out loud that the Muck is behaving like a *response*, not a spill. |
| **Luis** | Repair cart | Repairs Auggie with the player in Act 1. Later refuses to repair a Collective drone — small, good spine moment. |
| **Taye** | `491, 71, -124` | Sign painter. Runs the "what do we call you?" naming scene. Quietly the chapter's thesis: names are given, not found. |
| **Dimmi** | `560, 71, -182` | Shutter Cove. Collects reflections and anomalies. Gates the first optional Fracture Gate sighting. |
| **Sil** | `462, 71, -252` | Mosslawn. Song stones. Provides the *sound* trigger class for memory. |
| **Kit the Courier** | `504, 71, -118` | Carries the letter that starts Act 5. Nearly dies for it. |
| **Rin the Forager / Fern the Grower / Gus the Baker / Carlo the Cook** | Grove economy | Provisioning chain for both dungeons. Their jobs become load-bearing, which is the point of the whole economy design. |
| **Doctor Hana Greenlamp** | `656, 65, -182` | Greenlamp Walk-In Clinic. Hosts Dr. Lou as a "visiting specialist." Reluctant, then complicit, then horrified. |
| **Mucked Robot** | Muck vs. Machine | **Is AUGUR-9 / "Auggie."** See below. This is the single most important retcon in the chapter. |
| **Ranger/road cast** (Allix, Helsa, Drona, Coretta, Patsy, Gizela, Grover, Alva, Davi, Runna, Richard, Emily) | snapshot Grove bible | Ambient witnesses. Each holds exactly one true detail about the night the player arrived. Collecting all twelve is the chapter's optional completionist thread (see §11.4). |

### 3.2 New cast

#### **Dr. Lucien "Lou" Ardan** — Curator of Care, Collective Medical Directorate
**Age:** late 60s. **Voice:** unhurried, precise, warm without being soft. Uses the player's first name constantly. Never raises his voice, not once, in the entire chapter.

Lou is the chapter's antagonist and must never once *feel* like one before Act 6. Write him as the best doctor the player has ever met. He listens. He remembers what you said last time. He is unimpressed by the Collective's politics and says so. He is openly critical of Arbiter Vane in front of the player, which is the cheapest and most effective trust-purchase in the book, and it costs him nothing because it is true — he does dislike her.

His self-justification, stated plainly in Act 6 and never retracted:

> "I was given a choice between your mind and four hundred million homes. I chose a third thing. You are alive, you are unhurt, you are standing in front of me, and every one of those homes still has power. I would like someone, once, to tell me what the better answer was."

**Do not let anyone answer him well.** The player's answer is worse than his. That's the chapter.

> **WRITER'S TRUTH:** Lou administered the dose personally. He also genuinely carried the player out of the collapsing east wing afterward, which is why the rescue memory is real. He has been looking for the player for eleven years, not to silence them — to *use* them, kindly, when the time was right. He believes he is holding the player in trust.

```hooks
npc_id: npc_lou_ardan
faction: collective_medical
first_placement: Greenlamp Walk-In Clinic annex, near [656, 65, -182]
disposition_track: ch1_lou_trust (0..100, starts 40, peaks ~85 end of Act 4)
voice_note: never uses combat barks; never present in any encounter
```

#### **Jackie Halloway** — Grove road-keeper (cover), Take Terra cell lead (actual)
**Age:** late 30s. **Voice:** blunt, funny, allergic to reassurance. Deflects every direct question about herself with a task.

Jackie's writing problem is that she must be **suspicious without being written as suspicious.** Her evasions must all have innocent readings on first pass and guilty readings on replay. Rules:

1. She never lies outright. She changes subject, answers a different question, or says "not today."
2. She is physically competent in ways a road-keeper shouldn't be — but always in ways that read as "capable frontier woman" the first time.
3. She refuses to use the player's old designation even after she knows the player has heard it. Reads as coldness in Act 3. Reads as respect in Act 6.
4. She is the only person who ever asks the player what they *want*, rather than what they *remember*.

Her Act 6 line, and the emotional target of the whole chapter:

> "I could have told you on day one. You'd have believed me for about a week, and then the Stillwater would have made me a liar in your own head, and you'd have walked to him on your own anyway — except angrier, and alone. So I fed you the cure and I let you hate me on your own schedule. That was the plan. That was the whole plan. It wasn't a good one."

```hooks
npc_id: npc_jackie   # existing
disposition_track: ch1_jackie_trust (0..100, starts 55, floors ~15 in Act 4)
flag: ch1_jackie_true_identity_known  (set Act 6 only)
```

#### **Arbiter Cressa Vane** — Collective political liaison
**Voice:** procedural, exhausted, entirely reasonable. Not cruel. She has done the arithmetic and the arithmetic is on her side.

Vane exists so that the Collective is not a cartoon. She never threatens. She presents costs. Her best scene is Act 4, where she walks the player through, in numbers, exactly how many people die in the first ninety days of an orderly Biome shutdown. She is not wrong. She is a distant cousin of Harthmere's Edrik Vane, a fact both families find embarrassing and useful.

```hooks
npc_id: npc_cressa_vane
faction: collective_civil
first_placement: Returnstone Pad Office [41.9, 41, -30.1]
```

#### **AUGUR-9 / "Auggie"** — autonomous research custodian unit
The **Mucked Robot** the player repairs during Muck vs. Machine. Chapter 1 reveals it was the player's own lab custodian, assigned to the Anchor Integrity program, and it has been walking a degrading patrol loop for eleven years with a corrupted directive and a nearly dead core.

Auggie is the chapter's **playback device**. It carries partial, damaged research logs in the player's own voice. It cannot lie; it can only be incomplete. This makes it the counterweight to the Reconstruction fragments, which lie beautifully.

Auggie's running cost is a real resource sink: it needs Exotic Matter to keep its core lit, and every log the player pulls costs core charge. **Choosing what to remember costs Auggie hours of life.** That is the chapter's quietest tragedy and it should be entirely optional whether the player notices.

```hooks
npc_id: npc_augur9   # promote existing "Mucked Robot" entity
resource: augur9_core_charge (0..100, starts 62, -6 per log playback, +18 per em_cell)
death_state: if charge hits 0, Auggie shuts down permanently; remaining logs lost for the run
voice: player's own recorded voice, degraded — reuse player VO bank with heavy artifacting
```

#### **Halden Rook** — Harthmere exile, gate-warden at the Old Bridge
**Voice:** formal, cold, unexpectedly gentle with children and animals. Believes killing Biome engineers is an act of mercy and says so without heat.

Rook is Chapter 1's entire Harthmere presence. He does not let the player cross the bridge (`904, 71, -209`) and does not need to be fought. He shows up when a Fracture Gate opens, because Harthmere has been tracking the Mouths for two years and knows more about them than the Collective admits.

His function: **he is right about everything and unbearable about all of it.** He is the first person to tell the player, correctly, that the gates are proof the technology is failing. The player has to accept a true fact from a man who would kill them for their résumé.

```hooks
npc_id: npc_halden_rook
faction: harthmere_watch
first_placement: Harthmere Bridge Center [904, 71, -209], gate closed
rule: portals/gates NEVER spawn east of bridge_center.x — Harthmere uses no Biomes
```

#### **Dr. Nadia Sorrel** — the player's research partner, lost eleven years, aged four months
**Voice:** fast, impatient, mid-argument from the second she opens her mouth. She has been mid-argument for four months.

Sorrel is the human antidote to amnesia and the chapter's cruelest instrument, because she remembers the player perfectly and the player does not remember her at all. She does not handle this well. She is not gracious about it. She will demand the player finish a sentence they started eleven years ago and will be visibly hurt when they can't.

She is also the chapter's most reliable narrator and therefore must be extracted late and kept talking for as short a time as possible before the climax. Design constraint: **Sorrel must not be alone with the player for more than one scene before the handover**, or the twist unravels.

```hooks
npc_id: npc_nadia_sorrel
introduced: Dungeon 2, Zone 5 (Sorrel's Camp)
escort_state: ch1_sorrel_escorted
item_carried: item_sorrel_field_ledger
```

#### **Iris Fen** — a child pulled through from somewhere she should not have been
Eight years old, displaced into the Bronze Age desert site from a Biome that failed near the Grove. She has been there eleven days. She is fine, which is the disturbing part. Something in the desert site has been keeping her fed.

Iris is the emotional proof-of-concept for time displacement, and she is the first person the player rescues rather than helps. She becomes a Grove resident afterward and a recurring presence in later chapters.

```hooks
npc_id: npc_iris_fen
rescued_flag: ch1_iris_rescued
post_chapter_placement: Grove, near Emily's photo corner / Lovely Locks
```

#### **Teague "Teak" Morrow** — TT cell runner
Cynical, funny, thinks the whole plan is stupid, is right. He is the player's first hard evidence that Jackie belongs to an organization, and the Act 4 mislead runs through him.

```hooks
npc_id: npc_teak_morrow
faction: take_terra
capture_flag: ch1_teak_detained  (Act 4)
```

#### Minor new cast
- **Sister Wen Halloway** — Jackie's sister, a Collective refinery clerk, estranged. One scene. Explains the shape of Jackie's guilt without Jackie having to.
- **Marrow** — a Muck-displaced dog that follows Iris back. Purely for warmth. Protect at all costs.
- **Foreman Calla Ashe** — (existing label) runs Ashline Containment Works, is present for the Act 4 bomb scene, and is the witness who reports the player's impossible competence to the Collective.

### 3.3 Faction sheet

| Faction | Wants | Believes | Chapter 1 posture |
| --- | --- | --- | --- |
| **The Collective** | Stabilization, continuity, Harthmere's antimatter | Biomes are civilization; failure is a maintenance problem | Recruiting the player, gently |
| **Take Terra (TT)** | Wind Biomes down before the timeline does it for us | The planet is the only anchor that matters | Hiding the player, badly |
| **Harthmere** | To be left alone on top of the world's most wanted rock | The gates prove they were right in 2062 | Watching, not yet fighting |
| **The Grove** | To get through the week | Politics is what happens to other towns | Caught in the middle, as always |

---

## 4. The Memory System

### 4.1 Design principle

The chapter's entire mechanical identity is: **memory is a system the player levels up, and it is an unreliable system.** Not "collect 40 audio logs." A reconstructor with confidence values that can be *wrong*, and that visibly *revises itself* later.

### 4.2 The six phases → the six acts

The real-world memory-reconstruction stages from the outline map one-to-one onto acts. Each act's mechanics are derived from its stage.

| Act | Real-life stage | Player experience | Mechanic introduced |
| --- | --- | --- | --- |
| 1 | Confusion & disorientation | Nothing comes back. The world has to be explained. | Tutorialization; the Card warms near instability |
| 2 | Formation of new memories | New things stick. Old things don't. | The Fragment Ledger opens; NPC relationship tracks |
| 3 | Fragmented recall | Flashes, out of order, emotionally loud | Fragment types: Echo, Overlay |
| 4 | Recognition before recall | Hands know what the head doesn't | **Latent Skill** unlocks — full-expertise UI, no tutorial |
| 5 | Gradual reconstruction | Fragments chain into a timeline | Fragment **linking**; confidence values become visible |
| 6 | Consolidation | Fixed, stable, and too late | Fragment **revision** — the ledger rewrites itself on screen |

### 4.3 Fragment types

**1. Echo** — audio only, no visuals, 3–8 seconds. Cheap to produce, use liberally. Always ambiguous. *Reliability: high content, no context.*

**2. Overlay** — a ghost scene rendered in place over the current world. The player is standing in Mosslawn and a lab corridor is drawn over it at 30% opacity, with figures. Non-interactive, 10–20 seconds. *Reliability: accurate geometry, unreliable faces.*

**3. Playback** — a recovered recording from Auggie, the Card, or a terminal. Diegetic, verifiable, incomplete. **These never lie.** They are the player's evidence baseline. Costs Auggie core charge.

**4. Reconstruction** — a fully playable first-person flashback vignette, 2–6 minutes, where the player controls their past self. Rich, cinematic, memorable — and **these are the liars.** The brain is filling gaps with plausible material. Two of the six Reconstructions in Chapter 1 are materially false and both are false in the same direction: they make Lou a rescuer and Jackie a threat.

This is the fair-play contract: the game never lies in a Playback, only in a Reconstruction, and it tells the player in Act 2 — through Doc, clinically, in one line — that reconstructed memory confabulates. The player is warned. They will not listen. Nobody does.

```hooks
fragment_schema:
  id: string
  type: echo | overlay | playback | reconstruction
  confidence: 0..100          # hidden until Act 5
  truth: true | partial | false   # server-side only, NEVER sent to client
  revised_by: fragment_id | null
  trigger: object | place | sound | face | skill | stress | sleep
```

### 4.4 Trigger classes

| Class | Example in Chapter 1 |
| --- | --- |
| **Object** | The Card warming; a bronze scale; a syringe cap; a specific mug |
| **Place** | Standing on the Old Bridge; the Greenlamp exam room; the Returnstone pad |
| **Sound** | Sil's song stones; a containment alarm; ice under load |
| **Face** | Seeing Lou for the first time; a photograph in Sorrel's camp |
| **Skill** | Doing something correctly that the player was never taught (see §7.4) |
| **Stress** | Dropping below 15% health; the Act 4 containment sequence |
| **Sleep** | Sleeping at Lanternrest Road Inn `[605.6, 48, -483.8]` — the only *scheduled* fragment delivery, used for pacing control |

### 4.5 The Fragment Ledger (UI)

A journal tab, `Recovered`. Opens at the start of Act 2.

- **Acts 2–4:** flat list, newest first, no dates, no confidence. Deliberately unhelpful — it mirrors the player's state.
- **Act 5:** the player unlocks **linking**. Fragments can be dragged into a timeline. Correct links award XP and produce a *derived* fragment. Confidence values become visible. Some fragments the player has trusted for hours turn out to be sitting at 22%.
- **Act 6:** **revision.** During the climax, six fragments visibly rewrite themselves in the ledger while the player watches, one after another. No input. This is the chapter's cinematic payload and it should be the single most expensive thing we build in Chapter 1.

```hooks
ui: journal tab "Recovered"
unlock_link_mode: flag ch1_act5_linking
revision_sequence: cutscene id ch1_consolidation_revision
  # uses CutsceneDirector; see docs/cutscenes.md
  # 6 ledger entries animate a text-diff in sequence, 4.5s each
```

---

## 5. Fracture Gates (Dungeon Portals)

### 5.1 What they are

A **Fracture Gate** is a hole in the present tense. Where enough anchors have been stacked and stressed, the local timeline loses containment and a stable-for-a-while aperture forms onto **a real place at a real other time.** Not a pocket dimension. Not a simulation. The past, still running.

Harthmere calls them **Mouths**. Collective field reports call them "aperture events." The Grove just calls them gates and stays away from them.

### 5.2 The hard rules

1. **Gates only appear where Biomes are used.** Density of anchors drives it. This is the visible, undeniable, in-your-face proof that the technology is unstable — and it is why Harthmere's argument stops being ideology and starts being data.
2. **No gates in Harthmere.** Ever. Not one, not a small one, not a "special exception." Harthmere refuses Exotic Matter, so Harthmere has no anchors, so Harthmere has no Mouths. Halden Rook will point this out and the player cannot argue.
3. **A gate is a one-way door until you reach the far anchor.** You go in. It shuts. You come out somewhere else in the same site, or you don't come out.
4. **No merchants. No rest areas. No safe rooms. No resupply.** What you bring is what you have. This is not a difficulty choice, it is the thematic point: the modern world cannot buy its way through the past.
5. **Time inside runs differently and inconsistently.** Never make this a puzzle mechanic; make it a dread mechanic. The player learns on the way out that the Grove has had two days.
6. **Something always has to come back with you.** An item, a person, or both. The chapter's dungeons are *retrievals*, not clears.

### 5.3 Why retrieval matters

The collapse is not fixable with knowledge alone. Certain physical things — a pre-industrial reference mass, a person whose body has a clean timeline signature, an object that predates every anchor on Earth — are the only calibration references left. Everything in the present has been contaminated by eleven years of anchor load.

> **WRITER'S TRUTH:** the player knows this instinctively before they can explain it, and the explanation is one of the Act 4 Latent Skill unlocks. The reason Seven wanted the program stopped is that Seven could no longer trust a single measurement taken after 2049 — including their own.

### 5.4 Provisioning

Both dungeons open with a **provisioning gate**: a required loadout check that cannot be skipped and cannot be bought in one place. The player must actually work the Grove economy — Rin for forage, Fern for produce, Gus for bread that keeps, Carlo for cooked stock, Luis for repair kits, Doc for field medicine, Mel for tools.

This is where the game's business/economy systems become *narratively* necessary rather than optional flavour. It is also, quietly, the chapter's argument: **the world runs on the people doing jobs.**

```hooks
provisioning_check:
  gate_id: ch1_gate_desert | ch1_gate_winter
  required: { food_units>=X, water_units>=Y, light_units>=Z, repair_kit>=1, bandage>=N }
  hard_block: true  # cannot enter under-provisioned
  warning_npc: Jackie (desert) / Ranger Jane (winter)
  ui: a checklist panel at the gate, red items blocking
```

---

## 6. Items

### 6.1 The Card

The player wakes with the clothes on their back and one object: a thin grey card, slightly warm, with no printing on it. It is the chapter's spine.

**Act 1 name:** *Grey Card*. Description: "A card. Warm. You have no idea." No stats. Cannot be sold, dropped, or destroyed — attempts produce a small, wrong-feeling refusal message.

**What it does, discovered in order:**

| Act | Discovery |
| --- | --- |
| 1 | It gets warm near unstable places. The player uses it as a dowsing rod without understanding it. |
| 2 | Dimmi notices the warmth correlates with the reflections she collects. First evidence it is instrumentation, not jewellery. |
| 3 | Auggie recognizes it and refuses to explain — a directive lock. It opens the first Fracture Gate anchor. |
| 4 | It has storage. The player's hands know how to open it. It contains 41 seconds of a voice memo in their own voice. |
| 5 | It is a custodian key. Sorrel has the matching one. Hers is numbered 3. |
| 6 | Renamed on-screen during the revision sequence: **Custodian Key 7 — Anchor Zero.** |

```hooks
item_id: item_grey_card
rename_at: flag ch1_act6_consolidation -> "Custodian Key 7"
undroppable: true
proximity_effect: warmth VFX + haptic + audio, scaled by local anchor_stress
```

### 6.2 Chapter items

| Item | First seen | Purpose |
| --- | --- | --- |
| **Muckwad Sample** | Prologue (existing) | Retconned into evidence: Doc's analysis in Act 2 shows it contains material with no isotopic present tense |
| **Auggie's Core Cell** | Act 1 | Consumable Exotic Matter cell; keeps Auggie alive; the player must choose between logs and the robot's lifespan |
| **Jackie's Tin** | Act 2 (background), Act 4 (evidence) | A dented tea tin. Innocuous for two acts. Contains `ch1_compound_b`. |
| **Unmarked Vial** | Act 4 | The mislead detonator. Found in Jackie's stores. Doc identifies it as "unregistered, neuroactive, not from any dispensary I know." |
| **Lou's Case Notes** | Act 3 | Lou *volunteers* his own patient file on the player. Honest, complete, and damning of nobody — because he wrote it eleven years ago knowing it would be read. |
| **The First Grain** | Dungeon 1 | A pre-anchor reference mass. Calibration standard. Physically unremarkable; a small dull bead. |
| **Iris's Button** | Dungeon 1 | A modern coat button found in a Bronze Age stratum. The first thing that tells the player a *person* is in there. |
| **Sorrel's Field Ledger** | Dungeon 2 | The unredacted original. The thing the player gives away. |
| **Custodian Key 3** | Dungeon 2 | Sorrel's card. Two keys together do something. Chapter 2 problem. |
| **Rook's Bell-Iron Token** | Act 3 | Harthmere safe-conduct. Doesn't open the bridge. Does stop a Harthmere patrol from killing you once. |
| **Marrow's Collar** | Dungeon 1 | Cosmetic. Emotional. Non-negotiable. |

### 6.3 The two compounds

```hooks
item_id: item_ch1_compound_a   # Stillwater — the sequestrant
  client_name_acts_1_5: "Clear Ampoule"
  client_name_act_6: "Stillwater (Anterograde Sequestrant)"

item_id: item_ch1_compound_b   # Riverbed — the reversal agent
  client_name_acts_1_5: "Unmarked Vial"
  client_name_act_6: "Riverbed (Sequestrant Reversal Agent)"

CRITICAL: both compounds must be visually near-identical in inventory art
until Act 6. The player's inability to tell them apart is the plot.
```

---

## 7. Act Structure

Six acts, plus the existing prologue. Target total: **12–18 hours**, of which 2–6 hours are the two dungeons.

---

### Act 0 — Prologue: "The Road Ahead" *(existing content, lightly re-framed)*

**Chain:** Road Ahead → Busted → Get the Muck Out → **Muck vs. Machine**

No memory content. No mystery. The player learns to move, break, place, wear, craft, fight, and talk. Jackie is a friendly road-keeper. The Card is in the inventory doing nothing.

**The only change required:** the final beat of *Muck vs. Machine*. When the player repairs the Mucked Robot, it stands up, its optic focuses on the player's face, and it says one line in a degraded voice:

> "…custodian recognized. Resuming log playback. Entry four hundred and… entry four hundred and… entry—"

And then it fails, and the audio that comes out is **the player's own voice**, badly artifacted, mid-sentence, saying something that makes no sense yet.

That is the ignition. The chapter starts on that sound.

```hooks
trigger: on_complete quest "Muck vs. Machine"
  -> spawn cutscene ch1_ignition (12s, CutsceneDirector)
  -> set flag ch1_started
  -> unlock journal tab "Recovered" (empty, greyed, tooltip "Nothing yet.")
  -> Auggie converts from quest prop to persistent follower-capable NPC
```

---

### Act 1 — "What the Card Opens"
**Memory stage:** Confusion and disorientation
**Length:** ~2 hours
**Emotional target:** Safety, curiosity, and one cold spike at the very end.

#### Events

The player wakes the morning after Muck vs. Machine in Jackie's spare room above the Grove road-house. This is the first time the game has shown the player *sleeping and waking*, and it establishes the sleep-fragment channel.

Jackie's morning routine is the tutorial for the chapter's real systems: eat, drink, check your kit, don't go past the fence line. She makes tea. She always makes tea. **The tea is the cure and the player will drink it roughly forty times before they learn what it is.**

Act 1's spine is the **Naming Scene** with Taye. The Grove needs to put something on the ledger. The player picks a name — this is where character naming happens diegetically, and Taye paints it on a board. Taye's line:

> "Nobody finds their name. Everybody gets given one and then spends a while growing into it. You're just doing it faster than most."

Then: Auggie. Luis and the player rebuild enough of the robot's chassis for it to walk. It follows the player. It calls the player "Custodian" and will not stop, no matter how many times it is corrected. Every log the player plays costs core charge, and Luis says so out loud once so the player understands the cost.

**Log playback #1** (Playback, true, 22 seconds): the player's own voice reading a measurement aloud, sounding bored, and then stopping. There is a long pause. Then, quietly: *"Run it again."*

#### The Card learns to be useful

The player discovers, by accident, that the Card gets warm. Jackie shrugs it off. Dimmi at Shutter Cove `[560, 71, -182]` does not — she's been collecting things the water returns that shouldn't exist, and she notices the Card gets hottest exactly where her weirdest finds wash up.

This is the first thread of the real plot, delivered by a side character, in a side conversation, about junk on a beach. Correct.

#### The Act 1 close

At dusk the player walks the fence line with Jackie. The Card goes hot enough to hurt. At the open boundary stones beyond the **Broken Safe-Zone Fence**, the air is wrong — a vertical seam of light, two metres tall, humming.

It is a Fracture Gate, and it is *small*, and it closes on its own after ninety seconds.

Jackie sees the player's face and says the first thing in the chapter that doesn't fit:

> "…You've seen one before."

The player has not. The player has no idea. But the answer that comes out of their mouth, without permission, is: **"Not this small."**

**First Echo fragment fires.** No image. Just a woman's voice, urgent, from a long way off: *"—seven, get back from it—"*

Act 1 ends there.

```hooks
quests:
  ch1_a1_q01_morning_after      (Jackie; wake, eat, drink, gear check)
  ch1_a1_q02_a_name_for_the_board (Taye; naming scene; sets player_display_name)
  ch1_a1_q03_stand_him_up       (Luis + Auggie repair; unlocks augur9_core_charge)
  ch1_a1_q04_what_the_water_gives (Dimmi; Shutter Cove; card-warmth correlation)
  ch1_a1_q05_the_fence_line     (Jackie; first gate sighting; ACT CLOSE)
fragments:
  frag_a1_echo_get_back  (echo, truth=true, confidence 90, trigger=stress)
  frag_a1_play_run_it_again (playback, truth=true, trigger=object/auggie)
flags_set: ch1_act1_complete, ch1_seen_first_gate
anchors: fence gate spawn [543, 69, -221]  # measured open shelf east of the wall
```

---

### Act 2 — "Names Worth Keeping"
**Memory stage:** Formation of new memories
**Length:** ~3 hours
**Emotional target:** Belonging. This act is where the player falls for the Grove.

#### Events

New memories stick now. Old ones still don't. The Fragment Ledger opens as a functional tab, and the player is told — by Doc, in a flat clinical aside that is the fair-play warning for the entire chapter:

> "Anterograde's the front half. You'll make new memories fine. Retrograde's the back half, and it doesn't come back clean. What comes back gets *rebuilt*, and the brain fills the gaps with whatever's handy. Best guesses. Confident ones. Don't marry the first version of anything."

Then the game spends three hours making the player marry the first version of everything.

#### The meet-everyone structure

Act 2 is a hub act. The player takes jobs from the **Jobs Board**, works the Grove economy, and meets the cast. Each significant NPC has a **Testimony**: one true detail about the night the player arrived. Nobody has the whole picture. Together, the twelve testimonies describe a woman carrying an unconscious adult through the Grove at 3 a.m. in the rain, refusing help, and putting them in a bed.

The player will read this, in Act 2, as *Jackie saved me.*
They will re-read it in Act 4 as *Jackie took me.*
Both readings are supported by the same twelve sentences. **Write them so neither reading requires a stretch.** This is the hardest writing task in the chapter and it must be done at the sentence level.

Sample testimonies:

- **Alva** (bench, Old Grove Road): "She didn't stop to rest. Not once. People who are helping stop to rest."
- **Helsa** (night lamps): "She asked me to put the lamps out. Not down. *Out.*"
- **Grover**: "You had a shoe on one foot. Only one. Nobody loses one shoe."
- **Coretta** (ledger): "She didn't write you in for nine days. Coretta writes everything in the same day. That's the whole point of Coretta."
- **Emily** (photo corner): "She kept checking the road behind her. All the way up. Every few steps."
- **Patsy** (labels): "She asked me for a blank tag. Not a name tag. A blank one."
- **Richard** (quartermaster): "She asked what I had that couldn't be traced. I thought she meant boots."
- **Runna**: "She was *fast*. Carrying a whole adult, uphill, and I couldn't have kept up."
- **Drona** (moss): "The moss came back from her prints in about an hour. That's a trained walk. That's someone who's been taught not to leave a trail."
- **Gizela** (cove): "The tide gave back a hospital bracelet three days later. Wasn't yours. Didn't have a name on it either."
- **Davi** (crossroads): "She borrowed a cart and brought it back cleaner than she took it."
- **Allix** (canopy): "From up top? She took the long way. Not the fast way. The way with no windows on it."

```hooks
system: ch1_testimonies (12 entries, collectible, journal sub-page "The Night You Came")
completion_reward: fragment frag_a2_recon_arrival (reconstruction, truth=FALSE)
  # the player's brain assembles the testimonies into a playable flashback
  # of being CARRIED AWAY FROM SAFETY. It is emotionally vivid and materially wrong.
```

> **WRITER'S TRUTH:** the twelve-testimony reward is a **Reconstruction**, and it is the chapter's first big lie. It is generated *by the player's own act of investigation*, which is exactly how confabulation works, and it means the player builds the false memory themselves. Nobody lied to them. They did it.

#### Lou arrives

Mid-Act 2. A visiting specialist comes to **Greenlamp Walk-In Clinic** `[656, 65, -182]` to consult on the Grove's rising number of memory-sickness cases — which are real, and which are a symptom of local anchor stress, and which give Lou an entirely legitimate reason to be there.

The player meets him because Jackie sends them. **Jackie sends them.** She has to; refusing would be conspicuous, and she needs to know what he wants. This is the closest thing to a mistake Jackie makes in the chapter and it costs her everything.

Lou is wonderful. He examines the player, tells them the truth about their condition as far as it goes, gives them a real diagnosis with a real name, refuses payment, and asks nothing. On the way out he says, absently, not looking up from his notes:

> "You hold your pen like a physicist. Sorry. That's a strange thing to say to a stranger."

**Face-trigger fragment fires.** Overlay: a corridor, a hand on the player's shoulder, smoke, and a voice saying *"I've got you. I've got you. Walk."*

The player's brain files Lou under **rescue** in the first ninety seconds of meeting him, and it is *not wrong*, and that is the trap.

#### Act 2 close

Kit the Courier brings a sealed packet addressed to no one, delivered to the Grove road-house, which Jackie takes and does not open in front of the player.

Same night: the second gate. Bigger. It does not close after ninety seconds. It is still there in the morning, out past the **Old Wood Copse** `[640, 57, -455]`, and something has come *out* of it — a single set of footprints in Bronze Age sandal-leather, walking north, and stopping halfway.

Halden Rook is standing at the treeline looking at them when the player arrives, having crossed a bridge he is not supposed to cross.

> "Two years I have watched these open on your side of the river and never once on mine. I would like someone from the Grove to say the obvious sentence out loud. Just once. I will wait."

```hooks
quests:
  ch1_a2_q01_the_ledger_opens   (Doc; unlock Recovered tab; confabulation warning line)
  ch1_a2_q02_work_the_board     (Jobs Board; N of M economy jobs; gates provisioning literacy)
  ch1_a2_q03_the_night_you_came (12 testimonies; reward = false reconstruction)
  ch1_a2_q04_the_visiting_doctor (Jackie -> Lou; Greenlamp; face-trigger overlay)
  ch1_a2_q05_footprints         (Rook; second gate; ACT CLOSE)
fragments:
  frag_a2_overlay_ive_got_you   (overlay, truth=PARTIAL, confidence 71, trigger=face)
  frag_a2_recon_arrival         (reconstruction, truth=FALSE, confidence 84)
flags_set: ch1_act2_complete, ch1_met_lou, ch1_met_rook, ch1_gate_persistent_open
anchors: persistent gate approx [648, 57, -462]  # near Old Wood Mucker Copse Sentinel
```

---

### Act 3 — "The Sand That Remembers"
**Memory stage:** Fragmented recall
**Length:** ~4 hours (1.5 hub + 2.5 dungeon)
**Emotional target:** Awe, then dread, then a lie the player is grateful for.

#### The hub half

The persistent gate is a crisis. The Grove has three responses and the player has to pick a side before they understand the politics, which is the point.

- **Ranger Jane** wants it contained and left alone. Rope it, watch it, don't touch it.
- **Arbiter Cressa Vane** arrives from the Returnstone Pad `[41.9, 41, -30.1]` and wants it *studied*, which means Collective personnel, Collective instruments, and Collective jurisdiction over a piece of the Grove.
- **Halden Rook** wants it collapsed, and says — correctly — that nobody knows how.

And **Jackie** wants the player nowhere near it, urgently, with an intensity she can't justify out loud.

The deciding factor is the footprints. Somebody walked out. Which means something can walk in. And then Rin the Forager finds **Iris's Button** — a modern coat button, from a coat sold in a Grove shop nine months ago, sitting in a fold of sandal-print sand.

A child from the Grove went missing eleven days ago. Everyone assumed the Muck.

That settles it. The player is going in, and every faction agrees for a different reason, and Jackie stops arguing and starts packing, which is worse.

#### Provisioning

The full economy loop, mandatory. Rin (forage), Fern (produce), Gus (keeping-bread), Carlo (cooked stock), Doc (field medicine), Luis (repair kits), Mel (tools), Richard (untraceable spares, if the player has that relationship). Jackie checks the pack at the gate and pulls things out and puts things in and does not explain how she knows.

> **WRITER'S TRUTH:** Jackie has been through a Mouth. Twice. TT has been mapping them for three years. She cannot say so.

#### Lou's gift

Before the player leaves, Lou gives them his **case notes** — the complete patient file he wrote on an unnamed subject eleven years ago at a Collective facility, unprompted, unredacted, with a plain covering line:

> "You'll want to know whether the man treating you is the man who put you here. So here's everything I have, and I'll be here when you get back either way. Read it in the dark somewhere. It's not flattering to me."

It is honest. It is complete. It describes compassionate care of a patient with a genuine memory disorder. It contains no lie of any kind.

It also does not contain the fourteen hours before intake.

```hooks
item_id: item_lou_case_notes
readable: true, 6 pages, in-world document viewer
content_rule: every sentence must be verifiably TRUE and remain true after Act 6.
  The document's deceit is entirely by omission of the intake window.
effect: ch1_lou_trust +25
```

---

## 8. Dungeon 1 — **The Sand That Remembers**

**Era:** ~1750 BCE. A river-valley city at the end of a long drought.
**Biome:** Desert — dune sea, salt flat, buried mudbrick city, deep cistern system.
**Target length:** 2–2.5 hours.
**Retrieval:** one item (**the First Grain**) and one person (**Iris Fen**).
**Party:** solo-viable; scales to 4.

### 8.1 Premise

The gate opens onto a city that is dying of thirst on top of a natural Exotic Matter outcrop it does not have a word for. The locals call it **the Sleeping Weight** and have built a temple over it, and they are correct about almost everything: it does not fall, it does not burn, it is not of the world, and it must not be broken.

They have also been quietly, accidentally, doing exotic-matter metallurgy for two hundred years, and the city's celebrated bronze work is the best on Earth for reasons no one there can articulate.

The city is not hostile. The city is *gone* — the player arrives after the evacuation, into a place emptied about six weeks ago, with meals on tables. What's left behind is what came *after*: displaced Muck, the temple's automated guardians, and one eight-year-old girl who has been living in the granary.

### 8.2 Structure

| # | Zone | Length | Mechanic | Threat |
| --- | --- | --- | --- | --- |
| 1 | **Dune Threshold** | 15 min | Heat + water attrition. No combat. | The environment |
| 2 | **The Salt Market** | 25 min | First combat; verticality; collapsing awnings | Muck-displaced scavengers |
| 3 | **The Cistern Stair** | 25 min | Darkness, light management, water level | Drowning, Hexers in the dark |
| 4 | **The Hall of Weights** | 30 min | The chapter's signature puzzle (below) | Timed, non-combat |
| 5 | **The Sun Court** | 20 min | Mini-boss arena | **The Gilded Bull** |
| 6 | **The Seed Vault** | 20 min | Discovery + Iris + a Reconstruction | None (deliberate) |
| 7 | **The Long Walk** | 25 min | Escort under sandstorm, one-way | Attrition + a pursuit |

### 8.3 Zone notes

**Zone 1 — Dune Threshold.** Fifteen minutes of no enemies. This is a flex and it is worth it. The player crests a dune and sees a Bronze Age city under a sun that is the wrong colour, and the only mechanic is that water goes down. Heat drains stamina, shade restores it, and the player learns that in here, the resource bar *is* the health bar. Auggie's core drains 3× faster in the heat — first real pressure on the "which logs do I play" economy.

**Zone 2 — The Salt Market.** Combat introduction, in a ruined bazaar with awnings the player can drop on things. The enemies are **Salt-Cured Muckers**: Muck that came through a much older, much smaller aperture and has been baking here for a century. They are slower, harder, and they do not bleed. First proof the Muck is not local to the Grove and not local to *now*.

**Zone 3 — The Cistern Stair.** Light management. Torches burn out; the player brought a finite number. The cistern is partly flooded and the level changes as ancient sluices fail. Lesser Hexers hunt by sound in the dark sections. There is a shortcut that saves fifteen minutes and requires swimming through a section with no air pockets, and the game should absolutely let the player try it and drown.

**Zone 4 — The Hall of Weights.** *This is the puzzle that carries the chapter's thesis.*

The temple's inner hall is a metrology room: a Bronze Age standards vault, full of reference weights, balance beams, and graduated vessels. To open the Seed Vault the player must produce an exact mass against the temple's own standard.

Every modern instrument the player is carrying gives a different answer. Auggie's readings drift. The player's own tools disagree with each other by amounts that are small, consistent, and impossible.

The solution is to stop trusting instruments and use the temple's own balance beam — comparative, not absolute. **You cannot measure anything against the present. You can only measure things against each other.**

When the player solves it, a **Latent Skill** preview fires: the balance solution executes with an expertise UI the player was never taught, and Auggie says:

> "Custodian. That is the calibration procedure from your ninth paper. You wrote it. I have the citation. Would you like me to read it?"

And playing that log costs core charge, and the player has to decide whether their own bibliography is worth an hour of the robot's life.

**Zone 5 — The Sun Court. The Gilded Bull.** A temple guardian: a bronze automaton, exotic-matter cored, running on a two-hundred-year-old directive to keep the unclean out of the Sun Court. It is not evil and it is not alive. Three phases:

1. *Patrol.* It hasn't noticed you. Full stealth bypass is possible and rewards a lore cache.
2. *Charge.* Straight-line charges; the arena is full of pillars; you break its horns on the architecture, not with your weapon.
3. *Unbalanced.* Hornless, it fights badly and desperately, and it takes too long to die, and that is intentional. The player should feel slightly sick about it.

Loot: **the Bull's Core** — a two-hundred-year-old Exotic Matter cell, the single best Auggie recharge in the chapter, +48 charge. Using it means the Bull's death bought Auggie's life. Nobody comments on this.

**Zone 6 — The Seed Vault.** No combat. The vault is a granary and a seed library, and it is *full*, because the city evacuated without taking its future with it. And in the middle of it, in a nest of grain sacks, is **Iris Fen**, eight years old, eleven days in, entirely calm.

She is calm because the vault has been feeding her. The temple's systems read a child as something to preserve.

She has also been talking to somebody. She describes, in a child's vocabulary, a woman who comes and goes and doesn't stay long and is "cold to stand next to." The player will assume Muck, or a ghost, or a hallucination.

> **WRITER'S TRUTH:** it is Sorrel. Sorrel has been walking between apertures for four subjective months looking for a way out, and the Seed Vault is on her route. She has already met Iris. She has been keeping a child alive across two thousand years and will never mention it.

**The First Grain** sits in the seed library's index position: a single dull bead of ordinary matter, sealed, catalogued, and dated by the temple's own reckoning to before the drought. Pre-anchor. Uncontaminated. The last honest gram on Earth.

Taking it fires the act's major **Reconstruction** — the second big lie.

**Zone 7 — The Long Walk.** Escort. Iris is slow, Marrow the dog will not be left, the sandstorm is arriving, and the return aperture is four hundred metres of open flat. No combat encounters — a *pursuit*. Something large is moving parallel in the storm and never quite arrives, and the game must never show it, ever, in this chapter.

### 8.4 The Act 3 lie

In the Seed Vault, taking the First Grain, the player gets a full playable **Reconstruction** — the night of the collapse.

They play it. They are in a corridor. There is smoke. There is an alarm. There is a woman ahead of them at the end of the corridor with a syringe in her hand, and she is coming toward them, and they cannot move, and behind them a man's voice says *"I've got you, walk, don't look at her, walk—"* and hands pull them backward through a door.

The woman's face is not clear. The build is right. The walk is right. **Drona's line about a trained walk fires as a caption cue.**

The player finishes Dungeon 1 believing Jackie tried to inject them with something and Lou pulled them out.

> **WRITER'S TRUTH:** every element is real and the assembly is wrong. There was a corridor, smoke, an alarm, a syringe, a woman running toward them, and a man pulling them backward. The woman was Jackie, running to *stop* it, four minutes too late. The syringe in her hand was `ch1_compound_b`, the reversal agent, which she had already stolen. The man pulling the player backward was Lou, who had administered `ch1_compound_a` eleven minutes earlier and was removing the patient from an active fire. The reconstruction is 100% accurate in every physical particular and 100% inverted in meaning. **It contains no invented frames.** Verify this in review: if any single shot in the vignette is not literally true, we have cheated.

```hooks
dungeon_id: ch1_dungeon_desert  ("The Sand That Remembers")
gate_anchor: [648, 57, -462]  (Grove side, persistent)
zones: 7, no merchants, no rest nodes, no resupply (enforced)
time_dilation: 1 hour inside ≈ 9 hours Grove-side (revealed on exit, not before)
boss: enc_gilded_bull (3 phase, stealth-bypassable)
retrieval: item_first_grain (required), npc_iris_fen (required), npc_marrow (optional-but-cruel)
fragments:
  frag_a3_recon_corridor (reconstruction, truth=FALSE, confidence 91)  # THE BIG ONE
  frag_a3_play_ninth_paper (playback, truth=true, costs augur9 charge)
  frag_a3_echo_cold_to_stand_next_to (echo, truth=true, Iris-triggered)
flags_set: ch1_act3_complete, ch1_iris_rescued, ch1_has_first_grain,
           ch1_believes_jackie_hostile
```

### 8.5 Act 3 close

The player comes out of a ninety-second gate into a Grove that has had **three days**. Jackie has not slept. She grabs the player by both arms before she thinks better of it.

And the player, fresh out of the Reconstruction, flinches.

Jackie sees it. Jackie knows exactly what it means. And Jackie — because she cannot explain without making it worse — lets go, steps back, and says:

> "Right. Okay. Yeah."

End of act.

---

### Act 4 — "Hands That Know"
**Memory stage:** Recognition before recall
**Length:** ~3 hours
**Emotional target:** Exhilaration, then paranoia. The player becomes powerful and stops trusting anyone in the same act.

#### The premise of the act

The player now *recognizes* before they *recall*. Their hands know things. Their eyes know things. They walk into a room and know which piece of equipment is going to fail, and cannot say how.

Mechanically this is the **Latent Skill** system, and it is the chapter's power fantasy — and it is deliberately placed in the act where the player's judgement is worst.

```hooks
system: ch1_latent_skills
  Unlocked by recognition triggers, NOT by XP or trees.
  On unlock: the ability appears ALREADY MASTERED — full expertise UI,
  no tutorial, no practice curve, tooltip reads "You know how to do this."
  Player cannot explain any of them to an NPC; every dialogue attempt
  produces a failed-explanation line.

  ls_containment_triage   — read and stabilize an Exotic Matter containment fault
  ls_anchor_read          — see anchor stress as a world overlay (dowsing, upgraded Card)
  ls_field_calibration    — the Hall of Weights procedure, usable anywhere
  ls_gate_timing          — predict a Fracture Gate's collapse window ±20s
```

#### The set piece: Ashline Containment Works

**Anchor:** `[673.96, 67, -44.23]`, refinery intake at `[674, 67, -56]`.

A containment core at Ashline goes into runaway during a shift change. Foreman **Calla Ashe** has forty seconds of procedure and needs four minutes. The refinery, the workers' housing beside it, and about a kilometre of the road are inside the failure radius.

The player walks in and fixes it in **thirty-one seconds.**

Design it as a real sequence, not a cutscene: a genuine multi-step interaction the player has never seen, presented with a complete expert interface — labelled, confident, no hints needed because the UI *is* the knowledge. The player will be moving faster than they can think. Give them a timer, give them real inputs, and let them be brilliant.

Then, the moment it's over, the game takes it away: Calla Ashe asks *how*, and the dialogue wheel offers four options, and **all four are "I don't know."** Phrased differently. That's it. That's the scene.

> **WRITER'S TRUTH:** Calla files an incident report, because she has to. The report reaches Collective Civil within a day. Arbiter Vane reads a description of a stabilization procedure that exists in exactly one place: an unpublished internal method attributed to a researcher whose file is sealed. This is the moment the Collective confirms they have found Seven. Everything Lou does from here is on a clock he does not tell the player about.

```hooks
quest: ch1_a4_q02_thirty_one_seconds
  minigame: containment triage, 4 stages, 45s timer, expert UI, no tutorial
  fail_state: NONE — this cannot be failed. On timeout, the player's hands
    complete it automatically and the player watches. This is the point.
  on_complete: unlock ls_containment_triage
               set flag ch1_collective_confirmed_identity (hidden)
               ch1_lou_trust +15
```

#### The other recognitions

Distribute three more Latent Skill unlocks across Act 4 so the pattern is unmistakable:

- **Sil's song stones, Mosslawn `[468, 71, -250]`.** The player hears the stones and corrects Sil's tuning — the stones are half a tone flat, and they've been flat for a year, and the reason is that a sub-surface anchor is loading the bedrock. Sil weeps. The player doesn't know why they're right. → `ls_anchor_read`
- **Dimmi at Shutter Cove.** Given her collection of impossible objects, the player sorts them by *era of origin* in one pass. → deep lore cache, no skill.
- **Rook, at the bridge.** The player predicts a gate collapse to the second, in front of a Harthmere warden who has spent two years failing to do that. Rook gives them the **Bell-Iron Token** and says the worst possible thing: → `ls_gate_timing`

  > "I have been told my whole life that your people are clever devils. It is a great deal more frightening to learn you are simply clever."

#### The mislead detonates

This is the act's second half and it must be executed precisely.

**Step 1 — the observation.** The player, now hyper-perceptive, notices Jackie put something in the tea. Not a cutscene: a **Latent Skill passive** flags it, the way it flags a failing valve. The game is telling the player something true. The interpretation is theirs.

**Step 2 — the search.** The player searches Jackie's stores and finds **Jackie's Tin** and inside it a rack of **Unmarked Vials**. Twenty-two of them, used. Roughly one a fortnight for eleven months.

**Step 3 — the analysis.** Doc runs it. Doc is honest, competent, and does not have the equipment to do better than:

> "It's neuroactive. It's unregistered. It's not from any dispensary I know and it's not in any book I own. Whoever's making this is making it quietly." *(beat)* "How long's she been giving you this?"

Every word true. Every word damning.

**Step 4 — the confirmation the player seeks.** They take it to Lou. And Lou — and this is the finest thing Lou does in the chapter — **does not accuse Jackie.** He looks at the vial for a long moment and says:

> "I don't know what this is. I'd want to run it properly before I said anything about anyone." *(beat)* "But I'll tell you the thing I do know, and then I'll stop. Compounds like this aren't made in kitchens. They're made by people with access. And there aren't many organizations with that kind of access who'd have a reason to keep a person quiet in a small town."

He implies **Take Terra** without naming them. He is not lying. He is not even wrong about the access. He simply never mentions the third organization with that access, which is his.

**Step 5 — the corroboration.** Teak Morrow is picked up by Grove watch and detained with TT materials on him. The player can interrogate him. Teak, who is loyal and stupid and scared, refuses to say what the vials are and *will not deny that Jackie is TT*, because she is. Every evasion he makes confirms the wrong thing.

**Step 6 — the confrontation.** The player confronts Jackie. She has three dialogue options available to her and the writing must ensure that all three are true and all three sound like a guilty person:

1. "It's medicine." — refused; the player asks for what, and she can't say without triggering the sequestrant's protective response *(see below)*.
2. "You need to keep taking it." — an order, from the woman drugging you.
3. "Ask me again in a month." — which is genuinely her plan and sounds exactly like a stall.

She never denies drugging them. She can't. She is.

> **WRITER'S TRUTH — the reason Jackie can't just say it.** `ch1_compound_a` is not passive. It is a **protective** sequestrant: direct, specific assertions about the sequestered material trigger an aversion-and-rejection response in the patient. If Jackie says the sentence *"You are Seven, you built Biomes, Lou erased you, I am curing you,"* the compound converts it into panic and distrust and burns the credibility she needs to keep dosing him. She has tested this. Twice, in month two. Both times it set the treatment back weeks. Her plan — feed the cure, let the truth arrive from *inside* where the compound can't reject it, absorb the hatred in the meantime — is the only plan that works and it is a terrible plan and she knows it.
>
> This is not a get-out-of-jail card for lazy writing. It must be **seeded in Act 2** by Doc, in one clinical line about sequestrants "defending themselves," so that on replay the player can see it was always there.

**Step 7 — the break.** The player stops taking the tea, reports Jackie to the Grove watch, or both. Whichever they choose, the act ends with Jackie leaving the road-house, and the player sleeping alone in it, and the **first missed dose.**

The withdrawal is not painful. It is *quiet*. The Ledger stops producing fragments for the first time in three acts.

```hooks
quests:
  ch1_a4_q01_the_stones_are_flat  (Sil; ls_anchor_read)
  ch1_a4_q02_thirty_one_seconds   (Calla Ashe; Ashline; ls_containment_triage)
  ch1_a4_q03_what_the_devils_know (Rook; bridge; ls_gate_timing; bell-iron token)
  ch1_a4_q04_what_is_in_the_tea   (passive flag -> search -> Doc analysis)
  ch1_a4_q05_the_man_who_didnt_accuse (Lou; implication of TT)
  ch1_a4_q06_teak                 (interrogation; all answers incriminate correctly-wrongly)
  ch1_a4_q07_ask_me_in_a_month    (Jackie confrontation; ACT CLOSE)
flags_set: ch1_act4_complete, ch1_jackie_expelled, ch1_dosing_stopped,
           ch1_collective_confirmed_identity (hidden)
tracks: ch1_jackie_trust -> ~15 ; ch1_lou_trust -> ~85
system_note: while ch1_dosing_stopped, fragment drop rate = 0.
  Player must re-start dosing in Act 5 to progress. See Act 5.
```

---

### Act 5 — "The Long Winter Mouth"
**Memory stage:** Gradual reconstruction
**Length:** ~4 hours (1 hub + 3 dungeon)
**Emotional target:** Momentum. The player thinks they are solving it. They are assembling the murder weapon.

#### The hub half

The Ledger has gone quiet. Three acts of steady recovery, and now nothing, and the player notices within about twenty minutes because we have trained them to.

The player has to work out — themselves, with no NPC telling them — that the vials were *causing* the recovery. The evidence chain:

- Coretta's ledger: the player's first recorded fragment date lines up with dose four.
- Doc, re-examined: "Neuroactive. I said that. I didn't say which direction."
- Auggie: a clean chronological log of every fragment event, because Auggie records everything, because that is what a custodian unit does.

And here is the trap that makes Act 5 work: **the player figures out the vials are helping, and does not revise anything else.** They conclude Jackie was drugging them *with something that happened to help*, or that Jackie was managing them, or that TT wanted them functional for TT's own reasons. The correct conclusion — *she was curing you* — requires an assumption of good faith the Act 3 Reconstruction has made impossible.

So the player goes and takes the remaining vials without asking, from a woman who would have given them freely, and resumes their own dosing, and feels clever.

**Fragment linking unlocks here.** Confidence values become visible for the first time. The Act 3 corridor Reconstruction shows **91%**. The player has no reason to doubt it. Meanwhile a scatter of low-confidence Echoes — 20s and 30s — start turning out to be the true ones, and a few players will notice the inverse correlation. Those players deserve it.

#### The letter

Kit the Courier — who nearly died on the Bluewater route to bring it — delivers the packet Jackie received at the end of Act 2, which Jackie left behind, addressed to no one.

It is four months old by the sender's reckoning and eleven years old by ours. It is handwritten. It is short:

> *"Whoever finds this. I have been walking since the Ashfall test. I count one hundred and nineteen days. I have found four doorways and all four put me somewhere worse. There is a child at the desert one; I keep her fed, I cannot take her with me, do not judge me. I am going to stop moving and build something at the cold one because I am tired.*
> *If you are Collective: I have the original ledger and I will burn it before I hand it over.*
> *If you are anybody else: bring rope, bring fire, bring more food than you think.*
> *— N. Sorrel, Custodian 3"*

The player does not know that name. Auggie does. Auggie, at the cost of core charge, plays a log: two voices arguing about a decimal place, and one of them is the player's, and the other one is laughing.

#### The winter gate

The cold gate is at the far edge of the Grove's anchor field, out past the muck flats, and it has been there for weeks, and everybody has been ignoring it because it is unpleasant to stand near.

Provisioning round two is harsher: cold-weather gear, fuel, rope, iron, and roughly double the food. Ranger Jane runs this check instead of Jackie, and the absence is louder than a scene.

Rook shows up at the gate uninvited with a coil of Harthmere rope and no explanation. He will not go in. He will hold the near side for as long as it takes, because a Mouth with nobody watching it is how towns end.

---

## 9. Dungeon 2 — **The Long Winter Mouth**

**Era:** ~880 CE. A Norse fjord settlement in a winter that has not ended in nine years.
**Biome:** Snow — sea ice, frozen fjord, drowned longhouse, black pine, ash hall.
**Target length:** 2.5–3 hours.
**Retrieval:** one person (**Dr. Nadia Sorrel**) and one item (**her field ledger**). Plus **Custodian Key 3**.
**Party:** scales to 4; solo is punishing and should be.

### 9.1 Premise

This site is not a healthy past. It is a **stalled** one. The aperture has been leaking into this fjord for so long that the local timeline has stopped advancing — the same winter, running over and over, for nine years by the inhabitants' count. Nothing grows. Nothing rots. Nobody has aged. Nobody has died, either, which sounds like mercy and is not.

The settlement is still populated. That is the difference between Dungeon 1 and Dungeon 2: the desert was empty and sad; the fjord is full and *wrong*. There are people here, and they are not hostile, and they have been having the same nine winters and they would very much like to stop.

**Jarl Hallr Ironmouth** knows. He is the only one who has worked out that the winter is not weather. He has kept his people alive through a stopped year by sheer will and he is monstrously tired, and when the player arrives with the ability to end it, he has to decide whether ending it means his people finally get to *die on schedule.*

That is the moral weight of the dungeon and it should not be resolved cleanly.

### 9.2 Structure

| # | Zone | Length | Mechanic | Threat |
| --- | --- | --- | --- | --- |
| 1 | **The Ice Shelf Landing** | 20 min | Cold attrition; fuel is the new water | Exposure |
| 2 | **The Drowned Longhouse** | 30 min | Under-ice navigation; breath | Cold, drowning, Hexers |
| 3 | **The Hanged Wood** | 30 min | Stealth-preferred; sound discipline | **Things that should not be here** |
| 4 | **The Whale Road** | 25 min | Ice crossing under load; weight matters | Ice failure; pursuit |
| 5 | **Sorrel's Camp** | 25 min | Dialogue, no combat, a locked door | Sorrel herself |
| 6 | **The Ash Hall** | 35 min | Boss + moral choice | **The Ninth Winter** |
| 7 | **The Breaking Year** | 25 min | Escort out under a collapsing timeline | Everything |

### 9.3 Zone notes

**Zone 1 — The Ice Shelf Landing.** Mirror of Dungeon 1's opening, inverted. Water was the desert's clock; **fuel** is the fjord's. Fire is finite, carried, and the only thing between the player and a slow stat death. Auggie's core actually *lasts longer* in the cold — a small mercy, and the only one.

The landing is where the player finds the first bodies that are not bodies: three men frozen mid-stride on the shelf, nine years dead, not decomposed, not frozen solid, **warm.**

**Zone 2 — The Drowned Longhouse.** A hall that flooded and froze with everything inside it. The player goes under the ice through a broken roof and navigates a house from below, with breath as a hard timer and the ceiling as the floor. Wayfinding by furniture. Genuinely claustrophobic; keep it short enough that it stays fun.

Reward: a Norse **hnefatafl** board with a piece missing, and the missing piece is in Sorrel's camp, and if the player carries it to her she will actually smile once.

**Zone 3 — The Hanged Wood.** The chapter's horror zone. A black pine wood on the fjord's north face where the aperture leaks worst, and things from *other* apertures have accumulated. Not Muck. Not Norse. Things with no era at all.

Rules: they hunt by sound. Combat is possible and expensive. Stealth is the intended path. **Nothing in this wood is explained in Chapter 1** and nothing in it is ever fought as a boss. It is a wood full of unfinished business, and it will be finished in Chapter 3.

**Zone 4 — The Whale Road.** Crossing the frozen fjord with everything the player is carrying. Carry weight becomes lethal: too much and the ice goes. The player will have to choose what to leave on the near shore, and whatever they leave is *gone*, and they have to make that choice again on the way back with a person added to the load.

**Zone 5 — Sorrel's Camp.** No combat. A fortified fisherman's shed with a barred door, four months of survival engineering, and a wall of charcoal notation that is the most beautiful and most alarming set-dressing in the chapter.

Sorrel does not open the door. The first conversation is through a bar-slot and she is *furious* before she knows who it is, and then she recognizes the voice and stops mid-sentence.

The scene runs on a single engine: **she remembers the player and the player does not remember her.** Every warm thing she says lands on nothing. She works it out fast — she is not slow — and the way she handles it is to get clinical and brisk and to stop looking at them, and it is the saddest thing in the chapter.

She gives the player three things, in this order:
1. **Custodian Key 3**, to prove the Card is a key.
2. **The truth about the model** — the anchor load, the cumulative non-local failure, the recommendation to stop. Delivered as an argument she is *continuing*, not starting.
3. **The field ledger**, last, and only after the player agrees to a condition: *it does not go to the Collective. Ever. Under any circumstance. Say it.*

**The player says it.** Make them pick the line. Make them commit.

**Zone 6 — The Ash Hall. The Ninth Winter.** Jarl Hallr's hall, and the aperture's local wound, and the boss.

The Ninth Winter is not a creature; it is the stalled year itself, given a body by the anchor leak — a slow, vast, cold thing wearing the hall's roof beams and nine years of accumulated unfinished mornings. Phases:

1. *The Hearth Fails.* Fight in darkness with a dying fire the player must feed with their own carried fuel. Every log burned is a log they don't have for the walk out.
2. *The Same Day Again.* The arena resets — literally, a loop of about ninety seconds, with the player's damage persisting and the environment's not. Disorienting on purpose.
3. *The Year Breaks.* Winter ends in the room. Snow turns to rain. Everything the stall was holding up comes due at once.

And then the choice, and it is Hallr's, and the player only gets to influence it:

- **Let the year run.** The stall ends. The fjord's nine years arrive at once. Most of these people were already dead in 880 and now they get to be. Hallr accepts it. The player watches a settlement age nine years in ninety seconds. *The aperture closes cleanly.*
- **Hold the stall.** Leave the wound open. The people live — in the same winter, forever, and the leak keeps bleeding into the Grove, and the gates keep opening. Hallr will take this deal if the player argues for it. He should not be judged for it.

Neither option is scored. Both are logged for Chapter 2.

**Zone 7 — The Breaking Year.** The way out, with Sorrel, under a collapsing local timeline, across the Whale Road, with weight that matters, while the fjord goes through nine years of weather in twenty minutes.

Sorrel talks the entire way. This is where the player gets the truth, in pieces, at a run — and where the player learns the word **Seven**, from a woman shouting it over wind, and hates it.

### 9.4 The Act 5 revelation and the second lie

Sorrel gives the player the shape of the truth: the model, the recommendation, the burial, the sealed file, and the fact that Seven was committed rather than killed.

She does **not** know who administered the compound. She was already gone. She has a name from a document — the attending physician of record — and she has one initial and a surname that is common, and she says it out loud once, at a run, over wind, and the audio is deliberately compromised.

> **WRITER'S TRUTH:** the name is Ardan, and the mix must bury it *fairly* — it should be audible on headphones at high volume, and roughly 15% of players will catch it, and those players will spend the entire climax screaming at the screen, which is the single best experience Chapter 1 can offer anybody.

What the player takes from Act 5 instead is the confirmation of everything they already believed: they were silenced, they were valuable, someone hid them in a small town, and the woman who hid them belongs to an organization that wanted them quiet.

Jackie fits. Jackie has always fit. The Reconstruction said so at 91%.

```hooks
dungeon_id: ch1_dungeon_winter  ("The Long Winter Mouth")
gate_anchor: approx [232, 54, -506]   # near Muck-Scarred Helix, far anchor field edge
zones: 7, no merchants, no rest nodes, no resupply (enforced)
carry_weight: HARD constraint in zones 4 and 7 (ice failure)
fuel: replaces water as the attrition resource
boss: enc_ninth_winter (3 phase) + choice ch1_hallr_choice { let_run | hold_stall }
retrieval: npc_nadia_sorrel (required), item_sorrel_field_ledger (required),
           item_custodian_key_3 (required)
fragments:
  frag_a5_play_decimal_place (playback, truth=true, Auggie, costs charge)
  frag_a5_link_the_recommendation (derived, truth=true — first LINKED fragment)
  frag_a5_echo_the_name (echo, truth=true, confidence 18, audio deliberately buried)
oath: player must select the dialogue line committing the ledger away from the Collective
  flag: ch1_sorrel_oath_given
flags_set: ch1_act5_complete, ch1_knows_designation_seven, ch1_has_ledger
time_dilation: revealed on exit — the Grove has had 2 days
```

### 9.5 Act 5 close

The player comes out onto the near shore with Sorrel, into rain, and Rook is still standing there holding a rope, having held the near side for two days, and he looks at Sorrel and says:

> "One of yours, from before. I can tell by the coat." *(beat)* "It is a strange feeling, being proved right. I had expected to enjoy it more."

And in the Grove, waiting, patient, unhurried, warm — with a Collective medical transport that has been parked at the Returnstone Pad since the day after Ashline — is Lou.

---

### Act 6 — "Seven"
**Memory stage:** Memory consolidation
**Length:** ~1.5 hours
**Emotional target:** Certainty, then the floor going out, then a choice with no good option.

This is the climax. It runs in five movements and it should be nearly unbroken.

#### Movement 1 — The Case

Lou has been building something for two acts and now he presents it, and it is *good*.

He lays out, gently and completely: the sealed file, the Ashline report, the fact that the Collective knows who the player is, and the fact that **he told them nothing.** (True. Vane worked it out from Calla's report on her own. Lou has been protecting the player's location for eleven days and can prove it.)

Then he asks for the ledger. Not as an official. As a doctor and, he thinks, a friend.

His argument, which is the strongest argument anyone makes in Chapter 1:

> "Publish it and you are right. Loudly, permanently, historically right. And then the shutdown happens the way shutdowns happen — not in an orderly sequence, in a panic, in about eleven days. Four hundred million homes. Not houses. *Homes*, in pockets, with no doors on the other side once the anchors drop.
>
> Or you give it to me. I take it to the Directorate, sealed, and we do it slowly. Ten years. Fifteen. Evacuate in order. Build somewhere for people to go. Nobody knows your name and nobody has to.
>
> You've been right for eleven years. I'm asking you to be *useful* for one afternoon."

And Vane, present and procedural, adds the part that is not a threat and lands like one:

> "For completeness: we can also do this without you. It's slower and it's uglier and more people die. But I don't want you to believe you're the only lever. You aren't. You're the *kind* one."

#### Movement 2 — The Handover

**This must be a player action.** Not a cutscene. Not a betrayal that happens to them. The player opens their inventory, selects `item_sorrel_field_ledger`, and gives it to Dr. Lucien Ardan with a confirmation prompt.

The confirmation prompt text is:

> *Give the field ledger to Dr. Ardan?*
> *You told Nadia Sorrel this would never go to the Collective.*
> **[ Give it to him ]  [ Not yet ]**

"Not yet" is allowed. It is allowed as many times as the player likes. There is no timer and no pressure and the game will wait.

> **WRITER'S TRUTH — the design position.** The player *must* hand it over for Chapter 1 to end. This is a linear tragedy, and we are choosing that on purpose. What we owe the player in exchange for taking their agency is that **the game never tricks them into it.** They are told exactly what they are doing, they are reminded of the oath they swore, and they do it anyway, because Lou's argument is better than the alternative they can articulate. Playtest specifically for whether players feel *cheated* or *complicit.* We want complicit. If we get cheated, the fix is to strengthen Lou's argument, not to weaken the prompt.

And — because the player is not stupid — they also give Lou **Sorrel's location**, in a separate line, because Sorrel needs a doctor and has spent four months eating fish.

#### Movement 3 — The Consolidation

It starts about ninety seconds too late, and it starts because of a small thing: Lou takes the ledger, tucks it under his arm, puts a hand on the player's shoulder, and says, warmly, the way he has said it since Act 2:

> "Thank you. Truly. You've done the right thing here, Seven."

The player has heard the word **Seven** exactly once before, shouted over wind, on a collapsing ice shelf, two days ago.

**Lou has never been told it.**

Not by the player. Not by Vane, who doesn't use designations. Not by anyone in the Grove, because nobody in the Grove knows it. There is exactly one category of person who calls the player Seven without being told, and it is people who were in the room eleven years ago.

Run the **revision sequence** here. The Fragment Ledger opens itself and six entries rewrite in front of the player, one at a time, ~4.5 seconds each, no input accepted:

1. **frag_a2_overlay_ive_got_you** — *"I've got you, walk."* The hand on the shoulder is the same hand. Same words. Same cadence. Confidence 71 → 99. Meaning: inverted.
2. **frag_a3_recon_corridor** — the corridor. The camera does not change. Nothing new is added. The *woman* is re-rendered clearly for the first time: it is Jackie, running toward the player, and what is in her hand is the vial from Act 4, and she is screaming a name. Confidence 91 → 12.
3. **frag_a2_recon_arrival** — the night in the Grove. Twelve testimonies, unchanged. Reassembled. She took the long way with no windows. She put the lamps *out*. She waited nine days to write the player into the ledger. Not to hide a victim. To hide a *survivor*. Confidence 84 → 19.
4. **frag_a5_echo_the_name** — the buried audio from the ice, cleaned up and replayed at full clarity: *"—the attending was a man named Ardan—"* Confidence 18 → 100.
5. **frag_a1_echo_get_back** — *"—seven, get back from it—"* The woman's voice from Act 1, matched at last: Jackie, in a corridor, eleven years ago, four minutes too late.
6. **A new entry.** The intake window. Fourteen hours that were never in Lou's case notes, recovered whole: the room, the consent form the player did not sign, the argument, the needle, the fire alarm that was not a fire, and Lou's face, and Lou's voice saying, exactly as gently as he says everything: *"I'm sorry. This is the kind version."*

And the Card, in the player's inventory, renames itself: **Custodian Key 7 — Anchor Zero.**

```hooks
cutscene: ch1_consolidation_revision (CutsceneDirector; ~30s; no input)
  6 ledger entries animate a text-diff + re-render in sequence
  Entry 2 MUST reuse the exact Act 3 vignette shot list with only the
    woman's face/hand re-rendered. No new camera angles. This is the promise.
  item_grey_card -> rename "Custodian Key 7"
flags_set: ch1_act6_truth_known, ch1_jackie_true_identity_known
```

#### Movement 4 — Too Late

The player turns around and Lou is already at the transport. Vane is already signing for the ledger. And the honest, terrible thing about this scene is that **nobody runs.** There is no fight. There is no chase. Lou stops at the door and looks back and gives the player the only answer he has ever had:

> "I was given a choice between your mind and four hundred million homes. I chose a third thing. You are alive, you are unhurt, you are standing in front of me, and every one of those homes still has power. I would like someone, once, to tell me what the better answer was." *(beat)* "You couldn't tell me eleven years ago either. That's not a taunt. I really did wait for it."

And the player cannot answer him, because the dialogue wheel offers four options and all four are variations on *"I don't know"* — the same shape as the Ashline scene in Act 4, deliberately, and the callback should land like a slap.

The transport leaves. The ledger goes with it. Sorrel is collected from Doc's care two hours later, "for her own safety," and she goes without a struggle because she is not stupid either, and the last the player sees of her is her looking back through the window with an expression that is not anger.

**And Jackie is in a Grove watch-house.** Because the player reported her in Act 4. She has been there since. She has not said one word in her own defence in nine days, because she still cannot say the sentence, because the compound is still in the player's blood.

#### Movement 5 — The Reconciliation

The player walks to the watch-house. This is the last scene of the chapter and it should be small, and quiet, and mostly the player listening.

Jackie doesn't do a speech. She asks one question first — **"Did he take it?"** — and when the answer is yes, she closes her eyes for a second and then gets practical, because that's who she is.

Then she explains, finally, at last, at the wrong end of everything: the eight hours, the facility, the dose she got there too late to stop, the eleven months of tea, the two attempts to tell him directly and what the compound did both times, and the plan.

> "I could have told you on day one. You'd have believed me for about a week, and then the Stillwater would have made me a liar in your own head, and you'd have walked to him on your own anyway — except angrier, and alone. So I fed you the cure and I let you hate me on your own schedule. That was the plan. That was the whole plan. It wasn't a good one."

And then the thing that actually hurts, delivered without self-pity:

> "I'm not owed an apology. I'd have done the same in your shoes with the same memories, and I'd have done it faster." *(beat)* "But I'd like to get out of this room, because they've got a two-day head start and I know where that transport goes."

**The player's final choice.** Three branches, all of them costly, all carried into Chapter 2:

| Branch | The player does | Immediate cost | Chapter 2 consequence |
| --- | --- | --- | --- |
| **Confess** | Stands up in front of the Grove and tells them everything — who they are, what they built, what they just gave away | The Grove's safety. The Collective now has a public target and the Grove is it. Some NPCs leave. | The Grove becomes a faction with a stake. Jackie freed publicly. Rook opens a door. Highest long-term trust, highest exposure. |
| **Contain** | Says nothing publicly. Gets Jackie out quietly. Goes after the transport with TT. | The Grove never learns what happened and the player has to keep lying to people who love them. | TT alignment. Fast start on the pursuit. The Grove is safe and the player is alone in it. |
| **Bargain** | Goes to Vane and takes the offer — credentials, a lab, resources, and a seat at the table where the shutdown gets planned | Jackie stays in the watch-house. Sorrel stays in Collective custody. The player becomes the thing they were trying to expose. | Inside access. Real ability to shape the shutdown. Every ally earned in Chapter 1 becomes a liability or an enemy. |

None of these is the "good" ending. Do not mark one as canon.

**Final shot of the chapter,** identical in all three branches: the player standing at the Grove fence line at dusk, and the Card is warm, and three hundred metres out a new Fracture Gate opens — bigger than either of the ones they walked through — and it does not close.

Cut to title: **Chapter 2.**

```hooks
quests:
  ch1_a6_q01_the_case          (Lou + Vane; full argument; no time limit)
  ch1_a6_q02_the_handover      (PLAYER ACTION; confirm prompt; oath reminder)
  ch1_a6_q03_consolidation     (cutscene ch1_consolidation_revision)
  ch1_a6_q04_too_late          (Lou departure; 4x "I don't know" wheel)
  ch1_a6_q05_the_watch_house   (Jackie; full truth; FINAL CHOICE)
final_choice_flag: ch1_ending { confess | contain | bargain }
carry_forward:
  ch1_hallr_choice, ch1_iris_rescued, ch1_marrow_saved,
  ch1_jackie_trust, ch1_lou_trust, ch1_rook_token,
  augur9_alive (bool), ch1_testimonies_collected (0..12)
flags_set: ch1_complete
epilogue_gate: spawn ch2_gate_prime, persistent, non-enterable in ch1
```

---

## 10. The Misdirection Ledger

Every deception in Chapter 1, what supports it, and where it pays off. **This table is the chapter's QA checklist.** If a row cannot be defended on replay, the row is a cheat and gets cut.

| # | What the player believes | Planted | Supported by | Why it's fair | Paid off |
| --- | --- | --- | --- | --- | --- |
| 1 | Jackie rescued me | Act 2 | 12 testimonies | True in fact, and the player is *right*, just not in the way they'll later think | Act 4 (inverted), Act 6 (restored) |
| 2 | Jackie took me | Act 3 | Same 12 testimonies, reassembled | Reconstruction is a documented confabulation; Doc warns in Act 2 | Act 6, revision #3 |
| 3 | Lou rescued me from a fire | Act 2 | Overlay fragment; Lou's case notes | **Literally true.** He did carry the player out. | Act 6, revision #1 — same act, new context |
| 4 | Jackie tried to inject me | Act 3 | Playable Reconstruction, 91% | Every frame literally happened; only the assembly is wrong | Act 6, revision #2 — same shot list |
| 5 | Jackie is drugging me | Act 4 | Latent Skill flags it; 22 used vials; Doc's analysis; Teak's evasions | **She is.** Every piece of evidence is accurate. | Act 5 (it's helping), Act 6 (it's the cure) |
| 6 | Lou is impartial about Jackie | Act 4 | He explicitly declines to accuse her | He never lies; he omits one organization | Act 6 |
| 7 | Lou's case notes are complete | Act 3 | They are honest, detailed, unflattering | The player is given the document and can re-read it any time | Act 6, revision #6 — the missing 14 hours |
| 8 | The Collective found me because Lou told them | Act 6 | Reasonable inference | **False.** Calla Ashe's incident report did it. Lou actually protected them. | Act 6 — and it makes Lou *worse*, not better |
| 9 | Publishing is obviously right | Acts 1–5 | Genre expectation | Vane's arithmetic is real and never refuted | Act 6 — deliberately unresolved |
| 10 | I am the protagonist and will fix this | Whole chapter | Genre expectation | — | Act 6. No. |

### 10.1 The three fairness rules

1. **Playbacks never lie.** Every recording is accurate. Only Reconstructions confabulate, and the player is told this in Act 2 in plain clinical language.
2. **No invented frames.** A revised Reconstruction may only re-render what was already on screen. It may not add a shot, a line, or an angle. Revision #2 (the corridor) is the acid test: reuse the exact Act 3 shot list.
3. **The truth is always physically present.** The buried name in Act 5, Coretta's dates, Lou's missing intake window, the 22 vials at one-per-fortnight — all of it is checkable before the reveal. Roughly 10–15% of players should solve this chapter early. That's the target, and those players are the chapter's best marketing.

---

## 11. Gazetteer — Where Chapter 1 Happens

### 11.1 The Grove (hub)

| Place | Anchor | Chapter 1 use |
| --- | --- | --- |
| Jackie's post / road-house | `496, 71, -126` | Home base. Waking, tea, sleep fragments, Act 4 search, Act 6 emptiness |
| Fountain Lesson Board | `494, 71, -129` | Act 1 tutorial spine |
| Taye's sign post | `491, 71, -124` | The Naming Scene |
| Billy | `500, 71, -140` | Emotional baseline; provisioning comedy |
| Kit's mail stand | `504, 71, -118` | Act 2 packet; Act 5 letter |
| Grove Wishing Well | `490, 54, -148` | Optional; a testimony and a very good echo |
| Old Grove Road Post | `500, 71, -140` | Prologue tie-in |
| Muckwad Patch | `512, 71, -152` | Prologue tie-in; retconned sample evidence |
| Broken Safe-Zone Fence | `514, 71, -198` | **Act 1 close — first gate**, and the final shot of the chapter |
| Crossroads Service Tower | `498, 71, -216` | Provisioning; Davi, Patsy, Richard testimonies |
| Mosslawn Song Stones | `468, 71, -250` | Act 4 — `ls_anchor_read` unlock; Sil |
| Ranger Jane | `450, 71, -260` | Containment argument; Dungeon 2 provisioning check |
| Shutter Cove Photo Marker | `560, 71, -182` | Dimmi; Card-warmth correlation; era-sorting lore cache |
| Lovely Locks Mirror | `407, 71, -126` | Emily; Iris's post-chapter home |
| Grove Supply Chest / Garden Gate | `496, 54, -138` / `502, 54, -145` | Provisioning storage |

### 11.2 The wider map

| Place | Anchor | Chapter 1 use |
| --- | --- | --- |
| **Old Wood Copse** | `640, 57, -455` | **Act 2 close — persistent gate.** Dungeon 1 entrance at ~`648, 57, -462` |
| **Greenlamp Walk-In Clinic** | `656, 65, -182` | Lou's base. Doctor Hana Greenlamp. Face-trigger overlay |
| **Ashline Containment Works** | `674, 67, -44` | **Act 4 set piece.** Refinery intake `674, 67, -56` |
| **Returnstone Pad Office** | `41.9, 41, -30.1` | Arbiter Vane's arrival; the Act 6 transport |
| **Lanternrest Road Inn** | `605.6, 48, -483.8` | The scheduled sleep-fragment channel |
| **Muck-Scarred Helix** | `232, 54, -506` | Far anchor-field edge. **Dungeon 2 gate** |
| **Harthmere Bridge Center** | `904, 71, -209` | Rook. Closed all chapter. The border of the argument |
| **Eastgate Portal Office** | `1578, 66, -136` | Optional: portal link-drift side content, Collective texture |
| **Glassyard Biome Studio** | `1183, 46, 138` | Optional: "designer who builds paradise and rents a room" |
| **Biome anchor leak** | `766, 63, 27` | Optional: the clearest non-dungeon evidence of anchor stress |
| **Rat Crown's Den** | `418, 53, -237` | Optional: Teak's TT dead-drop |

**Hard placement rule:** no Fracture Gate spawns at any position with `x > 904` (Harthmere side of the bridge). Add a test.

```hooks
test: gates_never_east_of_bridge
  for every gate spawn definition in ch1: assert anchor.x < HARTHMERE_BRIDGE_CENTER.x
  rationale: Harthmere uses no Exotic Matter, therefore has no anchors,
             therefore has no Mouths. This is a story-critical invariant.
```

---

## 12. Pacing

| Act | Hours | Gates | Combat load | Fragments | Trust: Jackie / Lou |
| --- | --- | --- | --- | --- | --- |
| 0 Prologue | 1.5–2 | — | Tutorial | 0 | 55 / — |
| 1 Confusion | ~2 | Sighting | Very light | 2 | 60 / — |
| 2 Formation | ~3 | Persistent opens | Light | 4 | 65 / 40→60 |
| 3 Fragmented | ~4 | **Dungeon 1** | Heavy | 6 | 45 / 70 |
| 4 Recognition | ~3 | — | Medium | 5 | **15** / **85** |
| 5 Reconstruction | ~4 | **Dungeon 2** | Heavy | 7 | 20 / 80 |
| 6 Consolidation | ~1.5 | Epilogue gate | **None** | 6 (revisions) | — |

**Total: 19–21 hours** for a thorough player; ~12–14 hours critical path.

**Deliberate rhythm choices:**
- Act 6 has **zero combat.** After two dungeons, the climax being entirely conversation is the point.
- Fragment delivery goes to **zero** for the back half of Act 4. Silence is a pacing instrument and we've earned it by then.
- Both dungeons are preceded by mandatory economy work. This is not padding — it is the chapter's argument that the world runs on people doing jobs.

---

## 13. Implementation Summary

### 13.1 New systems required

| System | Scope | Notes |
| --- | --- | --- |
| **Fragment Ledger** | Journal tab; 30 fragments; confidence; linking; revision | Reuse `harthmere_native_hotbar_and_journal` patterns |
| **Fragment triggers** | 7 trigger classes | Object/place/sound reuse existing F-interaction + proximity authority |
| **Latent Skills** | 4 abilities, no tree, pre-mastered | New; small |
| **Auggie core charge** | Consumable resource on a follower NPC | Reuse `escort_companion_npc_ecs` |
| **Fracture Gates** | Spawn, persist, collapse-timer, one-way entry, provisioning check | New; the biggest engineering item |
| **Dungeon instancing** | 2 dungeons × 7 zones, no-merchant/no-rest enforcement | Extend Bellward Halls patterns |
| **Attrition resources** | Water/heat (desert), fuel/cold (winter), carry-weight ice failure | Extend `native_vitals` + `native_vitals_environment` |
| **Revision cutscene** | 6 animated ledger diffs | `CutsceneDirector`; see `docs/cutscenes.md` |
| **Testimony collection** | 12 entries → generates a false Reconstruction | Small |

### 13.2 Server-authority notes

Given the live-mode write/read history in this codebase, three things must be **server-authoritative and never client-trusted**:

1. `fragment.truth` — never sent to the client under any circumstance. The client receives rendered fragment content only.
2. Dungeon provisioning checks and no-resupply enforcement.
3. `ch1_ending` and all carry-forward flags.

### 13.3 Files as built

```hooks
SHARED DATA / LOGIC
  src/shared/harthmere/ch1_ids.ts              anchors, entity ids, flags, tracks
  src/shared/harthmere/ch1_fragment_ledger.ts  fragments, linking, revision
  src/shared/harthmere/ch1_latent_skills.ts    4 pre-mastered skills, containment
  src/shared/harthmere/ch1_fracture_gates.ts   gates, dilation, provisioning
  src/shared/harthmere/ch1_dungeons.ts         both dungeons, 7 zones each
  src/shared/harthmere/ch1_dungeon_terrain.ts  canonical voxel terrain (23 volumes)
  src/shared/harthmere/ch1_dungeon_decor.ts    prop interiors + memory budget
  src/shared/harthmere/ch1_elsewhen_region.ts  the unreachable warp-only band
  src/shared/harthmere/ch1_cast.ts             new cast + 12 testimonies
  src/shared/harthmere/ch1_items.ts            the Card, both compounds, etc.
  src/shared/harthmere/ch1_quests.ts           every quest, acts 1-6
  src/shared/harthmere/ch1_chapter.ts          act gating, run lifecycle, endings,
                                               Hallr-choice recording
  src/shared/harthmere/ch1_augur9.ts           core charge: spend/recharge/loss
  src/shared/harthmere/ch1_party.ts            MMO party runs, solo beats
  src/shared/harthmere/ch1_engine_contracts.ts ECS/Anima/Gaia rules, checkable

CUTSCENES (built on the existing generator)
  src/shared/cutscene/ch1_scenes.ts            16 scenes incl. the revision seq.

SERVER (truth never crosses the wire)
  src/server/harthmere/ch1_fragment_authority.ts

CLIENT
  src/client/game/renderers/ch1_fracture_gate_material.ts   portal shader
  src/client/game/renderers/ch1_fracture_gate.ts            portal renderer

TESTS  (84 passing)
  src/shared/harthmere/test/ch1_chapter.test.ts
  src/shared/harthmere/test/ch1_gate_visual.test.ts
  src/shared/cutscene/test/ch1_scenes.test.ts
  src/server/harthmere/test/ch1_fragment_authority.test.ts

TYPECHECK
  tsconfig.ch1check.json      fast; everything except the client renderer
  tsconfig.ch1renderer.json   slow/incremental; the renderer
  # ts-node is transpileOnly+swc — `./b test` does NOT typecheck.
```

### 13.4 The Elsewhen band (dungeon isolation)

Dungeon interiors are not "somewhere far away with a wall around it." They are
in a reserved world band with **no walkable connection to anything**, following
the same additive recipe Harthmere used:

```
snapshot production terrain : X 0    .. 1792
Harthmere additive town     : X 1792 .. 2560
VOID GAP — no terrain, ever : X 2560 .. 2624
Elsewhen dungeon band       : X 2624 .. 3648   (2 slots x 512 wide)
```

The 64-block gap is a full shard wider than any shard, so no terrain shard can
straddle it: there is no surface to walk, nothing to place a block against, and
no chunk to stand on. Even a movement-cheating client has nothing to collide
with. On top of that, `ch1AdmitToElsewhen` rejects any player in the band who
does not hold an active run **for that exact slot** and evicts them to the
Grove. Entry is a server-validated warp; exit is the far anchor.

### 13.5 Portal visual

`ch1_fracture_gate_material.ts` is a self-contained `THREE.ShaderMaterial`
(deliberately outside the `.fs/.vs/.material.json` codegen pipeline, since the
gate is fully emissive and needs no engine lighting integration).

Design decisions worth keeping:

- **Vesica, not a circle.** Circles read as "portal" — a friendly videogame
  doorway. Two arcs meeting at points read as something *split*.
- **The interior scrolls inward.** Things fall into the past.
- **Chromatic rim split.** Red and blue edges diverge, because the aperture is
  not focusing time cleanly. This is the single cheapest thing that makes a
  gate look wrong rather than magical.
- **Normal blending, not additive.** Additive washes out the deep interior and
  makes the Mouth look welcoming. The centre must stay genuinely dark.
- **Per-gate seed.** No two Mouths breathe together, and the one that doesn't
  close in the epilogue runs at `instability: 1.0` and is visibly worse.
- **Monotonic open curve.** The "tear" punch is delivered by the shader's
  intensity flash, not by pushing the silhouette past 1 — a bouncing aperture
  reads as rubbery, and a non-monotonic close makes a collapsing gate flicker.

Era palettes are data (`CH1_GATE_PALETTES`); adding a third era is a palette
entry, not a shader change.

### 13.6 Dungeons as canonical terrain

The first pass authored both dungeons as pure narrative data — zones,
encounters, retrievals — with no voxels behind any of it. That violates the
snapshot map guide's Rule 3: *"If players can stand on it, collide with it,
climb it, harvest it, or see it on the map, it must be canonical data."*

`ch1_dungeon_terrain.ts` now builds them for real, using the same shape as the
existing Harthmere underground (`HARTHMERE_DUNGEON_AREAS` +
`harthmereDungeonBlockAt` + `harthmereShouldCarveDungeonAirBlockAt` in
`src/server/shim/main.ts`) so the seeder consumes it with the code path it
already has:

- **Volumes** — 12 (desert) and 11 (winter), each with shell, floor, headroom,
  and an explicit `openAir` flag for exteriors.
- **Cuts** — doorways punched through shells, minimum 3 tall, validated to sit
  on a real wall of *both* volumes they claim to connect.
- **Water** — `shard_water` bodies with real basin floors under them, not
  decorative planes (recipe Step 6).
- **Stairs** — every vertical transition greater than one block has one
  (recipe Step 5). No jumps, no falls, escort-width minimum.
- **Shard specs** — `ch1DungeonShardSpecs()` enumerates every shard the
  dungeon touches, for the seeder's spec list.

Authored coordinates are **local** and converted once by
`ch1DungeonAuthoredToWorld()`. Recipe Step 1: do not scatter offsets, and never
apply one twice. There is a test for exactly that.

**Layer split.** Per the building guide, voxels own only shell, floor, roof,
stairs, doorways, windows, and water basins. Furniture is runtime props
(`ch1_dungeon_decor.ts`) with **non-blocking collision** — a blocking prop in a
one-way dungeon with an escorted NPC is a soft-lock, so the validator rejects
any prop within clearance of a doorway.

**Edge cases the validators catch** (each of these was a real bug in the first
draft of the layout, found by writing the test):

| Failure | Why it matters |
| --- | --- |
| Doorway between volumes with non-overlapping Y | Opening lands in solid rock at one end |
| Doorway not on either volume's wall | Punches a hole into rock, leads nowhere |
| Volume unreachable from arrival | Soft-lock in a one-way gate |
| Exit volume unreachable | The player is trapped |
| Height change > 1 with no stair | Player has to fall or jump; escort cannot follow |
| Water with no basin floor | Drains into the void |
| Volume escaping its slot | Two dungeons see each other's terrain |
| Headroom < 3 | Camera clips; player cannot stand |
| Prop with no support | Floating furniture |
| Prop blocking a doorway | Soft-lock |
| Enclosed zone with no light prop | Black box navigated on carried torches |

### 13.7 Art assets — nothing new was needed

Audited `public/assets/harthmere/` before sourcing anything. The existing packs
cover both eras well enough that adding downloads would have been noise:

| Pack | Count | Chapter 1 use |
| --- | --- | --- |
| `church_cemetery` | 84 obj | Catacomb walls, pillars, crypts, candelabra, skulls, bells — reads as a Bronze Age temple undercroft *and* a Norse grave-hall unmodified |
| `tavern` | 84 obj | Kegs, shelves, tables, stools, torches, fireplace — the longhouse and Sorrel's camp |
| `medieval_voxel` | 53 obj | Lamps, banners, bridges, towers |
| `itch_voxel_asset_pack` | ~25 vox | Braziers, crates, market stalls, gravestones, torches |

Every asset referenced by `ch1_dungeon_decor.ts` is checked against the
filesystem by test, so a missing file fails CI instead of rendering nothing.

**The one genuine gap** is era-specific dressing: no sand/palm/bronze props for
the desert, no Norse-specific carving for the fjord. Both currently borrow from
the church and tavern packs, which works because the dungeons are dark and
ruined. If that ever reads as generic, the right sources are the same CC0
vendors already wired into `scripts/generate-medieval-asset-manifest.mjs`
(Kaykit, Quaternius, Kenney) — add a pack entry there rather than a one-off
directory. I did not download several hundred MB of binaries into the repo
unprompted.

### 13.3 Open questions for the next pass

1. **Does the player's old name ever get spoken?** Current design says no — only the designation "Seven." Preserves player-chosen identity. Worth a playtest read.
2. **Multiplayer and the amnesia frame.** ~~Needs a decision before scripting.~~
   **DECIDED AND IMPLEMENTED** (`ch1_party.ts`): "your story, their world."
   Story state is per-player (like the existing per-player Bikkie challenge
   state); the world is shared; narrative singularity is diegetic — every
   player is "the" Custodian in their own telling, exactly as every player is
   already "the" bell-binder in the 85-quest bible catalog. Dungeons are
   party-instanced (1–4): every member's own story must have the gate open
   (no spoiler-carrying), every member provisions individually, one party per
   slot, death = wake at the arrival anchor (never an exit), leadership
   transfers on disconnect, last-out ends the run and evicts stragglers, and
   story credit lands only on members whose own chapter earned it. Five beats
   are solo-only (`CH1_SOLO_BEATS`), Sorrel's bar-slot conversation above all
   — she cannot discover that four people don't remember her at once.
3. **Dungeon 1 party scaling** — the Gilded Bull's stealth bypass doesn't survive four players. Needs a group variant.
4. **Hallr's choice** has no Chapter 1 consequence. It should visibly change something in the Grove epilogue or players will read it as fake.
5. **The buried name in Act 5** — mix level needs a real playtest. Target: ~10–15% catch rate on headphones.
6. **Marrow the dog must be unkillable.** Non-negotiable. Flag it in review.

---

*End of Chapter 1 writer's journal, draft 1.*
