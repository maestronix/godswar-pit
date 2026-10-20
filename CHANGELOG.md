# Changelog

All notable changes to Godswar Pit are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/).

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
