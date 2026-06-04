const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HAIKU  = 'claude-haiku-4-5';
const SONNET = 'claude-sonnet-4-6';

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
async function generateOverview(nodeLabel, domain, level) {
  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 200,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Write exactly 2 sentences describing "${nodeLabel}" (a level-${level} concept in ${domain}).
First sentence: what it is. Second sentence: why it matters or where it shows up.
No headings, no bullet points — just the 2 sentences.`,
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
  return JSON.parse(msg.content[0].text.trim());
}

// ── Explain phase — ADVANCE to next byte ("I understand") ────────────────────
// previousContent is what was shown in the previous byte so the LLM can
// build on it without repeating itself.
async function generateExplainByte(nodeLabel, knobitTitle, byteIndex, previousContent) {
  let prompt;

  if (byteIndex === 0 || !previousContent) {
    prompt = `You are teaching knobit "${knobitTitle}" within the topic "${nodeLabel}".

Write the OPENING explanation (byte 1). Introduce the core concept clearly and simply.
2–4 sentences. Plain prose — no headings, no bullet points.`;
  } else {
    prompt = `You are teaching knobit "${knobitTitle}" within the topic "${nodeLabel}".

The learner understood the previous explanation:
"""
${previousContent}
"""

Now write the NEXT step (byte ${byteIndex + 1}). Advance the explanation — cover a new aspect, go one level deeper, or add a concrete application. Do NOT repeat or paraphrase what was already explained. Build forward.
2–4 sentences. Plain prose — no headings, no bullet points.`;
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
async function generateRephrase(nodeLabel, knobitTitle, originalByte, mode) {
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

Write the replacement paragraph only — 2–4 sentences, no headings.`,
    }],
  });
  return msg.content[0].text.trim();
}

// ── Demonstrate phase ─────────────────────────────────────────────────────────
async function generateDemonstrate(nodeLabel, knobitTitle, exampleIndex) {
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

No markdown fences. Just the JSON object.`,
    }],
  });
  return JSON.parse(msg.content[0].text.trim());
}

// ── Practice phase ────────────────────────────────────────────────────────────
async function generatePractice(nodeLabel, knobitTitle, problemIndex) {
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

No markdown fences. Just the JSON object.`,
    }],
  });
  return JSON.parse(msg.content[0].text.trim());
}

// ── Grade a practice answer ───────────────────────────────────────────────────
async function gradePractice(nodeLabel, knobitTitle, question, expected, userAnswer) {
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

No markdown fences. Just the JSON object.`,
    }],
  });
  return JSON.parse(msg.content[0].text.trim());
}

// ── Meaning phase ─────────────────────────────────────────────────────────────
async function generateMeaning(nodeLabel, knobitTitle) {
  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 180,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}"

Write 2–3 sentences on why this matters in the real world.
Be concrete: name a profession, product, decision, or daily situation where it directly applies.
No "In conclusion" — just the insight.`,
    }],
  });
  return msg.content[0].text.trim();
}

// ── Ask anything ─────────────────────────────────────────────────────────────
async function answerQuestion(nodeLabel, knobitTitle, phase, question, context) {
  const msg = await client.messages.create({
    model: SONNET,
    max_tokens: 400,
    system: [{
      type: 'text',
      text: `You are an expert adaptive tutor in the Map of Knowledge platform.
Answer off-script questions clearly, staying relevant to the topic.
2–5 sentences unless the question genuinely requires more.`,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}" — Phase: ${phase}
Context: "${context}"
Question: "${question}"`,
    }],
  });
  return msg.content[0].text.trim();
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
};
