# Charlie's Class

A class website for Year 6/7 maths games, built to run free on **GitHub Pages**
(static files) + **Supabase** (shared live data across the Chromebooks).

- `index.html` — student entry: *Welcome to Charlie's Class* → Boys / Girls →
  tap your name → type your 4-digit secret code. On first login the student
  picks an **emoji avatar** (People / Animals / Plants / Gestures, with skin
  colours for people and gestures), then lands in the hub.
- `hub.html` — game hub: name + emoji top-right opens **My room** (money in
  Whare, stuff won in games, Pet Shop placeholder, change-emoji, log out).
  The Algebra Machine card sits here, marked *coming very soon*.
- `admin.html` — **teacher admin**: roster split into boys and girls, add /
  edit / remove students, each student's unique 4-digit code and money (Whare),
  and a button that prints A4 login cards (10 per page).
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

## The printed login cards

*Print login cards* lays out one card per student (boys first, then girls) on
A4, two columns × five rows = 10 per page, with dashed cut lines. Codes print
even while they are hidden on screen. If you regenerate a student's code,
reprint their card.

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

This is a class game with play money, so the setup is deliberately simple:
the public anon key may read and write the `students` table, and a determined
student with DevTools could read codes. If that ever matters, the upgrade path
is Supabase email auth for the teacher + row-level-security policies that hide
`code` from anonymous readers. The 4-digit codes stop casual name-borrowing,
which is all they need to do.

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
