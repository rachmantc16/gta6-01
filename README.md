# gta6-01

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rachmantc16/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rachmantc16/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Marisol Bay** is an original top-down open-world crime game that runs entirely in the browser — no build step, no assets, just HTML, CSS and JavaScript modules. You are Danny Reyes, a driver in a sunset-soaked coastal city, running jobs for fixer Ms. Vega at Club Solstice: pickups, a timed cash delivery under police heat, and a marina heist. Between jobs the city is yours — steal cars, dodge or fight the law, and watch your wanted stars.

## How to play

Open `game/index.html` in a browser (or serve the `game/` folder) and press Enter.

- **WASD / arrow keys** — walk and drive · **Shift** — run
- **E** — talk, get in / out of a car, steal a car
- **Space** — punch on foot, handbrake in a car
- **P** — pause · **M** — mute

Finish all three of Vega's missions to own the bay. Get caught and you wake up at the police station, lighter in the wallet; get flattened and it is the hospital. Progress, cash and completed missions save automatically in your browser.

## Run it

Hand the entry in (copies `game/` and `screenshots/` to the output folder and writes `dossier.json`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

To play locally with the kit's dev server instead:

```sh
node serve.ts
```

<sub>Entered on [make.fun](https://make.fun/?ref=pas2z9sw&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
