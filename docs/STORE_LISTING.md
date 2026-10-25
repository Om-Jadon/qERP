# qERP: store listing kit

Everything you need to paste into the Chrome Web Store dashboard and addons.mozilla.org. Only needed if you decide to publish to the stores.

## Files to upload
- Chrome / Edge: zip the contents of the `chrome/` folder (see RELEASING.md)
- Firefox: zip the contents of the `firefox/` folder
- Screenshots: `images/` (1280x800 PNG). Small promo tile (optional, Chrome): `images/promo-440x280.png`
- Store icon: `icon128.png` is inside each extension folder.

## Basics
- **Name:** qERP
- **Summary (max 132 chars):** Unofficial one-click login helper for the IIT Kharagpur ERP. Not affiliated with IIT Kharagpur. Data stays on your device.
- **Category:** Productivity (Chrome). Firefox: "Other".
- **Language:** English
- **Privacy policy URL:** use the public link to `PRIVACY.md` in this repo.
- **Support / contact:** your email or the repo's issues page.
- **Visibility:** Chrome: Unlisted (install only via link) or Public. Firefox: Listed ("On this site") or Unlisted ("On your own").
- **Chrome trader status:** choose "non-trader" if this is a free personal project.

## Detailed description (paste as-is)

qERP is a small, unofficial helper that makes logging in to the IIT Kharagpur ERP quick.

Save your User ID, password and your security questions once. After that, one click on "Log in to ERP" will:
- fill in your User ID and password,
- pick the right security answer for the question the ERP shows (it matches the question text, so it works even when the ERP asks a different one each time),
- press "Get OTP" for you.

Optional: Gmail OTP auto-fill. If you want, qERP can also read the OTP email from your Gmail and finish the login for you. You paste your Gmail inbox URL once, and the browser asks your permission for Gmail access only when you switch this on. After the OTP is requested, qERP watches your Gmail unread-mail feed for up to one minute (a countdown shows on the page), fills the OTP, and logs you in. If it can't, it stops and you type the OTP yourself. If anything goes wrong with Gmail, you are told immediately and the normal login steps still work.

Privacy:
- Everything you save stays in your browser, on your device.
- No servers, no analytics, no ads, no remote code.
- The only sites qERP talks to are the ERP (erp.iitkgp.ac.in) and, only if you enable it, your own Gmail feed.
- Turning the Gmail option off removes the Gmail permission.

Notes:
- qERP stores your details unencrypted in the browser's extension storage. Use it only on a device you trust.
- qERP is an independent project and is not affiliated with, endorsed by, or sponsored by IIT Kharagpur or Google.

## Chrome Web Store: Privacy tab

- **Single purpose:** Help the user log in to the IIT Kharagpur ERP by filling the login form, requesting the OTP, and (optionally) filling the OTP read from the user's own Gmail.
- **storage permission:** Saves the user's login details, security questions and settings locally so they only have to enter them once.
- **Host permission (https://erp.iitkgp.ac.in/*):** The extension fills the ERP login form, looks up the security question and presses "Get OTP" on that site. It does nothing on any other site.
- **Optional host permission (https://mail.google.com/*):** Requested only when the user turns on "Auto-fill the OTP and log in". Used to fetch the user's own Gmail unread-mail feed for up to one minute after the OTP is requested, to extract the numeric OTP from the ERP OTP email. All other content is discarded. Removing the option removes the permission.
- **Remote code:** No, I am not using remote code.
- **Data usage disclosure (be conservative):** tick *Authentication information* (the ERP password and security answers) and *Personal communications* (the OTP email is read from Gmail's feed). Then certify all three statements: not sold to third parties outside approved use cases; not used or transferred for purposes unrelated to the single purpose; not used for creditworthiness or lending.
- **Test instructions (optional field):** Logging in requires an IIT Kharagpur ERP account, so the full flow can't be reproduced without one. The code is unminified and readable. The ERP flow is in content.js and the Gmail feed request is the single fetch in background.js.

## addons.mozilla.org

- **Manifest:** `firefox/manifest.json` already contains `data_collection_permissions` set to `none` and the add-on ID `qerp@qerp.addon`. The ID is permanent after the first upload; change it in `manifest.json` before uploading if you want a different one.
- **Notes to reviewers:** Source is not minified or built; the uploaded package is the source. The only network requests are to erp.iitkgp.ac.in (same-origin, from the content script) and, only if the user enables the optional Gmail feature and grants the optional `mail.google.com` host permission, one fetch of `https://mail.google.com/mail/u/N/feed/atom` in background.js. Only the numeric OTP of emails from an iitkgp.ac.in sender with an ERP OTP subject is passed to the page; everything else in the feed is dropped. No data is sent to the developer or any third party, hence `data_collection_permissions: none` (the user's ERP login details are sent only to the ERP site itself, as part of the login the user asked for).
- **Summary (max 250 chars):** same as the summary above.
- **Support / privacy policy:** same URLs as for Chrome.

## Version updates
Bump `version` in `manifest.json`, re-zip from inside the folder, and upload the new zip.
