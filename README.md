# Godswar Pit

**Climb to become a god.**

A browser based idle-roguelike. You are a champion of Ashvale who is thrown
into the Godswar Pit, walks a path of rooms, fights everything that stands in
the way and either dies or takes a throne. Your gear survives your death, your
loot does not, and your legacy (Inheritance) is forever.

Everything runs in the browser. There is no server, no account, no download.
The whole game is a few hundred kilobytes of static files.

---

## Play it

The finished game is hosted on GitHub Pages. Open the URL and start playing -
your progress is stored in the browser (localStorage) and never leaves your
machine.

## Run it locally

You need [Node.js](https://nodejs.org/) 20 or newer (Node 22 is recommended).

```bash
npm install     # once - downloads the build tools
npm run dev     # starts the game on http://localhost:5173 with auto reload
```

Other commands:

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server (auto reload). |
| `npm run build` | Type check and build the final files into `dist/`. |
| `npm run preview` | Serve the built `dist/` folder - this is the local Pages test. |
| `npm run test` | Run all automated tests (Vitest). |
| `npm run typecheck` | Check the types without building. |
| `npm run balance` | Simulate 1000 runs per class and print a balance report. |
| `npm run gen:trees` | Regenerate the 540 skill tree nodes from the archetype rules. |

## Publish it to GitHub Pages

**Live:** <https://maestronix.github.io/godswar-pit/>

### The easy way

Double click **`deploy.bat`** in the project folder. It asks two questions
(your GitHub user name and the name of the repository), walks you through
creating the repository and pushes everything for you. At the end it prints
the address of your game.

To publish a new version later: run `npm run build`, commit and push (or
just run `deploy.bat` again). The workflow on GitHub rebuilds and republishes
the game automatically. If you only changed the content and want to publish
without a new commit, run `npm run redeploy`.

### The manual way

You only have to do this once:

1. Create an **empty** GitHub repository (no README, no `.gitignore`).
2. Push this project to it (see below).
3. In the repository go to **Settings -> Pages -> Build and deployment ->
   Source** and choose **GitHub Actions**.
4. Every `git push` to `main` now builds and publishes the game.

The URL is then `https://<your-user>.github.io/<your-repo>/`.

The build uses `base: './'`, so the game also works when the repository sits
in a sub folder.

```bash
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

If you have the GitHub CLI installed, the agent can create the repository for
you: `gh repo create gottergraben --public --source . --push`.

**Fallback without Actions:** build the game and push the result into a
`gh-pages` branch - the repository settings then have to point Pages at that
branch instead of at GitHub Actions:

```bash
npm run build
git subtree push --prefix dist origin gh-pages
```

---

## How the game works

```
Ashvale (hub)  ->  build your loadout  ->  descend into the pit
      ^                                              |
      |                                              v
   legacy  <-  death / throne  <-  automatic combat  |
```

* **The paths of the pit** - every run is a single path. At the entrance you
  pick one of three paths - the Ash Road, the Shrine Way or the Gilded Road -
  and the hero walks exactly that path up to the throne. The type and the risk
  of every room are visible before you commit, the content is not. There is no
  second choice after a cleared room: the path is the decision of a run.
* **Healing rooms instead of a free ride** - the hero does not regenerate life
  between the rooms any more. The shrines on the path heal 40 % of the maximum
  life, but they cost 10 % of the souls of the run. The Shrine Way has three of
  them, the Gilded Road only one - that is the trade.
* **The steward** - if you do nothing, the steward decides for you: after 15
  seconds it picks a path, after 30 seconds it answers an event. Both windows
  are long enough to read the text first.
* **Death rules** - your six equipped items stay with you, everything else you
  picked up in that run rots, and the skill points you earned are gone. The
  legacy (souls, divine echo, inheritance, thrones, achievements) is never
  lost. The souls of a run are always paid out - the loot only survives a
  claimed throne.
* **Ascension** - after all ten thrones you can become a god. The pit gets
  harder, the enemies get stronger, and you keep 25% of your divine echo
  (plus 5% per inheritance you sacrifice).

See `docs/PLAN.md` for the full design and `docs/OPEN-QUESTIONS.md` for the
open points.

---

## Project layout

```
src/
  core/     rng, time, math, formatting, events
  sim/      the deterministic simulation (engine, combat, loot, routes, policy)
  state/    save schema, migrations, localStorage store, contracts, offline
  data/     ALL content as JSON + the node archetype system
  art/      procedural pixel art (sprites, tiles, palette, particles)
  audio/    procedural sound and music (no audio files)
  ui/       the screens (hub, run, trees, inventory, achievements, ...)
tests/      the automated tests
scripts/    content generator and balance tool
docs/       plan, open questions, decisions
```

The most important rule in this codebase: **the simulation is deterministic.**
The same seed and the same inputs always produce the same result, no matter
whether the game is played live, simulated offline or measured by the balance
tool. `tests/determinism.test.ts` is the gate that keeps that true.

---

## Manual test checklist

- [ ] Start a run, pick a path, fight, die - the report appears.
- [ ] The path of the run can only be picked once - the hero walks it to the end.
- [ ] The life of the hero does not regenerate between the rooms - a shrine heals.
- [ ] Your equipped items are still in your inventory after the death.
- [ ] The loot of the run is gone, the souls are on your account.
- [ ] Reload the page - the run continues where it left off.
- [ ] Stay away for an hour, come back - the return report shows kills,
      souls and the cause of death.
- [ ] Buy a node in a skill tree - the numbers change.
- [ ] Recraft an item, reroll an aspect, respec the tree.
- [ ] Claim a contract, collect the login bonus, buy a potion.
- [ ] Export the save, import it again - everything is still there.
- [ ] Push to GitHub and open the Pages URL (root and sub path).
- [ ] Check the layout on a tablet width.
