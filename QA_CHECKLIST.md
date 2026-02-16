# Seller Tracker Smoke Test Checklist

Use this quick checklist after UI or logic changes.

## Core Flow
- [ ] Open `index.html` in a browser.
- [ ] Confirm page loads with no console errors.
- [ ] Confirm one default item row is visible.

## Business Settings
- [ ] Open **Business Settings**.
- [ ] Save business name, email, social handle, area code, and note.
- [ ] Confirm area-code prefix updates in both customer and business phone fields.

## Order Entry
- [ ] Add at least one item with qty and price.
- [ ] Set a delivery fee and confirm subtotal/total updates.
- [ ] Save order and confirm success message appears.

## Saved Orders Actions
- [ ] Confirm saved order appears in **Saved Orders** list.
- [ ] Click **Download PDF** and confirm receipt file downloads.
- [ ] Click **Share Receipt** and confirm share dialog appears or file downloads as fallback.
- [ ] Click **Export All to CSV** and confirm CSV file downloads with row data.

## Persistence
- [ ] Refresh the page.
- [ ] Confirm orders remain visible and total revenue is preserved.
- [ ] Confirm saved business settings are still populated.
