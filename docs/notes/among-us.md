# Among Us - Game Rules & Mechanics

**Source:** Wikipedia, Innersloth
**Reference:** https://en.wikipedia.org/wiki/Among_Us

## Overview

Among Us is a multiplayer social deduction game for 4-15 players. Most players are Crewmates, a small number are secretly Impostors. Inspired by the party game Mafia and the film *The Thing*.

## Win Conditions

### Crewmates Win
- Complete all assigned tasks, OR
- Eject all Impostors via voting

### Impostors Win
- Kill enough Crewmates so #Crewmates = #Impostors, OR
- Sabotage a critical system that Crewmates fail to fix in time

## Core Mechanics

### Roles

**Crewmates (Majority)**
- Complete tasks around the map (minigames, puzzles, toggles)
- Report dead bodies to trigger meetings
- Call Emergency Meetings (limited)
- Vote to eject suspected Impostors
- Use surveillance systems (cameras, door logs, vitals)

**Impostors (1-3 players)**
- Pretend to perform tasks (cannot actually complete them)
- Kill Crewmates (cooldown between kills)
- Use ventilation ducts ("venting") to travel quickly
- Sabotage systems (lights, oxygen, reactors, etc.)
- Blend in during meetings, accuse innocents

**Ghost (Dead Players)**
- Can still complete tasks (Crewmate ghosts) or sabotages (Impostor ghosts)
- Cannot be seen by or interact with living players
- Can chat with other ghosts, pass through walls

### Meetings & Voting

1. Triggered by: Reporting a dead body OR pressing Emergency Meeting button
2. Discussion phase: Players discuss via text/voice chat
3. Voting: Each player votes for who they think is an Impostor (or skips)
4. Ejection: Player with plurality of votes is ejected (unless tie or skip wins)
5. Ejected player becomes a ghost

### Evidence & Detection

**Visual Tasks:** Tasks with visible animations (e.g., Medbay scan). Impostors cannot do these—seeing someone do one proves they're Crewmate.

**Surveillance Systems:**
- The Skeld: Security cameras
- MIRA HQ: Door log sensors
- Polus: Vitals indicator (shows living status)

**Suspicious Behavior:**
- Seen killing (unless Shapeshifter)
- Seen venting (unless Engineer or Shapeshifter)
- Not doing visual tasks when others are watching
- Inconsistent alibis

### Sabotage

Impostors can sabotage:
- **Lights:** Reduces Crewmate vision
- **Oxygen:** Must be fixed at two panels or everyone dies
- **Reactor:** Must be fixed at two panels or everyone dies
- **Communications:** Disables certain UI elements
- **Doors:** Lock doors temporarily (map-dependent)

## Special Roles (2021+ Updates)

### Crewmate Variants
- **Engineer:** Can use vents (limited capacity)
- **Scientist:** Can check vitals from anywhere
- **Guardian Angel:** First dead Crewmate; can protect living players from kills
- **Tracker:** Can track another player's location (limited time)
- **Noisemaker:** When killed, alerts others with visual indicator of death location
- **Detective:** Can open case files and interrogate to find where players were during murders

### Impostor Variants
- **Shapeshifter:** Can temporarily morph into another player's appearance
- **Phantom:** Can briefly turn invisible
- **Viper:** Can dissolve bodies over time, leaving no evidence

## Maps

1. **The Skeld** - Spaceship (original map)
2. **MIRA HQ** - Office building (tight quarters)
3. **Polus** - Planet base (outdoor areas)
4. **The Airship** - Henry Stickmin-themed (multiple floors, ladders)
5. **The Fungle** - Mushroom jungle (added Oct 2023)

## Game Settings (Host Configurable)

- Player speed
- Number of Emergency Meetings
- Kill cooldown
- Kill distance
- Impostor vision vs Crewmate vision
- Visual tasks on/off
- Anonymous votes
- Task count (short vs long)
- Voting time
- Discussion time

## Hide & Seek Mode (Dec 2022)

Alternative game mode:
- Single Impostor (seeker) - identity known to all
- No meetings or ejections
- Crewmates hide/flee, complete tasks to reduce timer
- Impostor has countdown timer to kill everyone
- Impostor cannot vent or sabotage
- Crewmates get proximity indicator to Impostor

## AI Implementation Considerations

For among-us-ai:

1. **State Machine:** Game has clear phases (lobby → tasks → meeting → voting → ejection)
2. **Information Asymmetry:** Impostors know more than Crewmates
3. **Task System:** Needs minigame implementations or abstractions
4. **Voting Logic:** Plurality-based, handle ties/skips
5. **Sabotage Timers:** Critical systems need countdowns
6. **Role Assignment:** Random at game start, configurable ratios
7. **Death Mechanics:** Instant kill, no revival (except Guardian Angel protection)
8. **Win Detection:** Check after each kill, ejection, task completion, sabotage
