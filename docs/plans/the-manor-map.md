# The Manor — Map Design

**Created:** 2026-02-15
**Status:** Draft
**Map ID:** `manor`

---

## Overview

The Manor is the first map for Double Agent. A space station with a medieval-estate naming scheme — rooms named after castle/manor areas, but the tasks and flavor remain sci-fi.

---

## Room Layout

```
                    ┌─────────────┐
                    │   Library   │
                    │  (2nd flr)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌────┴────┐ ┌─────┴─────┐
        │  Medical  │ │  Logs   │ │  Weapons  │
        └─────┬─────┘ └────┬────┘ └─────┬─────┘
              │            │            │
              └─────┬──────┴──────┬─────┘
                    │             │
              ┌─────┴─────┐ ┌─────┴─────┐
              │   Great   │ │ Northeast │
              │   Hall   ─┤│ Passage   │
              └─────┬─────┘ └─────┬─────┘
                    │             │
        ┌───────────┼─────┬───────┴───────┐
        │           │     │               │
  ┌─────┴─────┐ ┌───┴───┐ │         ┌─────┴─────┐
  │  Council  │ │Kitchen│ │         │  Admin-   │
  │  Chamber  │ │       │ │         │ istration│
  └───────────┘ └───────┘ │         └─────┬─────┘
                          │               │
                    ┌─────┴─────┐   ┌─────┴─────┐
                    │  Engine   │   │ Electrical│
                    └───────────┘   └───────────┘
```

### Rooms

| ID | Name | Exits | Features |
|----|------|-------|----------|
| `great-hall` | Great Hall | kitchen, council-chamber, engine, northeast-passage, medical, logs, weapons | Central hub, emergency button |
| `council-chamber` | Council Chamber | great-hall | **Dead end**, emergency meetings only |
| `kitchen` | Kitchen | great-hall | **Dead end**, few tasks, no vents/sabotage |
| `engine` | Engine | great-hall | Tasks, standard room |
| `electrical` | Electrical | administration | **Dead end**, lights sabotage fix |
| `administration` | Administration | electrical, northeast-passage | Kill records computer (redacted names) |
| `northeast-passage` | Northeast Passage | great-hall, administration | Corridor |
| `medical` | Medical Bay | great-hall, library | Standard room |
| `logs` | Logs Room | great-hall | Ship logs interactable |
| `weapons` | Weapons Bay | great-hall | Tasks |
| `library` | Library | medical | **Dead end, 2nd floor**, many tasks, dangerous |
| `navigation` | Navigation | TBD | Tasks |
| `life-support` | Life Support | TBD | Tasks |
| `security` | Security | TBD | Tasks, cameras? |
| `communication` | Communication | TBD | **Dead end**, comms sabotage fix |

---

## Vent Networks (2)

Players can vent between rooms in the same network.

### Network 1 (3 rooms)
- Electrical
- Administration
- Engine

### Network 2 (4 rooms)
- Security
- Medical
- Great Hall
- Weapons

---

## Sabotage Types

| Sabotage | Fix Location(s) | Description |
|----------|-----------------|-------------|
| Lights Out | Electrical ONLY | Moles can see, loyalists cannot |
| Communications | Communication | Disables certain info |
| O2/Life Support | Life Support | Timer-based emergency |
| Lockdown | **No fix point** | 30s expiry, doors unlock via random single-digit code |

---

## Task Distribution

- **41 total tasks** across the map
- All tasks are **variations of 8 task types**:
  1. Sequence Repetition (Memory)
  2. Word Math (Logic)
  3. Sliding Tile (Spatial/Logic)
  4. Battleship (Deduction)
  5. Hot-n-Cold (Deduction)
  6. Hold Button (Nerve/Tension)
  7. Code Breaker (Deduction)
  8. Transfer Fuel (Logic)

- Tasks assigned **randomized but weighted towards evenness**
- Some tasks may have 0 players, others may have all 6 loyalists doing them
- Flavor texts added after playtesting settles locations

---

## Special Features

### Kill Records (Administration)
- Computer in Administration shows recent kills
- **Names are redacted** for privacy
- Players can see WHEN and WHERE kills happened, but not WHO

### Body Reporting
- **Must be in the same room as the body to report it**
- You know where bodies are (announced), but must travel there
- This forces movement and creates opportunities for imposters

### Library (2nd Floor)
- Two-deep dead end (Medical → Library)
- Many tasks concentrated here
- **Dangerous** — easy to get trapped

---

## Configuration

All sabotage counts configurable per map:
```typescript
interface MapConfig {
  sabotageTypes: SabotageType[];
  ventNetworks: VentNetwork[];
  taskPool: TaskDefinition[];
  startingRoom: string;
}
```

---

## Open Questions

1. Navigation, Life Support, Security, Communication room connections?
2. Exact task counts per room?
3. Camera system in Security — live feeds or recordings?
4. Library second-floor mechanic — any gameplay impact?

---

## Changelog

- **2026-02-15**: Initial draft from design discussion with Blake
