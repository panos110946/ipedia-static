# iPedia HTML Tester

A minimal static viewer for one local `.html` or `.htm` file at a time.

Current app version: `2026-06-23-simple-2`.

Open:

`https://ipedia.online/tester/`

Choose an HTML file and it is displayed in an iframe. Choosing another file immediately replaces the current preview. The previous Blob URL is revoked and the previous file is not retained.

## What it does

- accepts only `.html` and `.htm`;
- reads the selected file into browser memory;
- creates one temporary Blob URL for the current preview;
- revokes the previous Blob URL when another file is chosen or the preview is cleared;
- provides reload, clear, and open-in-new-tab controls;
- unregisters old Service Workers under `/tester/` on startup;
- deletes legacy tester preview caches on startup.

It does not use a Service Worker, ZIP files, `files.json`, a file library, local storage, IndexedDB, a backend, or a build step.

## Important limitation

The viewer receives only the single file selected through the browser picker. Separate local files beside it—such as `style.css`, scripts, images, fonts, or audio—are not available to the preview.

For a self-contained preview, embed CSS, JavaScript, and other required content inside the HTML file or use external `https://` URLs.

## Local testing

Serve the repository root:

```bash
cd "/path/to/repository-root"
python3 -m http.server 8000
```

Open:

`http://localhost:8000/tester/`

Test the replacement workflow:

1. Select `first.html`.
2. Select `second.html`; it must replace `first.html`.
3. Select `third.htm`; it must replace `second.html`.
4. Test reload, clear, and open in new tab.

## Deployment

Keep these files in the repository's `tester/` directory:

```text
tester/
├── index.html
├── style.css
├── app.js
└── README.md
```

`sw.js` must not be present.

For a Render Static Site:

- repository root as Render Root Directory: Publish Directory `tester`;
- `tester` as Render Root Directory: Publish Directory `.`;
- Build Command: empty or `echo "no build"`.

No backend or framework is required.
