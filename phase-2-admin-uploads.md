# Phase 2: Admin uploads and management

Read `CLAUDE.md` and the existing code. Plan first, then build.

**Goal:** admins can add and manage papers without touching the database.

- Admin login and an admin role. Only admins see the admin area; enforce it in the database too.
- Upload form: PDF plus metadata (course, term, year, semester, total marks, number of questions). Reject a paper that already exists and point to the existing one.
- Edit, unpublish and delete papers. Manage the course list.
- Simple bulk upload (for example a folder of PDFs plus a CSV of metadata) so we can load the existing backlog.

Done when an admin can load a semester's papers in a few minutes and they show up on the public site.
