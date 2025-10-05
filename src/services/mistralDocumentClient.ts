import { Buffer } from 'node:buffer';
import { jsonrepair } from 'jsonrepair';
import { config } from '../config.ts';

interface MistralOcrPage {
	markdown?: string;
	text?: string;
}

interface MistralOcrResponse {
	document_annotation?: unknown;
	pages?: MistralOcrPage[];
	usage?: Record<string, unknown>;
}

export const purchaseOrderJsonSchema = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	title: 'PurchaseOrder',
	type: 'object',
	description:
		'Normalized purchase order structure extracted from the PDF document.',
	required: ['vendor', 'purchaser', 'items', 'total'],
	additionalProperties: false,
	properties: {
		purchaseOrderNumber: {
			type: ['string', 'null'],
			description: 'Identifier assigned to the purchase order.',
		},
		issueDate: {
			type: ['string', 'null'],
			description: 'Original date the purchase order was issued.',
		},
		vendor: {
			type: 'object',
			required: ['name', 'address'],
			additionalProperties: false,
			properties: {
				name: {
					type: 'string',
					description: 'Legal or trading name of the vendor.',
				},
				address: {
					type: 'string',
					description: 'Mailing address for the vendor.',
				},
				contact: {
					type: ['string', 'null'],
					description:
						'Point of contact for the vendor (person or department).',
				},
				email: {
					type: ['string', 'null'],
					description: 'Email address supplied for the vendor.',
				},
				phone: {
					type: ['string', 'null'],
					description: 'Phone number listed for the vendor.',
				},
			},
		},
		purchaser: {
			type: 'object',
			required: ['name', 'address'],
			additionalProperties: false,
			properties: {
				name: {
					type: 'string',
					description: 'Organization or person placing the order.',
				},
				address: {
					type: 'string',
					description: 'Mailing address for the purchaser.',
				},
				contact: {
					type: ['string', 'null'],
					description:
						'Primary contact or department for the purchaser.',
				},
				email: {
					type: ['string', 'null'],
					description: 'Email address supplied for the purchaser.',
				},
				phone: {
					type: ['string', 'null'],
					description: 'Phone number listed for the purchaser.',
				},
			},
		},
		currency: {
			type: ['string', 'null'],
			description:
				'Currency code (ISO 4217 when available) that totals are denominated in.',
		},
		notes: {
			type: ['string', 'null'],
			description: 'Additional instructions or free-form notes.',
		},
		items: {
			type: 'array',
			description: 'Line items contained within the purchase order.',
			minItems: 1,
			items: {
				type: 'object',
				required: ['name', 'quantity', 'unitPrice'],
				additionalProperties: false,
				properties: {
					name: {
						type: 'string',
						description: 'Item name or SKU description.',
					},
					description: {
						type: ['string', 'null'],
						description: 'Detailed description of the item.',
					},
					sku: {
						type: ['string', 'null'],
						description: 'SKU or part number if present.',
					},
					quantity: buildNumericSchema(
						'Number of units ordered for the line item.',
					),
					unitPrice: buildNumericSchema(
						'Price per unit of the item.',
					),
					totalPrice: buildNumericSchema(
						'Extended line total (quantity × unit price).',
						{ allowNull: true },
					),
					currency: {
						type: ['string', 'null'],
						description: 'Currency applicable to the line item.',
					},
				},
			},
		},
		subtotal: buildNumericSchema(
			'Sum of line items before tax or adjustments.',
			{ allowNull: true },
		),
		tax: buildNumericSchema(
			'Total taxes applied to the purchase order.',
			{ allowNull: true },
		),
		total: buildNumericSchema(
			'Grand total expected to be paid.',
		),
	},
};

interface NumericSchemaOptions {
	allowNull?: boolean;
}

function buildNumericSchema(
	description: string,
	options: NumericSchemaOptions = {},
) {
	const baseTypes = options.allowNull
		? ['number', 'string', 'null']
		: ['number', 'string'];

	return {
		description,
		type: baseTypes,
	};
}

function buildDataUrl(buffer: Buffer): string {
	return `data:application/pdf;base64,${buffer.toString('base64')}`;
}

function buildAnnotationFormat() {
	return {
		type: 'json_schema',
		json_schema: {
			name: 'PurchaseOrder',
			description:
				'Purchase order schema guiding Mistral Document AI extraction.',
			schema: purchaseOrderJsonSchema,
		},
	};
}

function getOcrEndpoint(): string {
	const baseUrl = config.mistralApiUrl.replace(/\/$/, '');
	if (baseUrl.endsWith('/ocr'))
		return baseUrl;
	return `${baseUrl}/ocr`;
}

function parseAnnotationPayload(annotation: unknown): unknown {
	if (annotation == null)
		return undefined;

	if (typeof annotation === 'object') {
		const candidate = annotation as Record<string, unknown>;
		if (candidate.annotation)
			return parseAnnotationPayload(candidate.annotation);
		if (candidate.content)
			return parseAnnotationPayload(candidate.content);
	}

	if (typeof annotation === 'string') {
		const trimmed = annotation.trim();
		if (!trimmed)
			return undefined;
		try {
			return JSON.parse(trimmed);
		} catch (_error) {
			const repaired = jsonrepair(trimmed);
			return JSON.parse(repaired);
		}
	}

	return annotation;
}

function extractRawText(pages: MistralOcrPage[] | undefined): string {
	if (!Array.isArray(pages))
		return '';

	return pages
		.map((page) => page?.markdown?.trim() ?? page?.text?.trim() ?? '')
		.filter((value) => value.length > 0)
		.join('\n\n');
}

export interface MistralExtractionResult {
	annotation: unknown;
	rawText: string;
	usage?: Record<string, unknown>;
}

export async function requestPurchaseOrderExtraction(
	buffer: Buffer,
): Promise<MistralExtractionResult> {
	if (!config.mistralApiKey) {
		throw new Error(
			'Mistral API key is not configured. Set MISTRAL_API_KEY in your environment.',
		);
	}

	const response = await fetch(getOcrEndpoint(), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${config.mistralApiKey}`,
		},
		body: JSON.stringify({
			model: config.mistralOcrModel,
			document: {
				type: 'document_url',
				document_url: buildDataUrl(buffer),
			},
			document_annotation_format: buildAnnotationFormat(),
			include_image_base64: false,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => '');
		throw new Error(
			`Mistral OCR request failed with status ${response.status}: ${errorText}`,
		);
	}

	const payload = (await response.json()) as MistralOcrResponse & {
		document_annotations?: unknown[];
	};
	const annotationSource = payload.document_annotation
		?? payload.document_annotations?.[0];
	const annotation = parseAnnotationPayload(annotationSource);

	if (!annotation) {
		throw new Error(
			'Mistral OCR response did not contain a document annotation payload.',
		);
	}

	return {
		annotation,
		rawText: extractRawText(payload.pages),
		usage: payload.usage,
	};
}
