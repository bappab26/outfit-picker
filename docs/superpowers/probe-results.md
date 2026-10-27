# OneDrive probe results

Run `tools/probe.html` as described in README.md, "Run the probe", then fill this in.

These results come from using the finished app itself (version 1.19) with real photos in
OneDrive, not from the probe page. The app uses `IMAGE_STRATEGY = 'thumbnail'` and
`HOME_SCREEN_SIGNIN = 'redirect'`, so the app working shows those choices work.

## Results

### (a) Computer, http://localhost:8080/tools/probe.html

Not run.

### (b) Phone browser, GitHub Pages address

Phone and browser: iPhone 17 Pro Max, Safari

Tested from the home-screen icon (see (c)), which uses Safari's engine.

### (c) Phone, from the home-screen icon

Redirect sign-in worked? Yes
Popup sign-in worked? Not tried (redirect worked)

Tested 2026-10-26 and 2026-10-27 on an iPhone 17 Pro Max, opened from the home-screen icon:

- Signed in with redirect.
- Photos show (OneDrive thumbnails come with the photo listing).
- Colors are detected from the thumbnails.
- Still signed in after fully closing the app and reopening it from the icon.

## Decisions

- Thumbnails in listing (check 3b): passed — photos show in the app
- IMAGE_STRATEGY: `thumbnail` — colors are detected from thumbnails
- HOME_SCREEN_SIGNIN: `redirect` — redirect sign-in works from the home-screen icon
- Still signed in after fully closing and reopening the home-screen app (with "Stay signed in" = Yes)? Yes
- Not checked: Android phones, and the computer run in (a).
