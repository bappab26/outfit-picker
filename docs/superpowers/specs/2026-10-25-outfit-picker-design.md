# lil evil wardrobe (first called Outfit Picker) — Design Spec

Date: 2026-10-25
Status: Draft, waiting for review

## 1. Goal

A free web app for a friend. She photographs her clothes on her phone and saves the
photos into OneDrive folders. The app reads those photos and suggests outfits, using
plain code rules (no AI, no paid services).

She uses it in three ways, all equally important:

- **Today:** "what should I wear today?"
- **Occasion:** an outfit for work, an evening out or a special event.
- **Rotation:** bring back pieces she forgot she owns.

### Success criteria

- She opens the app and sees 3 outfits she would actually wear within about 3 seconds
  (after the first load, with a wardrobe of about 100 pieces).
- Labeling a new piece takes about 5 seconds: two taps, plus an optional color fix.
- Running it costs $0: free hosting, free Microsoft sign-in, no paid APIs.
- The person who builds it can test it fully on their own account before sharing the link.

### Out of scope (first version)

Trip planning, weather, notifications, accessories and bags, an outfit history screen,
a shared wardrobe between several people, photo editing (cropping, background removal),
and a French interface (the interface is English).

## 2. What she sees and does

### First time (once)

1. She opens the link on her phone and taps **Sign in with Microsoft**.
2. The app creates a `Wardrobe` folder at the root of her OneDrive, with 11 subfolders:

   | Folder | What goes in it |
   |---|---|
   | `Tops` | Shirts, t-shirts, blouses, sweaters |
   | `Hoodies` | Hoodies |
   | `Sweatshirts` | Sweatshirts |
   | `Pants` | Trousers |
   | `Jeans` | Jeans |
   | `Shorts` | Shorts |
   | `Skirts` | Skirts |
   | `Dresses` | Dresses and jumpsuits |
   | `Shoes` | All footwear |
   | `Jackets` | Jackets, blazers, cardigans worn on top |
   | `Coats` | Coats |

   If the folders already exist, the app uses them as they are.
3. She adds it to her home screen ("Add to Home Screen") so it opens like an app.

### Adding clothes

- She photographs each piece (one piece per photo, plain background works best) and saves
  it into the right subfolder, from the OneDrive app or by sharing from her photo gallery.
- The next time she opens the app, it shows a banner like **"3 new pieces to label"**.
  Tapping it opens the labeling screen, one photo at a time:
  - The photo, large, with a swatch of the **detected color** and its name. Tapping the
    swatch opens the color list so she can fix it.
  - **Warmth:** Light / Medium / Warm
  - **Style:** Casual / Smart / Dressy
  - Once both are chosen, it moves on to the next photo. A **Skip** button leaves a piece for later.
- Unlabeled pieces never appear in outfits.

### Home screen: outfits

- The app's name at the top, "lil evil wardrobe" until she renames it: tapping the name
  (with its ✎) opens a box to type a new one. It is saved with her data and also shows in
  the browser tab. An empty name goes back to "lil evil wardrobe".
- **Occasion** choice at the top: Everyday · Work · Evening out · Special event.
- **Temperature** choice: Cold · Mild · Hot. (There is no weather lookup. This tap decides
  sweater-and-coat versus t-shirt.)
- Both choices are remembered from last time.
- **3 outfit cards.** Each card shows the photos of its pieces (see 3.2): a top, hoodie or
  sweatshirt, or a hoodie or sweatshirt over a top; pants, jeans, shorts or a skirt; shoes;
  or a dress and shoes; plus a jacket or coat when the rules add one.
- The last card has a piece she hasn't worn in 30 or more days, when she has one, and is
  marked **Not worn in a while** (see 3.5). There is no switch for this.
- Each card has three buttons:
  - **👍** marks the outfit as liked (button stays highlighted). Tapping it again takes it back.
  - **👎** lowers the outfit's score and replaces the card with the next-best outfit. The new
    card shows **Undo 👎** until she taps one of its buttons; Undo takes the 👎 back and
    brings the old outfit back.
  - **Wore this** records today's date on every piece. The button changes to "Worn today ✓";
    tapping it again takes it back and restores the earlier dates.
  - Undo works while the cards are on screen; it is not kept after the app closes.
- **Shuffle** replaces all 3 cards with 3 new ones.
- At the bottom: "Version <date> · by bap bap" (also on the sign-in screen).
- Zooming is turned off (no pinch or double-tap zoom).

### Wardrobe screen

- A grid of all pieces, grouped by folder, each showing its color, labels and "last worn".
- Tapping a piece opens the same labeling view so she can change warmth, style or color.
- A **Refresh** button checks OneDrive again for new, moved or deleted photos.

### Sample mode

- The sign-in screen has a **Try with sample clothes** button.
- It loads about 25 built-in sample pieces drawn as simple colored shapes (a shirt shape,
  pants shape and so on), already labeled. No sign-in needed.
- Everything works the same, except that data is saved in the browser instead of OneDrive.
  A banner shows "Sample mode" with an **Exit** button.
- Purpose: test the matching rules quickly before using real photos.

## 3. Matching rules

All numbers below are defaults stored in one settings file (`js/settings.js`) so they can
be adjusted later.

### 3.1 Colors

Each piece has one main color from this list:

- **Neutrals:** black, white, grey, beige, brown, navy, denim
- **Bold colors:** red, orange, yellow, green, blue, purple, pink

Bold colors sit on a wheel in this order (the last one wraps back to the first):
red → orange → yellow → green → blue → purple → pink → red.

- **Next to each other** on the wheel = distance 1 (for example red and orange).
- **Opposite** = distance 3 (for example red and green, orange and blue, yellow and purple,
  pink and green).

### 3.2 Step 1: build every possible outfit

From labeled pieces only:

- **Upper body:** a top, a hoodie or sweatshirt on its own, or a hoodie or sweatshirt over a
  top. Never two hoodies or sweatshirts, never one over a dress, and no layering when Hot.
- **Shapes:** upper body + bottom (pants, jeans, shorts or skirt) + shoes, or dress + shoes.
- **Jackets and coats** go over everything:
  - **Cold:** one Medium or Warm jacket or coat is added. If she has none that fits,
    outfits are shown without it, with a note "Add a coat or a jacket".
  - **Mild:** optional. Outfits are built both without one and with each Light or Medium
    jacket or coat.
  - **Hot:** none.
- **Speed:** a big wardrobe makes too many outfits to score on a phone. While picking, only
  the 4 best-scoring tops go under each hoodie or sweatshirt, and only the 500 best outfits
  get a jacket or coat, with no piece in more than an eighth of those 500. If that still leaves
  too few outfits that share no piece, the list is built again from the pieces not used yet
  (see 3.5). One list serves both the ordinary and the Not worn in a while outfits.

### 3.3 Step 2: remove outfits that don't fit

**Style must match the occasion.** Styles are ordered Casual → Smart → Dressy.

| Occasion | Allowed styles |
|---|---|
| Everyday | Casual, Smart |
| Work | Smart |
| Evening out | Smart, Dressy |
| Special event | Dressy |

- Tops, hoodies, sweatshirts, bottoms and dresses must have an allowed style.
- Shoes, jackets and coats may be one step away from an allowed style (for example a Smart coat
  over a Casual outfit is fine for Everyday; Casual shoes are fine for Work).

**Temperature:**

- **Hot:** no Warm pieces at all.
- **Cold:** no shorts, no Light pants or jeans (thin trousers) and no Light shoes
  (this removes sandals). Skirts and dresses of any warmth are allowed, assuming tights;
  a jacket or coat is added anyway. Light tops are allowed (worn under a coat).
- **Mild:** no restrictions.

**Colors:** an outfit with more than 2 different bold colors is removed. Neutrals don't count.

### 3.4 Step 3: score each remaining outfit

The score is the sum of the parts below. The color and taste parts look at every **pair of
pieces** in the outfit (an outfit of 4 pieces has 6 pairs). Their sum is then counted as if
the outfit had 3 pairs (sum × 3 ÷ pairs), so layers don't win just by adding pairs, and a
dress with shoes (1 pair) isn't behind.

**Color score, per pair:**

| Pair | Points |
|---|---|
| At least one neutral | +2 |
| Same bold color | +1 |
| Bold colors next to each other | +1 |
| Bold colors opposite each other | +1 |
| Any other bold combination | −2 |

**Taste score.** The app keeps a score for every pair of pieces she has reacted to:

- **👍** adds +1 to every pair in that outfit.
- **👎** adds −1 to every pair in that outfit, and the exact outfit gets an extra −5.
  It can still come back, just rarely.
- **Wore this** adds +0.5 to every pair in that outfit.
- The outfit's taste score is the sum of its pair scores, plus its exact-outfit penalty if any.

**Freshness, per piece:**

- Worn in the last 3 days: −3.
- Only when picking the **Not worn in a while** outfit (3.5): not worn in 30 or more days
  (or never worn): +4, counted as if the outfit had 3 pieces (sum × 3 ÷ pieces).

**Randomness:** a random value between 0 and 1.5 is added, so Shuffle gives new picks.

**Her habits** (§3.6) add up to ±6 more points.

### 3.5 Step 4: pick 3

- First the **Not worn in a while** outfit: the best-scoring outfit (with the forgotten-piece
  bonus) that contains a piece not worn in 30 or more days. If she has no such piece, all 3
  are ordinary outfits.
- Then the others: sort outfits by score, highest first. Take the best one, then keep going
  down the list, skipping any outfit that shares a piece with one already picked, until
  there are 3.
- The forgotten-piece outfit is shown last. When 👎 replaces it, the new one is also a
  forgotten-piece outfit when possible.
- **Shuffle** re-rolls the randomness and skips the outfits currently shown.
- If no outfit is possible, show what's missing, for example "Add some shoes" or
  "Add at least one top and one pair of pants, jeans, shorts or a skirt, or a dress".
- If only 1 or 2 outfits are possible, show those.

### 3.6 Her habits (added after the first version)

Every 👍, 👎 and Wore this also adds a line to a **diary**: the date, which tap, the occasion
and the pieces. The diary keeps her latest 500 choices. The app counts it to learn four habits,
using the pieces' labels as they are now:

- **Color combinations:** every pair of colors in the outfit (two black pieces make black + black).
- **Favorite colors:** every color in the outfit.
- **Shape per occasion:** the outfit's dress, skirt or pants. On a yes, the other two shapes
  count as a no for that occasion.
- **How dressed-up:** the styles of the main pieces, where the occasion allows two styles
  (Everyday, Evening out, At home). On a yes, the other allowed style counts as a no.

Wore this and 👍 count as yes, 👎 as no. A choice counts half after 60 days, a quarter after
120, and so on. Each habit's score is (yes − no) / (yes + no + 4), from −1 to +1.

Points per outfit (averages, so an extra piece like a coat doesn't add points by itself):

| Habit | Points |
|---|---|
| Color combinations | 2 × the average over its pairs |
| Favorite colors | 1 × the average over its pieces |
| Shape per occasion | 2 × the score of its shape |
| How dressed-up | 1 × the average over its main pieces |

The Wardrobe screen shows **Your style so far** once she has made 5 choices: the two
strongest color combinations and colors, and per occasion the shape and style she mostly
picks (habits scoring 0.3 or more).

## 4. How it's built

### 4.1 Overview

- **Static web app:** plain HTML, CSS and JavaScript (ES modules). No framework, no build
  step.
- **Only outside library:** Microsoft's official sign-in library, MSAL.js (`@azure/msal-browser`),
  pinned to an exact version and loaded from a CDN.
- **Hosting:** GitHub Pages (free). The page's address is "the app".
- **Installable:** a web app manifest and a small service worker that caches the app's own
  files, so it opens quickly from the home screen.
- **No server.** Everything runs in her phone's browser and talks directly to OneDrive.

### 4.2 Sign-in and OneDrive access

- MSAL.js with the **redirect** sign-in flow (popups behave badly on phones).
- Authority `common`, so personal Microsoft accounts (Outlook/Hotmail) and work or school
  accounts both work.
- Permission requested: `Files.ReadWrite` (needed to create the `Wardrobe` folders and save
  the data file).
- Tokens are cached in the browser so she stays signed in; expired tokens are renewed
  silently, and she is sent to sign-in again only if that fails.

### 4.3 Reading photos

On each app open (and when she taps **Refresh** on the Wardrobe screen):

1. Make sure `Wardrobe` and its 11 subfolders exist; create any that are missing.
2. List the image files in each subfolder through Microsoft Graph, including their
   thumbnails, following paging links.
3. Show photos using the **medium thumbnail**, not the full photo. This keeps it fast and
   also handles iPhone HEIC photos, since OneDrive's thumbnails are regular images.
4. Compare with the saved data (see 4.5):
   - **New photo:** added as unlabeled, with its detected color.
   - **Photo moved to another subfolder:** its type updates; its labels are kept.
   - **Photo deleted:** removed from the data, along with every pair score and outfit
     penalty that includes it.

### 4.4 Color detection

Done on the phone with a canvas:

1. Draw the thumbnail scaled down to 48×48 pixels.
2. Estimate the background color from the border pixels, and ignore pixels close to it.
3. Name every remaining pixel with the closest color from the list in 3.1, using simple
   hue/saturation/lightness thresholds (for example very dark = black, low saturation =
   grey or white, dark desaturated blue = navy or denim).
4. The most common name wins.

The detected color is only a starting point; she confirms or fixes it while labeling.

### 4.5 Saved data

One JSON file, `data.json`, in the app's own OneDrive folder (`Apps/Outfit Picker/`;
Microsoft names this folder after the app registration).

```json
{
  "version": 1,
  "items": {
    "<onedrive item id>": {
      "category": "tops",
      "fileName": "IMG_1234.jpg",
      "color": "navy",
      "warmth": "medium",
      "style": "casual",
      "addedAt": "2026-10-25",
      "lastWorn": "2026-10-20",
      "wearCount": 3
    }
  },
  "pairScores": { "<id A>|<id B>": 1.5 },
  "outfitPenalties": { "<id A>|<id B>|<id C>": -5 },
  "diary": [{ "date": "2026-10-25", "kind": "wore", "occasion": "work", "ids": ["<id A>", "<id B>", "<id C>"] }],
  "settings": { "occasion": "everyday", "temperature": "mild", "name": null }
}
```

- `category` is one of `tops`, `hoodies`, `sweatshirts`, `pants`, `jeans`, `shorts`, `skirts`,
  `dresses`, `shoes`, `jackets`, `coats`.
- `settings.name` is her name for the app (at most 40 letters), or `null` for the default.
- `warmth` and `style` are `null` until she labels the piece.
- IDs inside the keys of `pairScores` and `outfitPenalties` are sorted, so the same pair or
  outfit always gets the same key.
- `diary` lists her taps oldest first (`kind` is `wore`, `like` or `dislike`), at most 500 (§3.6).
- The file is saved about 1 second after each change. Last save wins (one person, so
  conflicts are not expected).
- If the file is missing or unreadable, the app starts with empty data; photos are found
  again and show up as unlabeled. (Deleting the file is how to start over.)
- In sample mode the same structure is stored in the browser's local storage instead.

### 4.6 Code layout

```
index.html               Page shell, loads js/app.js
manifest.webmanifest     Home-screen name and icons
sw.js                    Caches the app's own files
icons/                   App icons
css/app.css              Styles (phone first)
js/config.js             Microsoft app ID, folder names, redirect address
js/settings.js           All rule numbers from section 3
js/app.js                Starts the app, switches between screens
js/auth.js               Sign-in with MSAL
js/onedrive.js           Microsoft Graph calls: folders, listing, thumbnails, data file
js/store.js              Load and save data; merge with the OneDrive listing
js/colors.js             Color list, color wheel, naming a pixel, detecting a photo's color
js/rules.js              Build, filter, score and pick outfits
js/feedback.js           Apply 👍, 👎 and Wore this to the data
js/habits.js             Learn her habits from the diary (section 3.6)
js/sample.js             Sample wardrobe and its drawings
js/ui/home.js            Home screen
js/ui/label.js           Labeling screen
js/ui/wardrobe.js        Wardrobe screen
tests/*.test.js          Automated checks
package.json             Only so `node --test` can run; no dependencies
README.md                Setup guide
```

`rules.js`, `feedback.js`, the merge logic in `store.js` and the pixel-naming part of
`colors.js` are **pure functions**: no browser, no network. The current date and the random
number generator are passed in as parameters, so tests give the same result every time.

## 5. Error handling

| Situation | What she sees |
|---|---|
| Not signed in, or sign-in can't be renewed | The sign-in screen |
| No internet | "You're offline. Connect to load your wardrobe." with a Retry button |
| OneDrive request fails | "Couldn't reach OneDrive." with a Retry button |
| No labeled pieces yet | A short welcome explaining the folders, plus the "new pieces" banner if any |
| Not enough pieces for an outfit | What's missing (see 3.5) |
| A thumbnail fails to load | A plain placeholder with the file name; the outfit still works |
| Saving the data file fails | A small "Not saved, retrying" notice; it retries on the next change and when the app reopens |

## 6. Testing

1. **Automated checks** with Node's built-in test runner (`node --test`), for the pure parts:
   - Color naming: sample pixel values map to the expected color names.
   - Color wheel: next-to and opposite pairs; outfits with 3 bold colors are removed.
   - Style rules: for example Work never includes a Casual top; shoes one step off are allowed.
   - Temperature rules: Hot never includes Warm pieces; Cold removes Light pants and Light
     shoes but keeps Light skirts and dresses; Cold adds a jacket or coat.
   - Layers: hoodies and sweatshirts alone or over a top, never over a dress or when Hot.
   - Scoring: 👍 raises the pairs, 👎 lowers them and penalizes the exact outfit, Wore this
     updates the dates and counts, and each can be undone; recently worn pieces lose points;
     one outfit has a forgotten piece.
   - Picking: never the same piece on two cards; Shuffle avoids the outfits shown.
   - Merging: new, moved and deleted photos are handled as described in 4.3.
2. **Sample mode** to try the whole app in a browser without signing in.
3. **Real test on the builder's account:** sign in with their own Microsoft account on a
   computer (`http://localhost`) and on a phone (the GitHub Pages address), add a few photos
   and go through labeling, outfits, 👍/👎 and Wore this.
4. **Hand-off:** send her the same link. She signs in with her own account and starts with
   an empty wardrobe; the test data stays in the builder's OneDrive.

## 7. One-time setup (builder)

Covered step by step in `README.md`:

1. Register the app in the Microsoft Entra admin center (free): type "Single-page
   application", accounts "any organizational directory and personal Microsoft accounts",
   redirect addresses `http://localhost:<port>/` and the GitHub Pages address.
2. Paste the app ID into `js/config.js`.
3. Create a free GitHub account and repository, push the code, and turn on GitHub Pages.
4. Open the link on a phone and add it to the home screen.

## 8. Risks to check early

These are checked first, before building the rest:

1. **Reading thumbnail pixels.** Color detection needs to read a thumbnail's pixels, which
   only works if OneDrive allows it from another website (CORS). If it doesn't, the
   fallback is to download the image through Graph's download link (which allows it) and
   shrink it on the phone.
2. **Sign-in inside an iPhone home-screen app.** The redirect sign-in must come back into
   the installed app correctly. If it doesn't, the first fallback is the popup sign-in flow
   in home-screen mode only; if that also fails, she uses the app from a Safari bookmark
   instead of a home-screen icon.
3. **Microsoft's current registration steps for a personal account.** Microsoft may require
   a free Azure account, which can ask for a card to verify identity (nothing is charged).
   The README describes the steps as they are when it's written.
