
/**
 * Minimal AI-Powered Role-Based Assessment & Evaluation System (Server)
 * Tech: Node.js + Express (no DB for demo; JSON file storage)
 * Run:  node server.js
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 5050;

app.use(bodyParser.json({ limit: '2mb' }));

// --- Naive JSON storage for demo ---
const storePath = path.join(__dirname, 'store.json');
function loadStore(){
  if(!fs.existsSync(storePath)){
    fs.writeFileSync(storePath, JSON.stringify({ tests: {}, results: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(storePath, 'utf-8'));
}
function saveStore(data){
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

// --- NLP Parsing (very lightweight heuristics) ---
function parseNaturalLanguageNotes(notes){
  const n = (notes || "").toLowerCase();
  const prefs = {
    emphasizeProblemSolving: /problem[-\s]?solving|dsa|algorithms/.test(n),
    includeSystemDesign: /system\s*design/.test(n),
    heavyOnCoding: /heavy.*coding|coding[-\s]?heavy/.test(n),
    scenarioBased: /scenario|case study|situational/.test(n),
    addUnitTests: /unit test|test case/.test(n),
    difficultyBias: /hard|advanced/.test(n) ? 'hard' : (/easy|beginner/.test(n) ? 'easy' : 'balanced'),
    minDesignCount: (() => {
      const m = n.match(/at\s*least\s*(\d+)\s*(system\s*design|design)/);
      return m ? parseInt(m[1],10) : 0;
    })()
  };
  return prefs;
}

// --- Question generation ---
function generateQuestions(blueprint){
  // blueprint: { role, stack[], experience, types[], duration, nlNotesParsed }
  const skills = blueprint.stack && blueprint.stack.length ? blueprint.stack : ['general'];
  const types = blueprint.types && blueprint.types.length ? blueprint.types : ['MCQ','short','coding','scenario'];
  const difficultyBias = blueprint.nlNotesParsed?.difficultyBias || 'balanced';

  function pickDifficulty(base){
    if(difficultyBias === 'hard') return base === 'coding' ? 'hard' : 'medium';
    if(difficultyBias === 'easy') return 'easy';
    return base === 'coding' ? 'medium' : 'easy';
  }

  const all = [];
  let qid = 1;
  const pushQ = (q) => all.push({ id: `Q${qid++}`, ...q });

  // Ensure coverage & variety
  for(const skill of skills){
    for(const t of types){
      const diff = pickDifficulty(t);
      if(t === 'MCQ'){
        pushQ({
          type: 'MCQ',
          skill,
          difficulty: diff,
          time: 2,
          prompt: `Which of the following is TRUE about ${skill}?`,
          options: [
            `It is always synchronous by default.`,
            `Best practices include modularization and testing.`,
            `It guarantees O(1) memory usage.`,
            `It cannot be deployed to production.`
          ],
          answer: 1
        });
      } else if(t === 'short'){
        pushQ({
          type: 'short',
          skill,
          difficulty: diff,
          time: 3,
          prompt: `Briefly explain a common pitfall in ${skill} and how to avoid it.`,
          keyPoints: [`mention trade-offs`, `mention testing`, `mention performance`]
        });
      } else if(t === 'coding'){
        pushQ({
          type: 'coding',
          skill,
          difficulty: diff,
          time: 10,
          prompt: `Write a function to check if a string is a palindrome (ignore case & non-alphanumerics).`,
          starterCode: `function isPalindrome(s){\n  // your code\n}\nmodule.exports = isPalindrome;`,
          tests: [
            { input: "A man, a plan, a canal: Panama", output: true },
            { input: "race a car", output: false }
          ],
          evaluatorHint: "strip non-alphanumeric, toLowerCase, compare reversed"
        });
      } else if(t === 'scenario'){
        pushQ({
          type: 'scenario',
          skill,
          difficulty: diff,
          time: 5,
          prompt: `Your team’s ${skill} service spikes latency under load. Outline 3 likely causes and 3 concrete mitigations.`,
          rubric: [
            "Root causes identified (3+)",
            "Mitigations actionable and relevant",
            "Mentions monitoring/observability",
            "Considers trade-offs"
          ]
        });
      }
    }
  }

  // Natural language constraints
  if(blueprint.nlNotesParsed?.includeSystemDesign || blueprint.nlNotesParsed?.minDesignCount > 0){
    const need = Math.max(1, blueprint.nlNotesParsed?.minDesignCount || 0);
    for(let i=0;i<need;i++){
      pushQ({
        type: 'scenario',
        skill: 'system-design',
        difficulty: 'hard',
        time: 15,
        prompt: `Design a scalable ${blueprint.role || 'service'} that handles 10k RPS. Cover data model, caching, queues, consistency, and monitoring.`,
        rubric: [
          "Scalability & load distribution",
          "Data modeling & storage choice",
          "Caching strategy",
          "Asynch processing / queues",
          "Consistency & failure handling",
          "Observability"
        ]
      });
    }
  }

  return all;
}

// --- Basic evaluation ---
function evaluateSubmission(test, responses){
  let score = 0;
  let total = 0;
  const perSkill = {};

  const addSkill = (skill, ok) => {
    if(!perSkill[skill]) perSkill[skill] = { correct: 0, total: 0 };
    perSkill[skill].total += 1;
    if(ok) perSkill[skill].correct += 1;
  };

  const findings = [];

  for(const q of test.questions){
    total += 1;
    const r = responses[q.id];
    let ok = false;

    if(q.type === 'MCQ'){
      ok = (r?.choice === q.answer);
      addSkill(q.skill, ok);
      if(!ok) findings.push({ id: q.id, need: 'Review fundamentals / best practices.' });
    } else if(q.type === 'short' || q.type === 'scenario'){
      const text = (r?.text || "").toLowerCase();
      const keyPoints = (q.keyPoints || q.rubric || []);
      const matched = keyPoints.filter(k => text.includes(k.split(' ')[0].toLowerCase())).length;
      ok = matched >= Math.ceil(keyPoints.length * 0.5);
      addSkill(q.skill, ok);
      if(!ok) findings.push({ id: q.id, need: `Missed key points: ${keyPoints.join(', ')}` });
    } else if(q.type === 'coding'){
      const code = r?.code || "";
      // naive test runner: simulate by searching for keywords and simple function behavior check
      try{
        // very naive: implement quick check for palindrome solution markers
        const hasReplace = /replace|[^a-z0-9]/i.test(code);
        const lower = /toLowerCase/.test(code);
        const reverse = /reverse\(/.test(code);
        const fnOk = hasReplace && lower && reverse;
        ok = fnOk;
      }catch(e){
        ok = false;
      }
      addSkill(q.skill, ok);
      if(!ok) findings.push({ id: q.id, need: 'Coding: ensure normalization, reversal, and comparison logic.' });
    }
    if(ok) score += 1;
  }

  const overall = Math.round((score/total)*100);
  const strengths = Object.entries(perSkill).filter(([_,v]) => (v.correct/v.total)>=0.7).map(([k])=>k);
  const weaknesses = Object.entries(perSkill).filter(([_,v]) => (v.correct/v.total)<0.5).map(([k])=>k);

  const recommendations = [];
  if(weaknesses.includes('system-design')){
    recommendations.push('Practice system design: load balancing, caching, queues, and observability.');
  }
  if(weaknesses.length){
    recommendations.push('Review fundamentals and do targeted practice with timed drills.');
  }
  if(strengths.length){
    recommendations.push('Leverage strengths to mentor peers or tackle advanced problems.');
  }

  return {
    overallScore: overall,
    perSkill,
    strengths,
    weaknesses,
    findings,
    recommendations
  };
}

// --- Routes ---

// Phase I — Blueprint creation
app.post('/api/blueprint', (req, res) => {
  const { role, stack = [], experience, types = [], duration, notes = "" } = req.body || {};
  const parsed = parseNaturalLanguageNotes(notes);
  const blueprint = { role, stack, experience, types, duration, nlNotesParsed: parsed };
  return res.json({ ok: true, blueprint });
});

// Phase 2 — Generate test
app.post('/api/generate', (req, res) => {
  const { blueprint } = req.body || {};
  if(!blueprint) return res.status(400).json({ ok:false, error: 'Missing blueprint' });
  const questions = generateQuestions(blueprint);

  const store = loadStore();
  const testId = 'T' + Math.random().toString(36).slice(2, 8);
  const test = { id: testId, blueprint, questions, createdAt: new Date().toISOString() };
  store.tests[testId] = test;
  saveStore(store);

  res.json({ ok: true, test });
});

// Phase 3 — Submit & evaluate
app.post('/api/submit', (req, res) => {
  const { testId, responses } = req.body || {};
  const store = loadStore();
  const test = store.tests[testId];
  if(!test) return res.status(404).json({ ok:false, error: 'Test not found' });

  const report = evaluateSubmission(test, responses || {});
  store.results[testId] = { report, submittedAt: new Date().toISOString() };
  saveStore(store);

  res.json({ ok: true, report });
});

app.get('/api/test/:id', (req, res) => {
  const store = loadStore();
  const t = store.tests[req.params.id];
  if(!t) return res.status(404).json({ ok:false });
  res.json({ ok: true, test: t });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
