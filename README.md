# Charlie's Class

A class website for Year 6/7 maths games, built to run free on **GitHub Pages**
(static files) + **Supabase** (shared live data across the Chromebooks).

- `index.html` — student entry: *Welcome to Charlie's Class* → Boys / Girls →
  tap your name → secret code. **Students choose their own 4-digit code** the
  first time (type it, then type it again to confirm); after that they just
  type it to log in. Then they pick an **emoji avatar** (People / Animals /
  Plants / Gestures, with skin colours for people and gestures) and land in
  the hub.

  No browser is ever sent the class's codes: the site reads a `code_set`
  true/false flag and never the `code` column itself. A forgotten code is
  cleared by the teacher (admin 🔑), not looked up.
- `hub.html` — game hub: name + emoji top-right opens **My room** (money in
  Whare, stuff won in games, Pet Shop placeholder, change-emoji, log out).
  The Algebra Machine card sits here, marked *coming very soon*.
- `admin.html` — **teacher admin**: roster split into boys and girls, add /
  edit / remove students, whether each student has chosen a code yet, their
  money (Whare), a 🔑 button that clears a forgotten code, and a button that
  prints A4 welcome cards (10 per page).
- `js/` — `config.js` (your Supabase keys), `roster.js` (seed class list),
  `store.js` (one data layer used by every page), `emoji.js` (avatar picker).
- `supabase/schema.sql` — run once in Supabase to create + seed the database.

Students go by **first name only** (e.g. *Tepono*), on screen and on the
printed cards.

## It is live

| | |
| --- | --- |
| Students | **https://harufocus.com** |
| Teacher admin | **https://harufocus.com/admin.html** |
| Repo | `bluemuple/charlies-class` (GitHub Pages, `main` branch, root) |
| Database | Supabase project `charlies-class`, table `public.students` |

Publishing a change:

```bash
git add -A && git commit -m "..." && git push
```

GitHub Pages rebuilds in under a minute. The `CNAME` file in this folder is
what claims `harufocus.com` — don't delete it.

## Local demo mode

Blank out both values in `js/config.js` and the site runs entirely in the
browser (seeded from `js/roster.js`), which is handy offline. The header badge
always says which mode you are in: *Live — Supabase* or *Local demo*.

## The printed welcome cards

*Print welcome cards* lays out one card per student (boys first, then girls)
on A4, two columns × five rows = 10 per page, with dashed cut lines. Each card
carries the student's name, `harufocus.com`, and the three steps for making
their own code. **No codes are printed** — there are none to print.

## Things to check in the roster

The boy/girl split was read from the class photos (`names.png`) — worth a
quick scan; ✏️ Edit can move anyone to the other group or fix a spelling.

## Testing

Headless tests with jsdom (once: `npm install jsdom` here or in a parent
folder):

```bash
node test.js
```

## Security notes (plain honesty)

This is a class game with play money, so the setup is deliberately simple.

- The site never downloads the `code` column — only `code_set` — so a student
  poking at DevTools on the name screen does **not** see everyone's codes.
- But the publishable key can still write to the table, and someone determined
  could query `code` directly. So: tell the class to pick a code they use
  **nowhere else**. It guards a snack game, not a bank.
- `admin.html` is a public URL. Anyone who guesses it can reset codes, edit
  money, or remove students. Fixing that properly means Supabase teacher
  login + policies that only let the teacher write — worth doing before the
  address is widely known.

## Roadmap (planned pages)

1. ✅ Teacher admin (roster, codes, money, printed cards)
2. ✅ Student entry with emoji avatar picker (first login + editable later)
3. ✅ Game hub (basic): profile room with money; games plug in here
4. **Algebra Machine** (multiplayer): Seller picks products (snacks +
   max-3 non-snacks, 7 total, 90-s timer) and writes a rule (up to two
   operations; harder rule = bigger reward); buyers join live mall sections
   (mall.jpg background), take turns guessing; slot-machine prize animation,
   confetti; non-snacks are rarer prizes but sell for more Whare
5. Pet Shop — six silhouette pets, naming, feeding snacks, affection hearts,
   superpowers every 10 affection

## Notes for future work

- All user-facing text is **English** (NZ classroom), warm primary-school tone.
- Currency is **Whare** (≈ NZ$1). Prices should let a student afford a pet
  after roughly two games.
- `assets/` for the games (products, mall, pets, rule laptop) live in the
  parent project for now; copy what each page needs into this folder when the
  page is built. Pet images hold two frames each — the second is the happy one.
