# Self Observation OS API

## Setup
```
cd server
npm install
```

## Environment
Required for Firestore access:
- `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON)

Or set:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Optional for LLM/embedding:
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default: gemini-2.0-flash)
- `GEMINI_EMBEDDING_MODEL` (default: text-embedding-004)

## Run
```
npm start
```

API endpoints:
- `POST /api/analyze`
- `POST /api/similar`
- `POST /api/summary`
