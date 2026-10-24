# MOODS

A moodboard / wishlist for clothes, built as an iPhone web app. Snap or screenshot a piece, Claude reads the brand, and it's filed by category and season.

Palace-style navigation (pill menu, frosted category list, swipeable tabs, tight 2-up grid) on a Hard Sun-style page (bone white, hairlines, `+` accordions, black bottom bar).

## Use it

1. Open the site in Safari on your iPhone → Share → **Add to Home Screen**.
2. Menu → **Settings** → paste an Anthropic API key (stored on this device only).
3. **+ ADD** → choose a photo. Claude fills in brand, piece, category, colour (and season if it's on screen). Edit anything, then **Save to board**.

Your board lives in the browser's IndexedDB on that device. Use **Settings → Export backup** to keep a copy or move phones.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173/moods/
npm run build    # typecheck + production build to dist/
```

Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml` (repo Settings → Pages → Source: **GitHub Actions**).
