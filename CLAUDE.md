# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# lil evil wardrobe

A free phone web app that reads clothing photos from OneDrive and suggests outfits with plain
rules (no AI, no paid services). It's live on GitHub Pages and a friend of the owner uses it.

- `README.md`: setup, testing, publishing, handing it over, adjusting the rules.
- `docs/superpowers/specs/2026-10-25-outfit-picker-design.md`: how the app works now.
- `docs/superpowers/plans/2026-10-25-outfit-picker.md`: the original build plan. Parts are out
  of date (it lists 6 clothing folders; there are now 11). Trust the README and spec over it.
- `docs/superpowers/probe-results.md`: phone test results and the sign-in/photo settings
  they decided.

## Commands

- `npm test`: all tests (`node --test`, Node 24, nothing to install).
- `node --test tests/rules-pick.test.js`: one file. Add `--test-name-pattern="<text>"` to run
  only the tests whose names match.
- `npm run serve`: local server at `http://localhost:8080/`. Microsoft sign-in only works on
  this port, because that address is registered. **Try with sample clothes** needs no sign-in.
- `node scripts/make-icons.mjs`: redraws `icons/` from `scripts/logo-source.png`.
- `tools/probe.html`: a separate page that tests phone sign-in and photo reading. It isn't
  part of the app and isn't in `APP_FILES`.

There is no lint or build step.

## How the code fits together

- `js/app.js` holds the app's state and controls the screens: one `state` object,
  `show(screen)` to switch screens, and `render()`, which clears `#app` and redraws the
  current screen after every change. Each screen in `js/ui/` is a function
  `renderX(root, view, actions)` that builds elements with `h()` from `js/ui/dom.js`. It
  changes nothing itself: every tap calls an action in `app.js`, which updates `state` and
  calls `render()` again.
- `js/sources.js` lets the same app code run on two **sources**: OneDrive (`onedrive.js`
  for the Graph calls, `auth.js` for MSAL sign-in) or the built-in sample (`sample.js`,
  saved in `localStorage`). Both provide `load`, `refresh`, `photoUrl`, `save`, `movePiece`
  and `deletePiece`; only OneDrive provides `addPhotos` (`canAdd`). Data that hasn't reached
  OneDrive yet stays in `localStorage` under `outfit-picker:pending`.
- `js/store.js` owns the shape of `data.json` (spec §4.5). It parses and checks the file,
  merges it with the OneDrive photo list (new, moved and deleted photos), trims the diary,
  and saves about 1 second after each change (`createSaver`).
- How outfits are picked: `rules.js` builds every possible outfit, removes the ones that
  don't fit, scores the rest and picks 3. Color points come from `colors.js`, and the nudge
  from her learned habits comes from `habits.js`, which reads the diary. `feedback.js`
  applies 👍/👎/Wore this (and their undo) to the data, and `keys.js` makes the sorted
  `id|id` keys.
- `eggs.js` decides the Easter eggs; `ui/eggs.js` draws them. Don't spoil them in interface
  text.
- **Pure modules:** the rule, store, sample, source and OneDrive modules (the full list is in
  the plan's "Global Constraints") take the date, randomness, `storage`, `graph` and the
  browser's photo functions as parameters. The tests rely on this, with fake versions built
  in `tests/helpers.js`. Keep browser objects out of these modules' top-level code.
- Some tests read the source files as text. `page.test.js` checks the viewport and the
  version line, `sw.test.js` checks `APP_FILES` and the MSAL version, and `icons.test.js`
  checks the icons. Changing that markup or the MSAL version (`index.html` and `sw.js`
  together) can make them fail.
- The browser's own storage (`localStorage`) keys all start with `outfit-picker:` and are
  listed at the top of `app.js` and `sources.js`. `SAMPLE_KEY` has a number; raise it when
  the sample's data shape changes, so old saved samples get replaced.

## Never push to `main`

Pushing to `main` deploys straight to GitHub Pages, i.e. to the friend's phone. The owner
tries every change on localhost before merging it (rule set 2026-10-27; a one-day switch to
pushing straight to `main` was undone on 2026-10-30):

- Before changing anything, pull the latest `main`: work also happens in cloud sessions and on
  the GitHub website.
- Work on a branch and push only the branch.
- Never push, merge or force-push to `main`. The owner tests, reviews and merges pull requests
  themselves.
- To try a branch on the owner's PC: `git fetch`, `git switch <branch>`, `npm run serve`, then
  open `http://localhost:8080/`. Afterwards: `git switch main` and `git pull`.

## Rules for changes

- Plain HTML, CSS and JavaScript ES modules. No framework, no build step. `package.json` has
  no dependencies; the only runtime library is MSAL, loaded from jsDelivr in `index.html`.
- Interface text is in English.
- Phone first: works at 320px wide with no sideways scrolling, tap targets at least 44px,
  works in iOS Safari and Android Chrome.
- Every number the rules use lives in `js/settings.js`.
- Dates are local `YYYY-MM-DD` strings (`todayISO` in `js/dates.js`), never UTC.
- Logic modules must import in Node without a browser (see the plan's "Global Constraints").
- Run `npm test` (Node's built-in runner, nothing to install) before every push. All must pass.

## Every app update

When a change touches anything the phone downloads (`index.html`, `css/`, `js/`, `icons/`,
`manifest.webmanifest`, `sw.js`):

- Raise `CACHE_NAME` in `sw.js` and `VERSION_NUMBER` in `js/ui/labels.js` together
  (`outfit-picker-v20` goes with `'1.20'`).
- Add any new file under `js/` to `APP_FILES` in `sw.js`.

`npm test` checks both. Changes to docs, tests or tools alone don't need a new version.

## Working with the owner

- The owner often works from a laptop without Git or Node.js, through cloud sessions. Explain
  Git and GitHub steps in plain words.
- Earlier updates were uploaded through the GitHub website, which can't delete files, so old
  files can be left behind. Check that nothing still uses a file before trusting it.
