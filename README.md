# TREXVEN Admin

Internal ODT operations, analytics, monitoring, and governed training-data platform. This repository is deliberately separate from the TREXVEN customer application and production database.

The Next.js application, dependencies, and environment configuration live in
[`app`](app/README.md). The root npm scripts forward commands to that directory.

From this folder, start development with:

```powershell
npm.cmd run dev
```

Open http://localhost:3000. On Windows PowerShell, `npm.cmd` avoids the execution
policy restriction on `npm.ps1`.

For a fresh checkout, install the application dependencies first:

```powershell
npm.cmd --prefix app ci
```

Without backend credentials, the app opens
the integration setup screen. See [application setup](app/README.md) for details.
