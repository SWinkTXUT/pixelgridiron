# Pixel Gridiron

A pixelated, Retro Bowl–style football game where you are the **head coach and GM** of an NFL team.
Plain HTML/CSS/JS, no build step. Open `index.html` in a browser (phone, tablet or desktop).

## Features
- **32 NFL teams**, 8 divisions, 17‑game season + 7‑team‑per‑conference playoffs and a championship game.
- **Real-time pixel gameplay**: pick plays, throw to receivers, scramble with the QB, juke as a ball carrier, take control of a defender (tackle, dive, jump passes, swim past blockers).
- **Every position has a spot**: QB, RB, WR1‑3, TE, LT/LG/C/RG/RT, LE/DT/DT/RE, OLB/MLB/OLB, CB×2, FS/SS, K, P. 53‑man rosters with a **$200M salary cap**.
- **Coach tools during the game**: Subs / depth chart with fatigue bars (tired players are slower and weaker), play calling, defensive calls (base, blitz, zone, run stop), 4th‑down choices (punt / field goal meter / go for it).
- **Roster management**: trades with AI (players + draft picks, valued by rating/age/position), free agency (3 days, AI teams compete), re-signing expiring contracts, cutting players.
- **7‑round draft** with scouted (imperfect) prospect grades, draft order by record, tradable picks.
- **Progression**: players grow, age, decline, retire and get injured.
- **Team editor**: city, nickname, abbreviation, stadium, both colors, player names / numbers / ratings / skin tone / hair.
- **Mascots** with sideline cheer animations on scores and big plays, plus a **mascot editor** (body, colors, hat, prop, sunglasses, cheer style). Each cheer style gives a small gameplay perk and the crowd **hype meter** boosts your team's ratings.
- Auto-saves in your browser (`localStorage`). Random player names every new career.

## Controls
| Action | Touch | Keyboard |
|---|---|---|
| Move | drag anywhere (floating stick) | WASD / arrows |
| Throw to receiver | tap the receiver (numbered) | `1`‑`5` |
| Juke / dive / throw away | big round button | Space / Z |
| Take over a defender | tap that defender | – |
| Pause | II button | P |

## Layout
```
index.html        entry point
css/style.css     retro UI
js/data.js        teams, names, positions, constants
js/league.js      players, contracts, schedule, trades, draft, free agency, saves
js/sprites.js     pixel mascots, portraits, player sprites
js/match.js       real-time match engine + canvas renderer
js/ui.js          menus, editors, controls
```
