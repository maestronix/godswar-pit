# GODSWAR PIT — Idle-Roguelike (16-Bit) für GitHub Pages

> **Projektordner:** `C:\Users\georg\Desktop\coding\gottergraben\`
> **Projektkopie dieser Datei:** `C:\plans\gottergraben\docs\PLAN.md` (Planungs-Sandbox blockiert Schreibzugriffe in den Projektordner)
> **Schritt 1 der Implementierung:** Ordner `C:\Users\georg\Desktop\coding\gottergraben\` anlegen, `docs/` übernehmen (diese Datei + `OPEN-QUESTIONS.md`), dann `git init`.

## 1. Kontext & Ziel

Neues, komplett statisches Idle-Roguelike im Browser. Einzige harte Vorgabe des Users: **vollständig auf GitHub Pages host- und spielbar** — kein Backend, kein Login, keine Server-Kosten, kein Registrierungszwang.

**Produktidee:** Ein Run = ein Leben. Der Held wird automatisch in den Göttergraben geschickt, kämpft sich einen Baum hoch, sammelt Loot und Seelen, stirbt oder erklimmt den Thron. Was bleibt, ist **Erbe**: Skills, Klassen, Verwalter-Funktionen und göttliche Ränge. Das Spielziel ist der **Aufstieg zum Gott** (10 Throne), danach endlose Inkarnationen.

| | |
|---|---|
| Titel | **Godswar Pit** — Untertitel „Climb to become a god" |
| Sprache | **Nur Englisch** (kein i18n) |
| Genre | Idle-Roguelike / Auto-Battler mit Baum-Run-Struktur |
| Kamerasicht | **Top-down**, 4 Blickrichtungen, Räume als Kachelraster |
| Plattform | Desktop-first, browserbasiert, responsiv (Tablet-Fit) |
| Persistenz | localStorage (1 Slot) + Export/Import als Base64-Text |

### 1.1 Arbeitsweise mit dem User (Noob-Freundlichkeit)

Der User ist kein Entwickler. Der Agent richtet deshalb **alles** ein, was nur geht:

- `npm install`, `npm run dev` (lokal, mit Auto-Reload), `npm run build` (fertige Web-Dateien), `npm run test`, `npm run preview`.
- **Der User muss nur:** ein leeres GitHub-Repo anlegen und die URL weitergeben → Settings → Pages → Source: **GitHub Actions**. Danach jeder `git push` veröffentlicht automatisch. Optional `gh repo create godswar-pit --public --source .` übernimmt der Agent, falls `gh` authentifiziert ist.
- Der Agent schreibt alle Erklärungen/Entscheidungen in `docs/`, nicht in Chats: `docs/PLAN.md`, `docs/OPEN-QUESTIONS.md`, `docs/DECISIONS.md`.

---

## 2. Gameplay-Spec (verbindlich)

### 2.1 Setting & Lore (EN)

- **Ashvale** — the village on the rim of the pit. Normal life: tavern, market, smithy, chapel, a mayor who hands out contracts. This is the "ordinary world" contrast.
- **The Godswar Pit** — a thousand years ago two gods fought here and died. Their corpses *are* the landscape: bone ridges, rime anthills, godblood crystal. Cultists, reavers and *remnants* live in it.
- **Currency in the pit:** Souls (harvested from reavers, crystals, bosses).
- **Dramaturgie:** 10 **Thrones** guard the way up to the **Hollow Throne** — the empty seat of a dead god at the pit's heart. Taking it makes you the new god. Then: **Inkarnation**.

### 2.2 Kernschleife

```
Hub (Ashvale)  →  Loadout bauen  →  Expedition starten  →  Baum hochklettern
     ↑                                                            ↓
Erbe sichern ← Tod / Thron ←─────────── automatischer Kampf ←─────┘
```

1. **Vorbereitung:** Klasse wählen, 6 Item-Slots belegen, 3 Trank-Slots belegen, Skill-Baum-Knoten kaufen, Erbschaften einsetzen, Ziel-Zone wählen, Verwalter-Policy setzen.
2. **Expedition:** Der Baum wird generiert (siehe 2.3). Der Held kämpft automatisch, Skills feuern nach Cooldown per Prioritätenliste.
3. **Knotenwahl:** Der Spieler wählt den nächsten Knoten (Risiko/Belohnung). Das ist die **einzige** aktive Entscheidung im Run. Ohne Eingabe (offline) wählt der **Verwalter** nach Policy.
4. **Ende:** Tod → Erbschaften sichern; oder Thron-Sieg → Rang + Mechanik freigeschaltet; oder freiwilliger Rückzug.
5. **Erbe** bleibt: Seelen, Echo, Erbschaften, Throne, Erfolge, Codex, Statistiken, Verwalter-Mechaniken.

### 2.3 Der Graben-Baum (Kernstück der Run-Struktur)

Der Run ist ein **aufsteigender Baum**: Start unten, Thron-Boss oben. Jeder Knoten ist ein Raumtyp.

```
                 [BOSS · Throne]
                 ╱            ╲
          [TREASURE]        [ELITE]
             ╱     ╲           ╲
      [HEALING]  [FIGHT]     [EVENT]
         ╱         ╲           ╲
     [FIGHT]     [TRAP]      [TREASURE]
        ╱           ╲           ╲
   [FIGHT]       [FIGHT]      [FIGHT]
       ╲           │           ╱
             [START]
```

**Sichtbarkeit:** Der **komplette Baum ist sichtbar** (eigene Screen-Oberfläche, aufsteigend gezeichnet). Knoten-**Typ** und **Risikostufe** sind überall bekannt. Der **Inhalt** (Gegnerliste, Loot-Klasse, Event-Variante) bleibt verborgen, bis der Knoten betreten wird. Tiefere Ebenen zeigen vorab Typ + Risiko, nicht die konkrete Verteilung.

**Knoten-Typen**

| Typ | Inhalt | Risiko | Effekt |
|---|---|---|---|
| `FIGHT` | 4–6 normale Gegner | 1–2 | Standard-Beute, Seelen |
| `ELITE` | 6–8 Gegner inkl. Anführer | 3–4 | garantiert Selten+, Bonus-Seelen |
| `TREASURE` | kein Kampf, Beute + Seelen | 1–2 | 20 % „Mimic" → Kampf |
| `HEALING` | kein Kampf | 0–1 | +40 % HP, kostet 10 % der getragenen Seelen |
| `EVENT` | 3 Risiko/Belohnung-Optionen | 1–3 | Choice; manche Optionen lösen einen Kampf aus |
| `TRAP` | kein Kampf, Schaden | 2–3 | −10…−25 % max. HP, kleine Belohnung |
| `BOSS` | Zonen-Boss | 5 | Thron-Fortschritt, Erbschaft |

**Generator-Regeln**
- Tiefe 12–16 Knoten, gewählter Pfad 8–12 Knoten. Verzweigung 2 (ab Zone 4 drei Optionen).
- `BOSS` immer genau einer, auf der obersten Ebene.
- `HEALING` max. 1–2 pro Zone, nie in Ebene 1–2.
- `TRAP` erst ab Ebene 3. `ELITE` erst ab Ebene 2. `TREASURE` 1–2 pro Zone.
- Risikostufe = f(Zone, Ebene, Knotentyp). Sie steigt monoton mit der Ebene.
- **Inhalte** werden erst beim Betreten gewürfelt (Seed pro Knoten, deterministisch).

**Bedienung:** Tree-Panel (SVG/DOM) neben dem Kampf-Canvas. Aktueller Knoten markiert, wählbare Nachfolger anklickbar. Bleibt der Spieler 3 s ohne Klick, wählt der Verwalter automatisch (relevant fürs AFK-Verhalten im selben Tab).

**Verwalter-Policy (Rang 5):** Presets `Safe` / `Balanced` / `Greedy` + Schieberegler (Heilungs-Bevorzugung, Schatz-Suche, Fallen-Vermeidung, Risiko-Toleranz). Keine Skriptsprache.

### 2.4 Kampf

- **4–6 Gegner** pro Kampf (`ELITE`: 6–8, `BOSS`: Boss + 2–4 Adds). Positionen: geclustert (front/mid/back) für Lesbarkeit.
- **Kein manuelles Positionieren** (widerspricht Idle). Der Held steht zentriert; Zielwahl automatisch (nächster/niedrigste HP, Boss bevorzugt wenn ≤2 Gegner übrig).
- **Kein manuelles Casting.** Aktive Skills feuern bei Cooldown-Ende nach der Prioritätenliste des Loadouts.
- **Status-Effekte:** DoT (Gift, Verbrennung, Verfall), Buffs (Wut, Schild, Aura), Debuffs (Einfrieren, Verlangsamen, Verblenden).
- **Kritisch:** Basis-Kritchance + Boni; Krit-Schaden = 150 % + Boni.
- **Ressourcen:** pro Klasse (Wut / Faith / Arcane / Venom / Souls / Chi) — regenerierend oder durch Kills/Actions gefüllt.
- **Tick:** 100 ms Spielzeit, alle Werte in Ticks (Cooldowns, DoT-Ticks). Deterministisch.

### 2.5 Klassen (6)

| Klasse | Rolle | Identität | Ressource |
|---|---|---|---|
| **Bladewalker** | Kraft/AoE | Wut, Flächenangriffe, hohe Leben | Wut (Angriffe erzeugen) |
| **Ironpriest** | Tank/Aura | Schild, Aura, Heilung, göttliches Licht | Faith (Cooldowns + Heilung) |
| **Pitsorcer** | Fernkampf/Element | Frost/Blitz, Teleport, Kontrolle | Arcane |
| **Plagueborn** | Tempo/Gift | Gift-Stacks, Ausweichen, Doppelgriff | Venom |
| **Soulbinder** | DoT/Minionen | Schatten, DoT, 2–3 Minionen, Lebensraub | Souls |
| **Ashmonk** | Ressourcen-Combo | Ressourcen-Zyklen, Tempo-Kombo | Chi |

Pro Klasse: **1 Signatur + 3–5 aktive Skills (Cooldown) + 6–8 Passives**, **3 Skill-Bäume à ~30 Knoten**, **4–5 klassengebundene Aspects**, 6 Waffen-Bases.

**Lieferreihenfolge (Content-Budget):** Bladewalker → Ashmonk → Pitsorcer → Ironpriest → Plagueborn → Soulbinder (Minionen zuletzt, weil dort die meiste Animationsarbeit ist).

### 2.6 Skill-System

- **Run-Skillpunkte** (Stufe 1–20, Diablo-artig): +Ranking auf aktive Skills, +Stufen auf Passives. **Gehen bei Tod verloren** (der XP-Loss).
- **Runen:** 2–3 Varianten je aktivem Skill (z. B. „Flood" brennt / „Frost" friert / "Venom" stackt). Dauerhaft freischaltbar (Inheritance).
- **Auto-Cast-Prioritätenliste** pro Loadout, z. B. `AoE wenn ≥3 Gegner → Ultimate wenn bereit → Boss-Skill → Angriff`. Feinjustierbar pro Slot.
- **Erinnerung (Erbe):** Run-Skillpunkte können in permanente Punkte im Inheritance Tree umgewandelt werden (Umrechnung ~1:1, aber teurer in Seelen) — der Meta-Fortschritt, der auch einen Tod überlebt.
- **Respec** per Seelen, jederzeit, kostenlos zurückverteilbar.

**Knoten-Archetypen (max. 12, datengetrieben — 540 Knoten entstehen aus 12 Typen + Parametern, nicht aus 540 Handarbeiten):**

| Archetyp | Parameter | Beispiel |
|---|---|---|
| `VALUE` | stat, scaling | +12 % Angriffsenschaden |
| `CONDITIONAL` | Bedingung, Wert | Wenn ≤ 2 Wut: +20 % Schaden |
| `COOLDOWN` | skill, ticks | Flammenradius −0,5 s |
| `RESOURCE` | resource, delta | Flammenradius kostet 10 Wut |
| `TRANSFORM` | skill, flag | AoE ↔ Einzelziel |
| `PIERCE` | count | Durchschlägt 1 weiteren Gegner |
| `DURATION` | buff/debuff, ticks | Wut hält 2 s länger |
| `RUNE_UNLOCK` | skill, rune | Schaltet Rune „Frost" frei |
| `ACCESS` | skill/branch | Schaltet Skill „Rune" frei |
| `MULTIPLIER` | stat, mult, cap | Schaden ×1,15 (max. 3 Stacks) |
| `PASSIVE` | passive id, rank | Passive „Rückenschuss" +1 |
| `NODE_GATE` | node id | Benötigt Knoten „Flamme I" |

**Budgetregeln** (hart, per Test erzwungen): max. 3 Stacks je Multiplikator-Node, Multiplikationsbudget je Baum (z. B. Summe aller Multiplikatoren ≤ 3,0), keine Kreisreferenzen, max. 40 aktive Nodes je Baum (Rest rein passiv).

### 2.7 Item-System (schmal, 6 Slots)

- **Slots:** Weapon · Armor · Boots · Gloves · Amulet · Ring.
- **Raritäten:** Common · Magic · Rare · Legendary · Mythic.
  Affix-Anzahl: 0 / 1 / 2–3 / 3–4 + Aspect / 4–5 + Aspect (starke Roll).
- **Affixes (~16 Typen)** mit Prefix-/Suffix-Namensgenerator: `Fiery`, `Sturdy`, `Bitter`, `of the Drowned`, `of Ash`, `of the Hollow` …
  Relevante Achsen: Damage %, Crit Chance, Crit Damage, Max HP, Armor %, Attack Speed, Cooldown Reduction, AoE %, DoT %, Soul Yield %, Move Speed, Resource Regen, Execute Threshold, Status Resist, flat Souls.
- **Aspects (~20, 4–5 klassengebunden):** legendäre Kräfte an Item gebunden, im **Codex** gesammelt, am Schmied rerollbar. Beispiele: *Flamebrand* (Angriffe hinterlassen brennende Flächen), *Soulthirst* (10 % des Schadens als LP), *Hollow Step* (25 % Chance auf einen Extra-Angriff).
- **Basis-Items:** 4 geteilte Rüstungs-Bases + 6 Waffen-Bases je Klasse.
- **Keine** Sets, Gems, Runen-Slots, Rohstoffe, Handwerk.
- **Tresor** (Vault) persistent, unbegrenzt, mit Auto-Schrott-Regel (Items unter Qualitätsschwelle werden beim Einsortieren zu Schrott).
- **Schmiede:** Recraft (einen Affix neu würfeln, kostet Seelen) · Respec (Skill-Baum) · Aspect-Reroll (Codex-Eintrag, Aspekt an Waffe/Trinket binden).
- **UX:** Auto-Vergleich, „besser"-Marker, Slot-Filter, Tooltip mit Roll-Qualität (Prozentile), Suche.

### 2.8 Tod-Regeln (fix)

> **Regel:** Dein **Loadout überlebt** den Tod. **Beute geht verloren.** Run-Skillpunkte und Run-Stufen gehen verloren.

| Element | Run-Scope | bei Tod | bei Inkarnation |
|---|---|---|---|
| Ausgerüstete Items (6 Slots) | run | **bleiben** | weg |
| Zusätzliche Beute im Tresor | run | **zerfällt** | weg |
| Run-Skillpunkte & Run-Stufe | run | **weg** | weg |
| Aktive Skills (Unlock) | Inkarnations-Scope | bleiben | **weg** (dieser Inkarnation) |
| Passives (Baum-Nodes) | permanent | bleiben | bleiben |
| Seelen | permanent | bleiben | bleiben |
| Divine Echo | permanent | bleibt | **25 %** (+5 % je Inheritance, die dafür geopfert wird) |
| Inheritance | permanent | bleiben | bleiben |
| Throne / Ränge | permanent | bleiben | bleiben |
| Verwalter-Mechaniken | permanent | bleiben | bleiben |
| Achievements · Codex · Statistiken | permanent | bleiben | bleiben |
| Tränke | verbraucht | – | – |
| Fortschritt im aktuellen Baum | run | weg | weg |

**Keine Todesstrafe für Zeit-Absenzheit:** Offline-Tode kosten nur Beute + Run-Fortschritt, nie Erbe.

### 2.9 Throne (10 Automation-Ränge)

| Rang | Titel | Freigeschaltete Mechanik |
|---|---|---|
| 1 | Pitling | Die Expedition läuft nach deiner Rückkehr 1× weiter |
| 2 | Ash-Seer | Loot-Vorschau der nächsten Kämpfe (Rarität) |
| 3 | Twin-Diggers | 2 Expeditionen parallel |
| 4 | Ironfist | Auto-Equipping der besten Items |
| 5 | Godservant | Verwalter wählt Knoten nach deiner Policy |
| 6 | Soulcounter | Seelen fließen auch ohne laufende Expedition |
| 7 | Runebinders | Aspects werden automatisch rerollt |
| 8 | Shadowlord | Automatischer Vorlauf ohne Truppe (Zonen-Rotation) |
| 9 | Divine Voice | 3 Expeditionen parallel + Seelen-Regen in Echtzeit |
| 10 | **The New God** | **Inkarnation möglich** |

Jeder Rang gibt zusätzlich einen permanenten Multiplikator (Grace Mirror) und einen Inheritance-Grant.

### 2.10 Inkarnation

- Freigeschaltet mit Rang 10 (erfordert: alle 10 Throne + Story-Kapitel 10).
- **Reset:** Items, Run-Skillpunkte, in dieser Inkarnation freigeschaltete aktive Skills, Baum-Nodes dieser Inkarnation, Echo bis auf den Anteil.
- **Behalten:** Throne, Inheritance, Achievements, Codex, Statistiken, passive Knoten früherer Inkarnationen, Verwalter-Mechaniken, 25 % (+5 % je Inheritance) des Echo.
- **Schwierigkeit:** `×(1 + 0,5 × Inkarnationen)` auf alle Gegner; zusätzlich **Anomalien** (Modifikatoren pro Zone, z. B. „+1 Extra-Elite", „Gegner heilen sich", „jeder 5. Knoten ist ein Trap").
- Jede Inkarnation schaltet eine neue Anomalien-Serie + ein kosmetisches Siegel frei.

### 2.11 Währungen (3) & Meta-Bäume

| Währung | Quelle | Verwendung |
|---|---|---|
| **Souls** | Kills, Bosses, Treasure-Nodes, Contracts | Skill-Baum-Knoten, Recraft, Respec, Markt (Tränke), Seelen↔Echo-Tausch |
| **Divine Echo** | Run-Ende, Throne, Contracts | **Grace Mirror** (Paragon-Baum: Multiplikatoren + Boni) |
| **Inheritance** | Throne-Siege, Achievements, Meilensteine, Inkarnationen | **Inheritance Tree** (Unlocks: Klassen, aktive Skills + Runen, Start-Items, Startboni, Verwalter-Features, kosmetisch) |

**Grace Mirror** (~60 Knoten, Echo): Schaden, Leben, Krit, AoE, Cooldown, Seelen-Ertrag, Beweglichkeit, Drop-Rate.
**Inheritance Tree** (~80 Knoten, Inheritance): Klassen-Freischaltung, aktive Skills/Runen, Start-Ausrüstung, Startboni, „Erinnerung"-Knoten (Run-Skillpunkte → permanent), Verwalter-Features, kosmetische Banner/Titel.

### 2.12 Hub „Ashvale" (5 Tabs + Login-Bonus)

1. **CONTRACTS** — 3 rotierende Verträge (Rolling 24 h) + 1 Story-Kette (10 Kapitel = 10 Throne).
   Vertrags-Typen: `kill_count` (Zone/Enemy-Typ) · `reach_depth` (Zone + Ebene) · `find_rarity` (N Items einer Rarität) · `earn_souls` (X Seelen in Y Minuten) · `survive_runs` (N Runs) · `ascend` (neuer Throne).
   Belohnung: Souls (skaliert nach Zone) + 1 Inheritance (oder Fragment) + gelegentlich ein Trank.
   Story-Kapitel: freischaltet Zonen, gibt Inheritance + Lore-Text + kosmetisches Siegel.
2. **SMITHY** — Recraft · Respec · Aspect-Reroll (Codex) · Schmelzen (Schrott anzeigen).
3. **ENVOY** (Botschafter) — Inheritance → Unlocks aus dem Inheritance Tree.
4. **GRACE MIRROR** — Echo-Baum.
5. **MARKET** — **nur Tränke + Seelen↔Echo-Tausch.** Kein Item-Verkauf (Loot kommt zu 100 % aus Runs).
   Tränke: 3 Slots im Loadout, wirken den gesamten Run.
   `Wrath Elixir` (+30 % Schaden) · `Ironroot` (+40 % max. HP) · `Blade Oil` (−15 % Cooldowns) · `Soulfog` (+25 % Seelenertrag) · `Blood Price` (Heilung kostet 25 % der geheilten HP) · `Second Wind` (eine Wiederbelebung pro Run).
   3 Gütestufen (Weak ×0,5 / Strong ×1 / Grim ×1,5) mit Preisen ×1 / ×3 / ×8. Immer verfügbar, Preise fix → reiner Souls-Sink.
6. **LOGIN BONUS** — 7-Tage-Streak, danach zyklisch steigend (Souls + gelegentlich Inheritance).

### 2.13 Erfolge (~70, 8 Kategorien)

`COMBAT` · `DEPTH` · `LOOT` · `META` · `IDLE` · `COLLECTION` · `SECRET` · `DISCOVERY`

- Belohnungen: **Inheritance** (echte Unlocks) + Seelen-Boni + kosmetische Titel + „Shadowpet"-Begleiter (cosmetic). Jede Kategorie hat 3–4 **Meilensteine** mit substanzieller Belohnung.
- Fortschrittsseite mit Kategorie-Balken + Toast-Nachricht bei Freischaltung.
- Beispiele: *First Blood* (1 Kill) · *Thousand Cuts* (1.000 Kills) · *Descent* (Ebene 8) · *Ascendant* (Thron 10) · *Godslayer* (Inkarnation 1) · *Collector* (alle 20 Aspects im Codex) · *Offline Pilot* (1 h AFK) · *No Quarter* (Run ohne Trank) · *Ruthless* (Boss mit 1 HP besiegt).

---

## 3. Technische Architektur

**Stack:** TypeScript 5 (strict) · Vite 6 · Vitest · Canvas 2D · DOM/CSS-UI · WebAudio. **Keine Runtime-Dependencies.** Bundle-Ziel < 200 KB gzip.

```
gottergraben/
├─ docs/                       # PLAN.md, OPEN-QUESTIONS.md, DECISIONS.md
├─ src/
│  ├─ main.ts                  # Bootstrap, Screen-Router (Hub / Run / Trees / Inventory / Achievements)
│  ├─ core/                    # rng.ts, events.ts, time.ts, math.ts, id.ts, format.ts
│  ├─ sim/                     # engine.ts (Tick), combat.ts, status.ts, autocast.ts, loot.ts, tree.ts, expedition.ts, policy.ts
│  ├─ state/                   # store.ts (localStorage), schema.ts, migrations.ts, offline.ts, contracts.ts
│  ├─ data/                    # ALL CONTENT as data
│  │  ├─ classes/*.json        # 6 classes
│  │  ├─ nodes/archetypes.ts   # the 12 node archetypes + budget validation
│  │  ├─ nodes/trees/*.json    # skill trees
│  │  ├─ items/bases.json  affixes.json  aspects.json
│  │  ├─ enemies/*.json  zones.json  nodes.json
│  │  ├─ achievements.json  contracts.json  thrones.json  potions.json  anomalies.json
│  │  └─ balance.ts            # scaling formulas, cost multipliers
│  ├─ art/                     # sprites.ts, palette.ts, tiles.ts, fx.ts, icons.ts
│  ├─ audio/                   # chip.ts, music.ts, sfx.ts
│  ├─ ui/                      # hub/, tree/, inventory/, achievements/, offline-report/
│  └─ styles.css
├─ tests/                      # vitest
├─ .github/workflows/deploy.yml
├─ index.html
├─ vite.config.ts              # base: './'
├─ tsconfig.json
└─ package.json
```

### 3.1 Simulations-Kern (Architektur-Herz)

- **Tick = 100 ms Spielzeit.** Alle zeitlichen Werte in Ticks. `step(state, ticks): SimState`.
- **Determinismus:** seeded RNG (xorshift128) mit getrennten Strömen (`loot`, `crit`, `spawn`, `event`) über Sub-Seeds. Gleicher Seed + gleiche Eingaben ⇒ identisches Ergebnis. **SimState ist rein** — Renderer lesen, mutieren nie.
- **Live:** `requestAnimationFrame` → Akkumulator → `step(state, nTicks)` mit Catch-up (max. 5 Ticks pro Frame, kein Death-Spiral).
- **Offline (`state/offline.ts`):** Beim Laden `elapsed = now − savedAt` →
  1. bis zu **200 000 Ticks** (≈ 5,5 h) echte Simulation in Chunk-Blöcken (Yield alle 5 000 Ticks, damit der Browser nicht einfriert),
  2. danach Restzeit per Extrapolationsformel mit **50 % Effizienz** (Schätzung, klar als „estimated" markiert),
  3. Ergebnis: **Return Report** (Report-Screen): Dauer, Nodes, Kills, Todesursache, Loot, Seelen, Echo, Fortschritt je Inkarnation.
- **Auto-Retry:** Nach Tod startet der nächste Run automatisch mit dem letzten Loadout (abschaltbar, Default an).
- **Determinismus-Test:** `step()` über N Ticks live vs. im Fast-Forward ⇒ identischer State-Hash. (Vitest, Pflicht-Gate.)

### 3.2 Datenformate (Schemas)

```ts
// Sprite — prozedural, handgestaltet, Text-basiert
type Sprite = { palette: Record<string, string | null>; frames: string[] };
// frames: je Element ein Frame; "\n" trennt Zeilen. 16×16 oder 24×24, 1 Pixel = 1 Zeichen.
// Renderer: drawSprite(ctx, sprite, x, y, frame); imageSmoothingEnabled = false.
// Die Schnittstelle erlaubt später 1:1-Ersetzung durch PNG (ImageBitmap-Quelle).

type NodeType = 'FIGHT' | 'ELITE' | 'TREASURE' | 'HEALING' | 'EVENT' | 'TRAP' | 'BOSS';

type TreeNode = {
  id: string; parent: string | null; depth: number;
  type: NodeType; risk: number;          // 0..5
  x: number; y: number;                  // Layout für den Baum-Screen
  contentSeed: number;                   // würfelt Inhalte erst beim Betreten
};

type ClassDef = {
  id: string; name: string; resource: string;
  signature: SkillDef; actives: SkillDef[]; passives: string[];
  weaponBases: string[]; aspects: string[];
  trees: string[];                        // 3 tree ids
};

type Affix = { id: string; stat: string; min: number; max: number; tier: number; prefix: string[]; suffix: string[] };
type Aspect = { id: string; classId: string; name: string; effect: string; params: Record<string, number> };
type EnemyDef = { id: string; name: string; hp: number; dps: number; speed: number; range: number; tier: number; sprite: string; traits: string[] };
type Achievement = { id: string; cat: string; name: string; desc: string; condition: Condition; reward: Reward };
```

Alle Inhalte werden zur Laufzeit geladen und **gegen ein Schema validiert** (Vitest-Test), damit ein Tippfehler in einer JSON nicht das Spiel killt.

### 3.3 Save-System

- Key `godswarpit.save.v1`, Schema `{ version, savedAt, player, settings, stats, achievements, unlocked, meta, contracts, tree }`.
- **Nur Zustand speichern, keine abgeleiteten Werte** (Stats werden berechnet) → Balancing-Änderungen invalidieren keine Saves.
- Autosave alle 10 s + `visibilitychange` + `beforeunload`. Bei `visibilitychange` zusätzlich: laufende Simulation deterministisch anhalten und Zustand sichern.
- **Export/Import:** JSON → Base64 → Clipboard/Textarea; Import validiert Schema + Version, migriert bei Bedarf, bietet „Exportieren" vor dem Überschreiben an.
- **Best-Runs-Liste** (lokal): tiefster Run, meiste Seelen, bester Throne-Sieg, längste Überlebenszeit, 5 Einträge „Runs" mit Kurzreport. **„Share"-Button** kopiert einen kompakten Score-Text (Name/Tiefe/Thron/Zeit/Build) in die Zwischenablage. Optional `leaderboard.json` im Repo (per PR gepflegt) — kein Backend nötig.

### 3.4 Rendering & Art

- Canvas 480×270 intern, ganzzahlig skaliert (`image-rendering: pixelated`), CSS-Skalierung auf Viewport. DOM/CSS-UI darum herum (Panels, Bäume, Inventar).
- **Kacheln:** 16×16, aus einem Basis-Schema (Boden/Wand/Kante) + Zonenpalette (5–7 Farben) + Variation per Seed. Keine 3D-Logik, keine 6 Wandansichten.
- **Sprites:** Held 16×24, Gegner 16×16, Boss 32×32. 4 Blickrichtungen (Spiegelung reicht für 2), Frames: idle 2 · walk 4 · attack 2 · hit 1 · death 3.
- **FX:** Partikelsystem (Funken, Staub, Blut/Ichor, Seelen-Funken), Trefferblitz, Screen-Shake, Floating-Damage-Numbers, Licht/Fog-Maske (radial), Fackel-Flackern (3 Frames).
- **Paletten:** Basis-16-Farben-Schema (DB32-ähnlich) + Zonen-Palette; Item-Raritäten an eigenen Farb-Codes gebunden.
- **Icons:** ein Satz 16×16-Icons, ~120 Stück, für Items, Skills, Achievements, Tabs.

### 3.5 Audio (WebAudio, keine Dateien)

- `chip.ts`: Synth mit Square (Duty-Cycle), Triangle, Noise + ADSR-Hüllkurve.
- **SFX:** Treffer, Krit, Tod, Loot-Drop, Kauf, Node-Auswahl, Throne-Sieg, Button.
- **Musik:** 10 Zonen-Loops, prozedural aus Basslinie + Arpeggio + Noise-Schlagzeug; Tempo/Scale pro Zone; adaptiv (Kampf-Intensität moduliert Percussion).
- AudioContext startet erst nach der ersten Nutzerinteraktion; Master-Volume + Mute im Settings-Tab.

### 3.6 Deploy (GitHub Pages)

- `.github/workflows/deploy.yml`:
  ```yaml
  permissions: { contents: read, pages: write, id-token: write }
  on: { push: { branches: [main] } }
  jobs: { build: { steps: [ checkout, setup-node, npm ci, npm run test, npm run build, upload-pages-artifact ] },
          deploy: { needs: build, uses: actions/deploy-pages } }
  ```
- `vite.config.ts`: `base: './'` → funktioniert unter Root **und** Repo-Subpfad.
- **Setup beim User (einmalig):** GitHub-Repo anlegen → Settings → Pages → Source: *GitHub Actions*. Danach `git push` = fertig.
- Fallback ohne Actions: `npm run build` → `dist/` in den Branch `gh-pages` pushen.

---

## 4. Implementierungsplan (geordnet, mit Akzeptanzkriterien)

### Phase 0 — Fundament
1. Ordner `C:\Users\georg\Desktop\coding\gottergraben\` anlegen, `docs/` übernehmen (PLAN, OPEN-QUESTIONS), `git init`, `package.json`, `tsconfig.json` (strict), `vite.config.ts` (base `'./'`), `index.html`, `styles.css`, `.gitignore`.
2. CI-Workflow `deploy.yml` (Test → Build → Deploy) + `npm run preview` als lokaler Pages-Test.
3. `core/`: `rng.ts` (xorshift128 + Sub-Streams), `events.ts`, `time.ts`, `math.ts`, `format.ts`.
4. `state/schema.ts` + `state/store.ts` (Autosave, Export/Import, Migration v1→v2) + `state/migrations.ts`.
5. *Akzeptanz:* `npm run dev` zeigt eine Seite; `npm run build` erzeugt `dist/`; `npm run test` grün; `git push` → GitHub Actions baut und publiziert; `npm run preview` liefert eine lokal erreichbare Seite.

### Phase 1 — Simulation + spielbares MVP (1 Klasse, 1 Zone)
6. `sim/engine.ts`: Tick-Engine, `SimState`, `step()`, Event-Queue.
7. `sim/combat.ts` + `sim/status.ts`: Angriff, Reichweite, Krit, Cooldowns, DoT/Buff/Debuff, Ressourcen, Tod.
8. `sim/autocast.ts`: Prioritätenliste → Skill-Auswahl; `sim/loot.ts`: Basis → Item-Level → Rarität → Affixes → Aspect; `data/items/*`.
9. `sim/tree.ts` + `sim/expedition.ts`: Baum-Generator, Knoten-Wahl, Raum-Auflösung, Auto-Retry, Todesauflösung.
10. `art/`: Sprite-Format + Renderer, Kachel-Schema, Palette, erste Helden-/Gegner-Sprites, FX-Partikel.
11. `ui/`: Hub-Shell, Run-Screen (Canvas + Tree-Panel), Loadout, Rückkehr-/Todes-Report.
12. *Akzeptanz:* Ein Run läuft im Browser, Knoten sind wählbar, Tod erzeugt einen Report, Loot landet im Tresor, gleicher Seed ⇒ gleiches Ergebnis (Test).

### Phase 2 — Items, Skill-Bäume, Erbe
13. Item-System komplett: 6 Slots, 5 Raritäten, 16 Affixes + Namensgenerator, 20 Aspects, Codex, Tresor-UI mit Auto-Vergleich/Filter, Schmiede (Recraft/Aspect-Reroll).
14. `nodes/archetypes.ts` (12 Typen) + Budget-Validator + Skill-Baum-UI (SVG, Pan/Zoom, Tooltips, Kauf, Respec).
15. Eine Klasse vollständig (Bladewalker: 1 Signatur, 4 aktive, 8 Passives, 3 Bäume, Runen, Item-Bases, Aspects).
16. `data/balance.ts` + Grace Mirror + Inheritance Tree (je 1 Ast voll, Rest als Stubs).
17. *Akzeptanz:* Build verändert messbar DPS/Überleben; Items sind vergleichbar; Respec und Recraft funktionieren; Save überlebt einen Neustart.

### Phase 3 — Idle-Kern & Hub
18. `state/offline.ts`: Chunk-Simulation, Extrapolation, Effizienz-Faktor; **Determinismus-Test Online ≈ Offline**.
19. Verwalter-Policy (Presets + Slider) + Auto-Retry + Report-Log.
20. Hub-Tabs: Contracts (rotierende + Story-Kette), Smithy, Envoy, Grace Mirror, Market (Tränke + Tausch), Login-Bonus.
21. Statistics-Screen + Best-Runs + Share-Text.
22. *Akzeptanz:* 1 h abwesend ⇒ reproduzierbarer Fortschritt, der Report nennt Kills/Todesursache/Loot; Verwalter wählt Knoten nach Policy.

### Phase 4 — Inhalt (Skalierung)
23. Zonen 1–10 (Kacheln, Paletten, Gegner-Roster, Bäume), 10 Throne inkl. Mechanik-Unlocks (Auto-Equip, Parallel-Expeditionen, Auto-Reroll, Seelen-Regen).
24. Klassen 2–6 (Skills, Bäume, Waffen-Bases, Aspects) in der Lieferreihenfolge Bladewalker → Ashmonk → Pitsorcer → Ironpriest → Plagueborn → Soulbinder.
25. Inkarnationen (Reset, Echo-Anteil, Anomalien-Serien, Schwierigkeit ×N) + Story-Kapitel 1–10.
26. Erfolge: ~70 in 8 Kategorien + Meilensteine + Erfolge-Screen + Toasts.
27. **Balance-Werkzeug:** `npm run balance` → 1 000 simulierte Runs je Klasse → Report (Zeit pro Throne, Todeszonen-Heatmap, Drop-Raten, Seelen/Minute). Iterativ tunen.
28. *Akzeptanz:* Alle 6 Klassen bis Rang 10 spielbar; Inkarnation funktioniert; Erfolge schalten echte Unlocks frei; Balance-Report zeigt plausibles Wachstum.

### Phase 5 — Polish & Release
29. Art-Feinschliff: Licht/Fog, Fackeln, Screen-Shake, Damage-Numbers, Item-Tooltips, Übergänge.
30. Audio-Feinschliff: 10 Musik-Loops, SFX-Vielfalt, adaptive Intensität.
31. Responsive/Tablet-Fit, Accessibility (Kontrast, Schriftgröße, `aria`-Texte für UI, keine reine Farbinformation).
32. Performance: Bundle < 200 KB gzip, stabile 60 FPS bei 6 Gegnern + Partikeln.
33. Release: README (EN), Changelog, `gh-pages`-Fallback, Live-Test auf GitHub Pages (Root **und** Subpfad), Mobile-Smoke-Test.

---

## 5. Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| **Balancing-Explosion** (540 Knoten × 16 Affixes × 6 Klassen) | 12 Knoten-Archetypen + Parameter; harte Budgetregeln pro Baum; `npm run balance` Batch-Simulation; gestaffelte Lieferung (1 Klasse voll in Phase 2, Rest in Phase 4) |
| **Content-Erschöpfung / Burnout** | Alles datengetrieben; Item-Bases pro Klasse aus Templates; ein Icon-Satz; Phase 1 ist bereits ein vollständiges, spielbares kleines Spiel |
| **Offline driftet von Online ab** | Eine gemeinsame deterministische Engine + Vitest-Gate „Online ≈ Offline" |
| **UX-Overwhelm** (6 Bäume, Items, Erfolge) | Progressive Disclosure, Filter, Auto-Vergleich, Empfehlungs-Marker, Suche, Hub-Tabs |
| **Save-Bruch durch Schema-/Content-Änderungen** | Versioniertes Schema + Migrationen; nur Zustand speichern, Stats berechnen; Export/Import mit Validierung |
| **Performance auf Pages** | Keine Runtime-Deps, kleines Bundle, 480×270 intern, Canvas nur für die Szene |
| **16-Bit-Optik wirkt billig** | 6-Farben-Zonenpaletten, Flicker-/Fog-Effekte, Partikel, Damage-Numbers, Musik |
| **Todes-Feedback frustet (Idle)** | Loadout überlebt, Beute zerfällt; Erbe unantastbar; Offline-Tode kosten nie Fortschritt |

---

## 6. Validierung

- **Unit (Vitest):** RNG-Determinismus (gleicher Seed ⇒ gleiche Sequenz) · Schema-Validierung aller JSON-Dateien · Knoten-Budgetregeln · Affix-/Aspect-Konsistenz · Save/Load-Roundtrip · Migration v1→v2 · Namensgenerator-Statistik (keine Duplikate, plausible Namen).
- **Simulation:** `step()` live vs. Fast-Forward ⇒ identischer State-Hash (Pflicht-Gate) · Offline ≈ Online bei gleicher Dauer · Auto-Retry-Kette erzeugt reproduzierbare Runs.
- **Balance:** `npm run balance` → 1 000 Runs/Klasse → Farm-Zeit pro Throne, Todeszonen-Heatmap, Drop-Raten pro Rarität, Seelen/Minute, Inkarnations-Kurve.
- **Manuell (Checkliste im README):** erster Run · Knotenwahl · Tod + Report · 1 h Offline · Throne 1→10 · Inkarnation · Contracts · Tränke · Erfolge · Export/Import → Neustart · GitHub Pages live (Root + Subpfad) · Tablet-Layout.
- **CI-Gates:** `npm run test` **und** `npm run build` müssen grün sein, bevor deploy läuft.

---

## 7. Out of scope (bewusst)

Multiplayer · Cloud-Sync/Accounts · Leaderboard-Server (nur lokal + Share-Text) · Monetarisierung · PNG-Binärassets (Pipeline bleibt offen) · Mobile-First (responsive, Desktop-first) · Audio-Dateien (nur prozedural) · PvP · Gefährten/Party (Single-Hero).

---

## 8. Entscheidungs-Log (Runde 1–3)

| # | Thema | Entscheidung | Runde |
|---|---|---|---|
| 1 | Kernschleife | Auto-Expedition + Meta-Baum | 1 |
| 2 | Setting | Göttergraben / Godswar Pit, Aufstieg zum Gott | 1 |
| 3 | Held | Einzelheld mit Erbschaften | 1 |
| 4 | Run-Struktur | Raumkette → **Baum** (Knotentypen wählbar) | 1 → 3 |
| 5 | Skills | Große Skill-Bäume (3 × 30 Knoten), 12 Archetypen | 1 |
| 6 | Items | Schmal: 6 Slots, 5 Raritäten, 16 Affixes, 20 Aspects, keine Sets | 1 |
| 7 | Aufstieg | 10 Throne + Inkarnationen | 1 |
| 8 | Erfolge | ~70, 8 Kategorien, Unlock-Rewards | 1 |
| 9 | Stack | Vite + TS, prozedurale Pixel-Art, WebAudio, GH Actions | 1 |
| 10 | Kamera | Top-down, 4 Richtungen | 3 |
| 11 | Gegnerzahl | 4–6 pro Kampf | 3 |
| 12 | Takt | Kampf 10–20 s, Run 4–6 min | 3 |
| 13 | Tod | Ausrüstung sicher, Beute verloren | 3 |
| 14 | Inkarnation | Harter Reset + Echo-Anteil (25 % + 5 %/Inheritance) | 3 |
| 15 | Hub | 5 Tabs + Verträge + Story-Kette + Login-Bonus | 3 |
| 16 | Markt | Nur Tränke + Seelen↔Echo | 3 |
| 17 | Events | Risiko/Belohnung-Choices (3 Optionen) | 3 |
| 18 | Sprache | Nur Englisch | 3 |
| 19 | Titel | Godswar Pit | 3 |
| 20 | Gefährten | **Verworfen** (Single-Hero bleibt) | 3 |

## 9. Verbleibende offene Punkte

Alle inhaltlichen Entscheidungen sind getroffen. Offen sind nur Feinheiten, die der Implementierungs-Agent nach den gesetzten Regeln selbst treffen darf:

1. **Exakte Balancing-Werte** (Schadenskurven, Kosten, Drop-Raten) — Iterationsziel über `npm run balance`, keine Vorabfestlegung.
2. **Konkrete Item-/Skill-Namen** — generiert aus Präfix-/Suffix-Listen + Flavor-Texten; keine Vorabfestlegung nötig.
3. **Lokalisierung der Anomalien-Serien** und exakte Textlängen der Flavor-Texte.
4. **Layout-Details** der Tree-Ansicht (Zoom, Mindestgröße, Panning auf Touch).

---

## 10. Implementierungsstand (Stand 2026-10-20)

Die Phasen 0-5 sind umgesetzt. `npm run typecheck`, `npm run test` (70 Tests)
und `npm run build` sind grün.

| Bereich | Status | Fundort |
|---|---|---|
| Projekt, Tooling, CI | fertig | `package.json`, `.github/workflows/deploy.yml` |
| Deterministische Engine | fertig | `src/core/rng.ts`, `src/sim/engine.ts`, `src/sim/hash.ts` |
| Kampf, Status, Auto-Cast | fertig | `src/sim/combat.ts`, `src/sim/status.ts` |
| Baum, Expedition, Verwalter | fertig | `src/sim/tree.ts`, `src/sim/expedition.ts`, `src/sim/policy.ts` |
| Item-System, Beute, Codex | fertig | `src/sim/loot.ts`, `src/ui/inventory/inventory.ts` |
| 540 Knoten aus 12 Archetypen | fertig | `scripts/generate-trees.ts`, `src/data/nodes/trees/*.json` |
| 6 Klassen, 30 Skills, 30 Runen | fertig | `src/data/classes`, `src/data/skills` |
| 10 Zonen, 100 Gegner | fertig | `src/data/enemies`, `src/data/zones.json` |
| Throne, Automation, Inkarnation | fertig | `src/state/thrones.ts`, `src/state/automation.ts` |
| 70 Erfolge, 12 Events, 31 Anomalien | fertig | `src/data/achievements.json` u. a. |
| Grace Mirror (60), Inheritance Tree (80) | fertig | `src/data/meta/` |
| Offline-Simulation | fertig | `src/state/offline.ts` |
| Hub, Run-Screen, Inventar, Statistik | fertig | `src/ui/**` |
| Prozedurale Art und Audio | fertig | `src/art/**`, `src/audio/**` |
| Balance-Werkzeug | fertig | `scripts/balance.ts` |

### Bewusste Abweichungen

1. **Run-Länge:** Der Plan nennt 4-6 Minuten pro Run. Gemessen liegt ein
   vollständiger Run bei 2-4 Minuten, ein früh gescheiterter Run bei 1-2
   Minuten. Der Grund ist die Menge der Räume (12-16 Ebenen, davon rund 60 %
   Kampf) und die Kampfzeit von 5-12 Sekunden. Die Zahlen lassen sich mit
   `BALANCE.enemyHpBase` und `treeDepthFor()` jederzeit anheben.
2. **Klassen-Bäume** werden bei einer Inkarnation zurückgesetzt (Plan 2.10:
   "Baum-Nodes dieser Inkarnation"). Dauerhaft sind nur der Grace Mirror
   (Echo) und der Inheritance Tree (Inheritance).
3. **Aspects** sind 26 Stück (4 je Klasse + 2 universelle) statt 20, damit
   jede Klasse eigene Legendär-Effekte hat.
4. **Der Verwalter** (Steward) ist immer aktiv und übernimmt nach 3 Sekunden
   ohne Klick. Der Throne-Rang 5 gibt dem Spieler die Policy-Regler.
5. **PNG-Art** bleibt offen - die Sprite-Schnittstelle erlaubt den Wechsel
   1:1, ohne Spiellogik anzufassen.
