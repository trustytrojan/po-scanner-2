import type { Buffer } from 'node:buffer';
import { Collection, ObjectId } from 'mongodb';
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

function sanitizeForUpdate(value: unknown): unknown {
	if (value === null || value === undefined)
		return undefined;

	if (Array.isArray(value)) {
		const sanitizedItems = value
			.map((entry) => sanitizeForUpdate(entry))
			.filter((entry): entry is unknown => entry !== undefined);
		return sanitizedItems;
	}

	if (value instanceof Date)
		return value;

	if (typeof value === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
			const sanitizedEntry = sanitizeForUpdate(entry);
			if (sanitizedEntry !== undefined)
				result[key] = sanitizedEntry;
		}
		return result;
	}

	return value;
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

export async function updatePurchaseOrder(
	id: string,
	payload: unknown,
): Promise<PurchaseOrderRecord> {
	if (typeof id !== 'string' || id.trim().length === 0)
		throwBadRequest('Purchase order id is invalid.');

	if (!payload || typeof payload !== 'object')
		throwBadRequest('Request body must be a JSON object.');

	const sanitizedPayload = sanitizeForUpdate(payload) as Record<string, unknown>;

	const {
		_id: _ignoredId,
		createdAt: _ignoredCreatedAt,
		updatedAt: _ignoredUpdatedAt,
		rawText,
		sourceFileName,
		...orderFields
	} = sanitizedPayload;

	let parsedOrder;
	try {
		parsedOrder = purchaseOrderSchema.parse(orderFields);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Invalid payload.';
		throwBadRequest(message);
	}

	const normalizedOrder: Record<string, unknown> = {
		...parsedOrder,
		updatedAt: new Date(),
	};

	if (typeof rawText === 'string')
		normalizedOrder.rawText = rawText.trim();

	if (typeof sourceFileName === 'string' && sourceFileName.trim().length > 0)
		normalizedOrder.sourceFileName = sourceFileName.trim();

	if ('_id' in normalizedOrder)
		delete (normalizedOrder as Record<string, unknown>)._id;

	const updateDocument = sanitizeForUpdate(normalizedOrder) as Record<string, unknown>;

	const collection = getPurchaseOrdersCollection() as unknown as Collection<Record<string, unknown>>;

	const filters: Record<string, unknown>[] = [
		{ _id: id },
	];

	if (ObjectId.isValid(id))
		filters.unshift({ _id: new ObjectId(id) });

	const filter = filters.length === 1 ? filters[0] : { $or: filters };

	const result = await collection.findOneAndUpdate(
		filter,
		{ $set: updateDocument },
		{ returnDocument: 'after', includeResultMetadata: true },
	);

	const value = result?.value ?? null;

	if (!value) {
		const error = new Error(`Purchase order ${id} was not found.`);
		(error as any).status = 404;
		throw error;
	}

	const updatedRecord = value as unknown as Record<string, unknown> & {
		_id: ObjectId | string;
	};

	return {
		...updatedRecord,
		_id: typeof updatedRecord._id === 'string'
			? updatedRecord._id
			: updatedRecord._id.toString(),
	} as PurchaseOrderRecord;
}
