# Phase 5: AI hot-question prediction

Read `CLAUDE.md` and the existing code. Plan first and explain the approach in a decision note before building.

**Goal:** for an upcoming exam, show students the questions and topics most likely to appear.

- Group questions into topics per course. Score them with signals such as how often and how recently they appeared, which term they appear in, and marks weight. Start simple and explainable; add an LLM or embeddings where they clearly help.
- A "hot questions" page per course and term: ranked topics, example past questions, and a plain reason for each ("asked in 4 of the last 5 T2 papers").
- Backtest on past years (predict year N from earlier years) and show me how well it does before calling it done.
- Make it clear on the page that these are predictions, not guarantees.
- Refresh predictions automatically when new papers are approved.

Done when the backtest shows it beats simply listing the most frequent past questions, and the page is live for at least one course.
