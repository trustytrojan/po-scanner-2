import { z } from 'zod';

const numberLike = z
	.union([z.number(), z.string()])
	.transform((value): number => {
		if (typeof value === 'number')
			return value;

		const sanitized = value.replace(/[^0-9+\-.,]/g, '').replace(',', '.');
		const parsed = Number.parseFloat(sanitized);

		if (Number.isNaN(parsed))
			throw new Error(`Unable to parse numeric value from "${value}".`);

		return parsed;
	});

const partySchema = z.object({
	name: z.string().min(1, 'Vendor or purchaser name is required.'),
	address: z.string().min(1, 'Address is required.'),
	contact: z.string().optional(),
	email: z.string().email().optional(),
	phone: z.string().optional(),
});

const itemSchema = z.object({
	name: z.string().min(1, 'Item name is required.'),
	description: z.string().optional(),
	sku: z.string().optional(),
	quantity: numberLike.refine(
		(value: number) => value >= 0,
		'Quantity must be non-negative.',
	),
	unitPrice: numberLike.refine(
		(value: number) => value >= 0,
		'Unit price must be non-negative.',
	),
	totalPrice: numberLike.optional(),
	currency: z.string().optional(),
});

export const purchaseOrderSchema = z.object({
	purchaseOrderNumber: z.string().optional(),
	issueDate: z.string().optional(),
	vendor: partySchema,
	purchaser: partySchema,
	items: z.array(itemSchema).min(1, 'At least one item is required.'),
	subtotal: numberLike.optional(),
	tax: numberLike.optional(),
	total: numberLike,
	currency: z.string().optional(),
	notes: z.string().optional(),
});

export type PurchaseOrderSchema = z.infer<typeof purchaseOrderSchema>;
