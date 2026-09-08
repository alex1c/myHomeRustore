# RuStore screenshots

Target format: **1080×1920** (portrait), cover-cropped without stretch.

| filename | dimensions | ratio | size | purpose | PASS/FAIL |
|---|---|---|---|---|---|
| 01-today.png | 1080×1920 | 0.5625 | 128 KB | Smart Today attention + summary | PASS |
| 02-inventory.png | 1080×1920 | 0.5625 | 141 KB | Inventory list with items/locations | PASS |
| 03-item-detail.png | 1080×1920 | 0.5625 | 111 KB | Item detail (Робот-пылесос Dreame L20 Ultra) | PASS |
| 04-documents.png | 1080×1920 | 0.5625 | 110 KB | Documents archive + add CTA | PASS |
| 05-maintenance.png | 1080×1920 | 0.5625 | 98 KB | ТО list + compact controls + add CTA | RECAPTURE REQUIRED |
| 06-consumables.png | 1080×1920 | 0.5625 | 99 KB | Consumables list + compact controls + add CTA | RECAPTURE REQUIRED |
| 07-backup-export.png | 1080×1920 | 0.5625 | 86 KB | Backup / restore / export entry points | PASS |

## Validation checklist

- PNG format
- Exact 1080×1920
- No keyboard / notification shade / Metro / Expo menu
- No system share sheet / permission dialogs
- No test labels (`Test`, `Demo`, `Item 1`)
- Bottom tabs / CTAs readable when in frame (no overlap)

Overall: **FAIL / CAPTURE PENDING** (recapture **05** and **06** after maintenance UX polish)

## Local recapture

```powershell
cd D:\PetProject\myHomeRustore
npm run seed:demo
.\scripts\seed-rustore-demo.ps1 -Serial emulator-5556
.\scripts\capture-rustore-screenshots.ps1 -Serial emulator-5556 -Interactive
```

Recapture only **05-maintenance.png** (ТО list) and **06-consumables.png** (Расходники list). Leave 01–04 and 07 unchanged.
