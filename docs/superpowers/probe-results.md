# OneDrive probe results

Run `tools/probe.html` as described in README.md, "Run the probe", then fill this in.

## Results

### (a) Computer, http://localhost:8080/tools/probe.html

(paste results here)

### (b) Phone browser, GitHub Pages address

Phone and browser: 

(paste results here)

### (c) Phone, from the home-screen icon

Redirect sign-in worked? 
Popup sign-in worked? 

(paste results here)

## Decisions

- Thumbnails in listing (check 3b): (pending) — if it fails, photos would show only file names; the listing needs changing before release
- IMAGE_STRATEGY: (pending) — `thumbnail` if check 4 passes everywhere; otherwise `download` if check 5 passes
- HOME_SCREEN_SIGNIN: (pending) — `redirect` if (c) works with redirect; otherwise `popup` if (c) works with popup; otherwise `safari-only`
- Still signed in after fully closing and reopening the home-screen app (with "Stay signed in" = Yes)? (pending)
