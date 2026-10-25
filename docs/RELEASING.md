# Releasing qERP (for the maintainer)

## 1. Bump the version
Change `"version"` in **both** `chrome/manifest.json` and `firefox/manifest.json`. Keep them the same.

If you change any code, change it in both folders. They are identical except for `manifest.json`.

## 2. Build the zips
Zip the folder contents, not the folder itself, so `manifest.json` sits at the top level of the zip.

```bash
VERSION=1.8.0
(cd chrome  && zip -r ../qerp-chrome-$VERSION.zip  .)
(cd firefox && zip -r ../qerp-firefox-$VERSION.zip .)
```

On Windows, open the `chrome` folder, select everything inside, and use *Send to → Compressed folder*. Do the same for `firefox`.

## 3. Get a signed Firefox file (free, a few minutes)
Regular Firefox only keeps signed add-ons installed.

1. Sign in at the Firefox Add-ons Developer Hub (`addons.mozilla.org/developers/`) with a free account.
2. Choose **Submit a New Add-on**, then **On your own** (unlisted).
3. Upload `qerp-firefox-<version>.zip`.
4. When signing finishes, download the signed `.xpi` and rename it `qerp-firefox-<version>.xpi`.

The add-on ID is `qerp@qerp.addon`. It is permanent after the first upload. To use a different one, change `browser_specific_settings.gecko.id` in `firefox/manifest.json` before the first upload.

Each new version needs a higher `version` number and another upload and signing.

## 4. Publish a GitHub release
1. On the repo page, open **Releases → Draft a new release**.
2. Create a tag such as `v1.8.0`.
3. Attach `qerp-chrome-<version>.zip` and `qerp-firefox-<version>.xpi`. Attaching `qerp-firefox-<version>.zip` too is a good fallback for temporary installs.
4. Publish. The README's "latest release" links now point to it.

## 5. Change the videos
The **Videos** section in `README.md` has two YouTube links. To swap one, replace its 11-character video ID (the part after `v=`) in both the link and the thumbnail address, and rename the caption under it.

## Optional: submit to the stores
`docs/STORE_LISTING.md` has the listing text, permission justifications and reviewer notes. `docs/images/` has 1280×800 screenshots and a 440×280 promo tile. `PRIVACY.md` is the privacy policy to link from the listing. The Chrome Web Store charges a one-time $5 developer fee, and Firefox Add-ons is free.
