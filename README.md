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
- **32 badges** cover primes, Harshad numbers, squares, Fibonacci numbers, repeated digits, palindromes, sequences, and cultural references.
- Each match awards **Entropy Points (EP)**. Badge EP is computed from its exact frequency across the full number space: `max(5, round(-log10(frequency / 1000001) * 25 / 5) * 5)`. Matches stack; there are no mode multipliers or paid boosts.
- EP determines nine rarity tiers: **Trash, Common, Uncommon, Rare, Epic, Legendary, Mythic, Divine, Anomaly**.
- The standard reveal takes about 7.2 seconds, locking each digit in sequence. The seven-digit boundary takes about 7.7 seconds. Reduced suspense and the OS reduced-motion preference shorten the reveal and remove motion effects.

## Quests and extra rolls

Four quests each grant **one separate bonus roll**, claimable once per UTC day:

1. Complete a main daily roll.
2. Read and acknowledge the rules.
3. Successfully copy a result for sharing.
4. Find three distinct badges in that UTC day's main and bonus rolls.

Bonus rolls have identical odds and EP rules. They never overwrite a main roll, reset its cooldown, or enter the ranked leaderboard. Unspent bonus rolls expire at 00:00 UTC. Reading and copying are convenience quests; those actions are client-reported, while reward eligibility, single claims, balances, and spending are enforced by the server.

## Leaderboard and saves

All players on the **same running server** share a daily leaderboard, ordered by main-roll EP and then roll time. Only real main rolls appear. Bonus rolls are excluded. The board shows the top 25 and your rank. Sessions use an anonymous HttpOnly cookie, with an optional display name. No account or cross-device identity is implemented; clearing cookies creates a new anonymous player.

The frontend can also run on a static host. It explicitly shows **Local play**, saves progress in that browser, and explains that a shared leaderboard requires `npm start`. Local outcomes cannot be uploaded as ranked results. Existing RNG // VOID and LUCKY / daily browser saves migrate into local history; EP is recalculated under the new rules. Old saves with only a date use that date's UTC midnight as their best available timestamp.

## Verify

```sh
npm test
```

Fourteen checks cover exhaustive badge frequencies over all 1,000,001 outcomes, EP consistency, math and cultural badges, the seven-digit boundary, the full 24-hour lock, all quest paths, duplicate claims, UTC expiry, leaderboard exclusion and ordering, server-generated scoring, private sessions, SQLite durability, frontend/API integration, sequential reveal, and honest static fallback. The frontend checks use a DOM harness; visual browser testing is separate.

To deliberately recalibrate badge frequencies after changing matching rules:

```sh
node scripts/calibrate.cjs
npm test
```

## GitHub Pages

Published at https://realomlit.github.io/RNG/ from the repository's `main` branch, root directory. `.nojekyll` publishes the static assets directly. Pushes to `main` update the site automatically.

On GitHub Pages, the game starts directly in local-save mode without requesting a nonexistent backend. Daily rolls, quest rewards, EP, badges, sharing, and browser saves all work. The shared leaderboard requires the separately hosted Node server; this edition clearly labels rankings as unavailable. No database files or session data are committed.
