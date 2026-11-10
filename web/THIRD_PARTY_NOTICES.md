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
- `src/pages/accounts/*`: the accounts page (totals and categories beside the account cards) and the add/edit dialog, from `src/views/desktop/accounts/ListPage.vue` and `list/dialogs/EditDialog.vue`.
- `src/pages/transactions/*`: the transaction list (grouped by day, with type, account and category filters) and the add/edit dialog with its two-level category picker, from `src/views/desktop/transactions/ListPage.vue` and `list/dialogs/EditDialog.vue`.
- `backend/app/transactions/models.py` (in this repository's backend): the transaction types and the transfer's source and destination amounts, from `pkg/models/transaction.go`.
- `src/pages/categories/*`: the category list (by type, groups with their sub-categories) and the add/edit dialog, from `src/views/desktop/categories/ListPage.vue` and `list/dialogs/EditDialog.vue`.
- `src/pages/settings/*`: the settings area (a menu of user, data and application settings beside the chosen page) and its User Profile, Security, Data Management and Preferences pages, from `src/views/desktop/settings/SettingsPageLayout.vue`, `src/views/desktop/users/UserBasicSettingPage.vue`, `UserSecuritySettingPage.vue`, `DataManagementPage.vue` and `src/views/desktop/settings/PreferencesSettingsPage.vue`.
- `src/appearance/accountIcons.ts`: the account colours, from `src/consts/color.ts`.
- `backend/app/accounts/models.py` (in this repository's backend): the account categories and which are liabilities, from `src/core/account.ts`.
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
