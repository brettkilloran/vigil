# Heartgarden

**heartgarden** is the app name. The Next.js project lives in **`heartgarden/`** in git (see [`heartgarden/docs/NAMING.md`](heartgarden/docs/NAMING.md)). Run the dev server from that folder so it binds to port **3000**:

## Setup

### Mise Setup

Dev tooling is mostly managed by [mise](https://mise.jdx.dev/). This tool manager we have found to be fast and efficient. You can get the install script [here](https://mise.jdx.dev/).

### Postgres

Individual platform instructions are below, once Postgres is running, connect to the running instance and create the database. We reccomend naming it `heart_dev`.

```sql
CREATE DATABASE "heart_dev" ENCODING 'UTF8';
```

Then add the connection string to your root `.env` (mise loads it into your shell):

```
DATABASE_URL=postgres://postgres@localhost:5432/heart_dev
```

#### MacOS

The simplest option is install [Postgres.app](https://postgresapp.com) and follow the setup instructions.

If you installed Postgres from homebrew, you may need to run `createuser -s postgres` to create the default user.

#### Windows

TODO: add windows instructions

#### Linux

You probably already know your favorite way to manage Postgres on Linux, just be sure to match the db version to the app.

### Bootstrapping

Once mise and postgres are setup, run the commands below to get cooking.

```bash
mise install
mise pnpm:setup
mise deps
mise db:migrate
cd heartgarden
pnpm run dev
```

Then open [http://localhost:3000](http://localhost:3000). For a **finite** verification run (lint + build), use **`pnpm run check`** from the same directory instead of leaving `dev` running in a background terminal.

See [`heartgarden/README.md`](heartgarden/README.md) for product docs, environment variables, and Vercel notes.

### If production deploy fails on Vercel

Usually **Root Directory** in the Vercel project must be **`heartgarden`** (not `vigil`). See [`heartgarden/docs/DEPLOY_VERCEL.md`](heartgarden/docs/DEPLOY_VERCEL.md) § “Root Directory must be `heartgarden`” and [`heartgarden/docs/NAMING.md`](heartgarden/docs/NAMING.md) § “If something breaks later”.
