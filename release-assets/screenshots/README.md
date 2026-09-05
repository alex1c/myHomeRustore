# RuStore screenshots

Target format: **1080×1920** (portrait), cover-cropped without stretch.

| filename | dimensions | ratio | size | visual purpose | PASS/FAIL |
|---|---|---|---|---|---|
| 01-today.png | — | — | — | Smart Today attention + summary | FAIL |
| 02-inventory.png | — | — | — | Inventory list with items/locations | FAIL |
| 03-item-detail.png | — | — | — | Робот-пылесос Dreame L20 Ultra detail | FAIL |
| 04-documents.png | — | — | — | Documents archive + add CTA | FAIL |
| 05-maintenance.png | — | — | — | ТО list overdue/upcoming + add CTA | FAIL |
| 06-consumables.png | — | — | — | Consumables stock + add CTA | FAIL |
| 07-backup-export.png | — | — | — | Backup / restore / export entry points | FAIL |

## Validation checklist

- PNG format
- Exact 1080×1920
- No keyboard / notification shade / Metro / Expo menu
- No system share sheet / permission dialogs
- No test labels (`Test`, `Demo`, `Item 1`)
- Bottom tabs / CTAs readable when in frame

Overall: **FAIL / CAPTURE PENDING**

Emulator `Pixel_10` (Google Play / non-root) entered System UI ANR during capture on the remote machine. Tooling + demo seed are ready for local/recapture.

## Capture command (one shot)

```powershell
cd D:\PetProject\myHomeRustore
npm run seed:demo

# Debuggable APK with embedded JS (local android/ tree):
#   In android/app/build.gradle react {} set: debuggableVariants = []
#   .\android\gradlew.bat assembleDebug
adb -s emulator-5556 install -r android\app\build\outputs\apk\debug\app-debug.apk
.\scripts\seed-rustore-demo.ps1 -Serial emulator-5556

# Interactive (recommended for visual QA):
.\scripts\capture-rustore-screenshots.ps1 -Serial emulator-5556

# Or automatic navigation attempt:
node .\scripts\capture-rustore-screenshots-auto.mjs --serial emulator-5556
```
