# GODSWAR PIT — Content Decisions

Companion to [`PLAN.md`](./PLAN.md) and [`OPEN-QUESTIONS.md`](./OPEN-QUESTIONS.md).
This file records the design decisions behind the content created in this pass:
thrones, contracts, anomalies, events, achievements and the two meta trees.

| File | Shape | Size |
|---|---|---|
| `src/data/thrones.json` | array of `ThroneDef` (no `id` field) | 10 |
| `src/data/contracts.json` | array of `ContractDef` | 18 (8 rolling + 10 story) |
| `src/data/anomalies.json` | array of `AnomalyDef` | 31 (5 series) |
| `src/data/events.json` | array of `EventDef` (3 choices each) | 12 |
| `src/data/achievements.json` | array of `AchievementDef` | 70 (8 categories) |
| `src/data/meta/grace-mirror.json` | single `TreeDef` | 60 nodes |
| `src/data/meta/inheritance-tree.json` | single `TreeDef` | 80 nodes |

---

## 1. Thrones — feature keys

`ThroneDef.feature` is the automation key that the automation system checks. The key is
lowercase, prefixed `throne_`, and describes **the mechanic the rank unlocks** — not the
rank itself. Every key is unique so a single `Set` of unlocked features describes the
automation state of a save.

| Rank | Name | Feature key | Mechanic unlocked | Zone | Bonus | Inheritance |
|---|---|---|---|---|---|---|
| 1 | Pitling | `throne_automation` | Expedition continues once after you return | 1 | damagePct +3% | 1 |
| 2 | Ash-Seer | `throne_preview` | Loot rarity preview for the next fights | 2 | critChance +1% | 0 |
| 3 | Twin-Diggers | `throne_parallel_2` | 2 expeditions in parallel | 3 | soulYieldPct +3% | 0 |
| 4 | Ironfist | `throne_auto_equip` | Vault auto-equips the best items | 4 | maxHpPct +4% | 1 |
| 5 | Godservant | `throne_manager` | Manager picks nodes by your policy | 5 | cooldownReduction +2% | 0 |
| 6 | Soulcounter | `throne_soul_counter` | Souls accrue without a running expedition | 6 | soulYieldPct +4% | 0 |
| 7 | Runebinder | `throne_rune_binder` | Aspects are auto-rerolled at the forge | 7 | armorPct +3% | 1 |
| 8 | Shadowlord | `throne_shadowlord` | Automatic scouting / zone rotation | 8 | aoePct +3% | 0 |
| 9 | Divine Voice | `throne_divine_voice` | 3 parallel expeditions + real-time soul income | 9 | critChance +2% | 0 |
| 10 | The New God | `throne_regen` | The throne regrows souls forever; ascension unlocked | 10 | damagePct +5% | 1 |

Decisions:

- **Rank N is gated by zone N.** `zone` is the zone that must be cleared to claim the rank.
- **Inheritance every third rank** (1, 4, 7, 10) keeps the meta currency scarce while still
  rewarding early progress.
- **Bonuses are permanent and percentage based**, so they scale with the endless power curve
  without breaking the flat-stat economy. All `bonus.stat` values are valid `STAT_KEY`s.
- **Rank 10 is the ascension gate**; its description names the hollow throne, the key
  `throne_regen` is the endless idle income that starts with godhood.
- **`ThroneDef` has no `id`.** The file therefore contains no `id` field at all. The registry
  currently indexes thrones with `index(throneDefs)` (keyed by `item.id`) and looks them up
  with `throne_<rank>`; that lookup only resolves once the registry keys thrones by
  `throne_${rank}` (or once the def grows an `id`). This is an integration note for the
  registry owner — it was left untouched on purpose.

---

## 2. Contracts — metric semantics

`ContractDef.metric` selects the counter the hub evaluates. `params` are the parameters of
that counter; every placeholder in `description` is a key of `params`.

| Metric | Params used | Evaluated as | Rewards |
|---|---|---|---|
| `kill_count` | `zone`, `count` | Enemies killed in `zone` reach `count` | Souls, occasionally a potion |
| `reach_depth` | `zone`, `depth` | Depth `depth` reached inside `zone` | Souls |
| `find_rarity` | `zone`, `rarity`, `count` | `count` items of `rarity` found in `zone` | Souls, Inheritance, Echo |
| `earn_souls` | `souls`, `minutes` | `souls` souls earned within `minutes` | Souls, potion |
| `survive_runs` | `runs` | `runs` runs survived | Souls, potion |
| `ascend` | `zone` | A throne of `zone` is claimed | Souls + Inheritance |

Decisions:

- **8 rolling contracts** (`rolling: true`) cover all six metric types; they rotate in the
  CONTRACTS tab on a 24 h cycle.
- **10 story chapters** (`rolling: false`), `story_chapter_1` … `story_chapter_10`, use
  `metric: "ascend"` with `params: { zone: N }`. Each chapter unlocks zone N and always
  pays **1 Inheritance**; later chapters add potions and Echo. The story chain is therefore
  the guaranteed path to the ten thrones and to ascension.
- **Only real potion ids are referenced**: `wrath_elixir`, `ironroot`, `blade_oil`,
  `soulfog`, `blood_price`, `second_wind`.
- Reward sizes grow with the target zone so the story chain stays worth finishing.

---

## 3. Anomalies — kinds and scaling

Anomalies modify a run during an ascension (incarnation). `magnitude` is always a fraction
between 0 and 1 and its meaning depends on `kind`.

| Kind | Meaning of `magnitude` | Effect |
|---|---|---|
| `extra_elite` | probability | Chance that a combat node spawns one extra elite |
| `double_elite` | probability | Chance that elites spawn as a pair |
| `heal_enemies` | fraction per second | Enemies regenerate that share of their max HP |
| `trap_every` | fraction of nodes | Share of nodes that turn into traps |
| `enemy_damage` | fraction | Enemy damage multiplier |
| `enemy_hp` | fraction | Enemy health multiplier |
| `soul_tax` | fraction | Share of earned souls the pit takes |
| `fog` | fraction | Fog density / visibility loss |
| `cursed` | fraction | Curse severity (extra enemy damage and lost soul yield) |

Scaling per ascension series — one new series per ascension, five in total:

| Series | Anomalies | Magnitude range | Feel |
|---|---|---|---|
| 1 | 5 | 0.05 – 0.15 | Mild, mostly flavour (ash, taxes, a few elites) |
| 2 | 6 | 0.12 – 0.22 | Noticeable: enemies heal, elites appear more often |
| 3 | 6 | 0.20 – 0.32 | Cruel: paired elites, permanent dusk, hard tithe |
| 4 | 7 | 0.28 – 0.42 | Brutal: the gods' curse, bone walls of traps |
| 5 | 7 | 0.30 – 0.60 | Apocalyptic: the hollow throne itself fights back |

Decisions:

- Every series mixes at least one *spawn* anomaly (`extra_elite` / `double_elite` /
  `trap_every`) with at least one *stat* anomaly (`enemy_damage` / `enemy_hp`) so the
  difficulty is felt in different systems.
- Series 5 reaches 0.6 only for `trap_every` (the harshest swing for the player), all
  other magnitudes stay at or below 0.58.
- Ids are prefixed `anom_s<series>_<name>` so a series can be loaded or disabled as a block.
- Each series stays inside the 5–7 anomaly window, which caps the total at 31. `fog` is
  introduced in series 1 and escalated in series 3; series 5 instead spends its slots on
  the curses that hit the player's damage and income directly.

---

## 4. Events — choice structure

Each of the 12 events offers exactly three choices with a fixed risk grammar:

| Slot | Risk | Shape |
|---|---|---|
| Safe | 0 | No fight, no damage taken; small, reliable payoff |
| Gamble | 1–2 | Buff, loot or souls with a price (damage, max-HP loss) |
| Dangerous | 2–3 | Contains `{ kind: "fight", tier: N }` and the best loot / Echo |

Decisions:

- `tier` scales with the fight: early events use tier 2–4, the late ones tier 4–6.
- Buff effects always use a valid `STAT_KEY` and a duration in ticks (100 ms each).
- `hp`, `maxHp`, `damage` and `resource` effects are fractions of the hero's current /
  maximum values; `maxHp` may be negative (a permanent price for a good deal).
- `loot` uses `{ count, levelBonus }`: number of items and how many item levels above the
  zone baseline they roll.

---

## 5. Achievements — metric keys and rewards

70 achievements over 8 categories. The game evaluates the `metric` counter and compares it
to `threshold` (progress = `min(1, counter / threshold)`).

| Metric | Counter it reads |
|---|---|
| `kills` | Enemies killed (all time) |
| `boss_kills` | Bosses defeated (all time) |
| `deepest_run` | Deepest node depth reached in a single run |
| `nodes_visited` | Nodes of the pit entered (all time) |
| `items_found` | Relics found (all time) |
| `legendary_found` | Relics of legendary rarity or better found |
| `levels_reached` | Highest run level reached in a single run (run level caps at 20) |
| `souls_earned` | Souls earned (all time) |
| `offline_seconds` | Seconds spent away while the pit worked |
| `runs_survived` | Runs ended without death |
| `thrones_claimed` | Thrones claimed |
| `seasons_ascended` | Ascensions (inkarnations) completed |
| `aspects_collected` | Aspects recorded in the codex (26 exist) |
| `runes_unlocked` | Runes bound to skills (69 exist) |

Category distribution and milestone placement:

| Category | Count | Milestones (4th and 8th) |
|---|---|---|
| COMBAT | 10 | `Pit Slaughterer` (inheritance), `No Quarter` (inheritance) |
| DEPTH | 9 | `Abyss Walker` (inheritance), `Void Cartographer` (echo) |
| LOOT | 9 | `Vault Keeper` (inheritance), `Relic Bearer` (title) |
| META | 9 | `Grace Keeper` (echo), `Godslayer` (inheritance ×2) |
| IDLE | 8 | `Offline Pilot` (echo), `Ever-Watchful` (title) |
| COLLECTION | 9 | `Aspect Archivist` (inheritance), `Bound In Every Rune` (title) |
| SECRET | 8 | `The Long Quiet` (title), `Patient Blade` (pet) |
| DISCOVERY | 8 | `Treasure Hunter` (inheritance), `Cartographer of Ash` (title) |

Decisions:

- **Every fourth achievement in a category is a milestone** with a non-souls reward
  (inheritance, echo, title or pet). Ordinary entries pay souls scaled to their threshold.
- **The nine named achievements** are fixed by the brief: First Blood, Ruthless, Thousand
  Cuts (COMBAT), Descent (DEPTH), Ascendant, Godslayer (META), Collector (COLLECTION),
  Offline Pilot (IDLE), No Quarter (COMBAT).
- **All SECRET achievements are `hidden: true`** and only appear once unlocked.
- Cosmetic ids are `title_*` (`title_relic_bearer`, `title_codex_lord`,
  `title_ever_watchful`, `title_quiet`, `title_ash_cartographer`, `title_godslayer`) and
  `pet_shadowcat` — pure cosmetics, no gameplay effect.
- Thresholds are chosen against the real content: 26 aspects and 69 runes exist, so the
  "collect everything" achievements are reachable but not trivial.

---

## 6. Meta trees — budget compliance

Both trees are `classId: ""` (global) and follow the hard budget rules of
`src/data/nodes/archetypes.ts`:

| Rule | Limit | Grace Mirror | Inheritance Tree |
|---|---|---|---|
| Nodes per tree | – | 60 | 80 |
| Max ranks per node | 5 | 3 – 5 | 1 (ACCESS/RUNE) or 3 – 5 (VALUE) |
| MULTIPLIER `maxRank` | 3 | 3 | – |
| Σ (mult^maxRank − 1) per tree | ≤ 3.0 | **0.5730** | **0.0000** |
| Active nodes (MULTIPLIER, ACCESS, RUNE_UNLOCK, CONDITIONAL, COOLDOWN, RESOURCE, TRANSFORM, PIERCE, DURATION) | ≤ 40 | **3** | **38** |
| Depth | 1 – 8, strictly below the parent | 8 levels | 8 levels |
| Cost growth | – | 1.4 | 1.5 |

### Grace Mirror (Echo)

- Three pillar branches off one root: **Might** (damage, crit, AoE, DoT), **Vigor**
  (health, armor, dodge, resistance) and **Fortune** (souls, haste, cooldown, movement,
  resource regeneration). Each branch widens with depth: 1 → 3 → 6 → 9 → 12 → 12 → 9 → 8.
- 57 VALUE nodes (`{ stat, value }`, value 1 % – 8 % per rank) and **3 MULTIPLIER nodes**
  (`mult: 1.06`, `cap: 3`, `maxRank: 3`): `Wrath Echo` (damagePct), `Vital Echo`
  (maxHpPct), `Fortune Echo` (soulYieldPct).
- **Multiplier budget: 3 × (1.06³ − 1) = 0.5730**, far below the 3.0 cap, so the tree can
  never become a runaway damage spiral.

### Inheritance Tree (Inheritance)

- Root (`it_001`, "The Envoy's Table") plus one anchor per class, then six levels per
  class branch.
- **30 ACCESS nodes** unlock all 30 class skills permanently
  (`bw_signature` … `sb_a4`), one per node, `maxRank: 1`.
- **8 RUNE_UNLOCK nodes** bind a rune to a skill, `maxRank: 1`.
- **42 VALUE nodes** carry the small permanent boons (1 % – 4 % per rank).
- **Active nodes: 30 + 8 = 38 ≤ 40**, deliberately kept at 38 so that later content
  patches have two slots of headroom without a budget refactor.

### Rune ids

Rune ids must exist in `src/data/skills/*.json`, so the unlock nodes reference the real
runes of the class content. The planned flavour vocabulary maps onto the shipped runes as
follows:

| Flavour | Rune id used | Skill |
|---|---|---|
| flood | `bw_signature_flood` | Cleaving Arc |
| storm | `bw_a1_storm` | Whirlwind |
| quake | `am_a1_quake` | Palm Burst |
| venom | `am_a3_venom` | Serpent Strike |
| frost | `ps_a1_deepfreeze` | Frost Nova |
| ember | `ip_a3_pyre` | Consecrated Blade |
| shadow | `pb_a3_shadowfang` | Twin Fang |
| chain | `sb_a1_swarm` | Shadow Wisp |

Two flavours of the planned vocabulary (`holy`, `rage`) have no counterpart in the shipped
skill data; they can be added later as new runes without touching the tree structure.
