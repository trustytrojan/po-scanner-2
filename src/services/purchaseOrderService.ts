import type { Buffer } from 'node:buffer';
import { purchaseOrderSchema } from '../utils/schema.ts';
import { requestPurchaseOrderExtraction } from './mistralDocumentClient.ts';
import { requestStructuredPurchaseOrder } from './mistralResponsesClient.ts';
import { getPurchaseOrdersCollection } from '../db/mongo.ts';
import type { PurchaseOrderRecord } from '../types/purchaseOrder.ts';

const MAX_PDF_BYTES = 20 * 1024 * 1024;

interface ProcessParams {
	buffer: Buffer;
	fileName: string;
	fileSize: number;
	mimeType: string;
}

function throwBadRequest(message: string): never {
	const error = new Error(message);
	(error as any).status = 400;
	throw error;
}

function assertPdfInput({ fileSize, mimeType }: ProcessParams): void {
	if (!mimeType?.toLowerCase().includes('pdf'))
		throwBadRequest('Only PDF uploads are supported.');

	if (fileSize > MAX_PDF_BYTES)
		throwBadRequest('PDF exceeds the 20 MB size limit allowed by Mistral.');

	if (fileSize <= 0)
		throwBadRequest('Uploaded PDF appears to be empty.');
}

export async function processPurchaseOrder(
	params: ProcessParams,
): Promise<PurchaseOrderRecord> {
	assertPdfInput(params);

	const { buffer, fileName } = params;
	const extraction = await requestPurchaseOrderExtraction(buffer);
	let parsedOrder;
	if (extraction.annotation) {
		try {
			parsedOrder = purchaseOrderSchema.parse(extraction.annotation);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn('[Mistral annotation validation failed]', message);
		}
	}

	if (!parsedOrder) {
		parsedOrder = await requestStructuredPurchaseOrder(
			extraction.rawText ?? '',
		);
	}

	const record: PurchaseOrderRecord = {
		...parsedOrder,
		createdAt: new Date(),
		sourceFileName: fileName,
		rawText: extraction.rawText?.trim() ?? '',
	};

	const collection = getPurchaseOrdersCollection();
	const { insertedId } = await collection.insertOne(record);

	return {
		...record,
		_id: insertedId.toString(),
	};
}

export async function listPurchaseOrders(): Promise<PurchaseOrderRecord[]> {
	const collection = getPurchaseOrdersCollection();
	const records = await collection
		.find({})
		.sort({ createdAt: -1 })
		.limit(200)
		.toArray();

	return records.map((record: PurchaseOrderRecord) => ({
		...record,
		_id: record._id?.toString(),
	}));
}
