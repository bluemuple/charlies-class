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

## Clicks and hearts on Find an article

Every card on `news.html` shows how many times the site has been opened (👀) and how
many hearts it has (♥). One heart per person per site — the browser remembers.

- The numbers live on [Abacus](https://abacus.jasoncameron.dev), a free counter API with
  no account: namespace `wharenui-news`, one counter per site for clicks (`v-…`) and one
  for hearts (`h-…`). Settings and key naming are in `js/news-counters.js`.
- Opening the page fetches **one** file — `counts.json` on the `counts` branch — instead
  of a hundred counters; a whole class on the school's connection would trip Abacus's
  rate limit otherwise. A click or a heart sends one request and shows the number
  Abacus answers with (retried, and kept for next time, if the network is busy).
- `.github/workflows/counts.yml` rebuilds `counts.json` with `js/snapshot-counts.js`
  every 15 minutes in NZ school hours and hourly otherwise. GitHub switches schedules
  off after 60 days without a commit: open the Actions tab and press *Enable workflow*.
- Abacus forgets a counter six months after its last click; the snapshot job recreates
  it at the last number it saved. To start everyone from zero, change `NS` in
  `js/news-counters.js`.

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

- **The lobby** is two sections of three columns: **New** — 🌱 Beginner
  (chosen for you) · ⭐ Intermediate · 🔥 Expert, then one *New game* button —
  and **Open plots**, each tile carrying its difficulty. A tile shows only an
  emoji and a stage name (*Cute Rabbit's plot*); you find out who it is once
  you are in. Tapping a waiting plot starts the match immediately; always 1v1.
- **Two kinds of round.** First the **measuring** ones: a rectangle is shown
  and you fill in `perimeter ___` and `area ___`; first correct answer takes
  the Whare, a wrong one costs you a couple of seconds, and **💡 Hint** opens a
  panel with *P = 2l + 2b* and *A = lb* (with a ✕ to close). Then the
  **paving** ones: the round names a perimeter and an area and the first
  player to lay exactly that rectangle wins it — no submit button, the win
  fires the moment the last stone lands. Three and five by default; the
  teacher sets both counts, or switches either kind off.
- **Whare is the score**: 1 · 1.5 · 2 for measuring, 1 · 1.5 · 2 · 2.5 · 3 for
  paving, and the winner takes 1 W more (a tie splits it).
- **Laying stones**: tap any square to start, or press and drag to lay a whole
  row. Each stone must touch what you have and keep the shape heading for a
  rectangle — blobs and plus-shapes are politely refused. 🖌 Brush / 🧽 Eraser,
  **Backspace** takes back the last stone, **Space + click** lifts one.
- **Difficulty** decides how much the plot tells you. Beginner shows your live
  perimeter and area all game and draws the measuring shapes on squares;
  Intermediate switches the readout off for the last two paving rounds; Expert
  hides it from the first round, gives every shape *without* a grid to count,
  and trims the clock a little.
- Your opponent's plot is live in **round 1** only; after that it is covered
  until the round is won, then both are revealed. Every round opens on
  3 · 2 · 1 · Go!, with the new goal popping up in the middle of the screen
  and the banner blinking twice.
- **Results**: paving rounds are replayed as three grids — yours, theirs and
  the answer; measuring rounds simply show the answer and what you wrote. What
  you earned pops up in the middle of the screen, there is confetti and
  `victory.mp3` for the winner, **🔁 Play again with the same player** opens a
  fresh plot for the pair at the same difficulty, and each player banks their
  own Whare exactly once.
- A reload mid-match walks the student straight back onto their plot; if the
  teacher closes the game, anyone still in the lobby is sent home gently while
  running matches finish.
- **Admin**: hide the game, switch the class to **nicknames instead of real
  names** (real names are the default), choose whether each kind of round is
  in and how many of it, and add extra seconds per round.

## The Pet Shop 🐾

In *My room*: one pet per student, bought from six mystery silhouettes —
Goldfish 10 · Axolotl 12 · Cat 14 · Dog 16 · Budgie 18 · Triceratops 20 Whare
(a couple of games' earnings). Name it with the ✏️, feed it snacks from *My
stuff* (the snack flies over, the pet softly swaps to its happy picture,
+5 ❤️), and every 10 ❤️ the student picks one of five animal-appropriate
superpowers ("🎾 Fact Fetcher", "🛡️ Triple Shield"…) shown as badges.
Snacks can't be sold — they are pet food by design.

## Review 12 checkpoint 📄 (how it works)

`review12.html` + `js/review12-bank.js` turn the paper *Review 12* (MNP Year 7
Phase 3B, Chapter 12) into a computer-adaptive checkpoint for the Tuesday lesson.
The plan-view question (paper Q5) is left out; the other four each have a ladder:

- The **top level is the paper question itself** (same numbers; students are told
  "It's one of the same questions on your paper" and type/draw what they wrote).
- The levels below are the separate pieces of knowledge the question is built
  from (angle facts → straight line → vertically opposite → … ). Every level has
  a knowledge card, a hint, **3 test questions and 3 practice problems**, plus a
  textbook reference (chapter · lesson title · pages, from the MNP teacher guides).
- **One right answer locks a level** (that becomes the student's level for the
  question, even if a sibling question was missed first); **two wrong answers
  step down one level**. Bottoming out at level 1 is recorded with a `floor` flag.
- Q4 (parts of a circle) is answered by actually drawing on the screen: tap the
  centre + circumference for the radius; tap two opposite edge points for the
  diameter (a chord that misses O is refused).

Results land in the `review12-results` machine (one row per finished run).
Admin → 📄 Review 12 → *Levels & worksheets* shows each student's level per
question and the missing knowledge, with a **Download** button that prints an A4
helper sheet: one ~10-minute Part per missing level (knowledge box + worked
example + practice), answer key for the teacher on the last page. Downloads are
remembered in `review12-downloads`, so already-printed buttons wear a green tick.

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
