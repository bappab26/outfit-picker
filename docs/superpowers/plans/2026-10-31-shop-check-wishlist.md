# Shop Check and Wishlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let her photograph a piece in a store, see how many outfits it makes with her clothes, keep it on a OneDrive-backed wishlist, and turn it into a labeled piece when she buys it (version 1.27).

**Architecture:** A pure `js/shop.js` counts outfits with the app's own `buildOutfits` and scorer. The wishlist is a new `wishlist` list in `data.json` (store.js) whose photos live in a OneDrive `Wishlist` folder (onedrive.js, sources.js). A new Shop check screen (`js/ui/shop.js`) is wired into `app.js` like the other screens.

**Tech Stack:** Plain ES modules, no build step, Node's test runner (`npm test`), Microsoft Graph through `js/onedrive.js`.

**Spec:** `docs/superpowers/specs/2026-10-31-shop-check-wishlist-design.md` (main spec: `docs/superpowers/specs/2026-10-25-outfit-picker-design.md`)

## Global Constraints

- Work on the `shop-check` branch; never push to `main` (CLAUDE.md). Run `npm test` before every push; all must pass.
- Version 1.27: `CACHE_NAME = 'outfit-picker-v27'` in `sw.js`, `VERSION_NUMBER = '1.27'` in `js/ui/labels.js`; add `js/shop.js` and `js/ui/shop.js` to `APP_FILES`.
- Logic modules (`shop.js`, `store.js`, `sources.js`, `onedrive.js`) import in Node without a browser; dates and randomness come in as parameters.
- Every number the rules use lives in `js/settings.js`: `shop: { great: 10, few: 3, little: 1 }`.
- Phone first: 320px wide, no sideways scrolling, tap targets at least 44px. Text boxes 16px (iPhones zoom in otherwise).
- Interface text in English, exactly as the spec writes it ("Goes with N outfits", "Goes with 1 outfit", "A great match for your wardrobe 🔥", "Goes with a few things", "Only goes with a little", "Doesn't go with anything you own yet", "Label a few pieces first, so there's something to compare with.", "Sign in to keep a wishlist.", "Added to your wardrobe 🎉", "Remove from your wishlist? The photo goes to your OneDrive recycle bin.").
- The OneDrive folder is `Wishlist` at the root of her drive, next to `Wardrobe`.

## Review Focus

1. **A photo the browser can't read** (HEIC on some phones): no color is detected, so the result must wait for her to pick one rather than count with `color: null`. Pinned by `readyToCheck` in Task 1.
2. **Tapping Save to wishlist, I bought it or Remove twice**: the second tap must do nothing while the first is busy (no double upload or move). Covered in Task 4, step 5, by `state.busy` guards and checked by hand.
3. **Saving while offline**: the check (photo and picks) must stay on screen with the note, not be lost. Task 4, step 5; checked by hand in Task 5.
4. **A big wardrobe**: one check must stay quick. Task 1's `a check stays quick with 200 pieces` test (under 2 s in Node).
5. **The same photo name already in `Wishlist`**: OneDrive must rename, never overwrite. Task 3's upload test asserts `conflictBehavior=rename`.

---

### Task 1: The count and the verdict (`js/shop.js`)

**Files:**
- Create: `js/shop.js`, `tests/shop.test.js`
- Modify: `js/rules.js` (export `makeScorer` and `withIndexes`, unchanged), `js/settings.js` (add `shop`)

**Interfaces:**
- Produces:
  - `readyToCheck(labels) -> boolean`: true when `labels.category`, `labels.color` and `labels.style` are all set.
  - `shopCheck(items, labels, data, { today, habits }) -> { count: number, best: Array<Array<piece>> }`. `items` are her labeled pieces (`labeledItems(data)`); `labels` is `{ category, color, warmth, style }`. Each `best` entry is an outfit's pieces with the new piece (id `'shop-check'`) first; at most 3.
  - `shopVerdict(count) -> string`: the spec's line for the count.
  - `SHOP_ID = 'shop-check'`.

- [ ] **Step 1: Write the failing tests** in `tests/shop.test.js` (use `makeItem` from `tests/helpers.js`; a small wardrobe: 2 tops (black, white), 1 pink top, 1 hoodie (grey), 2 jeans (denim), 1 skirt (black), 2 shoes (black, white), 1 dress (black), all casual and medium unless the test says otherwise):

```js
test('nothing is checked until the type, color and style are picked', () => {
  assert.equal(readyToCheck({ category: 'tops', color: 'red', style: null }), false);
  assert.equal(readyToCheck({ category: 'tops', color: null, style: 'casual' }), false);
  assert.equal(readyToCheck({ category: 'tops', color: 'red', style: 'casual', warmth: 'medium' }), true);
});
test('a new top is counted with every bottom and shoes, never with another top', ...)
  // shopCheck(...).best: every outfit holds 'shop-check' first and no other piece of role 'top'
test('the same outfit is counted once, though it fits several occasions and temperatures', ...)
  // a black casual top in a wardrobe of 1 denim jeans + 1 black shoes, casual, medium: count === 1
test('a color that clashes with a piece leaves that outfit out', ...)
  // a green top with only a pink skirt + black shoes (green|pink is "other", −2): count === 0
test('a new dress goes with shoes, not with tops or bottoms', ...)
  // every best outfit is [dress, shoes] or [dress, shoes, outer]
test('nothing labeled yet: nothing to count', ...)
  // shopCheck([], labels, blankData(), ...) deepEquals { count: 0, best: [] }
test('the best 3, highest score first, never the same outfit twice', ...)
  // best.length <= 3; keys (sorted ids) all different
test('the verdict line', () => {
  assert.equal(shopVerdict(10), 'A great match for your wardrobe 🔥');
  assert.equal(shopVerdict(3), 'Goes with a few things');
  assert.equal(shopVerdict(1), 'Only goes with a little');
  assert.equal(shopVerdict(0), "Doesn't go with anything you own yet");
});
test('a check stays quick with 200 pieces', ...)
  // a generated 200-piece labeled wardrobe; shopCheck finishes in under 2000 ms
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/shop.test.js`
Expected: FAIL with `Cannot find module '../js/shop.js'`

- [ ] **Step 3: Implement `js/shop.js`** (and the two exports in `rules.js`, `shop` in `settings.js`)

The algorithm is the spec's section 3. For each of `OCCASIONS × TEMPERATURES`: pieces = `withIndexes([...items without the new piece's ROLE, newPiece])`; `score = makeScorer(pieces, data, { today, rng: () => 0, habits, occasion })`; `buildOutfits(pieces, { occasion, temperature }, { rank: score }).outfits`; keep outfits that hold `SHOP_ID` and where `pairColorPoints(new.color, other.color) >= 0` for every other piece; collect by `outfit.key` into one Map (keeping the highest score seen for that key). `count` is the Map's size; `best` is its 3 highest scores, pieces reordered with the new piece first.

- [ ] **Step 4: Run them to see them pass**

Run: `npm test`
Expected: all pass, including the 9 new ones.

- [ ] **Step 5: Commit**

```bash
git add js/shop.js js/rules.js js/settings.js tests/shop.test.js
git commit -m "Shop check: count the outfits a piece would make"
```

### Task 2: The wishlist in her data (`js/store.js`)

**Files:**
- Modify: `js/store.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Produces (all change `data` in place):
  - `emptyData()` now has `wishlist: []`; `parseData` always sets `data.wishlist`.
  - `mergeWishlist(data, listing) -> boolean` (changed): drops items whose id isn't in `listing` (the `Wishlist` folder's entries `{ id, fileName }`).
  - `addToWishlist(data, { id, fileName }, labels, today)`: pushes `{ id, fileName, category, color, warmth, style, addedAt: today }`.
  - `wishlistToPiece(data, id, fileName, today)`: adds `data.items[id] = { category, fileName, color, warmth, style, addedAt: today, lastWorn: null, wearCount: 0 }` from the wishlist item, then removes the item.
  - `removeFromWishlist(data, id)`.
  - `updateWishlistItem(data, id, labels)`: sets the item's category, color, warmth and style.

- [ ] **Step 1: Write the failing tests**

```js
test('older data without a wishlist gets an empty one', ...)        // parseData('{"version":1}').wishlist deepEquals []
test('the wishlist is read and checked like pieces', ...)
  // keeps a valid item; leaves out one with category 'hats', color 'teal', style 'fancy', or no id
test('a wishlist photo gone from OneDrive drops its item', ...)
  // mergeWishlist(data, [{ id: 'w1' }]) returns true and keeps only w1; again returns false
test('adding to, changing and removing from the wishlist', ...)
test('I bought it turns the item into a labeled piece', () => {
  // after wishlistToPiece(data, 'w1', 'photo (2).jpg', '2026-11-02'):
  assert.deepEqual(data.items.w1, { category: 'tops', fileName: 'photo (2).jpg', color: 'red', warmth: 'medium', style: 'smart', addedAt: '2026-11-02', lastWorn: null, wearCount: 0 });
  assert.deepEqual(data.wishlist, []);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/store.test.js`
Expected: FAIL (`mergeWishlist` is not exported).

- [ ] **Step 3: Implement** the six functions and the `wishlist` field (validate with the same `oneOf`, `isDate` and `CATEGORIES`/`COLORS`/`WARMTHS`/`STYLES` checks as pieces; `addedAt` falls back to `'2000-01-01'`).

- [ ] **Step 4: Run them to see them pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit** (`git commit -m "Wishlist in her data"`)

### Task 3: The `Wishlist` folder (`js/onedrive.js`, `js/sources.js`)

**Files:**
- Modify: `js/config.js` (`WISHLIST_FOLDER = 'Wishlist'`), `js/onedrive.js`, `js/sources.js`
- Test: `tests/onedrive.test.js`, `tests/sources.test.js`

**Interfaces:**
- Consumes: Task 2's `mergeWishlist`, `addToWishlist`, `wishlistToPiece`, `removeFromWishlist`.
- Produces:
  - Graph: `listWishlist() -> Promise<Array<{ id, fileName, thumbUrl, bigUrl }>>` (a missing folder gives `[]`); `uploadToWishlist(fileName, blob) -> Promise<{ id, fileName, thumbUrl: null, bigUrl: null }>`, which first creates the folder (POST to `/me/drive/root/children`, 409 means it exists). `movePhoto` and `deletePhoto` are reused as they are.
  - OneDrive source: `canWishlist: true`; `sync` also lists `Wishlist`, puts its thumbnails in the photo maps (so `photoUrl`/`bigPhotoUrl` work for wishlist ids) and calls `mergeWishlist`; `saveToWishlist(data, blob, labels) -> Promise<id>` (shrinks with `photos.shrink`, names with `photos.name(1)`, uploads, `addToWishlist`, shows the blob until OneDrive has a preview); `buyWishlistItem(data, id) -> Promise` (`movePhoto(id, category, fileName)` then `wishlistToPiece` with the returned file name); `removeWishlistItem(data, id) -> Promise` (`deletePhoto` then `removeFromWishlist`).
  - Sample source: `canWishlist: false`, none of the three.

- [ ] **Step 1: Write the failing tests**

```js
// onedrive.test.js
test('listWishlist lists the Wishlist folder with both previews', ...)
  // url === `${G}/me/drive/root:/Wishlist:/children?$expand=thumbnails&$top=200`; entries have thumbUrl and bigUrl
test('listWishlist gives nothing when the folder is missing', ...)   // 404 → []
test('uploadToWishlist makes the folder, then saves the photo without overwriting', ...)
  // a POST naming 'Wishlist' (409 accepted), then PUT `${G}/me/drive/root:/Wishlist/photo.jpg:/content?@microsoft.graph.conflictBehavior=rename`
// sources.test.js (fakeGraph gets listWishlist → g.wishlist (default []), and uploadToWishlist recording to g.wishUploads and returning { id: `wish${n}`, fileName, thumbUrl: null, bigUrl: null })
test('loading drops wishlist items whose photo is gone, and shows the others', ...)
test('saveToWishlist shrinks, uploads and adds the item', ...)      // photoUrl(id) is the local blob address until a preview exists
test('I bought it moves the photo into its Wardrobe folder as a labeled piece', ...)
  // graph.moves deepEquals [['wish1', 'tops', 'photo-1.jpg']]; data.items.wish1.fileName === 'moved-photo-1.jpg'
test('Remove deletes the photo and the item', ...)
test('a failed move or delete changes nothing', ...)                 // failChanges: item still in the wishlist
test('the sample has no wishlist', ...)                              // canWishlist === false
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/onedrive.test.js tests/sources.test.js`
Expected: FAIL (`graph.listWishlist is not a function`).

- [ ] **Step 3: Implement** the two Graph calls (reuse `listFolder`'s paging and preview code for the `Wishlist` path) and the source methods.

- [ ] **Step 4: Run them to see them pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit** (`git commit -m "Wishlist photos in a OneDrive Wishlist folder"`)

### Task 4: The Shop check screen

**Files:**
- Create: `js/ui/shop.js`
- Modify: `js/app.js`, `js/ui/wardrobe.js`, `js/ui/label.js` (export its color picker as `colorChoice(color, onPick)` and use it there too), `js/ui/labels.js` (`TYPE_LABELS` and version 1.27), `css/app.css`, `sw.js` (v27, `APP_FILES`)

**Interfaces:**
- Consumes: `readyToCheck`, `shopCheck`, `shopVerdict`, `SHOP_ID` (Task 1); `updateWishlistItem` (Task 2); `canWishlist`, `saveToWishlist`, `buyWishlistItem`, `removeWishlistItem` (Task 3); `detectImageColor(blob)` from `colors.js`.
- Produces:
  - `TYPE_LABELS = { tops: 'Top', hoodies: 'Hoodie', sweatshirts: 'Sweatshirt', pants: 'Pants', jeans: 'Jeans', shorts: 'Shorts', skirts: 'Skirt', dresses: 'Dress', shoes: 'Shoes', jackets: 'Jacket', coats: 'Coat' }` in `labels.js`.
  - `renderShop(root, view, actions)` in `js/ui/shop.js`. `view`: `{ check, result, wishlist, canWishlist, hasLabeled, photoUrl, busy, note, confirmRemove }`, where `check` is `null` or `{ photo, color, category, style, warmth, wishId }`, `result` is `null` or `{ count, best }`, and each wishlist entry is `{ id, labels, count }`. `actions`: `back, pickPhoto(file), setColor, setCategory, setStyle, setWarmth, save, done, openWish(id), buy, askRemove, cancelRemove, confirmRemove`.
  - `app.js`: `state.shop = { check: null, confirmRemove: false }`, screen `'shop'`, `wardrobeActions.openShop`, `shopActions`, `renderShopScreen`.

- [ ] **Step 1: Write the failing check**

Bump `CACHE_NAME` to `'outfit-picker-v27'` and `VERSION_NUMBER` to `'1.27'`, then add `js/shop.js` and `js/ui/shop.js` to `APP_FILES`.

Run: `npm test`
Expected: FAIL in `sw.test.js`: `js/ui/shop.js` is listed but doesn't exist.

- [ ] **Step 2: Build `js/ui/shop.js`** to the spec's section 2:
  - With no check: the **Check a piece** button, a `<label>` around a hidden `input type=file accept=image/*`, like `addClothes` in `wardrobe.js`. Then **Wishlist** cards, newest first, each a tappable card (`tapAttrs`) with its photo, "Red · Top · Smart" and "Goes with N outfits". In sample mode, the hint "Sign in to keep a wishlist." instead.
  - With a check: the photo, **Retake photo**, `colorChoice`, `choices('What is it?', Object.values(FOLDERS), TYPE_LABELS, ...)`, `choices('Style', ...)`, `choices('Warmth', ...)`, then the result card. It shows "Label a few pieces first, so there's something to compare with." when nothing is labeled, and nothing until `readyToCheck`. Otherwise the count line, `shopVerdict` and up to 3 rows of small photos (the check's photo for `SHOP_ID`). Last come **Save to wishlist** (not in sample mode, not when `wishId` is set) and **Done**. For a wishlist item, **I bought it** and **Remove**, with the remove confirmation like `deleteRow` in `label.js`.
  - Every button that talks to OneDrive is disabled while `view.busy`; `view.busy` and `view.note` show like on the labeling screen.

- [ ] **Step 3: Wire it in `app.js`**
  - `pickPhoto(file)`: release the old blob address, then `check = { photo: URL.createObjectURL(file), blob: file, color: await detectImageColor(file) (null on failure), category: null, style: null, warmth: 'medium', wishId: null }`.
  - The `set*` actions change the check. For a wishlist item they also call `updateWishlistItem` and `changed()`.
  - `done`/`back` release the blob address.
  - `renderShopScreen` builds `result` with `shopCheck(labeledItems(data), check, data, { today, habits: learnHabits(data, today) })` only when `readyToCheck(check)`, and a `count` for each wishlist item the same way.
  - Add the **🛍️ Shop check** button to `wardrobe-links` in `wardrobe.js`, full width under Calendar and Stats.

- [ ] **Step 4: Wire the OneDrive actions**
  - `save`, `buy` and `confirmRemove` each go through `busyChange` ('Saving…', 'Moving…', 'Removing…') and return at once when `state.busy` is set.
  - `save` on success: `changed()` and `check = null`. On failure the check stays.
  - `buy` on success: `changed()`, `toast('Added to your wardrobe 🎉')`, `check = null`.
  - `confirmRemove` on success: `changed()` and `check = null`.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit** (`git commit -m "Shop check screen and the wishlist"`)

### Task 5: Docs, the browser check, the pull request

**Files:**
- Modify: `README.md` (a "Shop check and wishlist" section), `docs/superpowers/specs/2026-10-25-outfit-picker-design.md` (the Wardrobe screen's third button, `wishlist` in §4.5, the new files in §4.6, a pointer to the new spec)

- [ ] **Step 1: Update the docs** as listed.
- [ ] **Step 2: Browser check** (sample mode, 320px; the test pattern in the session: switch to sample through the manifest page, restore after). Pick a photo from the computer, then:
  - the color is detected and the result appears once a type and style are picked;
  - changing the color or type updates the count;
  - there's no sideways scrolling and no console errors;
  - **Save to wishlist** is hidden and "Sign in to keep a wishlist." shows.
- [ ] **Step 3: Run `npm test`**. Expected: all pass.
- [ ] **Step 4: Commit, push `shop-check`, open the pull request** with `gh pr create`. Tell the owner that the wishlist (save, I bought it, Remove) needs a real account on localhost to try.
