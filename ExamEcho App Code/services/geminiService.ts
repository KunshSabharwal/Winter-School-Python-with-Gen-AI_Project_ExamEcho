import { GoogleGenAI, Type } from "@google/genai";
import { Quiz, EvaluationResults, QuizType, Difficulty, AppSource } from "../types";

/**
 * ✅ API KEY (Vite-safe)
 */
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;

if (!API_KEY) {
  throw new Error(
    "VITE_GEMINI_API_KEY is missing. Please add it to .env.local and restart the dev server."
  );
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * ✅ Model choices
 * NOTE: Using preview models can hit rate limits faster.
 * We'll prefer FLASH for most tasks to avoid 429 errors.
 */
const PRO_MODEL = "gemini-3-pro-preview";
const FAST_MODEL = "gemini-3-flash-preview";

/**
 * ✅ Helpers
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let delay = 1000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = String(err?.message || err);

      // ✅ Retry only on rate-limit errors
      if (msg.includes("429") || msg.toLowerCase().includes("too many requests")) {
        console.warn(`⚠️ Rate limited (429). Retry ${attempt}/${retries} in ${delay}ms...`);
        await sleep(delay);
        delay *= 2;
        continue;
      }

      throw err;
    }
  }

  throw new Error("Rate limit hit (429). Please wait 20–60 seconds and try again.");
}

function safeJsonParse<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.error(`${label} JSON Parse Error`, text);
    throw new Error(`${label}: Failed to parse JSON response.`);
  }
}

/**
 * ✅ Source handling
 * IMPORTANT:
 * - Sending full PDF inlineData repeatedly causes heavy requests and 429 errors.
 * - We'll use inlineData ONLY when required (detectTopics / generateQuiz).
 * - For evaluation, we will NOT resend the PDF again.
 */
const getSourcePart = (source: AppSource) => {
  if (source.type === "pdf") {
    return { inlineData: { data: source.data.base64, mimeType: source.data.mimeType } };
  } else {
    return { text: `Topic context: ${source.topic}\n\nContent:\n${source.content}` };
  }
};

/**
 * ✅ Study Notes Generator
 */
export const generateStudyNotes = async (topic: string): Promise<string> => {
  const prompt = `Act as an expert academic tutor. Create a high-quality revision module for: "${topic}".

STRICT FORMATTING RULES:
1. STRUCTURE: Use clear Markdown headings. Organize into: 
   - ✅ Executive Summary (in a blockquote)
   - ✅ Key Concepts
   - ✅ Short Notes (using bullet points)
   - ✅ Examples & Applications
   - ✅ Common Mistakes to Avoid
2. MATHEMATICS: Use LaTeX syntax. Use $inline math$ and $$block math$$. 
   NEVER use LaTeX for plain numbers like dates (e.g., 1945) or simple item counts.
3. TECHNICAL: Wrap SQL queries, Python, or other code in triple backticks with language tags (e.g. \`\`\`sql).
4. TABLES: Use Markdown tables to compare or list technical parameters.
5. HIGHLIGHTS: Use bold text for critical terms. Provide a final "Summary Checklist" at the end.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: FAST_MODEL,
      contents: { parts: [{ text: prompt }] },
    })
  );

  return response.text || "Failed to generate notes.";
};

/**
 * ✅ Topic detection
 * NOTE: Works best when PDF is a text-based PDF. Scanned PDFs may reduce accuracy.
 */
export const detectTopics = async (source: AppSource): Promise<string[]> => {
  const prompt =
    "Identify the top 5 distinct academic sub-topics or chapters from this material. Return only a simple comma-separated list of titles.";

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: FAST_MODEL,
      contents: {
        parts: [getSourcePart(source), { text: prompt }],
      },
    })
  );

  const text = response.text || "";
  return text
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 5);
};

/**
 * ✅ Quiz generation
 */
export const generateQuiz = async (
  source: AppSource,
  config: {
    type: QuizType;
    count: number;
    difficulty: Difficulty;
    topic: string;
  }
): Promise<Quiz> => {
  const prompt = `Construct a ${config.difficulty} difficulty ${config.type} quiz for: "${config.topic}". Provide exactly ${config.count} questions.

QUIZ REQUIREMENTS:
1. MCQs: Must have exactly 4 short, distinct options (A, B, C, D). 'correct_answer' must be the letter only (A/B/C/D).
2. SUBJECTIVE: Questions should require analytical answers. No 'options' property.
3. MATH/CODE: Use LaTeX for formulas. Use code blocks for snippets.
4. EVIDENCE: Every question must include an 'evidence' field (a short quote from the text supporting the answer).
5. TITLE: Provide a professional title for the quiz.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: FAST_MODEL,
      contents: {
        parts: [getSourcePart(source), { text: prompt }],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            quiz_title: { type: Type.STRING },
            quiz_type: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            total_questions: { type: Type.NUMBER },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  type: { type: Type.STRING, description: "MCQ or Subjective" },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.OBJECT,
                    properties: {
                      A: { type: Type.STRING },
                      B: { type: Type.STRING },
                      C: { type: Type.STRING },
                      D: { type: Type.STRING },
                    },
                  },
                  correct_answer: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  source: { type: Type.STRING },
                },
                required: ["id", "type", "question", "correct_answer"],
              },
            },
            instructions_to_user: { type: Type.STRING },
            ready_for_answers: { type: Type.BOOLEAN },
          },
          required: ["quiz_title", "questions"],
        },
      },
    })
  );

  const jsonText = response.text || "{}";
  return safeJsonParse<Quiz>(jsonText, "Quiz");
};

/**
 * ✅ Quiz evaluation (Cognitive Audit)
 * IMPORTANT FIX:
 * - Do NOT include the full PDF again here -> huge payload -> 429
 * - Use FAST_MODEL to avoid rate limits
 */
export const evaluateQuiz = async (
  _source: AppSource, // keep signature same, but we won't send PDF again
  quiz: Quiz,
  userAnswers: Record<number, string>
): Promise<EvaluationResults> => {
  const prompt = `Perform a comprehensive "Cognitive Audit" on these student responses.

Quiz Questions (JSON):
${JSON.stringify(quiz.questions)}

Student Answers (JSON):
${JSON.stringify(userAnswers)}

GRADING CRITERIA:
- For MCQs: Direct match check.
- For Subjective: Semantic alignment with the correct model answer.
- Provide a clear 'explanation' for every response, highlighting specific key points.
- Wrap the evaluation in a final encouraging feedback summary.

Return ONLY valid JSON matching the schema.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      // ✅ Use fast model to reduce 429 errors
      model: FAST_MODEL,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total_questions: { type: Type.NUMBER },
            correct: { type: Type.NUMBER },
            incorrect: { type: Type.NUMBER },
            score: { type: Type.NUMBER },
            total_score: { type: Type.NUMBER },
            percentage: { type: Type.NUMBER },
            final_feedback: { type: Type.STRING },
            all_questions_review: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  question: { type: Type.STRING },
                  your_answer: { type: Type.STRING },
                  correct_answer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  source: { type: Type.STRING },
                  is_correct: { type: Type.BOOLEAN },
                  score_attained: { type: Type.NUMBER },
                },
              },
            },
          },
        },
      },
    })
  );

  const jsonText = response.text || "{}";
  return safeJsonParse<EvaluationResults>(jsonText, "Evaluation");
};
