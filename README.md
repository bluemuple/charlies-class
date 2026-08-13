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
- `paving.html` — **Paving Race** 🧱, a 1v1 perimeter-and-area race (see below).
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
| Students | **https://bluemuple.github.io/charlies-class/** |
| Teacher admin | **https://bluemuple.github.io/charlies-class/admin.html** |
| Repo | `bluemuple/charlies-class` (GitHub Pages, `main` branch, root) |
| Database | Supabase project `charlies-class`, table `public.students` |

> **Why not harufocus.com?** The school's Palo Alto firewall DNS-sinkholes
> that domain (to 198.135.184.22), so it is unreachable on the school
> network — the GoDaddy DNS itself is correct and untouched. The custom
> domain is deliberately detached so the github.io address serves directly.
> Once school IT whitelists harufocus.com: restore the `CNAME` file
> (single line: `harufocus.com`), push, and swap the welcome-card address
> in `admin.html` back.

Publishing a change:

```bash
git add -A && git commit -m "..." && git push
```

GitHub Pages rebuilds in under a minute. (There is currently no `CNAME`
file — that is intentional while the school blocks harufocus.com.)

## Local demo mode

Blank out both values in `js/config.js` and the site runs entirely in the
browser (seeded from `js/roster.js`), which is handy offline. The header badge
always says which mode you are in: *Live — Supabase* or *Local demo*.

## The printed welcome cards

*Print welcome cards* lays out one card per student (boys first, then girls)
on A4, two columns × five rows = 10 per page, with dashed cut lines. Each card
carries the student's name, the site address, and the three steps for making
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
  starts when full. The game screen is the classic **Algebra Vending
  Machine**: the machine in the centre (rule box reads 🔒 ? ? ? until the
  end), the money-bill input top right, and *Results so far* bottom right
  showing **who** put **what** in and what came out. In joining order, each
  turn a customer types a number on the money (the machine's own keypad
  works too), the money flies onto the rule box, the machine shakes, and the
  product grows out of the tray with its output value. Then they may guess
  the rule — spaces and "3x" shorthand both fine — or pass. Wrong guess
  passes the turn.
- **Winning**: crack it by your 2nd turn → all 7 products; 3rd → 6 … 7th →
  2; later → 1. Which ones you get is a weighted draw — snacks are common,
  non-snacks half as likely, electronics rarer (car rarest) but they sell
  for more Whare in your room. Confetti + a slot-machine reveal, the seller
  earns the crack-reward, and the attempt lands in both players' history.

## Paving Race 🧱 (how a game runs)

Follows *Finding the Perimeter and the Area of Rectangles* — Matua Henare's
allotment, paved with 1 m² stones. Play it **after** the lesson: it rehearses
the relationship rather than teaching it.

- **The lobby** has two sections: **New** opens a plot and waits, and **Open
  plots** lists everyone else's. A plot tile shows only an emoji and a stage
  name (*Cute Rabbit's plot*) — you find out who it is once you are in.
  Tapping a waiting plot starts the match immediately; it is always 1 v 1.
- **Five rounds**, easy to hard. Each names a perimeter and an area
  (*perimeter 10 m, area 6 m²*) and the first player to lay exactly that
  rectangle wins the round — no submit button, the win fires the moment the
  last stone lands. Rounds pay **1 · 1.5 · 2 · 2.5 · 3 Whare**, and the score
  *is* the money — no conversion at the end. The winner takes 1 W more (a tie
  splits it).
- **Laying stones**: tap any square to start, then each stone must touch what
  you have and keep the shape heading for a rectangle — blobs and plus-shapes
  are politely refused. 🖌 Brush / 🧽 Eraser, **Backspace** takes back the last
  stone, **Space + click** lifts one, ♻️ clears.
- **What you can see**: your live perimeter and area show for the first three
  rounds and are **hidden for the last two** (the banner warns you). Your
  opponent's plot is live in **round 1** only; after that it is covered until
  the round is won, then both plots are revealed side by side. Each round
  starts on 3 · 2 · 1 · Go!
- **Results**: every round is replayed as three grids — yours, theirs, and the
  answer — with who won it and how fast. Confetti and `victory.mp3` for the
  winner, and each player banks their own Whare exactly once.
- A reload mid-match walks the student straight back onto their plot; if the
  teacher closes the game, anyone still in the lobby is sent home gently while
  running matches finish.
- **Admin**: hide the game, switch the class to **nicknames instead of real
  names** (real names are the default), and add extra seconds per round.

## The Pet Shop 🐾

In *My room*: one pet per student, bought from six mystery silhouettes —
Goldfish 10 · Axolotl 12 · Cat 14 · Dog 16 · Budgie 18 · Triceratops 20 Whare
(a couple of games' earnings). Name it with the ✏️, feed it snacks from *My
stuff* (the snack flies over, the pet softly swaps to its happy picture,
+5 ❤️), and every 10 ❤️ the student picks one of five animal-appropriate
superpowers ("🎾 Fact Fetcher", "🛡️ Triple Shield"…) shown as badges.
Snacks can't be sold — they are pet food by design.

## Roadmap

1. ✅ Teacher admin (roster, self-chosen codes, money, welcome cards, teacher lock)
2. ✅ Student entry with emoji avatar picker
3. ✅ Game hub: profile room (money, stuff + selling, rule-attempt history)
4. ✅ Algebra Machine multiplayer
5. ✅ Al-Zebra (beginners) — zebra rule-painting, carrot races, speed ratings
6. ✅ Pet Shop — pets, naming, feeding, affection, superpowers
7. ✅ Paving Race — 1v1 perimeter and area, five rounds, Whare as the score

## Notes for future work

- All user-facing text is **English** (NZ classroom), warm primary-school tone.
- Currency is **Whare** (≈ NZ$1). Prices should let a student afford a pet
  after roughly two games.
- `assets/` for the games (products, mall, pets, rule laptop) live in the
  parent project for now; copy what each page needs into this folder when the
  page is built. Pet images hold two frames each — the second is the happy one.
