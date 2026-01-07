/**
 * Centralized LLM client for OpenAI and Gemini API calls
 *
 * This module provides configured clients that read API keys
 * from the settings context. Use this for all LLM-related functionality
 * like market analysis, paper summarization, etc.
 */

const OPENAI_API_URL = 'https://api.openai.com/v1';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface MarketViabilityResult {
  novelty: number;
  marketSize: number;
  feasibility: number;
  timing: number;
  analysis: {
    novelty: string;
    marketSize: string;
    feasibility: string;
    timing: string;
    overall: string;
  };
}

/**
 * Create a chat completion using OpenAI API
 */
export async function createChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const {
    model = 'gpt-4o-mini',
    temperature = 0.7,
    maxTokens = 1000,
  } = options;

  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `OpenAI API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Create a chat completion using Gemini API
 */
export async function createGeminiCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  if (!apiKey) {
    throw new Error('Gemini API key is required');
  }

  const {
    model = 'gemini-2.0-flash',
    temperature = 0.7,
    maxTokens = 1000,
  } = options;

  // Convert messages to Gemini format
  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const response = await fetch(
    `${GEMINI_API_URL}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `Gemini API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Test if the OpenAI API key is valid
 */
export async function testOpenAIConnection(apiKey: string): Promise<boolean> {
  if (!apiKey) {
    return false;
  }

  try {
    const response = await fetch(`${OPENAI_API_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Test if the Gemini API key is valid
 */
export async function testGeminiConnection(apiKey: string): Promise<boolean> {
  if (!apiKey) {
    return false;
  }

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/models?key=${apiKey}`
    );
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// MARKET VIABILITY ANALYSIS - PRECISE EVALUATION PROMPTS
// ============================================================================

const SYSTEM_PROMPT = `You are a senior technology commercialization analyst with expertise in evaluating academic research for market potential. You have 15+ years of experience in venture capital, technology transfer offices, and startup incubation.

Your task is to analyze academic papers and provide rigorous, evidence-based assessments of their commercial viability. Be critical and objective - not every paper has commercial potential, and that's okay. Provide honest assessments.

IMPORTANT: You must respond ONLY with valid JSON. No markdown, no explanations outside the JSON structure.`;

const EVALUATION_PROMPT = `Analyze the following academic paper for market viability and commercial potential.

**PAPER TITLE:** {title}

**ABSTRACT:** {abstract}

Evaluate this paper on the following four dimensions using the precise criteria below. For each dimension, provide a score from 1-5 and a brief justification (1-2 sentences).

---

## DIMENSION 1: NOVELTY (Technical Innovation)
Score the uniqueness and innovation of the approach:

**Score 1 - Incremental:** Minor improvement on existing methods. Similar approaches already commercialized.
**Score 2 - Modest:** Some novel elements but largely derivative. Limited differentiation from existing solutions.
**Score 3 - Notable:** Clear innovation with meaningful improvements. Could enable new applications.
**Score 4 - Significant:** Substantially new approach or breakthrough. Strong patent potential.
**Score 5 - Transformative:** Paradigm-shifting innovation. Could create entirely new markets or disrupt existing ones.

Consider: Is this a genuine breakthrough or incremental improvement? How defensible is the innovation? Does it solve a problem in a fundamentally new way?

---

## DIMENSION 2: MARKET SIZE (Commercial Opportunity)
Score the potential market opportunity:

**Score 1 - Niche:** Very limited market (<$100M TAM). Academic interest only.
**Score 2 - Small:** Small addressable market ($100M-$500M TAM). Limited commercial applications.
**Score 3 - Moderate:** Medium market ($500M-$2B TAM). Clear industry applications.
**Score 4 - Large:** Large market ($2B-$10B TAM). Multiple industry verticals.
**Score 5 - Massive:** Enormous market (>$10B TAM). Platform potential across many industries.

Consider: Who would pay for this? How many potential customers exist? What industries could this serve? Is this B2B, B2C, or both?

---

## DIMENSION 3: FEASIBILITY (Path to Commercialization)
Score how realistic commercialization is:

**Score 1 - Theoretical:** Pure research with no clear path to product. Requires fundamental breakthroughs.
**Score 2 - Early Research:** Promising but needs 5+ years of development. Significant technical hurdles.
**Score 3 - Applied Research:** Clear development path, 2-5 years to product. Some technical challenges.
**Score 4 - Near-Ready:** Could be productized in 1-2 years. Minor engineering challenges.
**Score 5 - Ready:** Could be commercialized immediately. Proven at scale.

Consider: What's the technology readiness level? What resources are needed? Are there regulatory hurdles? What's the development timeline?

---

## DIMENSION 4: TIMING (Market Readiness)
Score whether the market is ready for this technology:

**Score 1 - Too Early:** Market won't exist for 10+ years. Infrastructure not ready.
**Score 2 - Early:** Market emerging but 3-5 years away. Early adopters only.
**Score 3 - Developing:** Market growing, infrastructure building. Good time to start development.
**Score 4 - Prime:** Market ready and growing. Strong customer demand. Ideal timing.
**Score 5 - Urgent:** Hot market with immediate demand. Risk of missing window.

Consider: Are customers actively seeking solutions? Is supporting infrastructure in place? Are competitors already in market? Is there regulatory tailwind or headwind?

---

Respond with this exact JSON structure:
{
  "novelty": <1-5>,
  "marketSize": <1-5>,
  "feasibility": <1-5>,
  "timing": <1-5>,
  "analysis": {
    "novelty": "<1-2 sentence justification for novelty score>",
    "marketSize": "<1-2 sentence justification for market size score>",
    "feasibility": "<1-2 sentence justification for feasibility score>",
    "timing": "<1-2 sentence justification for timing score>",
    "overall": "<2-3 sentence overall assessment of commercial potential>"
  }
}`;

/**
 * Analyze market viability of a paper using LLM (OpenAI or Gemini)
 */
export async function analyzeMarketViability(
  apiKey: string,
  paperTitle: string,
  paperAbstract: string,
  provider: 'openai' | 'gemini' = 'openai'
): Promise<MarketViabilityResult> {
  const userPrompt = EVALUATION_PROMPT
    .replace('{title}', paperTitle)
    .replace('{abstract}', paperAbstract);

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  const options: ChatCompletionOptions = {
    temperature: 0.3, // Lower temperature for more consistent scoring
    maxTokens: 800,
  };

  let response: string;

  if (provider === 'gemini') {
    response = await createGeminiCompletion(apiKey, messages, options);
  } else {
    response = await createChatCompletion(apiKey, messages, options);
  }

  return parseViabilityResponse(response);
}

/**
 * Parse the LLM response into structured viability data
 */
function parseViabilityResponse(response: string): MarketViabilityResult {
  try {
    // Try to extract JSON from response (handle potential markdown code blocks)
    let jsonStr = response;

    // Remove markdown code blocks if present
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      // Try to find JSON object
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and clamp scores to 1-5 range
    const clampScore = (score: number): number =>
      Math.max(1, Math.min(5, Math.round(score)));

    return {
      novelty: clampScore(parsed.novelty || 3),
      marketSize: clampScore(parsed.marketSize || 3),
      feasibility: clampScore(parsed.feasibility || 3),
      timing: clampScore(parsed.timing || 3),
      analysis: {
        novelty: parsed.analysis?.novelty || 'Unable to analyze novelty.',
        marketSize: parsed.analysis?.marketSize || 'Unable to analyze market size.',
        feasibility: parsed.analysis?.feasibility || 'Unable to analyze feasibility.',
        timing: parsed.analysis?.timing || 'Unable to analyze timing.',
        overall: parsed.analysis?.overall || 'Unable to provide overall assessment.',
      },
    };
  } catch (error) {
    console.error('Failed to parse viability response:', error, response);
    // Return default values if parsing fails
    return {
      novelty: 3,
      marketSize: 3,
      feasibility: 3,
      timing: 3,
      analysis: {
        novelty: 'Analysis failed.',
        marketSize: 'Analysis failed.',
        feasibility: 'Analysis failed.',
        timing: 'Analysis failed.',
        overall: 'Unable to analyze. Please check your API key and try again.',
      },
    };
  }
}

// ============================================================================
// KEYWORD SUGGESTIONS FOR PAPER SEARCH
// ============================================================================

const KEYWORD_SYSTEM_PROMPT = `You are an expert academic research assistant specializing in helping researchers find relevant papers. Your task is to suggest search keywords and phrases that will help find academic papers on a given topic.

IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanations outside the JSON structure.`;

const KEYWORD_PROMPT = `Given the research topic: "{topic}"

Generate search keywords and phrases to help find relevant academic papers. Include:
1. **Core terms**: Direct keywords related to the topic
2. **Technical synonyms**: Alternative technical terms used in academia
3. **Related concepts**: Broader or adjacent research areas
4. **Specific methods**: Relevant methodologies or techniques
5. **Application domains**: Fields where this research applies

Respond with this exact JSON structure:
{
  "keywords": [
    {
      "term": "<keyword or phrase>",
      "category": "<core|synonym|related|method|application>",
      "relevance": "<high|medium>"
    }
  ]
}

Provide 8-12 diverse, high-quality suggestions. Prioritize terms commonly used in academic literature.`;

export interface KeywordSuggestion {
  term: string;
  category: 'core' | 'synonym' | 'related' | 'method' | 'application';
  relevance: 'high' | 'medium';
}

/**
 * Generate keyword suggestions for a research topic
 */
export async function suggestKeywords(
  apiKey: string,
  topic: string,
  provider: 'openai' | 'gemini' = 'openai'
): Promise<KeywordSuggestion[]> {
  const userPrompt = KEYWORD_PROMPT.replace('{topic}', topic);

  const messages: ChatMessage[] = [
    { role: 'system', content: KEYWORD_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  const options: ChatCompletionOptions = {
    temperature: 0.5,
    maxTokens: 600,
  };

  let response: string;

  if (provider === 'gemini') {
    response = await createGeminiCompletion(apiKey, messages, options);
  } else {
    response = await createChatCompletion(apiKey, messages, options);
  }

  return parseKeywordResponse(response);
}

/**
 * Parse the LLM response into keyword suggestions
 */
function parseKeywordResponse(response: string): KeywordSuggestion[] {
  try {
    let jsonStr = response;

    // Remove markdown code blocks if present
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    const parsed = JSON.parse(jsonStr);

    if (Array.isArray(parsed.keywords)) {
      return parsed.keywords.map((k: KeywordSuggestion) => ({
        term: k.term || '',
        category: k.category || 'core',
        relevance: k.relevance || 'medium',
      })).filter((k: KeywordSuggestion) => k.term.length > 0);
    }

    return [];
  } catch (error) {
    console.error('Failed to parse keyword response:', error, response);
    return [];
  }
}
