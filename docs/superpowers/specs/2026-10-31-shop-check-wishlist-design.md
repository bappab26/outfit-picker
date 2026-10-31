# Shop check and wishlist — Design Spec

Added to lil evil in version 1.27. The main spec is
`2026-10-25-outfit-picker-design.md`; this one only covers the two new parts.

## 1. Goal

In a store, Anh takes a photo of something she's thinking of buying and the app tells her how
well it goes with the clothes she already owns. If she likes it, she keeps it on a wishlist,
and when she buys it, it becomes a real piece in her wardrobe without labeling it again.

Agreed with the owner on 2026-10-31:

- Wishlist photos live in her OneDrive, in a new `Wishlist` folder next to `Wardrobe`.
- "I bought it" moves the photo into the right `Wardrobe` folder, already labeled.
- Same rules as the rest of the app: plain rules, no AI, no paid services.

### Success criteria

- From the Wardrobe screen she can check a piece in a few taps: photo, what it is, its style.
- The answer is one clear number, "Goes with 14 outfits", plus the best outfits it would make.
- Checking works without signing in to anything new and without a connection (only saving
  needs one).
- Wishlist items survive a phone change, and their numbers stay right as her wardrobe changes.

### Out of scope

Prices, store names or links, several photos per item, sharing, and checking a piece against
someone else's wardrobe.

## 2. What she sees and does

### Getting there

The Wardrobe screen gets a third button, **🛍️ Shop check**, full width under **📅 Calendar**
and **📊 Stats**. It opens the Shop check screen.

### Shop check screen

Top to bottom:

1. **Check a piece**: one big button. It opens the phone's camera or gallery (the same kind
   of hidden photo picker as **Add clothes**). Picking a photo starts a check (below).
2. **Wishlist**: her saved items, newest first (section 2.3). Hidden in sample mode, where a
   hint says "Sign in to keep a wishlist." because its photos live in OneDrive.

### A check

After she picks a photo, the screen shows:

- The photo (from the phone; nothing is uploaded yet) and **Retake photo**.
- **Color**, detected from the photo the way new pieces are, and changeable from the full
  color list, as on the labeling screen.
- **What is it?**: the 11 types, named like the folders (Top, Hoodie, Sweatshirt, Pants,
  Jeans, Shorts, Skirt, Dress, Shoes, Jacket, Coat). Nothing is picked at first.
- **Style**: Cozy, Casual, Smart, Dressy. Nothing is picked at first.
- **Warmth**: Light, Medium, Warm, with Medium picked at first.
- Once a type and a style are picked, the **result** shows and updates on every change:
  - "Goes with **N** outfits" (one outfit: "Goes with 1 outfit"), and a line under it:
    - 10 or more: "A great match for your wardrobe 🔥"
    - 3 to 9: "Goes with a few things"
    - 1 or 2: "Only goes with a little"
    - 0: "Doesn't go with anything you own yet"
  - **Best with it**: up to 3 outfits, each a row of small photos with the new piece first.
    Tapping a row does nothing (it's only to look at).
- **Save to wishlist** (once a type and a style are picked; not in sample mode) and **Done**.
  Done forgets the check; nothing is saved anywhere.

If her wardrobe has nothing labeled yet, the result says "Label a few pieces first, so there's
something to compare with."

### Wishlist

Each item is a card: its photo, "Red · Top · Smart", and "Goes with N outfits" (worked out
again each time the screen is drawn, so it follows her wardrobe). Tapping the card opens it
like a check, with its type, color, style and warmth already picked (she can change them; a
change is saved), and instead of Save to wishlist:

- **I bought it**: moves the photo from `Wishlist` into the right `Wardrobe` folder and adds it
  as a piece with its color, warmth and style, so it's ready for outfits. A short message
  says "Added to your wardrobe 🎉" and the screen goes back to the Shop check screen.
- **Remove**: asks "Remove from your wishlist? The photo goes to your OneDrive recycle bin.",
  then deletes the photo and the item.

## 3. "Goes with N outfits"

The count uses the app's own rules, so a match means an outfit the app could really suggest.

1. The new piece is a labeled piece with id `shop-check` and the type, color, warmth and style
   she picked.
2. For each of the 15 occasion and temperature pairs (5 occasions × 3 temperatures), build the
   outfits with `buildOutfits` (rules.js) from her labeled pieces plus the new one, with every
   other piece of the **same role** left out (roles in `ROLES`: top, layer, dress, bottom,
   shoes, outer), so each outfit built either holds the new piece or can be dropped. As
   elsewhere, outfits are ranked by their color points and only the best `KEEP` (500) are
   kept per pair, so a huge wardrobe stays fast.
3. Keep the outfits that hold the new piece and where its color **clashes with nothing**: no
   piece in the outfit whose color pair with it scores below zero in `pairColorPoints`
   (today only "other" bold pairs, −2).
4. **N** is the number of different outfits kept (by their sorted ids), across all 15 pairs.
5. **Best with it**: the kept outfits with the highest score from `scoreOutfit` for the pair
   they were built for (her learned habits included, no random extra), at most 3, with no two
   showing the exact same outfit.

The thresholds (10, 3 and 1) live in `js/settings.js` under `shop`.

## 4. How it's built

### OneDrive

- `Wishlist` folder at the root of her OneDrive, created on the first save if it's missing.
- **Save to wishlist**: the photo is shrunk like **Add clothes** photos (`photos.shrink`) and
  uploaded to `Wishlist/<photoFileName>`, never over another file.
- On each app open and **Refresh**, the `Wishlist` folder is listed with its thumbnails, like
  the Wardrobe folders. Its photos are never treated as pieces.
- **I bought it**: `movePhoto` moves the photo into `Wardrobe/<Folder>` (renaming it if the
  name is taken); its id stays the same, so the next listing finds it as the piece already
  added.
- **Remove**: `deletePhoto` (to the OneDrive recycle bin).
- All three change OneDrive first; if that fails (offline), nothing changes in the app and a
  note says "You're offline. Connect and try again." or "OneDrive didn't answer. Try again in
  a moment.", as on the labeling screen.

### Saved data

`data.json` gets a `wishlist` list, oldest first:

```json
"wishlist": [{ "id": "<onedrive item id>", "fileName": "photo-1.jpg", "category": "tops",
  "color": "red", "warmth": "medium", "style": "smart", "addedAt": "2026-10-31" }]
```

- Read and checked like pieces (`parseData`): an item with an unknown type, color, warmth or
  style, or without an id, is left out. Older files without `wishlist` get an empty one.
- When the `Wishlist` listing no longer has an item's photo (she deleted it in OneDrive), the
  item is dropped, like a deleted piece.
- In sample mode there's no wishlist (it stays empty and isn't shown).

### Code

```
js/shop.js        The count and the best outfits for a piece (section 3). Pure, like rules.js.
js/ui/shop.js     Shop check screen: the photo picker, a check, the wishlist
js/onedrive.js    + listWishlist, uploadToWishlist (movePhoto and deletePhoto already exist)
js/sources.js     + wishlist calls for OneDrive; the sample has none
js/store.js       + the wishlist in parseData and when merging a listing
js/app.js         + the shop screen, its state and actions
js/ui/wardrobe.js + the Shop check button
js/settings.js    + shop thresholds
```

The photo of a check stays a blob on the phone (`URL.createObjectURL`), released when the
check is done or replaced.

## 5. Testing

- `tests/shop.test.js`: the count (same-role pieces left out, clashing colors not counted,
  the same outfit counted once across pairs, nothing labeled, a dress against tops and
  bottoms), the best 3, and the thresholds' lines.
- `tests/store.test.js`: the wishlist is read and checked, older files get an empty one, a
  photo gone from the listing drops its item.
- `tests/onedrive.test.js` and `tests/sources.test.js`: listing, uploading to, moving out of and
  deleting from `Wishlist`; I bought it adds a labeled piece and removes the item.
- In the browser at 320px: a check in sample mode (photo from the computer), the result
  updating as she picks, no sideways scrolling. With a real account on localhost: save to
  the wishlist, see the photo in OneDrive, I bought it, Remove.
- On a phone after merging: the camera opens from **Check a piece**.

## 6. Risks

- **Speed** with a big wardrobe: 15 builds per check, and one count per wishlist card on
  every draw. The `KEEP` cap and the left-out same-role pieces keep each build small; if it
  still feels slow on her phone, wishlist counts can be worked out once per visit instead.
- **Color detection** on a store photo with a busy background can be wrong; she can change
  the color, and the result updates.
