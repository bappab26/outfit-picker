# Anh's Wardrobe

A free phone web app that reads photos of clothes from OneDrive and suggests outfits
with simple rules. No AI, no paid services.

Each piece gets a warmth (Light, Medium, Warm) and a style (Cozy, Casual, Smart, Dressy).
Occasions use these styles: Everyday (Casual, Smart), Work (Smart), Evening out (Smart,
Dressy), Special event (Dressy) and At home (Cozy, Casual). Cozy shoes and outerwear are
only suggested at home, and at home a coat is never required.

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
- **Sample mode:** open the app and tap **Try with sample clothes**. It loads about 30 drawn
  pieces, no sign-in needed, so you can try the rules. Tap **Exit** to leave.
- **Your own account:** tap **Sign in with Microsoft** and sign in with your own Microsoft
  account. The app creates `Wardrobe` and its six folders in *your* OneDrive. Add a few
  photos, tap **Refresh** on the Wardrobe screen, label them and check the outfits.
  Test on your computer (`http://localhost:8080/`) and on your phone (the GitHub Pages
  address).
- **Close and reopen:** on the phone, fully close the home-screen app (swipe it away), open
  it again and check you are still signed in, or get **Continue as …** and are back after
  one tap.

## Put it online

Push your changes to GitHub; Pages updates the site within a minute or two.

Phones keep a copy of the app so it opens fast, and pick up a new version the next time
it's opened. To make phones drop the old copy right away, raise the number in `CACHE_NAME`
at the top of `sw.js` (`outfit-picker-v1` → `outfit-picker-v2`, and so on) with each update.
If you add a new file under `js/`, add it to `APP_FILES` in `sw.js` too (`npm test` reminds you).

## Give it to your friend

1. Send her the link: `https://<github-user>.github.io/<repo>/`.
2. She opens it on her phone and signs in with **her** Microsoft account, answering **Yes**
   to **Stay signed in?**. She starts with an empty wardrobe; your test data stays in your
   OneDrive. (Personal Outlook/Hotmail accounts are what this was tested for; with a work or
   school account, OneDrive may not send photo previews and the cards would show file names.)
3. She adds it to her home screen: **Share → Add to Home Screen** on iPhone (Safari), or
   **⋮ → Add to Home screen** on Android (Chrome). If you set `HOME_SCREEN_SIGNIN` to
   `'safari-only'`, she should keep it as a Safari bookmark instead.
4. Tell her how to add clothes:
   - Photos go in OneDrive under `Wardrobe`, in the right folder: `Tops`, `Pants` (jeans,
     trousers, shorts), `Skirts`, `Dresses` (dresses and jumpsuits), `Shoes`, `Outerwear`.
   - One piece per photo, on a plain background.
   - Then open the app and label the new pieces (two taps each).

## Adjust the rules

Every number the rules use is in `js/settings.js`, with a note on what it does. For
example, `recentDays: 3` is how long a piece counts as "just worn", and
`forgottenDays: 30` is how long until a piece counts as forgotten for
**Something different**. Run `npm test` after a change: some checks use these values, so
a failing check after a deliberate change means that check needs updating too.

## Start over

Delete `Apps/Outfit Picker/data.json` in her OneDrive. The app then finds all the photos
again as unlabeled pieces. Her photos are never changed or deleted by the app.

If `data.json` ever gets damaged (for example by editing it by hand), the app saves a copy
named `data-backup-<date>.json` next to it before starting fresh. OneDrive's own version
history (right-click the file → **Version history**) can also bring back an older copy.
On a French OneDrive the `Apps` folder may be called `Applications`.

## Troubleshooting

- **Sign-in error from Microsoft:** check the redirect addresses in your app registration
  (Setup, step 4) match the address in the browser exactly, including the `/` at the end.
- **"Sign in with Microsoft" is greyed out:** the app ID in `js/config.js` hasn't been
  filled in.
- **New photos don't show up:** tap **Refresh** on the Wardrobe screen. Photos must be in
  one of the six folders, not directly in `Wardrobe`.
- **A photo shows its file name instead of the picture:** OneDrive hasn't made a preview
  for it yet; try **Refresh** later.
- **"Not saved, retrying":** the phone lost its connection. Changes are kept on the phone
  and saved the next time the app opens online.
