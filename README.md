
# AI-Powered Role-Based Assessment & Evaluation — Mini Demo

This is a minimal full-stack demo implementing the 3 phases:
1) Role & Requirements Gathering
2) Dynamic Test Generation
3) Test Taking & AI Evaluation

> Frontend: Plain React (UMD) + Tailwind via CDN  
> Backend: Node.js + Express  
> Storage: JSON file (for demo), swap to Mongo/Postgres easily  
> AI/NLP: lightweight heuristics + templates, easy to plug any LLM

## Quick Start (Local)

### 1) Backend
```bash
cd server
npm install
npm start
# server on http://localhost:5050
```

### 2) Frontend (static file)
Open `client/index.html` in your browser.
> Ensure the backend is running on port 5050.

## What To Show in Demo Video
- Fill the role, stack, preferences, and natural language notes.
- Click **Create Blueprint** → shows parsed blueprint including NLP-derived constraints (e.g., include system design).
- Click **Generate Test** → displays an AI-like test with variety (MCQ, short, coding, scenario) and metadata (skill, difficulty, time).
- Answer a few questions (coding prompt included).
- Click **Submit & Generate Report** → renders an AI report (overall score, per-skill breakdown, strengths, weaknesses, recommendations).

## Architecture
- **Client:** Single page using React. Calls backend REST endpoints.
- **Server:** Express routes:
  - `POST /api/blueprint` — merges structured inputs + NLP parsed constraints
  - `POST /api/generate` — generates difficulty-adjusted, skill-tagged questions with time estimates
  - `POST /api/submit` — evaluates answers (MCQ correctness; heuristics for short/scenario; basic checks for coding)
  - `GET /api/test/:id` — fetch a generated test by id

### Data Models
**Blueprint**
```json
{
  "role": "Frontend Developer",
  "stack": ["React", "Node.js", "MongoDB"],
  "experience": "1-3 years",
  "types": ["MCQ","coding","scenario"],
  "duration": 45,
  "nlNotesParsed": {
    "emphasizeProblemSolving": true,
    "includeSystemDesign": true,
    "heavyOnCoding": true,
    "scenarioBased": false,
    "difficultyBias": "balanced",
    "minDesignCount": 1
  }
}
```

**Test**
```json
{
  "id": "Tabc123",
  "blueprint": { ... },
  "questions": [
    {
      "id": "Q1",
      "type": "MCQ",
      "skill": "React",
      "difficulty": "easy|medium|hard",
      "time": 2,
      "prompt": "Which of the following ...?",
      "options": ["...","...","...","..."],
      "answer": 1
    },
    {
      "id": "Q3",
      "type": "coding",
      "skill": "Node.js",
      "difficulty": "medium",
      "time": 10,
      "prompt": "Write a function ...",
      "starterCode": "function ...",
      "tests": [{ "input": "...", "output": "..." }]
    }
  ]
}
```

**Submission & Report**
```json
{
  "testId": "Tabc123",
  "responses": { "Q1": {"choice":1}, "Q3":{"code":"..."} }
}
```
Report:
```json
{
  "overallScore": 78,
  "perSkill": { "React": {"correct":3,"total":4}, "system-design":{"correct":1,"total":2} },
  "strengths": ["React"],
  "weaknesses": ["system-design"],
  "findings": [{ "id":"Q3", "need":"Coding: ensure normalization..." }],
  "recommendations": ["Practice system design ..."]
}
```

## AI Question Generation
- Heuristic template-based generator with difficulty bias influenced by NLP parsing.
- Variety ensured by mixing MCQ / short / coding / scenario for each skill in the stack.
- **Easy upgrade:** replace generator with LLM call; keep the same JSON structure.

## Natural Language Parsing
- `parseNaturalLanguageNotes(notes)` extracts constraints from user text:
  - Signals like “heavy on problem-solving”, “include at least one system design question”, “advanced/hard”
  - Produces a structured object used by the generator.

## AI Evaluation Logic
- **MCQ:** direct answer key comparison.
- **Short/Scenario:** key-phrase coverage (>=50%).
- **Coding:** simple static checks for core steps (normalization, reversal). Replace with sandbox + test runner for production.
- **Report:** overall score, per-skill breakdown, strengths/weaknesses, recommendations.

## Bonus Features (Where to add)
- **Proctoring:** add timer + visibility events in client; track tab blur/focus. Post to server for flagging.
- **Multi-role Templates:** persist blueprints in `store.json` (or DB) with names; add endpoints to list/reuse.

## Deployment
- **Backend:** Deploy Node/Express to Render/Fly.io/Heroku, or a container to any cloud.
- **Frontend:** Host `client/` on Netlify/Vercel or any static host. Update API base URL to the deployed backend.
- **DB:** Swap `store.json` with MongoDB or Postgres. Map `tests` and `results` collections/tables accordingly.

---

**Note:** This demo is intentionally minimal to fit into a single quick start. For production, add authentication, real LLM integration, secure code execution for coding tasks, richer NLP, and granular rubrics.
