# Godswar Pit

**Climb to become a god.**

A browser based idle-roguelike. You are a champion of Ashvale who is thrown
into the Godswar Pit, climbs a tree of rooms, fights everything that stands in
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

* **The pit tree** - every run is an ascending tree of rooms. The type and the
  risk of every room are visible, the content is not. Picking the next room
  is the only active decision in a run. If you do nothing for three seconds,
  the **steward** picks for you.
* **Death rules** - your six equipped items stay with you, everything else you
  picked up in that run rots, and the skill points you earned are gone. The
  legacy (souls, divine echo, inheritance, thrones, achievements) is never
  lost.
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
  sim/      the deterministic simulation (engine, combat, loot, tree, policy)
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

- [ ] Start a run, pick a room, fight, die - the report appears.
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
