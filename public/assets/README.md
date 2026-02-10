# Assets Notes

Source of truth for game assets is the root `/assets` directory.

- Runtime URL base: `/assets/...`
- Manifest used by client: `/assets/manifest.json`
- Server route: `app.use('/assets', express.static('assets', { fallthrough: false }))`

This `public/assets` folder may contain legacy/generated copies, but it is not the canonical source for runtime asset loading.
