# RuStore demo seed (DEVELOPMENT ONLY)

Creates a reproducible SQLite dataset for store screenshots.

## Safety

- Not wired into production UI
- Not auto-run on fresh install
- No "fill demo" button in release builds

## Generate demo DB

```powershell
cd D:\PetProject\myHomeRustore
npm run seed:demo
```

Output:

- `release-assets/demo/my_home_demo.db`
- `release-assets/demo/summary.json`

## Apply to emulator (debuggable build)

Expo SQLite path (required):

`files/SQLite/my_home.db`

```powershell
.\scripts\seed-rustore-demo.ps1 -Serial emulator-5556
```

The script writes only to `files/SQLite/`, removes `-wal`/`-shm`, and cleans any stale `databases/my_home.db`.
