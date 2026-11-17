# IT Asset Inventory

A small web app for keeping track of an office's devices and software licences. It records who has which laptop, phone, printer or scanner, flags warranties and licence renewals that are coming up, warns when a licence has more installs than seats, and exports either list to CSV for a spreadsheet.

I built it around the kind of record keeping a small team needs when one person looks after the equipment: which handheld went to which team, what is out for repair, and what is sitting spare in a cupboard.

## Run it

Needs Node.js 20.19 or newer (Vite 8).

```
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173).

Other commands:

```
npm run build   # production build into dist/
npm test        # unit tests for the inventory logic
```

## What it does

Devices
- Asset tag (required and must be unique), type, make and model, serial number, assigned to, location, status, purchase date, warranty end date and notes.
- Statuses: In use, Spare, In repair, Retired.
- Search across tag, model, serial, person, location and notes, plus filters for type and status.
- Click a column header to sort. Click again to reverse.
- Warranty dates show "Expired" or the number of days left when it is within 30 days. Retired devices are not flagged.

Licences
- Software name, vendor, seats bought, seats used, renewal date and notes.
- Shows free seats, and marks a licence in red when more seats are used than bought.
- Renewal dates show "Overdue" or the number of days left when it is within 30 days.

General
- Summary counts at the top: devices, in use, spare, warranties ending soon, over-allocated licences and renewals due.
- Export CSV saves the list you are looking at (with any search or filter applied). Values that start with `=`, `+`, `-` or `@` get a leading apostrophe so a spreadsheet does not run them as formulas.
- "Load example records" fills in a few made-up records when the inventory is empty.
- Everything is saved in the browser with localStorage. Nothing is sent anywhere, so the data stays on that one browser and is lost if the browser data is cleared. Export to CSV to keep a copy.
- Do not store licence keys or passwords in it. Browser storage is not encrypted.

## Structure

- `src/inventory.js`: validation, date checks, filtering, sorting, summary counts and CSV export. No React, so it is easy to test.
- `src/inventory.test.js`: tests for the above, run with Node's built-in test runner.
- `src/App.jsx`: the React interface, styled with Tailwind CSS.

## Limits

- One user, one browser. There is no login, sharing or sync.
- No CSV import yet.
