# iPedia HTML Tester

A pure static browser app for previewing either:

- one standalone `.html` or `.htm` file; or
- a `.zip` containing a small HTML project with relative CSS, JavaScript, images, audio, fonts, and other assets.

The app is designed to be published at `/tester/`, for example:

`https://ipedia.online/tester/`

No backend, Node.js server, framework, or build step is required.

## ZIP rules

The ZIP importer:

- ignores `.DS_Store` and `__MACOSX` entries;
- strips one common top-level folder when every useful file is inside it;
- chooses root `index.html` or `index.htm` first, then a nested index file, then the first `.html`/`.htm` file;
- preserves the project's remaining directory structure so relative asset paths work;
- rejects unsafe `..` archive paths and reports missing assets in the log panel.

Use relative paths such as `css/style.css` or `../images/photo.png`. Root-relative paths such as `/images/photo.png` point to the website root, not to the uploaded ZIP project.

## Local testing

Service Workers do not work when `index.html` is opened directly with `file://`. Serve the repository root on localhost instead:

```bash
cd "/path/to/repository-root"
python3 -m http.server 8000
```

Then open:

`http://localhost:8000/tester/`

Test all of these:

1. Click **Open demo**. It loads separate CSS and JavaScript through relative paths.
2. Upload a standalone `.html` or `.htm` file.
3. Upload a ZIP containing `index.html`, CSS, JavaScript, and an image or sound.
4. Try reload, back, clear, fullscreen, and open in new tab.
5. Check the message panel for missing files or runtime errors.

If an older Service Worker is still installed after deployment, reload the tester page once. In browser developer tools, you can also unregister the old worker and clear site storage before retesting.

The Service Worker never caches or intercepts the tester shell (`index.html`, `app.js`, `style.css`, or `sw.js`). It only serves generated URLs below `/tester/__ipedia_preview__/`. Use **Reset tester cache** to unregister tester-scoped workers, remove preview caches, and return to the normal `/tester/` URL.

## GitHub deployment at `/tester/`

Keep these files together in the repository's `tester/` directory:

```text
tester/
├── index.html
├── style.css
├── app.js
├── sw.js
└── README.md
```

Commit and push from the repository root:

```bash
git add tester .gitignore
git commit -m "Fix static HTML tester under /tester/"
git push origin YOUR_BRANCH
```

Your hosting configuration must publish the repository so that `tester/index.html` is available as `/tester/`. The Service Worker registers with `/tester/` scope, and all generated iframe preview URLs stay under that scope.

## Render Static Site settings

Create or edit a **Static Site**, not a Web Service.

If Render's **Root Directory** is the repository root:

- Build Command: leave empty, or use `echo "no build"`
- Publish Directory: `tester`

If Render's **Root Directory** is already the `tester` folder:

- Build Command: leave empty, or use `echo "no build"`
- Publish Directory: `.`

Do not use both `tester` as the Root Directory and `tester` as the Publish Directory; that would make Render look for `tester/tester`.

After deployment, open the final HTTPS URL and test the demo before testing uploads. HTTPS is required for Service Workers outside localhost.
