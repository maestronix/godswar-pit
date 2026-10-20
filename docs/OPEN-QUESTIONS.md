# GODSWAR PIT — Offene Fragen (Runde 3)

Stand: 2026-10-20 · Zugehöriger Plan: [`PLAN.md`](./PLAN.md)
Endgültige Ablage: `C:\Users\georg\Desktop\coding\gottergraben\docs\OPEN-QUESTIONS.md` (Schritt 1 der Implementierung)

**Status: Alle inhaltlichen Design-Entscheidungen sind getroffen.** Dieses Dokument listet nur noch,
was der Implementierungs-Agent selbst entscheiden darf bzw. was später nachjustiert wird.

---

## Erledigt (Runde 1–3) — Kurzform

| Thema | Entscheidung |
|---|---|
| Kernschleife | Auto-Expedition + persistenter Meta-Baum |
| Setting | Godswar Pit (Ashvale / Göttergraben), Aufstieg zum Gott |
| Held | Einzelheld mit Inheritance (Ascension-Runs) |
| Run-Struktur | **Aufsteigender Baum**, Knotentypen wählbar, Inhalte verborgen |
| Kamera | Top-down, 4 Blickrichtungen |
| Gegnerzahl | 4–6 pro Kampf (Elite 6–8, Boss + Adds) |
| Takt | Kampf 10–20 s · Run 4–6 min · Zone 3–5 min |
| Tod | Ausrüstung überlebt, Beute zerfällt, Run-Skillpunkte weg |
| Inkarnation | Harter Reset + 25 % Echo-Anteil (+5 % je Inheritance) |
| Skills | 6 Klassen × 3 Bäume à ~30 Knoten, 12 Archetypen, Runen, Auto-Cast, Respec |
| Items | 6 Slots, 5 Raritäten, ~16 Affixes, ~20 Aspects, kein Set/Gem/Handwerk |
| Tod-Verlust | siehe PLAN.md 2.8 |
| Währungen | 3: Souls · Divine Echo · Inheritance |
| Throne | 10 Automation-Ränge (Vorschau → Parallel-Expeditionen → Auto-Equip → Verwalter → Auto-Reroll → …) |
| Hub | 5 Tabs (Contracts, Smithy, Envoy, Grace Mirror, Market) + Login-Bonus + 10-Kapitel-Story |
| Markt | Nur Tränke (3 Slots) + Seelen↔Echo — kein Item-Verkauf |
| Verträge | 3 rotierende (24 h) + Story-Kette |
| Events | Risiko/Belohnung-Choices, 3 Optionen |
| Erfolge | ~70, 8 Kategorien, Rewards = echte Unlocks |
| Leaderboard | Lokale Best-Runs + Share-Text (+ optional `leaderboard.json` per PR) |
| Sprache | Nur Englisch |
| Titel | Godswar Pit |
| Gefährten/Party | **Verworfen** — Single-Hero |
| Stack | Vite + TS (strict), DOM/CSS-UI, Canvas 480×270, prozedurale Pixel-Art, WebAudio, Vitest, GitHub Actions → Pages |

---

## Offen — vom Implementierungs-Agenten selbst zu entscheiden

1. **Exakte Balancing-Werte** — Schadenskurven, Knotenkosten, Drop-Raten, Seelen-Ertrag.
   *Vorgabe:* iterativ über `npm run balance` (1 000 simulierte Runs/Klasse) tunen, nicht vorab festlegen.
   *Akzeptanz:* Farm-Zeit pro Throne und Seelen/Minute wachsen monoton, kein/Zone-Hotspot.
2. **Konkrete Item-, Skill- und Affix-Namen** — aus Präfix-/Suffix-Listen + Flavor-Text generieren.
   *Vorgabe:* keine Kollisionen, plausible Fantasy-Namen, Generator-Statistik-Test.
3. **Anomalien-Serien je Inkarnation** — 5–7 Modifikatoren pro Serie,难度 steigend, keine_combinationen die den Run unspielbar machen.
4. **Tree-UI-Details** — Zoomstufen, Mindestknotengröße, Panning per Touch, Highlighting des aktiven Pfades.
5. **Musik-Theme pro Zone** — Tonart/Tempo/Instrumentierung der 10 Zonen-Loops.

---

## Nicht entschieden, bewusst zurückgestellt

- **PNG- statt prozedurale Art.** Die Sprite-Schnittstelle (`drawSprite`) erlaubt 1:1-Ersetzung; ein Wechsel ist ein Content-Thema, kein Architektur-Thema.
- **Multiplayer / Cloud-Sync / Leaderboard-Server.** Ohne Backend bewusst draußen.
- **Mobile-First.** Responsive Desktop-first; Touch wird unterstützt, aber nicht priorisiert.

---

## Stand der Umsetzung (2026-10-20)

Alle fünf offenen Punkte sind entschieden:

| # | Thema | Entscheidung der Implementierung |
|---|---|---|
| 1 | Balancing-Werte | Iterativ über `npm run balance` gemessen. Erste Messung: ein nackter Held gewann Zone 1 und starb an der ersten echten Wand in Zone 4. Die Werte stehen in `src/data/balance.ts`. |
| 2 | Namen | 26 Aspects, 16 Affixes mit Präfix-/Suffix-Listen, 30 Skills mit eigenen Runen. Der Namensgenerator sitzt in `src/sim/loot.ts` (`buildItemName`), getestet in `tests/loot.test.ts`. |
| 3 | Anomalien-Serien | 5 Serien mit je 5-7 Anomalien (`src/data/anomalies.json`). Serie 1 ist mild, Serie 5 hart. Die Anomalien greifen mechanisch (extra Elites, Gegnerhärte, Seelensteuer, heilende Gegner, verfluchte Räume). |
| 4 | Tree-UI-Details | SVG-Baum mit Pan (die Ansicht ist scrollbar), Spalten nach Tiefe, Tooltips mit Kosten und Wirkung. Eine Zoomstufe ist offen - die Bäume sind bisher nur scrollbar. |
| 5 | Musik-Themes | 10 Zonen-Loops in `src/audio/music.ts` mit eigener Tonart, Skala und Tempo pro Zone, adaptiver Percussion. |

**Noch offen für später:**

- Der Skill-Baum hat kein Zoom/Pinch (nur Scrollen). Auf kleinen Touch-Geräten
  wäre ein Zwei-Finger-Zoom die bessere Lösung.
- Die Gemischtsprache in diesem Dokument (Deutsch/Englisch) stammt aus der
  Planungsphase. Die Codebasis, die UI und die Item-Namen sind vollständig
  englisch.
