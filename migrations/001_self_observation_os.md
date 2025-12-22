# 001 Self Observation OS

## New collections
- diary_entries: id, user_id, created_at, text, meta (json), locked (boolean)
- diary_analysis: entry_id, user_id, analysis_version, facts[], story[], emotions[], patterns[], triggers[], observation_comment, created_at
- diary_embeddings: entry_id, user_id, embedding[], created_at
- (optional) pattern_catalog: pattern_id, name_ja, description, examples

## Migration script
Run:
```
node scripts/migrate_entries.js
```

This copies legacy entries from `users/{uid}/entries` into `diary_entries`.

## Notes
- Analysis and embeddings are generated on save via the server API.
- Old entries are not re-analyzed automatically.
