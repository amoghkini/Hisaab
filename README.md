# Hisaab

Personal finance and net worth tracker, SMS-first. Inspired by [ezbookkeeping](https://github.com/mayswind/ezbookkeeping).

Bank SMS is read on Android, uploaded to the server, parsed into draft transactions, and approved by the user into the ledger.

## Structure

| Folder     | What it is                                  | Stack                          |
|------------|---------------------------------------------|--------------------------------|
| `backend/` | API, SMS parsing pipeline, ledger, database | Python, FastAPI, SQLAlchemy    |
| `web/`     | Web app                                     | React, Vite, TypeScript        |
| `mobile/`  | Sideloaded Android app: SMS capture, drafts | Kotlin (native Android)        |
| `docs/`    | Documentation website                       | MkDocs (Material theme)        |
