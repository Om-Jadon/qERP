# qERP Privacy Policy

Last updated: October 25, 2026

qERP is an unofficial browser extension that helps you log in to the IIT Kharagpur ERP faster. It is not affiliated with, endorsed by, or sponsored by IIT Kharagpur or Google.

**In short: everything qERP saves stays on your device. The developer receives no data from you, ever.**

## What qERP stores

When you press Save in the extension, it stores the following in your browser's local extension storage, on your own device:

- Your ERP User ID and password
- Your security questions and their answers
- Your settings: whether Gmail auto-fill is on, and the Gmail inbox URL you pasted (used only to work out which Gmail account number to read)

This data is stored unencrypted in the browser's extension storage. It is never sent to the developer or to any third party. qERP has no server, no analytics, no telemetry, no advertising, and does not load or run remote code.

## What qERP sends over the network

qERP makes network requests only to these two places:

1. **erp.iitkgp.ac.in** (the ERP login page). The extension fills in your saved details on the login form, looks up your security question, and requests the OTP, exactly as you would by hand. Your login details go to the ERP and nowhere else.
2. **mail.google.com** (optional). Only if you turn on "Auto-fill the OTP and log in", and only after you grant the browser permission, qERP reads Gmail's unread-mail feed (`https://mail.google.com/mail/u/N/feed/atom`) using your own existing Gmail sign-in. It does this for at most one minute after the OTP is requested, to find the new ERP OTP email. It keeps only the numeric code from emails with the ERP OTP subject sent from an iitkgp.ac.in address. Everything else in the feed is discarded immediately, and the code is not saved. The code is used once to fill the OTP field and log in.

## Permissions

- **storage**: to save your details and settings on your device.
- **erp.iitkgp.ac.in**: to fill the login form and request the OTP.
- **mail.google.com (optional)**: requested only when you switch on Gmail auto-fill, and removed again when you switch it off.

## Your control

- Turn off Gmail auto-fill in the extension at any time. This also removes the Gmail permission.
- Uninstalling the extension deletes everything it stored.

## Data use commitments

qERP does not sell or transfer user data to third parties, does not use or transfer data for purposes unrelated to its single purpose (logging you in to the ERP), and does not use or transfer data to determine creditworthiness or for lending purposes.

## Changes

If this policy changes, the new version will be posted at the same address with an updated date.

## Contact

Questions about this policy: please use the support contact shown on the extension's store page.
