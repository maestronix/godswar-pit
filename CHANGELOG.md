# Changelog

All notable changes to Godswar Pit are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/).

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
