---
name: full-width-pages
description: Use whenever a web page (web/src/pages/**) is added or its layout changes. Every page in the signed-in app uses the full width of the screen and works at phone width.
---

# Every page is full width

The signed-in pages fill the whole width of the screen. There are no centred, fixed-width pages.

## How it works

- `AppLayout` (`web/src/layouts/AppLayout.tsx`) renders every page inside `<main>` with no maximum width, and a side gutter of 16px on phones and 24px from `sm` up. That holds for every route, so a new page is full width without registering anywhere. Do not bring back a per-route allowlist or a `maxWidth` on `<main>`.
- Do not wrap a page in a `Container`, or a `Box` with `maxWidth` and `mx: "auto"`, to centre it.
- Use the room: lay cards out in a responsive grid (for example `gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }`), as the accounts, transactions and settings pages do.
- A form or a long piece of reading inside a full-width page may cap its own width (a `TextField` group, a dialog). The page itself does not.
- Dialogs use MUI `Dialog` with `fullWidth` and a `maxWidth`, and `fullScreen` on phones when the form is long.

## Check before you finish

- At desktop width, the page's content reaches both edges of the window, less the gutter.
- At 360px wide there is no horizontal scrolling, and every action can still be reached.
