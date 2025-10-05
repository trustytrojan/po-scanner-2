import { jsonrepair } from 'jsonrepair';
import { config } from '../config.ts';
import type { PurchaseOrderSchema } from '../utils/schema.ts';
import { purchaseOrderJsonSchema } from './mistralDocumentClient.ts';

interface ChatCompletionPayload {
	choices?: Array<{ message?: { content?: string } }>;
}

const SYSTEM_PROMPT = `You are a meticulous procurement analyst.

Return a JSON object that follows the provided schema exactly and captures
purchase order data from the supplied document text. Do not invent totals—use the
best numeric values you find and set missing numbers to null.`;

function buildPrompt(rawText: string): string {
	const snippet = rawText.slice(0, 12000);
	return `Document OCR text:\n\n${snippet}`;
}

export async function requestStructuredPurchaseOrder(
	rawText: string,
): Promise<PurchaseOrderSchema> {
	if (!config.mistralApiKey) {
		throw new Error(
			'Mistral API key is not configured. Set MISTRAL_API_KEY in your environment.',
		);
	}

	const baseUrl = config.mistralApiUrl.replace(/\/$/, '');
	const response = await fetch(`${baseUrl}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.mistralApiKey}`,
		},
		body: JSON.stringify({
			model: config.mistralResponsesModel,
			messages: [
				{
					role: 'system',
					content: SYSTEM_PROMPT,
				},
				{
					role: 'user',
					content: buildPrompt(rawText),
				},
			],
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'PurchaseOrder',
					schema: purchaseOrderJsonSchema,
				},
			},
			temperature: 0.1,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => '');
		throw new Error(
			`Mistral chat completions failed with status ${response.status}: ${errorText}`,
		);
	}

	const payload = (await response.json()) as ChatCompletionPayload;
	const text = payload.choices?.[0]?.message?.content;
	if (!text)
		throw new Error('Mistral chat completions did not return content.');

	let normalized = text.trim();
	try {
		return JSON.parse(normalized) as PurchaseOrderSchema;
	} catch (_error) {
		normalized = jsonrepair(normalized);
		return JSON.parse(normalized) as PurchaseOrderSchema;
	}
}
