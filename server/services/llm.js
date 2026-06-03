const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HAIKU  = 'claude-haiku-4-5';
const SONNET = 'claude-sonnet-4-6';

// Shared system prompt for the tutoring functions — cached since it's identical
// across every knobit interaction call.
const TUTOR_SYSTEM = [
  {
    type: 'text',
    text: `You are an expert adaptive tutor inside the Map of Knowledge learning platform.
Your tone is clear, direct, and intellectually engaging — like a knowledgeable friend, not a textbook.
Keep every response focused and concise. Never pad, never repeat the question back.
Respond only with the content requested, no preamble.`,
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
    system: [
      {
        type: 'text',
        text: `You are a curriculum designer for the Map of Knowledge platform.
You design learning sequences for leaf-level concepts (L5 nodes).
Each knobit is one atomic idea a learner must master before the next.
Respond only with valid JSON — no markdown fences, no commentary.`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{
      role: 'user',
      content: `Design the complete knobit sequence for this L5 concept:
Topic: "${nodeLabel}"
Domain: ${domain}
Breadcrumb: ${breadcrumb}

Return a JSON array of objects. Each object has exactly two fields:
- "sequence": integer starting at 1
- "title": string (short knobit name, 3–8 words)

Produce however many knobits this topic genuinely requires (typically 5–12).
The sequence should progress from foundational to nuanced.`,
    }],
  });

  const raw = msg.content[0].text.trim();
  return JSON.parse(raw);
}

// ── Explain phase — byte ──────────────────────────────────────────────────────
async function generateExplainByte(nodeLabel, knobitTitle, byteIndex, priorChoices) {
  const priorContext = priorChoices.length
    ? `Prior learner choices: ${priorChoices.join(' → ')}`
    : 'No prior bytes shown yet.';

  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 180,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}"
Byte number: ${byteIndex + 1}
${priorContext}

Write one short explanatory paragraph (3–5 sentences) for this byte.
If this is byte 1, introduce the core idea simply.
If a prior choice was "I don't understand", rephrase using a different analogy.
If prior choice was "Too complex", simplify. If "Too simplistic", go deeper.
Just the paragraph — no label, no heading.`,
    }],
  });
  return msg.content[0].text.trim();
}

// ── Explain phase — rephrase ──────────────────────────────────────────────────
async function generateRephrase(nodeLabel, knobitTitle, originalByte, mode) {
  const instruction = {
    simpler:  'Simplify it. Use simpler words and a concrete everyday analogy.',
    complex:  'Go deeper. Add precision, a formal definition, or a subtle distinction.',
    rephrase: 'Rephrase it entirely using a different angle or metaphor.',
  }[mode];

  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 180,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}"
Original byte: "${originalByte}"
Task: ${instruction}
Write the replacement paragraph only — no meta-commentary.`,
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

Write a worked example. Respond with valid JSON, two fields:
- "body": the step-by-step example (2–5 sentences or steps)
- "whatIDid": 1 sentence explaining the key move or trick used

No markdown fences. Just the JSON object.`,
    }],
  });

  return JSON.parse(msg.content[0].text.trim());
}

// ── Practice phase — generate problem ────────────────────────────────────────
async function generatePractice(nodeLabel, knobitTitle, problemIndex) {
  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 250,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}"
Practice problem number: ${problemIndex + 1}

Create one practice problem. Respond with valid JSON, two fields:
- "question": the problem statement (1–3 sentences)
- "expected": the correct answer (brief — a number, term, or short phrase)

Problem ${problemIndex + 1} should be ${problemIndex === 0 ? 'straightforward' : problemIndex === 1 ? 'moderate' : 'challenging'}.
No markdown fences. Just the JSON object.`,
    }],
  });

  return JSON.parse(msg.content[0].text.trim());
}

// ── Practice phase — grade answer ────────────────────────────────────────────
async function gradePractice(nodeLabel, knobitTitle, question, expected, userAnswer) {
  const msg = await client.messages.create({
    model: HAIKU,
    max_tokens: 200,
    system: TUTOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}"
Question: "${question}"
Expected answer: "${expected}"
Learner's answer: "${userAnswer}"

Grade the answer. Respond with valid JSON, two fields:
- "correct": boolean (true if the learner's answer captures the essential idea, even if worded differently)
- "feedback": 1–2 sentences — if correct, confirm briefly; if wrong, explain the correct reasoning

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

Write 2–3 sentences on why this knobit matters in the real world.
Be concrete: name a profession, product, decision, or daily situation where it directly applies.
No "In conclusion" or "This shows that" — just the insight.`,
    }],
  });
  return msg.content[0].text.trim();
}

// ── Ask anything ─────────────────────────────────────────────────────────────
async function answerQuestion(nodeLabel, knobitTitle, phase, question, context) {
  const msg = await client.messages.create({
    model: SONNET,
    max_tokens: 400,
    system: [
      {
        type: 'text',
        text: `You are an expert adaptive tutor inside the Map of Knowledge learning platform.
A learner has asked an off-script question during a learning session.
Answer it clearly and helpfully, staying relevant to the topic at hand.
If it is unrelated to the topic, gently redirect.
Keep the answer focused — 2–5 sentences unless more is genuinely needed.`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{
      role: 'user',
      content: `Topic: "${nodeLabel}" — Knobit: "${knobitTitle}" — Phase: ${phase}
Recent context: "${context}"
Learner question: "${question}"`,
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
