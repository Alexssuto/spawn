# Setting up Jira and Confluence for Spawn

A step-by-step guide to doing this yourself. The free plans cover up to 10 users, which is enough. Expect about an hour.

## 1. Create the Atlassian site

1. Go to [atlassian.com/software/jira/free](https://www.atlassian.com/software/jira/free) and sign up with your own account.
2. Pick a site name, e.g. `alexssuto.atlassian.net`.
3. When asked which products to add, choose **Jira**. Add **Confluence** from the same site afterwards (*Apps → Explore more apps*, or [atlassian.com/software/confluence/free](https://www.atlassian.com/software/confluence/free)).

## 2. Create the Jira project

1. *Projects → Create project → Software development → Scrum*.
2. Choose a **team-managed** project (simpler settings, fine for one person).
3. Name: `Spawn`. Key: **`SPAWN`**. The key matters: it's what links branches, commits and PRs to issues.

## 3. Import the roadmap

1. In the project: *⋯ (top right) → Import issues* (or *Settings → System → External system import → CSV* on some plans).
2. Upload [`docs/jira/spawn-roadmap.csv`](../jira/spawn-roadmap.csv).
3. Map the columns:
   | CSV column | Jira field |
   |---|---|
   | Issue Type | Issue Type |
   | Issue ID | Issue Id |
   | Parent ID | Parent Id (links stories to their epic) |
   | Summary | Summary |
   | Description | Description |
   | Story Points | Story point estimate |
   | Labels (both columns) | Labels |
   | Priority | Priority |
4. Check the result: 7 epics, 31 stories, each story under its epic.
5. Mark what's already done (see [roadmap.md](../roadmap.md)): move those stories to **Done**. Jira assigns its own keys (`SPAWN-1`, `SPAWN-2`, ...); they won't match the row numbers in the CSV, and that's fine.

## 4. Connect GitHub (the part that's most like a real team)

1. In Jira: *Apps → Explore more apps → search "GitHub for Jira"* (by Atlassian) → *Get app*.
2. Follow its setup: connect your GitHub account, then install it on the **Alexssuto/spawn** repository only. It works with private repos.
3. From then on, include the Jira key in:
   - **branch names:** `feat/SPAWN-12-rarity-rules`
   - **commit messages:** `SPAWN-12 Add rarity rules with tests`
   - **PR titles:** `SPAWN-12 Rarity rules`
4. Open the issue in Jira: the *Development* panel shows the branch, commits, PR and the CI status from GitHub Actions.

Optional, *Smart Commits*: `SPAWN-12 #comment Added boundary tests` in a commit message adds a comment to the issue.

## 5. Confluence space

1. *Confluence → Create space → Documentation* (or *Blank*). Name `Spawn`, key `SPAWN`.
2. Create this page tree:
   ```
   Spawn
   ├── Overview                (from README.md: pitch, features, stack)
   ├── Architecture
   │   └── Phase 2a: backend   (from docs/architecture/phase-2a-backend.md)
   └── Architecture decisions  (from docs/decisions/README.md)
       ├── ADR 0001 ... 0007   (one child page per file)
   ```
3. Paste the Markdown: Confluence converts most of it when you paste, and Mermaid diagrams can be added with a Mermaid macro from the Atlassian Marketplace, or as a screenshot.
4. Link each ADR page to the Jira epic it concerns (type `/jira` in the editor), and add the Confluence page link to the epic. That two-way link is how teams trace *why* something was built.

**Source of truth:** keep `docs/` in the repo as the source, and update Confluence when a decision changes. Say this in interviews; it shows you thought about docs drifting.

## 6. How to use it day to day

1. Pick the next story, move it to *In Progress*.
2. Branch with its key, commit with its key, open a PR with its key.
3. CI goes green → merge → move the story to *Done*.
4. If a decision was made, add or update an ADR and mirror it to Confluence.

## What not to do

- Don't put secrets, tokens or passwords in Jira or Confluence.
- Don't turn every small change into a ticket. The roadmap's three deliverables are the focus; the rest stays in the backlog.

## Optional: Jira Service Management

Its free plan allows 3 agents. A realistic use for Spawn would be a small portal where someone reports a wrong event (bad location, cancelled). It's marginal for a solo project, so treat it as a learning exercise, and only after the main work.
