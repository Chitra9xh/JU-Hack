### [Planner – Team Setup] Chitransh — 2026-10-23 — Phase 0 — discussion
- What changed: none (discussion)
- Issue: none
- Decisions locked in: all 4 members clone; lead = Chitransh; Claude only guides, never commits; 5 frames + 5 furniture/decor items; own catalog; hackathon; stack = React+Vite+TS, three.js, MediaPipe Face Landmarker, WebXR hit-test + model-viewer fallback, static JSON catalog, Vercel/Netlify hosting
- Needs from others: roadmap confirmation, 4 GitHub usernames, repo URL, demo phone types (Android/iOS), hours left
- Open / follow-ups: iOS Quick Look needs USDZ per model; deferred = buy links, recommendations, face-shape, Amazon/Lenskart fetch, backend, screenshot sharing

### [Planner – Team Setup] Chitransh — 2026-10-23 — Phase 0 — discussion
- What changed: none (discussion)
- Issue: none
- Decisions locked in: all 4 members clone; lead = Chitransh; Claude only guides, never commits; 5 frames + 5 furniture/decor items; own catalog; hackathon; stack = React+Vite+TS, three.js, MediaPipe Face Landmarker, WebXR hit-test + model-viewer fallback, static JSON catalog, Vercel/Netlify hosting
- Needs from others: roadmap confirmation, 4 GitHub usernames, repo URL, demo phone types (Android/iOS), hours left
- Open / follow-ups: iOS Quick Look needs USDZ per model; deferred = buy links, recommendations, face-shape, Amazon/Lenskart fetch, backend, screenshot sharing


### [Planner – Team Setup] Chitransh — 2026-10-23 — Phase 0 — done
- What changed: none in repo (planning output only: roadmap, 9 issues, team prompt, 4 member prompts, integration prompt)
- Issue: none (issues #1-#9 to be created by the team)
- Decisions locked in: all clone; lead = Chitransh; Claude guides only, humans commit; Android only in Phase 1; phases = Phase 1 (minimum MVP, two steps per member) + Phase 2 backlog (iOS, buy links, recommendations, Amazon/Lenskart fetch); 5 frames + 5 furniture/decor (3+2); Try-On testable on laptop webcam, AR needs an Android phone; HTTPS dev via basic-ssl; Chitransh installs all deps, others never touch package.json
- Needs from others: GitHub usernames of Aryan, Krishiv, Reeti; team creates issues #1-#9 in repo; Chitransh starts #1
- Open / follow-ups: iOS fallback (USDZ + model-viewer) in Phase 2; confirm Android demo phones support ARCore


### [Chitransh – Contract & Shell] Chitransh — 2026-10-23 21:37 — Phase 0 — discussion
- What changed: nothing yet; listed the remaining Phase 0 work (scaffold, deps, vite config, folder layout, Contract files, placeholders, logbooks, README, final check)
- Issue: #1
- Decisions locked in: chat name "Chitransh – Contract & Shell" (pending confirmation); repo mode is clone, so I paste files when asked
- Needs from others: nothing
- Open / follow-ups: paste `git log --oneline -5` and `ls -a` after cloning so the starting state can be confirmed

### [Planner – Team Setup] Chitransh — 2026-10-23 — Phase 0 — done
- What changed: none in repo (prompts revised: mid-prompt for Chitransh, Team Fixed Prompt v2, member-block edits)
- Issue: none (issue #1 retitled "Phase 0: scaffold + shared types", docs/** removed from its ownership)
- Decisions locked in: no docs/CONTRACT.md (team prompt is the contract; src/shared/types.ts + catalog.ts stay as code); no logbook files in repo, entries printed per reply and shared offline; logbook/ added to .gitignore by Chitransh; type changes agreed in person, edited only by Chitransh
- Needs from others: Chitransh pastes the mid-prompt into his current chat; Aryan/Krishiv/Reeti use Team Fixed Prompt v2; GitHub usernames of Aryan, Krishiv, Reeti still pending
- Open / follow-ups: none new


### [Chitransh – Contract & Shell] Chitransh — 2026-10-23 21:52 — Phase 0 — discussion
- What changed: nothing committed yet; plan revised: no docs/ folder and no docs/CONTRACT.md, no logbook/ folder or logbook files in the repo; types.ts replaced with the verbatim Team Fixed Prompt text; README cut to setup steps only
- Issue: #1
- Decisions locked in: logbook/ is gitignored and logbook entries are shared offline, never committed; ownership is package.json, vite.config.ts, .gitignore, src/app/**, src/shared/**, README.md; src/shared/types.ts matches the Team Fixed Prompt exactly; catalog.ts keeps the two required signatures plus a fetch error check
- Needs from others: nothing
- Open / follow-ups: run `git rm -r -q --ignore-unmatch docs logbook; rm -rf docs logbook` if either folder exists locally; run the remaining steps, then the final check (npm install, npm run build, npm run dev) and record the result; confirm issue #1 exists before pushing

### [Chitransh – Contract & Shell] Chitransh — 2026-10-23 22:19 — Phase 0 — partial
- What changed: nothing committed yet; `git status --short` shows exactly the expected 22 staged files (scaffold, vite config, tsconfig, index.html, src/app, src/shared, engine/view placeholders, empty catalog JSONs, .gitkeep files, README), with no docs/ or logbook/ files
- Issue: #1 ("Create project scaffold files", label: scaffold; the only issue created so far)
- Decisions locked in: REPO RULE: direct pushes to main are not allowed; every change goes on a branch, is pushed there, raised as a PR with "Closes #<n>", and merged via the PR (this overrides the Phase 0 brief's "push directly to main"); Phase 0 branch is chitransh/issue-1-scaffold; commit first, then `git fetch origin && git rebase origin/main`, then npm install, npm run build, npm run dev, then push the branch; after the merge run `git switch main && git pull origin main`; plus earlier decisions: no docs/ or CONTRACT.md in the repo; logbook/ is gitignored and logbook entries are shared offline only; ownership is package.json, vite.config.ts, .gitignore, src/app/**, src/shared/**, README.md; README contains setup steps only
- Needs from others: a PR approval if branch protection requires a review
- Open / follow-ups: run the branch, commit and final check; record the result; push the branch, open the PR ("Closes #1") and merge; announce in the group chat; create and assign issue #2 before starting Phase 1 work

### [Chitransh – Contract & Shell] Chitransh — 2026-10-23 22:27 — Phase 0 — partial
- What changed: scaffold committed (215d041, "Add project scaffold, dependencies and shared types") and pushed to branch scaffold/1-scaffold-files, one commit ahead of main; branch contents verified on GitHub (public, src, .gitignore, README.md, index.html, package-lock.json, package.json, tsconfig.json, vite.config.ts); no docs/ or logbook/; PR not opened yet
- Issue: #1
- Decisions locked in: REPO RULE: no direct pushes to main; branch, push, PR with "Closes #<n>", merge via PR; Phase 0 branch is scaffold/1-scaffold-files (differs from the rules' <member>/issue-<n>-<slug> pattern, pattern for next branches still to be decided); GitHub issues and PRs share one number sequence, so the PR for #1 takes #2 unless the other planned issues are created first; this chat covers Phase 0 only, Phase 1 (#2) goes in a new chat
- Needs from others: a PR approval if branch protection requires a review
- Open / follow-ups: report the final check result (npm run build, npm run dev) for the log; decide whether to create the other planned issues before opening the PR so issue numbers match the plan; open the PR ("Closes #1") and merge; sync main and delete the branch; announce in the group chat that the Contract is live; create and assign issue #2 before starting Phase 1


### [Chitransh – Contract & Shell] Chitransh — 2026-10-23 22:40 — Phase 0 — done
- What changed: scaffold committed (215d041, "Add project scaffold, dependencies and shared types") and pushed to branch scaffold/1-scaffold-files, one commit ahead of main; final check run on the branch by Chitransh; PR not opened yet
- Issue: #1
- Decisions locked in: REPO RULE: no direct pushes to main; branch, push, PR with "Closes #<n>", merge via PR; Phase 0 branch is scaffold/1-scaffold-files (differs from the rules' <member>/issue-<n>-<slug> pattern, pattern for next branches still to be decided); GitHub issues and PRs share one number sequence, so the PR for #1 takes #2 unless the other planned issues are created first; no docs/ or CONTRACT.md in the repo; logbook/ is gitignored and entries are shared offline only; this chat covers Phase 0 only, Phase 1 (#2) goes in a new chat
- Needs from others: a PR approval if branch protection requires a review
- Open / follow-ups: open the PR ("Closes #1") and merge it; sync main and delete the branch; announce in the group chat that the Contract is live; create and assign issue #2 before starting Phase 1; decide whether to create the other planned issues before opening the PR so the numbers match
- Final check: passed (npm run build and npm run dev ran clean on scaffold/1-scaffold-files)


### [Chitransh – App Shell & Deploy] Chitransh — 2026-10-23 — Phase 1 — discussion
- What changed: chat name confirmed; user confirmed scaffold PR merged into main; prepared app-shell issue title, body and acceptance criteria.
- Issue: not created yet; use the actual number GitHub assigns.
- Decisions locked in: create and assign the issue to Chitra9xh before implementation; GitHub issues and PRs share a numbering sequence.
- Needs from others: none currently.
- Open / follow-ups: create the issue; report its number; paste package.json, index.html, vite.config.ts and src/app files for review.


### [Chitransh – App Shell & Deploy] Chitransh — 2026-10-23 — Phase 1 — discussion
- What changed: clarified that git switch -c creates and switches to the local branch.
- Issue: #4
- Decisions locked in: branch name is chitransh/issue-4-app-shell.
- Needs from others: none.
- Open / follow-ups: run the three commands; report success or paste any error; then implement the app shell.


### [Chitransh – App Shell & Deploy] Chitransh — 2026-10-23 — Phase 1 — partial
- What changed: user confirmed local branch creation; provided App.tsx replacement, new src/app/shell.css, and README port correction for user to apply.
- Issue: #4
- Decisions locked in: BrowserRouter handles /, /tryon and /ar; existing default-exported feature views are mounted; shell CSS stays in src/app/; no new dependencies.
- Needs from others: feature owners replace their existing placeholders.
- Open / follow-ups: save the supplied files; configure HTTPS deployment and SPA fallback; final build and smoke checks remain pending.


### [Chitransh – App Shell & Deploy] Chitransh — 2026-10-23 — Phase 1 — partial
- What changed: user confirmed app-shell files saved; supplied Vercel SPA configuration and final local checkpoint commands.
- Issue: #4
- Decisions locked in: use Vercel; record Chitransh ownership of root vercel.json in issue #4 before creating it; use existing build script and dist output.
- Needs from others: none currently.
- Open / follow-ups: record ownership; save vercel.json; commit, rebase and run final build/local smoke check; report results before pushing; deployed Android HTTPS verification remains pending.

### [Chitransh – App Shell & Deploy] Chitransh — 2026-10-23 — Phase 1 — partial
- What changed: user reports the UI looks good for the MVP; supplied conditional push command and PR text.
- Issue: #4
- Decisions locked in: retain current MVP UI; PR targets main and includes Closes #4; keep PR open until deployment checks pass.
- Needs from others: none currently.
- Open / follow-ups: explicitly confirm build and route-refresh results; if passed, push branch and open PR; connect Vercel and verify HTTPS routes on Android.


### [Chitransh – App Shell & Deploy] Chitransh — 2026-10-23 — Phase 1 — partial
- What changed: user approved the current UI for the MVP and explicitly deferred Vercel deployment until final integration; no Vercel actions performed.
- Issue: #4 — app shell and routes implemented; deployment acceptance pending.
- Decisions locked in: keep current UI unless later changes are needed; deploy on Vercel at the end; the previous proposed Vercel instruction entry was not logged or executed.
- Needs from others: feature implementations and integration before final deployment.
- Open / follow-ups: retain existing vercel.json configuration; use Refs #4 instead of Closes #4 if merging before deployment; complete live HTTPS and Android route checks at final deployment, then close #4.


### [Aryan – Try-On Engine] Aryan — 2026-10-23 — Phase 1 — discussion
- What changed: verified assigned issue on GitHub via repository API; confirmed Phase 1 Step 1 is GitHub Issue #6 assigned to AryanAnand-ux; checked out tracking branch feature/try-on-step1; downloaded face_landmarker.task into public/models/.
- Issue: #6
- Decisions locked in: target Issue #6 (Try-On engine Step 1: camera, face tracking and stub glasses); restrict implementation to src/features/tryon/engine/** and public/models/**; preserve shared TryOnEngine interface without editing package.json or shared types; dev harness kept in src/features/tryon/engine/dev.html + dev.ts.
- Needs from others: none currently.
- Open / follow-ups: implement createTryOnEngine() with webcam tracking, Three.js procedural glasses, and dev harness.


### [Aryan – Try-On Engine] Aryan — 2026-10-24 — Phase 1 — done
- What changed: implemented createTryOnEngine() in src/features/tryon/engine/index.ts with webcam feed, MediaPipe Face Landmarker 4x4 matrix extraction, Three.js 3D scene, and procedural stub glasses (0.14m width, nose-bridge origin); anchored glasses to canonical Landmark 168 (0, 0.0327, 0.0524); corrected basis transform C = diag(1, -1, -1) with slerp/lerp smoothing; created dev harness in dev.html and dev.ts with real-time telemetry; verified clean production build (npm run build passed in 181ms).
- Issue: #6
- Decisions locked in: stub glasses conform strictly to Contract conventions (origin at nose-bridge midpoint, +Y up, +Z toward viewer, ~0.14m width); dev harness kept inside src/features/tryon/engine/ and excluded from production bundle; branch feature/try-on-step1 pushed with PR targeting main with Closes #6; branch to be deleted post-merge.
- Needs from others: PR review and merge into main by Chitransh; Reeti's real GLB frames (#5) for Phase 1 Step 2.
- Open / follow-ups: wait for PR merge on GitHub; run post-merge cleanup commands; await Step 2 issue kickoff.

