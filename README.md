# Knightly Chess Platform MVP

Knightly is a Chess.com-style MVP built with Next.js, TypeScript, Tailwind CSS, `chess.js`, and `react-chessboard`.

## Implemented Features

- Landing page with product sections, AI Coach, ratings, and Pro CTA
- Registration, login, logout, editable profile, local session recovery
- Full legal chess validation through `chess.js`
- Local two-player game with drag/drop, move history, turn display, last move and legal target highlights
- Play vs bot with Elo levels from 200 to 2400 plus Stockfish Max
- Play with friend page with room-link placeholder and local two-player fallback
- Save games to local storage with PGN, final FEN, result, moves, and analysis
- Game history table with Open and Analyze actions
- Analysis board with forward/back controls, accuracy, move labels, AI Coach summary, and Stockfish deep analysis
- Chess puzzles with adaptive 800 starting puzzle rating, harder rated puzzles, click-to-move validation, scoring, streaks, Puzzle Rush, Survival, attempts, and solved counter
- Puzzle validation script that blocks impossible starting positions and king-capture solutions
- Learning section, leaderboard, settings, and Pro/Pricing page
- Supabase-ready client helper and SQL schema in `supabase/schema.sql`
- Supabase Auth/data paths for profiles, games, puzzle progress, and Realtime friend rooms with local fallback
- Stockfish analysis with engine line details and an evaluation graph
- Puzzle leaderboard and per-category stats

## Not Completed Yet

- Real Supabase Auth wiring in the UI
- A live Supabase project must still be created and configured with `.env.local`
- Stripe payments
- Production deployment URL and GitHub remote require your GitHub/Vercel accounts

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Replace the local-storage auth/persistence adapters with Supabase calls when moving from MVP demo mode to production mode.

## Deployment

The project is ready for Vercel:

```bash
npm run build
vercel
```

Set the Supabase environment variables in Vercel before production deployment.

## GitHub and Vercel Remote Setup

```bash
git init
git add .
git commit -m "Initial chess platform MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Then import the GitHub repo in Vercel and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
