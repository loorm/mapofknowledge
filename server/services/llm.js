const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// LLMs sometimes wrap JSON in markdown fences despite instructions.
// Strip them before parsing.
function parseJSON(text) {
  const cleaned = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/,     '')
    .replace(/```\s*$/,     '')
    .trim();
  return JSON.parse(cleaned);
}

const HAIKU  = 'claude-haiku-4-5';
const SONNET = 'claude-sonnet-4-6';

const LANG_NAMES = { et: 'Estonian (Eesti keel)' };

function langText(locale) {
  if (!locale || locale === 'en') return '';
  const name = LANG_NAMES[locale] || locale;
  return `\n\nIMPORTANT: Write your entire response in ${name}.`;
}

function langJson(locale) {
  if (!locale || locale === 'en') return '';
  const name = LANG_NAMES[locale] || locale;
  return `\n\nIMPORTANT: Write all text content in ${name}. Keep JSON field names in English.`;
}

const TUTOR_SYSTEM = [
  {
    type: 'text',
    text: `You are an expert adaptive tutor inside the Map of Knowledge learning platform.
Your tone is clear, direct, and intellectually engaging.
Keep every response focused and concise. Never pad, never repeat.
Respond only with the content requested — no preamble, no headings.`,
    cache_control: { type: 'ephemeral' },
  },
];

// ── Overview ──────────────────────────────────────────────────────────────────
async function generateOverview(nodeLabel, domain, level, locale) {
  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 200,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Write exactly 2 sentences describing "${nodeLabel}" (a level-${level} concept in ${domain}).
First sentence: what it is. Second sentence: why it matters or where it shows up.
No headings, no bullet points — just the 2 sentences.${langText(locale)}`,
    }],
  });
  return msg.content[0].text.trim();
}

// ── Knobit generation ─────────────────────────────────────────────────────────
async function generateKnobits(nodeLabel, domain, breadcrumb) {
  const msg = await client.messages.create({
    model: SONNET,
    max_tokens: 600,
    system: [{
      type: 'text',
      text: `You are a curriculum designer for the Map of Knowledge platform.
Each knobit is one atomic idea a learner must master before the next.
Respond only with valid JSON — no markdown fences, no commentary.`,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: `Design the complete knobit sequence for this L5 concept:
Topic: "${nodeLabel}"
Domain: ${domain}
Breadcrumb: ${breadcrumb}

Return a JSON array. Each object has exactly:
- "sequence": integer starting at 1
- "title": string (short knobit name, 3–8 words)

Typically 5–12 knobits, progressing from foundational to nuanced.`,
    }],
  });
  return parseJSON(msg.content[0].text.trim());
}

// ── Explain phase — ADVANCE to next byte ("I understand") ────────────────────
// previousContent is what was shown in the previous byte so the LLM can
// build on it without repeating itself.
async function generateExplainByte(nodeLabel, knobitTitle, byteIndex, previousContent, locale) {
  let prompt;

  if (byteIndex === 0 || !previousContent) {
    prompt = `You are teaching knobit "${knobitTitle}" within the topic "${nodeLabel}".

Write the OPENING explanation (byte 1). Introduce the core concept clearly and simply.
2–4 sentences. Plain prose — no headings, no bullet points.${langText(locale)}`;
  } else {
    prompt = `You are teaching knobit "${knobitTitle}" within the topic "${nodeLabel}".

The learner understood the previous explanation:
"""
${previousContent}
"""

Now write the NEXT step (byte ${byteIndex + 1}). Advance the explanation — cover a new aspect, go one level deeper, or add a concrete application. Do NOT repeat or paraphrase what was already explained. Build forward.
2–4 sentences. Plain prose — no headings, no bullet points.${langText(locale)}`;
  }

  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 200,
    system: TUTOR_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text.trim();
}

// ── Explain phase — ADAPT the current byte ───────────────────────────────────
// mode:
//   'rephrase' — "I don't understand": step back, explain from first principles
//   'simpler'  — "Too simplistic": rephrase with professional/expert language
//   'complex'  — "Too complex": rephrase with simpler words and analogies
async function generateRephrase(nodeLabel, knobitTitle, originalByte, mode, locale) {
  const instructions = {
    rephrase: `The learner did not understand this explanation. Step back further.
Explain the same concept from first principles — start from something even more basic,
use a concrete real-world analogy, and build up slowly.
Do NOT reuse the same wording. A different angle entirely.`,

    simpler: `The learner found this too simplistic.
Rewrite it with professional, expert-level language. Use precise terminology,
a more formal framing, and the kind of depth an expert or researcher would appreciate.
Same core concept — elevated register.`,

    complex: `The learner found this too complex.
Rewrite it using simpler, everyday words. Replace jargon with plain equivalents,
use a concrete metaphor or comparison from daily life, and keep sentences short.
Same core concept — accessible register.`,
  }[mode] || 'Rewrite this explanation from a different angle.';

  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 200,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}"

Current explanation:
"""
${originalByte}
"""

${instructions}

Write the replacement paragraph only — 2–4 sentences, no headings.${langText(locale)}`,
    }],
  });
  return msg.content[0].text.trim();
}

// ── Demonstrate phase ─────────────────────────────────────────────────────────
async function generateDemonstrate(nodeLabel, knobitTitle, exampleIndex, locale) {
  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 350,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}"
Worked example number: ${exampleIndex + 1}

Respond with valid JSON, two fields only:
- "body": a step-by-step worked example (2–5 sentences)
- "whatIDid": 1 sentence naming the key technique or insight used

No markdown fences. Just the JSON object.${langJson(locale)}`,
    }],
  });
  return parseJSON(msg.content[0].text.trim());
}

// ── Practice phase ────────────────────────────────────────────────────────────
async function generatePractice(nodeLabel, knobitTitle, problemIndex, locale) {
  const difficulty = problemIndex === 0 ? 'straightforward' : problemIndex === 1 ? 'moderate' : 'challenging';
  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 250,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}"
Practice problem ${problemIndex + 1} — difficulty: ${difficulty}

Respond with valid JSON, two fields only:
- "question": the problem statement (1–3 sentences)
- "expected": the correct answer (brief — a number, term, or short phrase)

No markdown fences. Just the JSON object.${langJson(locale)}`,
    }],
  });
  return parseJSON(msg.content[0].text.trim());
}

// ── Grade a practice answer ───────────────────────────────────────────────────
async function gradePractice(nodeLabel, knobitTitle, question, expected, userAnswer, locale) {
  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 200,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}"
Question: "${question}"
Expected: "${expected}"
Learner's answer: "${userAnswer}"

Respond with valid JSON, two fields only:
- "correct": boolean (true if the learner captures the essential idea)
- "feedback": 1–2 sentences — confirm if correct, or explain what's wrong

No markdown fences. Just the JSON object.${langJson(locale)}`,
    }],
  });
  return parseJSON(msg.content[0].text.trim());
}

// ── Meaning phase ─────────────────────────────────────────────────────────────
async function generateMeaning(nodeLabel, knobitTitle, locale) {
  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 180,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}"

Write 2–3 sentences on why this matters in the real world.
Be concrete: name a profession, product, decision, or daily situation where it directly applies.
No "In conclusion" — just the insight.${langText(locale)}`,
    }],
  });
  return msg.content[0].text.trim();
}

// ── Ask anything ─────────────────────────────────────────────────────────────
async function answerQuestion(nodeLabel, knobitTitle, phase, question, context, locale) {
  const practiceRule = phase === 'practice'
    ? `\n\nPRACTICE PHASE — CRITICAL RULE: The learner is actively working on a practice problem. You must NEVER reveal, confirm, or strongly hint at the answer, even if asked directly. Instead offer a guiding question, point back to the relevant concept, or suggest a thinking approach. The learner must reach the answer themselves.`
    : '';

  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 300,
    system: [{
      type: 'text',
      text: `You are a focused learning assistant inside the Map of Knowledge platform.
You help the learner with exactly one concept:
  Knobit: "${knobitTitle}"
  Topic: "${nodeLabel}"

Rules:
1. Only answer questions relevant to this knobit or topic. If the question is clearly off-topic, reply warmly: "This chat is here to help you with '${knobitTitle}'. Happy to answer any questions about that!"
2. Be concise: 2–4 sentences. Never repeat what is already in the context.
3. No preamble — go straight to the helpful content.${practiceRule}`,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: `Phase: ${phase}
Recent content: "${context}"
Question: "${question}"${langText(locale)}`,
    }],
  });
  return msg.content[0].text.trim();
}

// ── 4-tier knowledge test ─────────────────────────────────────────────────────
// questionNum: 1-4  history: [{question, answer, correct}]
// Returns: { question, type: 'open'|'mcq', options?: string[] }
async function generateTestQuestion(nodeLabel, breadcrumb, questionNum, history, locale) {
  const tiers = [
    'Factual (Remember): one question on core terminology or a foundational definition.',
    'Conceptual (Understand): one question asking the learner to explain a mechanism or relationship. No calculations.',
    'Procedural (Apply): one question requiring step-by-step execution with specific numbers/inputs.',
    'Analytical (Evaluate): one question presenting a scenario or anomaly to diagnose or critique.',
  ];

  const correctCount = history.filter(h => h.correct).length;
  const lastWasWrong = history.length > 0 && !history[history.length - 1].correct;
  const adaptNote = questionNum === 4 && correctCount >= 3
    ? 'The learner has done very well. Make this question genuinely expert-level.'
    : lastWasWrong
    ? 'The previous answer was incorrect. Adjust difficulty slightly downward.'
    : '';

  const historyText = history.map((h, i) =>
    `Q${i + 1}: ${h.question}\nAnswer: ${h.answer}\nCorrect: ${h.correct}`
  ).join('\n\n');

  const msg = await client.messages.create({
    model: SONNET,
    max_tokens: 400,
    system: [{
      type: 'text',
      text: `You are a knowledge diagnostic examiner. You generate exactly one question per tier of a 4-tier framework.
Return ONLY valid JSON with these fields:
- "question": the question text (string)
- "type": "open" or "mcq"
- "options": array of 4 strings if type is "mcq", omit if "open"
Do not add any explanation outside the JSON.`,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" (${breadcrumb})
Tier ${questionNum}: ${tiers[questionNum - 1]}
${adaptNote}
${historyText ? `\nPrevious Q&A:\n${historyText}` : ''}

Generate question ${questionNum}. Choose open or MCQ based on what best tests this tier.
For MCQ: provide exactly 4 options, one correct. Return JSON only.${langJson(locale)}`,
    }],
  });

  return parseJSON(msg.content[0].text.trim());
}

// Evaluate one answer and return feedback.
// If questionNum === 4, also return final mastery score with breakdown.
async function evaluateTestAnswer(nodeLabel, breadcrumb, questionNum, question, options, userAnswer, history, locale) {
  const isLast = questionNum === 4;
  const allQA = [...history, { question, answer: userAnswer }];
  const historyText = allQA.map((h, i) =>
    `Q${i + 1}: ${h.question}\nAnswer: ${h.answer}`
  ).join('\n\n');

  const msg = await client.messages.create({
    model: SONNET,
    max_tokens: isLast ? 600 : 300,
    system: [{
      type: 'text',
      text: `You are a knowledge diagnostic evaluator. Return ONLY valid JSON. No text outside the JSON object.`,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: isLast
        ? `Topic: "${nodeLabel}" (${breadcrumb})

Full Q&A:
${historyText}

Evaluate all four answers. Return JSON with:
- "correct": boolean (is the current Q4 answer correct?)
- "feedback": 1-2 sentence feedback on the Q4 answer
- "finalScore": integer 0-100
- "scoreBreakdown": string (2-4 sentences explaining the score — what they got right, what they missed)${langJson(locale)}`
        : `Topic: "${nodeLabel}"
Question: "${question}"
${options ? `Options: ${options.map((o, i) => `${i + 1}. ${o}`).join(' | ')}` : ''}
Answer: "${userAnswer}"

Return JSON with:
- "correct": boolean
- "feedback": 1-2 sentences — confirm if correct or explain the right answer briefly${langJson(locale)}`,
    }],
  });

  return parseJSON(msg.content[0].text.trim());
}

module.exports = {
  generateOverview,
  generateKnobits,
  generateExplainByte,
  generateRephrase,
  generateDemonstrate,
  generatePractice,
  gradePractice,
  generateMeaning,
  answerQuestion,
  generateTestQuestion,
  evaluateTestAnswer,
};
