# Cursor workspace

**heartgarden** is the app name. The Next.js project lives in the **`vigil/`** directory (legacy path; see [`vigil/docs/NAMING.md`](vigil/docs/NAMING.md) to rename it to `heartgarden/` when nothing has the folder locked). Run the dev server from that folder so it binds to port **3000**:

```bash
cd vigil
npm install
npm run dev -- -p 3000
```

Then open [http://localhost:3000](http://localhost:3000). For a **finite** verification run (lint + build), use **`npm run check`** from the same directory instead of leaving `dev` running in a background terminal.

See [`vigil/README.md`](vigil/README.md) for product docs, environment variables, and Vercel notes.
