# Third-party notices

The look of the login, sign-up and dashboard pages follows [ezBookkeeping](https://github.com/mayswind/ezbookkeeping). These parts are adapted from its source:

- `src/components/AuthIllustration.tsx`: the login and sign-up artwork, from `src/components/desktop/AuthIllustration.vue`.
- `src/styles.css`: the auth layout and artwork styles, from `src/styles/desktop/components/_auth.scss`.
- `src/theme.ts`: the colour palette, from the Vuetify theme in `src/desktop-main.ts`.
- `src/components/StepsBar.tsx` and its styles in `src/styles.css`: the sign-up step bar, from `src/components/desktop/StepsBar.vue`.
- `src/pages/SignupPage.tsx`: the two-step sign-up flow, from `src/views/desktop/SignupPage.vue`.
- `src/pages/overview/layout.ts`: the dashboard's widgets and their places on the grid, from `DEFAULT_DESKTOP_OVERVIEW_LAYOUT` in `src/consts/overview_layout.ts`.
- `src/pages/overview/widgets/*`: the dashboard widgets and their artwork, from `src/views/desktop/overview/widgets/`.
- `src/pages/overview/overview.css`: the dashboard and widget styles, from `src/styles/desktop/components/_overview.scss` and `_overview-widget.scss`.
- `backend/app/categories/presets.py` (in this repository's backend): the preset category names, grouping and colours, from `src/consts/category.ts`.

ezBookkeeping is distributed under the MIT License:

```
MIT License

Copyright (c) 2020-2026 MaysWind (i@mayswind.net)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
