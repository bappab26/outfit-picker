# lil evil wardrobe

A free phone web app that reads clothing photos from OneDrive and suggests outfits with plain
rules (no AI, no paid services). It's live on GitHub Pages and a friend of the owner uses it.

- `README.md`: setup, testing, publishing, handing it over, adjusting the rules.
- `docs/superpowers/specs/2026-10-25-outfit-picker-design.md`: how the app works now.
- `docs/superpowers/plans/2026-10-25-outfit-picker.md`: the original build plan. Parts are out
  of date (it lists 6 clothing folders; there are now 11). Trust the README and spec over it.
- `docs/superpowers/probe-results.md`: phone test results and the sign-in/photo settings
  they decided.

## Never push to `main`

Pushing to `main` deploys straight to GitHub Pages, i.e. to the friend's phone. Until the
owner says otherwise (rule set 2026-10-27):

- Work on a branch and push only the branch.
- Never push, merge or force-push to `main`. The owner reviews and merges pull requests
  themselves.

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
  (`outfit-picker-v20` goes with `'1.20'`), and set `VERSION` to the day's date.
- Add any new file under `js/` to `APP_FILES` in `sw.js`.

`npm test` checks both. Changes to docs, tests or tools alone don't need a new version.

## Working with the owner

- The owner often works from a laptop without Git or Node.js, through cloud sessions. Explain
  Git and GitHub steps in plain words.
- Earlier updates were uploaded through the GitHub website, which can't delete files, so old
  files can be left behind. Check that nothing still uses a file before trusting it.
