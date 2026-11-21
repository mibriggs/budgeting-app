// Quick add's model fallback: asks Claude to read a pasted alert or typed note the local parser
// couldn't fully read. Server only (it holds the API key).
//
// Safety: the model gets only this user's own lists and the sanitized message (see prompt.ts),
// has no tools, and must answer in a fixed JSON shape whose category and payment method can only
// be this user's own IDs. Nothing it returns is saved without the user confirming it.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { ANTHROPIC_API_KEY, CLAUDE_MODEL } from '$app/env/private';
import type { ParseResult, QuickAddContext } from '#lib/quick-add/parse.ts';
import { MAX_CENTS } from '#lib/quick-add/parse.ts';
import { SYSTEM_PROMPT, buildUserPrompt, type HistoryExample } from '#lib/quick-add/prompt.ts';

/** One shared client. Short timeout and one retry: someone is waiting on the sheet. */
let client: Anthropic | null = null;
function getClient(): Anthropic | null {
	if (!ANTHROPIC_API_KEY) return null;
	client ??= new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 15_000, maxRetries: 1 });
	return client;
}

/** True when the model fallback is set up (an API key is configured). */
export const modelAvailable = () => Boolean(ANTHROPIC_API_KEY);

/** An ID from `ids`, or null. A user with none of them can only get null. */
function oneOf(ids: string[]) {
	return ids.length ? z.enum(ids as [string, ...string[]]).nullable() : z.null();
}

/** The answer's shape, built per user so the model can only pick their own IDs. */
function answerSchema(ctx: QuickAddContext) {
	return z.object({
		is_expense: z.boolean(),
		name: z.string().nullable(),
		amount_cents: z.number().int().nullable(),
		date: z.string().nullable(),
		payment_method_id: oneOf(ctx.paymentMethods.map((m) => m.id)),
		category_id: oneOf(ctx.categories.map((c) => c.id)),
		confidence: z.enum(['high', 'medium', 'low']),
		note: z.string().nullable()
	});
}

export type ModelAnswer = z.infer<ReturnType<typeof answerSchema>>;

export type ModelResult =
	| {
			ok: true;
			answer: ModelAnswer;
			/** Problems found checking the answer (bad date, amount out of range); empty if none. */
			problems: string[];
			model: string;
			usage: { inputTokens: number; outputTokens: number; thinkingTokens: number | null };
	  }
	| { ok: false; error: string };

/** Checks the parts the schema can't: a real date not far in the future, a sane amount. */
function check(answer: ModelAnswer, ctx: QuickAddContext): string[] {
	if (!answer.is_expense) return [];
	const problems: string[] = [];
	if (answer.amount_cents === null || answer.amount_cents <= 0 || answer.amount_cents > MAX_CENTS)
		problems.push(`amount_cents ${answer.amount_cents} is missing or out of range`);
	if (answer.date !== null) {
		const valid = /^\d{4}-\d{2}-\d{2}$/.test(answer.date) && !Number.isNaN(Date.parse(answer.date));
		if (!valid) problems.push(`date "${answer.date}" isn't a real date`);
		else if (answer.date > ctx.today.add({ days: 1 }).toString())
			problems.push(`date ${answer.date} is in the future`);
	}
	if (answer.name !== null && answer.name.length > 100) problems.push('name is too long');
	return problems;
}

export async function askClaude(
	message: string,
	ctx: QuickAddContext,
	local: ParseResult,
	history: HistoryExample[]
): Promise<ModelResult> {
	const anthropic = getClient();
	if (!anthropic) return { ok: false, error: 'No ANTHROPIC_API_KEY is set.' };

	try {
		const response = await anthropic.messages.parse({
			model: CLAUDE_MODEL,
			// Room for a little thinking plus the short JSON answer.
			max_tokens: 2048,
			system: SYSTEM_PROMPT,
			messages: [{ role: 'user', content: buildUserPrompt(message, ctx, local, history) }],
			// Low effort: this is a short extraction, not a hard problem.
			output_config: { format: zodOutputFormat(answerSchema(ctx)), effort: 'low' }
		});

		if (response.stop_reason === 'refusal')
			return { ok: false, error: 'The model declined to read this message.' };
		if (response.stop_reason === 'max_tokens')
			return { ok: false, error: 'The model ran out of room before finishing.' };
		if (!response.parsed_output)
			return { ok: false, error: `No usable answer (stop reason: ${response.stop_reason}).` };

		return {
			ok: true,
			answer: response.parsed_output,
			problems: check(response.parsed_output, ctx),
			model: response.model,
			usage: {
				inputTokens: response.usage.input_tokens,
				outputTokens: response.usage.output_tokens,
				thinkingTokens: response.usage.output_tokens_details?.thinking_tokens ?? null
			}
		};
	} catch (error) {
		if (error instanceof Anthropic.AuthenticationError)
			return { ok: false, error: 'The API key was rejected.' };
		if (error instanceof Anthropic.RateLimitError)
			return { ok: false, error: 'Rate limited or over the spend limit. Try again later.' };
		if (error instanceof Anthropic.BadRequestError)
			return { ok: false, error: `The request was rejected: ${error.message}` };
		if (error instanceof Anthropic.APIError)
			return { ok: false, error: `The API returned ${error.status}: ${error.message}` };
		return { ok: false, error: 'Couldn’t reach the model (timeout or network).' };
	}
}
