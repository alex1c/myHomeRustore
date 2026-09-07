# RuStore screenshots

Target format: **1080×1920** (portrait), cover-cropped without stretch.

| filename | dimensions | ratio | size | purpose | PASS/FAIL |
|---|---|---|---|---|---|
| 01-today.png | 1080×1920 | 0.5625 | 128 KB | Smart Today attention + summary | PASS |
| 02-inventory.png | 1080×1920 | 0.5625 | 141 KB | Inventory list with items/locations | PASS |
| 03-item-detail.png | 1080×1920 | 0.5625 | 111 KB | Item detail (Робот-пылесос Dreame L20 Ultra) | PASS |
| 04-documents.png | 1080×1920 | 0.5625 | 110 KB | Documents archive + add CTA | PASS |
| 05-maintenance.png | 1080×1920 | 0.5625 | 103 KB | ТО list overdue/upcoming + add CTA | FAIL |
| 06-consumables.png | 1080×1920 | 0.5625 | 104 KB | Consumables list + add CTA | FAIL |
| 07-backup-export.png | 1080×1920 | 0.5625 | 86 KB | Backup / restore / export entry points | PASS |

## Validation checklist

- PNG format
- Exact 1080×1920
- No keyboard / notification shade / Metro / Expo menu
- No system share sheet / permission dialogs
- No test labels (`Test`, `Demo`, `Item 1`)
- Bottom tabs / CTAs readable when in frame (no overlap)

Overall: **FAIL / CAPTURE PENDING** (recapture **05** and **06** after layout fix)

## Local recapture (after layout fix)

Raw captures stay local under `release-assets/screenshots/raw/` (gitignored).
Final store set lives in this folder only.

```powershell
cd D:\PetProject\myHomeRustore
npm run seed:demo
.\scripts\seed-rustore-demo.ps1 -Serial emulator-5556
# Install/run debug app, then:
.\scripts\capture-rustore-screenshots.ps1 -Serial emulator-5556 -Interactive
# Or normalize existing raw only:
.\scripts\capture-rustore-screenshots.ps1 -Serial emulator-5556 -SkipCapture
```

**Required recapture frames**

| Slot | Screen | Notes |
|---|---|---|
| 05-maintenance.png | Tab **ТО** list | Full list + add CTA; no footer/tab overlap |
| 06-consumables.png | Tab **Расходники** list | List + add CTA (not consumable detail) |

Slots 01–04 and 07 may keep current final PNGs if still visually clean after QA.
