# Changelog

All notable changes to Godswar Pit are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.2.0] - 2026-10-20

### Changed

- **The pit is a path, not a tree.** At the entrance the player picks one of
  three paths - *The Ash Road*, *The Shrine Way* or *The Gilded Road* - and the
  hero walks exactly that path up to the throne. There is no second choice
  after a cleared room any more: the path is the decision of a run. The type
  and the risk of every room of every path are visible before the player
  commits, the content of a room is only rolled when the hero enters it.
- **Healing rooms instead of auto heal.** The hero does not regenerate life
  between the rooms any more. The shrines on a path heal 40 % of the maximum
  life and cost 10 % of the souls of the run - the Shrine Way carries three of
  them, the Gilded Road only one. That is the trade of a run.
- **The decisions of the player are worth making.** The event dialog stays
  open for 30 seconds (it used to vanish after three), the path of the run
  stays open for 15 seconds, and the dialog is not rebuilt every frame any
  more - the click of the player is not swallowed between two frames.
- **Every room has its own decision window again.** The timer of a decision no
  longer runs through the fight of the room before, so the promised three
  seconds are really three seconds.
- The steward picks a path when the player does nothing. The policy sliders
  decide which one: a wounded hero gets the shrines, a healthy one the loot.

### Fixed

- **A run could get stuck for ever.** The trap anomaly of the ascension
  (*Loose Floor*) cleared the room it hit - and in the throne room that meant a
  run without a way out: the hero stood there in the state "ascending" for
  ever, without dying, without winning, without souls and without loot. The
  trap only hurts the hero now, the room still has to be fought. A run that
  ends up in a room without a way out ends as a death instead of hanging.
- A fight that never ends (the regenerating dead of the pit) ends the run
  instead of lasting for ever.
- A choice that does not exist any more no longer leaves the run in a room
  without a way out.
- The report of a finished run is not blocked by an open event dialog any
  more.
- The magnitude of the trap anomaly is the chance that a room gives way now
  (7 % in the first series) and not "every second room".
- A trap can kill the hero again - the life was clamped to 1 before.

### Save

- The save format is version 3. A run that was interrupted when the update
  happened is dropped, because the layout of the rooms changed. The permanent
  progress (souls, echo, inheritance, thrones, achievements, gear) is not
  affected.

## [0.1.1] - 2026-10-20

### Fixed

- **The pit tree is readable and complete again.** The layout used the column
  position of a node in a different unit than the renderer expected, so the
  left column of the tree was cut off and the whole tree was blown up to
  three times its size - only four of twelve rooms were visible at a time.
  The column is now the index of the room inside its layer, the viewBox is
  built from the real bounds of the tree and the SVG scales itself into the
  panel: every room of the climb is visible at once, at a readable size.
- **The tree reacts to the run.** The panel was drawn once when the screen
  opened and never updated, so after the first click the highlighted rooms
  were stale and further clicks did nothing. The tree is now redrawn
  whenever the state of the run changes.
- **The skill tree nodes no longer overlap.** The effect of a node and its
  price were drawn on the same line; both have their own line now.

### Added

- **The next rooms are unmistakable.** They glow gold, carry a `NEXT` marker
  and the name of the room, and the panel tells the player what to do
  ("Click a glowing room to climb. The steward picks one for you after 3s.").
- **The rooms can be picked with the keyboard.** The clickable rooms are
  focusable, announce themselves as buttons and react to Enter and Space.
- **Regression test for the tree** (`tests/tree-panel.test.ts`): no room may
  lie outside the viewBox and the clickable rooms must match the rooms the
  player may enter.

## [0.1.0] - 2026-10-20

The first playable version. Everything is static, runs in the browser and is
published with GitHub Actions.

### Added

- **The pit tree** - every run is an ascending tree of 12-16 rooms. The type
  and the risk of every room are visible, the content is rolled when the hero
  enters. Picking the next room is the only active decision; after three
  seconds the steward takes over.
- **Deterministic simulation** - xorshift128 with separated streams for loot,
  crits, spawns and events. The same seed always produces the same run, live
  or in the offline fast-forward. `tests/determinism.test.ts` is the gate.
- **Six classes** - Bladewalker, Ashmonk, Pitsorcer, Ironpriest, Plagueborn
  and Soulbinder, each with a signature skill, four actives, eight passives,
  three skill trees, runes and weapon bases.
- **540 skill tree nodes** generated from twelve archetypes with hard budget
  rules (max three multiplier stacks, a multiplier budget of 3.0 per tree, at
  most 40 active nodes, no cycles).
- **Items** - six slots, five rarities, 16 affixes with a name generator, 26
  aspects, a codex, a vault with an auto-scrap rule and a smithy (recraft,
  respec, aspect reroll).
- **Ten zones** with 100 enemies, ten thrones and their automation, and the
  ascension at rank 10.
- **Meta progression** - Grace Mirror (60 nodes, echo), Inheritance Tree
  (80 nodes, inheritance) and the class trees (souls).
- **Hub** - contracts with a ten chapter story chain, smithy, envoy, grace
  mirror, market and a seven day login bonus.
- **Offline simulation** - up to 200 000 ticks are really simulated in
  chunks, everything beyond that is extrapolated at 50% efficiency and marked
  as an estimate in the return report.
- **70 achievements** in eight categories with real rewards.
- **Procedural art and audio** - no image or sound files, everything is drawn
  or synthesised at runtime.
- **Save system** - one localStorage slot, autosave every 10 seconds, export
  and import as Base64, versioned schema with migrations.
- **Tools** - `npm run balance` simulates complete runs with the real engine
  and prints a report, `npm run gen:trees` regenerates the skill trees.
- **Deployment** - GitHub Actions workflow that tests, builds and publishes
  to GitHub Pages.
