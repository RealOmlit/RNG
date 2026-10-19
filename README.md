# RNGdle

A small, satirical daily game of pure luck. One main number every 24 hours, Entropy Points, mathematical and meme badges, daily quests for bonus rolls, and a shared daily leaderboard.

## Run

Requires Node.js 22.13+ (Node.js 24 recommended). No dependency installation or build step.

```sh
npm start
```

Open http://localhost:3000. `npm run dev` starts the same server. Override `PORT` to change the port.

The Node server serves the frontend and API, generates all ranked numbers with `crypto.randomInt`, and persists players, rolls, quest actions, and claims in SQLite at `data/rng.sqlite`. Set `RNG_DATABASE` to another persistent path. Use a single Node instance with a persistent writable disk; this local SQLite implementation is not configured for stateless or multiple-instance hosting. Set `COOKIE_SECURE=true` behind HTTPS. Nothing is published by starting the local server.

## Rules

- One **main daily roll every full 24 hours**, measured from the previous main roll. It is stored before the reveal and cannot be rerolled by refreshing.
- Outcomes are uniformly distributed over **0 through 1,000,000 inclusive**: 1,000,001 possibilities. Leading zeroes fill six positions; 1,000,000 displays seven digits as a special boundary result.
- **100 badges** cover digit patterns, mathematical properties, internet culture, and special numbers. New additions include full houses, triple pairs, consecutive halves, cubes, polygonal numbers, factorials, semiprimes, Smith numbers, happy numbers, automorphic numbers, angel numbers, HTTP codes, and exact cultural references. Leading zeroes count toward digit-pattern badges; math properties use the numeric value.
- Each match awards **Entropy Points (EP)**. Badge EP is computed from its exact frequency across the full number space: `max(5, round(-log10(frequency / 1000001) * 25 / 5) * 5)`. Matches stack; there are no mode multipliers or paid boosts.
- EP determines nine rarity tiers: **Trash** (0+), **Common** (45+), **Uncommon** (70+), **Rare** (110+), **Epic** (170+), **Legendary** (260+), **Mythic** (400+), **Divine** (600+), **Anomaly** (900+). Thresholds account for the expanded badge set; every tier remains attainable.
- The standard reveal locks digits at increasingly long intervals, holding the final digit until about 11.8 seconds (13 seconds for the seven-digit boundary). Then badges appear individually, increasing the EP total and rarity. Sound adds lock tones and a final-digit pulse when enabled. **Reveal now** skips the ceremony without changing the saved result. **Less suspense** and the OS reduced-motion preference complete the reveal in under a second and remove motion effects.
- The cabinet supports search, category filters, discovered/missing filters, rarity/name sorting, collection progress, and exact per-badge odds. Newly discovered badges are marked on fresh results.

## Quests and extra rolls

Four quests each grant **one separate bonus roll**, claimable once per UTC day:

1. Complete a main daily roll.
2. Read and acknowledge the rules.
3. Successfully copy a result for sharing.
4. Find three distinct badges in that UTC day's main and bonus rolls.

Normal bonus rolls have identical odds and EP rules. They never overwrite a main roll, reset its cooldown, or enter the ranked leaderboard. Unspent bonus rolls expire at 00:00 UTC. Reading and copying are convenience quests; those actions are client-reported, while reward eligibility, single claims, balances, and spending are enforced by the server.

## Secret code: Infinity mode

Click **Got a code?** in the footer and enter **123456**. This unlocks **Infinity mode**: unlimited extra rolls with guaranteed **Anomaly** rarity. The main roll button becomes **Roll with infinite luck**, and an Infinity banner, themed reels, and a top-tier celebration mark the mode. Skip and reduced-motion controls still work.

Infinity draws pick from the six numbers that reach Anomaly under the current scoring rules: 0, 1, 2, 5, 6, and 999999. Every matching badge and its actual EP are saved. Infinity rolls are marked as boosted in history and sharing, stay outside the leaderboard, and preserve your main daily result, cooldown, and earned quest-roll balance. Ranked daily rolls always use the normal uniform number generator.

Use **Return to normal play** to pause. The unlock persists; click **∞ Infinity mode** in the footer to enable it again without re-entering the code. Unlocks, enabled/paused state, and boosted results survive reloads in both local-browser and server-backed play. Active Infinity mode restores your most recent boosted result on reload. Incorrect codes show an inline error and grant nothing.

## Leaderboard and saves

All players on the **same running server** share a daily leaderboard, ordered by main-roll EP and then roll time. Only real main rolls appear. Bonus rolls are excluded. The board shows the top 25 and your rank. Sessions use an anonymous HttpOnly cookie, with an optional display name. No account or cross-device identity is implemented; clearing cookies creates a new anonymous player.

The frontend can also run on a static host. It explicitly shows **Local play**, saves progress in that browser, and explains that a shared leaderboard requires `npm start`. Local outcomes cannot be uploaded as ranked results. Existing RNG // VOID and LUCKY / daily browser saves migrate into local history; EP is recalculated under the new rules. Old saves with only a date use that date's UTC midnight as their best available timestamp.

Existing local and server rolls automatically gain the expanded badge matches and updated EP. SQLite scores migrate on startup when scoring rules change, keeping history and leaderboard scores consistent. Existing cooldowns and quest claims are preserved. Local play uses Web Locks where supported to serialize rolls and claims across tabs. If browser storage fills up, this tab retains new progress in memory and explains that it cannot persist it. A lost server response recovers an already committed daily or bonus roll instead of spending another roll.

## Verify

```sh
npm test
```

Thirty-three checks cover exhaustive frequencies for all 100 badges over all 1,000,001 outcomes, EP consistency and attainable tiers, known mathematical examples and exact modular arithmetic, digit patterns and the seven-digit boundary, the full 24-hour lock, all quests and claim rules, UTC expiry, leaderboard exclusion and ordering, server-generated scoring, private sessions, SQLite durability and score migration, frontend/API integration, progressive digit and badge reveals, skipping, reduced motion, cabinet controls, local save upgrades, full-storage recovery, lost bonus responses, mutation locking, honest static fallback, secret-code validation, unlimited Anomaly rolls, preserved quest balances and daily ranking, private unlocks, schema upgrades, secret persistence, and enabling/pausing Infinity in the frontend. The frontend checks use a DOM harness; visual browser testing is separate.

To deliberately recalibrate badge frequencies after changing matching rules:

```sh
node scripts/calibrate.cjs
npm test
```

## GitHub Pages

Published at https://realomlit.github.io/RNG/ from the repository's `main` branch, root directory. `.nojekyll` publishes the static assets directly. Pushes to `main` update the site automatically.

On GitHub Pages, the game starts directly in local-save mode without requesting a nonexistent backend. Daily rolls, quest rewards, EP, badges, sharing, and browser saves all work. The shared leaderboard requires the separately hosted Node server; this edition clearly labels rankings as unavailable. No database files or session data are committed.
