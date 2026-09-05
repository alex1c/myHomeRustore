# RuStore demo seed (DEVELOPMENT ONLY)

Creates a reproducible SQLite dataset for store screenshots.

## Safety

- Not wired into production UI
- Not auto-run on fresh install
- No "fill demo" button in release builds

## Generate demo DB

```powershell
cd D:\PetProject\myHomeRustore
npm test -- --runInBand __tests__/seedRustoreDemo.test.ts
```

Output:

- `release-assets/demo/my_home_demo.db`
- `release-assets/demo/summary.json`

## Apply to emulator (debuggable / rooted emulator)

```powershell
.\scripts\seed-rustore-demo.ps1 -Serial emulator-5554
```

This force-stops the app, pushes the demo DB into the app databases folder, and relaunches.
