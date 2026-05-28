# TQS Diary — Project Spec

Project root: D:\02_Developments\project_ジャーナル
Repository: github.com/provoyage/TQSdialy
Entrypoint: public/index.html (with public/script.js, public/style.css)
Deploy: firebase deploy --only hosting (public). Server lives in `server/` and is deployed separately to Cloud Run.
Local dev: `firebase serve --only hosting -p 5000` for the frontend, `npm --prefix server start` (with `FIREBASE_PROJECT_ID=tqsdiary-c640a` and `gcloud auth application-default login` ADC) for the API on port 8787.
Admin account: qutech314@gmail.com. Frontend gate: `ADMIN_EMAILS` const in public/script.js. Server gate: `ADMIN_EMAILS` env var (comma-separated, default `qutech314@gmail.com`). firestore.rules also hardcodes the same email for admin-only collections.

## Current views (navigateTo)
- list (Read)
- editor (Write)
- calendar
- questions (Odai)
- mypage

## Read page (important behavior)
- Central journal card preview with left/right nav buttons.
- moveReadIndex('older'|'newer') controls navigation.
- Arrow keys only work on Read view and only when not typing in inputs.
- Custom search modal + detail modal exist.

## Write page (layout)
- Fixed layout (not draggable). Left column: AI advice / schedule / memo / location.
- Right column (PC fixed-grid): row1 photo (square, col1) + summary (col2-3), row2 meals (full width), row3 KPT (full width), row4 highlight (col1-2) + URL button (col3, opens browsing modal), row5 diary (full width).
- Data saved in diary_entries; missing fields are allowed.

## Calendar page (layout & data flow)
- Two columns with one vertical divider. Ratio: left 0.36 / right 0.64.
- Left column sections: selected date row + add button, own schedule, memo, friend schedule.
- Right column: monthly goal area + Outlook-style line calendar.
- Calendar schedule/memo edits save to same-day diary_entries (draft/final).
- Schedule share modal saves per-row sharedWith and mirrors to shared_schedules.

## Odai (questions/answers)
- Questions: admin-only create/update/delete. Soft delete via isActive=false.
- Admin question-management cards display aggregated answer counts per question. Counts are fetched from `GET /api/admin/answer-counts` (Bearer Firebase ID token, server gates by `ADMIN_EMAILS`). The earlier client-side `db.collection('answers').get()` approach was always rejected by firestore.rules and is no longer used.
- Question types: text / choice.
- Extended metadata:
  - category: normal | screening
  - instrumentId (current: adhd_adult_v1, persona_5layer_v1)
  - dimension: inattention | hyperactivity
  - layer/axisKey/reverseScored (for persona_5layer_v1)
  - isCore, order, optionScores
- Answers: user-only CRUD. pendingAnalysis=true on save/edit.
- Choice answers save answerType, choiceValue, choiceScore (+layer/axisKey/reverseScored when applicable).
- Question page has 3 modes: persona / answer / history.
- Persona mode first shows 5 layer selectors (対人・社会 / 思考・判断 / 実行・行動 / 情動・自己調整 / 動機・世界観), then asks only selected-layer fixed baseline questions and allows repeated retake (answers overwrite same question docs).
- Persona layer retake now asks confirmation and clears previous diagnosis data (answers/draft/layer_result for that layer) before restart.
- Persona mode auto-advances to the next question in the selected layer after save.
- Persona mode requires a start popup after layer selection, locks other layers during the active run, and saves immediately on option tap (no save button).
- Persona baseline uses per-axis continuous scoring (0..100, reverse-scored items supported) with no type-label classification.
- SOC/COG/ACT layers are replaced with fixed 32-question banks each (8 axes x 4 questions), and EMO/MOT are replaced with fixed 40-question banks each (10 axes x 4 questions).
- SOC/COG/ACT/EMO/MOT question order is randomized per run and persisted in `users/{uid}/layer_drafts/{version}_{LAYER}.questionOrder` for resume consistency.
- SOC/COG/ACT/EMO/MOT choices are stored as 1..5 Likert values (left-most strongest agree) and completion writes `users/{uid}/layer_results/{resultId}` with axis scores.
- Answer mode excludes fixed 5-layer baseline questions and shows non-baseline unanswered questions.
- History mode excludes fixed 5-layer baseline answers.
- Saving, editing, deleting answers triggers screening recompute API.
- Fixed 5-layer baseline questions are built-in and prioritized before optional custom questions.

## Screening / Personality
- API: POST /api/screening/recompute (requires Firebase ID token in Authorization header).
- Firestore collections:
  - screening_profiles/{uid}: latest profile
  - screening_history/{uid_YYYYMMDDHHmm}: snapshots
- Mypage cards:
  - ADHD自己スクリーニング (progress / score / risk band / confidence)
  - 性格プロファイル (5 traits)
  - 5レイヤースコア (対人・社会 / 思考・判断 / 実行・行動 / 情動・自己調整 / 動機・世界観 + 総括)
  - 5レイヤー is layer-independent (each layer has separate progress/status; unanswered layers stay pending)
  - 5レイヤースコアカードは3x2グリッド（5レイヤー+総括）で、完了レイヤーはレーダーチャート表示
  - レーダーチャートは各軸の優勢側ラベルのみで構成（SOC/COG/ACT=8軸、EMO/MOT=10軸）
  - レーダーカードクリックで既存のレイヤー詳細モーダルを開く
- Matrix sample fallback points are removed; empty data shows empty state.

## Settings
- Settings is a modal (sidebar + detail pane), not a separate route.
- Friends tab: search + add button + fixed bottom tabs (friends/outgoing/incoming).
- Friend ID mapping via users + friend_ids.
- Friend requests in friend_requests.
- Appearance includes wallpaper upload (WebP <=1MB) to Storage wallpapers/{uid}.webp and URL in users.wallpaperUrl.
- MBTI manual edit UI is removed.

## UI rules
- Keep existing style (radius, shadow, spacing, palette).
- Avoid behavior changes unless explicitly requested.

## Auto-update policy
- Update this CLAUDE.md whenever a major spec / layout / data-flow / API / config change is implemented.
- Every entry in "Recent changes" carries a `YYYY-MM-DD` date so it is clear *when* the change happened.
- Discard outdated entries during updates: this file should reflect the **current** state, not a full history. When a fact is no longer true, replace it; when an entry is no longer load-bearing, remove it.
- Bump the `Last updated` date at the bottom every time this file is touched.

## Recent changes
- **2026-05-28** Added `GET /api/admin/answer-counts` server endpoint (firebase-admin SDK, Bearer token, gated by `ADMIN_EMAILS` env var). Replaced the broken client-side `db.collection('answers').get()` aggregation in `loadAnswerCountsForAdmin()` with a fetch to this endpoint. The admin "回答 N" badge on question cards now actually displays real counts.
- **2026-05-28** Repository hygiene: removed dead root-level duplicates (`script.js`, `style.css`, `firebase-config.js`) that were no longer referenced from `public/index.html`. Renamed `AGENTS.md` → `CLAUDE.md` (Claude Code convention). Stashed legacy unfinished edits from the old root files to `git stash`. Snapshot-committed all previously-uncommitted AntiGravity-era work as commit `722eea9` so nothing was lost.
- **2026-05-28** Switched primary AI-assisted development from Gemini AntiGravity to Claude Code.
- **2026-03-04** Migrated persona screening from 4-layer type-label model to 5-layer continuous-score model (persona_5layer_v1). Added fixed 5-layer baseline question generation (SOC/COG/ACT/EMO/MOT-WRL), then replaced SOC/COG/ACT with fixed 32-question banks and EMO/MOT with fixed 40-question banks, added per-run randomized order with draft persistence (`layer_drafts`) and per-layer result snapshots to `layer_results`. Recompute API/storage writes `screening_profiles.persona5` with per-layer axis scores (0..100), completion-gated layer analysis text, and no cross-layer aggregate label. Mypage right column now has tab switching: 「5レイヤースコア」 tab (matrix + 3x2 radar cards + all-layer summary) and 「夢リスト・推移グラフ」 tab (bucket + sleep/weight trends).

Last updated: 2026-05-28
