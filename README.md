# lil evil wardrobe

A free phone web app that reads photos of clothes from OneDrive and suggests outfits
with simple rules. No AI, no paid services. "lil evil wardrobe" is the starting name: she can
tap the name at the top of the app to call it whatever she likes.

Her clothes go in 11 OneDrive folders. An outfit is a top (from **Tops**, **Hoodies** or
**Sweatshirts**, or a hoodie or sweatshirt over a top), a bottom (**Pants**, **Jeans**,
**Shorts** or **Skirts**) or a **Dress**, **Shoes**, and sometimes a **Jacket** or **Coat** over
everything. A hoodie over a top is never suggested when it's hot, and shorts never when it's cold.

Each piece gets a warmth (Light, Medium, Warm) and a style (Cozy, Casual, Smart, Dressy).
Occasions use these styles: Everyday (Casual, Smart), Work (Smart), Evening out (Smart,
Dressy), Special event (Dressy) and At home (Cozy, Casual). Cozy shoes and jackets are
only suggested at home, and at home a coat is never required.

Of the three outfits, the last one always has a piece she hasn't worn in 30 days or more
(when there is one), marked **Not worn in a while**. 👍 and **Wore this** can be tapped again
to take them back; after a 👎, **Undo 👎** brings the outfit back. Tapping an outfit's photos
shows it big, on its own; **×**, a tap outside it, or Esc closes it.

Clothes can be added from the app (**Wardrobe → Add clothes**: pick a folder, then take or
choose photos) or by saving photos into the OneDrive folders. Tapping a piece in Wardrobe
lets her move it to another folder or delete it.

The app also learns her style from what she taps (see "How it learns her style" below).

(The Microsoft app registration below is still called "Outfit Picker", which is why the
data folder in OneDrive is `Apps/Outfit Picker`. Renaming the registration isn't needed.)

Design: [docs/superpowers/specs/2026-10-25-outfit-picker-design.md](docs/superpowers/specs/2026-10-25-outfit-picker-design.md)

## Setup

You do this once. It takes about 20 minutes. Steps checked against Microsoft's
documentation in October 2026; Microsoft sometimes renames menu items.

### 1. Install Node.js (for testing on your computer)

Install the LTS version from <https://nodejs.org> (or `winget install OpenJS.NodeJS.LTS`).
Your friend never needs it.

### 2. Get a free Azure account

Microsoft only lets you register an app from an Azure account. If you don't have one,
create a free one at <https://azure.microsoft.com/free>. Sign-up may ask for a phone number
and a card to confirm who you are; registering an app is free and nothing is charged.
Your account comes with a "Default Directory", which is all you need.

### 3. Register the app with Microsoft

1. Go to the Microsoft Entra admin center: <https://entra.microsoft.com> and sign in with
   your Azure account.
2. Go to **Entra ID** → **App registrations** → **New registration**.
3. **Name:** `Outfit Picker`. (OneDrive names the app's data folder after this:
   `Apps/Outfit Picker`.)
4. **Supported account types:** **Any Entra ID Tenant + Personal Microsoft accounts**.
   This lets Outlook/Hotmail accounts sign in.
5. Leave the redirect address empty for now and select **Register**.
6. On the **Overview** page, copy the **Application (client) ID**.
7. Open `js/config.js` and put it between the quotes on the `CLIENT_ID` line, keeping the
   quotes: `export const CLIENT_ID = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';`.

### 4. Add the redirect addresses

In your app registration: **Manage** → **Authentication** → **Redirect URI configuration**
tab → **Add Redirect URI** → choose **Single-page application**. Add these four addresses
(replace `<github-user>` and `<repo>` with yours from step 6; you can come back and add the
last two later):

```
http://localhost:8080/
http://localhost:8080/tools/probe.html
https://<github-user>.github.io/<repo>/
https://<github-user>.github.io/<repo>/tools/probe.html
```

They must match exactly, including the `/` at the end. Leave any "implicit grant" boxes
unchecked.

### 5. Add the OneDrive permission

**Manage** → **API permissions** → **Add a permission** → **Microsoft Graph** →
**Delegated permissions** → tick **Files.ReadWrite** → **Add permissions**.
(Your friend is asked to allow this the first time she signs in.)

### 6. Put it online with GitHub Pages

1. Create a free account at <https://github.com> and a new repository, for example
   `outfit-picker`. It can be public: the app ID is not a secret.
2. Push this folder to it (GitHub shows the commands on the new repository's page).
3. In the repository: **Settings** → **Pages** → **Build and deployment** → Source
   **Deploy from a branch** → branch `main`, folder `/ (root)` → **Save**.
4. After a minute the app is at `https://<github-user>.github.io/<repo>/`.

### 7. Try it on your computer

```bash
npm run serve
```

Then open <http://localhost:8080/>.

## Run the probe

Before the app is finished, a small test page checks the three risky parts: reading photo
colors from OneDrive, signing in from a phone's home screen, and saving the app's data file.

1. Put one photo in `Wardrobe/Tops` in your OneDrive (the probe creates the folders if
   they're missing).
2. **Computer:** run `npm run serve`, open <http://localhost:8080/tools/probe.html>, tap
   **Sign in (redirect)**, then **Run checks**. When Microsoft asks **Stay signed in?**,
   answer **Yes** (see "Staying signed in" below).
3. **Phone, in the browser** (Safari on iPhone, Chrome on Android): open
   `https://<github-user>.github.io/<repo>/tools/probe.html`, sign in, **Run checks**.
4. **Phone, from the home screen:** on that page use **Share → Add to Home Screen** (iPhone)
   or **⋮ → Add to Home screen** (Android), open it from the new icon, try
   **Sign in (redirect)**; if that doesn't come back signed in, try **Sign in (popup)**.
   Then **Run checks**.
5. Tap **Copy results** each time and paste the results into
   `docs/superpowers/probe-results.md`.
6. Set the two probe settings at the bottom of `js/config.js`:
   - `IMAGE_STRATEGY`: keep `'thumbnail'` if check 4 passed everywhere; use `'download'` if only
     check 5 passed.
   - `HOME_SCREEN_SIGNIN`: keep `'redirect'` if signing in from the home-screen icon worked
     with redirect; use `'popup'` if only popup worked; use `'safari-only'` if neither did.

   If check **3b. Thumbnails in listing** fails, photos would show only their file names, and
   no setting fixes that: the app's photo listing needs changing before she uses it.

## Staying signed in

Microsoft's sign-in library forgets the sign-in when the browser or home-screen app is fully
closed, unless **Stay signed in?** was answered **Yes** at sign-in. So:

- Answer **Yes** yourself when testing, and tell your friend to do the same.
- If she is signed out anyway, the app shows **Continue as her@email**: one tap signs her
  back in, usually without typing her password.
- Microsoft also asks a phone browser to sign in again now and then (about once a day);
  with "Stay signed in" that is a quick automatic bounce through Microsoft's page.

## Test it yourself

- **Automated checks:** `npm test` runs every check of the outfit rules, data handling and
  OneDrive calls. All should pass.
- **Sample mode:** open the app and tap **Try with sample clothes**. It loads about 40 drawn
  pieces, no sign-in needed, so you can try the rules. It comes with a made-up month of
  choices (pink with black, casual pants outfits, dresses for evenings out), so
  **Wardrobe → Your style so far** shows something and the picks lean that way. Tap **Exit**
  to leave.
- **Your own account:** tap **Sign in with Microsoft** and sign in with your own Microsoft
  account. The app creates `Wardrobe` and its 11 folders in *your* OneDrive. Add a few
  photos with **Wardrobe → Add clothes** (or save them into the folders and tap **Refresh**),
  label them and check the outfits. Try moving one to another folder and deleting one: the
  photo should move in OneDrive, or land in the OneDrive recycle bin.
  Test on your computer (`http://localhost:8080/`) and on your phone (the GitHub Pages
  address).
- **Tested with an earlier version?** Jackets and coats used to go in one `Outerwear`
  folder. Move those photos into `Jackets` or `Coats` and label them again; the app no
  longer reads `Outerwear`.
- **Close and reopen:** on the phone, fully close the home-screen app (swipe it away), open
  it again and check you are still signed in, or get **Continue as …** and are back after
  one tap.

## Put it online

Push your changes to GitHub; Pages updates the site within a minute or two.

Phones keep a copy of the app so it opens fast, and pick up a new version the next time
it's opened. To make phones drop the old copy right away, raise the number in `CACHE_NAME`
at the top of `sw.js` (`outfit-picker-v1` → `outfit-picker-v2`, and so on) with each update.
Also set `VERSION` in `js/ui/labels.js` to the day's date: it shows at the bottom of the app
("Version … · by bap bap"), so you can see which version a phone has.
If you add a new file under `js/`, add it to `APP_FILES` in `sw.js` too (`npm test` reminds you).

## Give it to your friend

1. Send her the link: `https://<github-user>.github.io/<repo>/`.
2. She opens it on her phone and signs in with **her** Microsoft account, answering **Yes**
   to **Stay signed in?**. She starts with an empty wardrobe; your test data stays in your
   OneDrive. (Personal Outlook/Hotmail accounts are what this was tested for; with a work or
   school account, OneDrive may not send photo previews and the cards would show file names.)
3. She adds it to her home screen: **Share → Add to Home Screen** on iPhone (Safari), or
   **⋮ → Add to Home screen** on Android (Chrome). If you set `HOME_SCREEN_SIGNIN` to
   `'safari-only'`, she should keep it as a Safari bookmark instead. The name under the icon
   is chosen here (an iPhone lets her type it); renaming the app inside it later doesn't
   change the icon's name.
4. Tell her how to add clothes:
   - In the app: **Wardrobe → Add clothes**, pick the folder, then take a photo or pick
     several from her gallery. The app shrinks them, saves them in OneDrive and opens the
     labeling screen.
   - Or in OneDrive, under `Wardrobe`, in the right folder: `Tops` (T-shirts, blouses,
     shirts), `Hoodies`, `Sweatshirts`, `Pants` (trousers), `Jeans`, `Shorts`, `Skirts`,
     `Dresses` (dresses and jumpsuits), `Shoes`, `Jackets`, `Coats`. Then open the app and
     label the new pieces.
   - One piece per photo, on a plain background.
   - A piece in the wrong folder: tap it in Wardrobe and pick another **Folder**. To remove
     one, tap it and **Delete piece**.

## How it learns her style

Every **Wore this**, 👍 and 👎 adds a line to a diary in her data file (her latest 500
choices). From it the app learns four habits by plain counting, no AI:

- **Color combinations** she wears together, like black with pink.
- **Favorite colors.**
- **Shape per occasion:** dress, skirt, pants (jeans count as pants) or shorts, for example
  mostly dresses for evenings out.
- **How dressed-up:** Casual or Smart for Everyday, Smart or Dressy for Evening out, and so on.

Wore this and 👍 count as a yes, 👎 as a no. Recent choices count more: a choice from two
months ago counts half. The habits only nudge the picks, about as much as the color rules:
pieces worn in the last 3 days still step aside, and the **Not worn in a while** outfit still
brings back forgotten ones. Taking back a tap (Undo) also takes it out of the diary. A new piece benefits right away, because habits are about colors and
shapes, not single pieces.

After about 5 choices, **Wardrobe** shows **Your style so far**, for example
"Often together: Black + Pink" or "Evening out: mostly dresses, Dressy". It's the easiest way
to check that it's learning.

## Adjust the rules

Every number the rules use is in `js/settings.js`, with a note on what it does. For
example, `recentDays: 3` is how long a piece counts as "just worn", and
`forgottenDays: 30` is how long until a piece counts as forgotten for the
**Not worn in a while** outfit. The `habits` numbers set how fast and how strongly it learns
her style. Run `npm test` after a change: some checks use these values, so
a failing check after a deliberate change means that check needs updating too.

## Start over

Delete `Apps/Outfit Picker/data.json` in her OneDrive. The app then finds all the photos
again as unlabeled pieces, and forgets her habits. The app only changes her photos when she
asks: **Add clothes** saves new ones, **Folder** moves one, and **Delete piece** sends one to
the OneDrive recycle bin (where it can be brought back for a while).

If `data.json` ever gets damaged (for example by editing it by hand), the app saves a copy
named `data-backup-<date>.json` next to it before starting fresh. OneDrive's own version
history (right-click the file → **Version history**) can also bring back an older copy.
On a French OneDrive the `Apps` folder may be called `Applications`.

## Troubleshooting

- **Sign-in error from Microsoft:** check the redirect addresses in your app registration
  (Setup, step 4) match the address in the browser exactly, including the `/` at the end.
- **"Sign in with Microsoft" is greyed out:** the app ID in `js/config.js` hasn't been
  filled in.
- **"Couldn't add the photos":** the phone lost its connection while sending them. The ones
  already sent are in the app; add the others again.
- **New photos don't show up:** tap **Refresh** on the Wardrobe screen. Photos must be in
  one of the 11 folders, not directly in `Wardrobe`.
- **A photo shows its file name instead of the picture:** OneDrive hasn't made a preview
  for it yet; try **Refresh** later.
- **The page still zooms on an iPhone:** iPhones don't always obey a page's no-zoom setting,
  so the app also blocks the pinch gesture itself. Check it on her phone.
- **"Not saved, retrying":** the phone lost its connection. Changes are kept on the phone
  and saved the next time the app opens online.
