# Phase 1: Monorepo foundation and public browsing

Read `CLAUDE.md`. Start in plan mode and show me a short plan before coding.

**Goal:** a working Turborepo where anyone can browse, filter and download papers.

- Set up the Turborepo with pnpm, the web app, the shared config package and the db package. `turbo dev`, `lint`, `typecheck`, `test` and `build` should work from the root, with CI running them.
- Design the schema for courses and papers, with duplicate prevention built in. Seed real JIIT courses (e.g. `18B11EC213` Digital Systems) and a few sample papers.
- Public pages: a landing page, a browse page with filters (semester, subject/course code, term, year) that live in the URL, and a paper page with a preview and free download. No login needed.
- Make it fast and good on a phone, since most students will use one.

Done when a stranger can open the site, filter to a paper and download it.
