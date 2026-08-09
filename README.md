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
  Whare, stuff won in games with selling, rule-attempt history with a sparkle
  on cracked rules, Pet Shop placeholder, change-emoji, log out).
- `algebra.html` — the **Algebra Machine** game (see below).
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
- `admin.html` sits behind a 4-digit teacher code (only a hash of it lives
  in the page source). That keeps students out; a determined adult with the
  database key could still write directly. The proper upgrade remains
  Supabase teacher login + teacher-only write policies.

## The Algebra Machine (how a game runs)

- **Seller**: 90 seconds (live bar) to stock 7 products — at most 3 from the
  non-snacks shelf — then writes a secret rule on the laptop (up to two
  operations; the crack-reward prices difficulty: + 3 · − 4 · × 5 · ÷ 6,
  +2 for combining two). Chooses 1–3 customers; the shop appears in the mall
  under an animal alias (*Cute Rabbit*), never the real name.
- **Customers**: join a mall section (occupancy 1/3 … full); the seller
  starts when full. In joining order, each turn a customer drops a number in
  on a calculator pad (physical keyboard mirrors onto the pad) and sees
  input → output plus which mystery product falls out (products are shuffled
  onto 7 input ranges). Then they may guess the rule — spaces and "3x"
  shorthand both fine — or pass. Wrong guess passes the turn.
- **Winning**: crack it by your 2nd turn → all 7 products; 3rd → 6 … 7th →
  2; later → 1. Which ones you get is a weighted draw — snacks are common,
  non-snacks half as likely, electronics rarer (car rarest) but they sell
  for more Whare in your room. Confetti + a slot-machine reveal, the seller
  earns the crack-reward, and the attempt lands in both players' history.

## Roadmap

1. ✅ Teacher admin (roster, self-chosen codes, money, welcome cards, teacher lock)
2. ✅ Student entry with emoji avatar picker
3. ✅ Game hub: profile room (money, stuff + selling, rule-attempt history)
4. ✅ Algebra Machine multiplayer
5. Pet Shop — six silhouette pets, naming, feeding snacks, affection hearts,
   superpowers every 10 affection; prices tuned so ~2 games buys a pet

## Notes for future work

- All user-facing text is **English** (NZ classroom), warm primary-school tone.
- Currency is **Whare** (≈ NZ$1). Prices should let a student afford a pet
  after roughly two games.
- `assets/` for the games (products, mall, pets, rule laptop) live in the
  parent project for now; copy what each page needs into this folder when the
  page is built. Pet images hold two frames each — the second is the happy one.
