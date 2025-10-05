import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { purchaseOrderSchema } from '../src/utils/schema.ts';

describe('purchaseOrderSchema', () => {
	it('coerces numeric strings into numbers', () => {
		const result = purchaseOrderSchema.parse({
			vendor: { name: 'Vendor Co', address: '1 Supplier Way' },
			purchaser: { name: 'Buyer Inc', address: '2 Client Road' },
			items: [
				{ name: 'Widget', quantity: '5', unitPrice: '9.99' },
			],
			total: '49.95',
		});

		expect(result.items[0]?.quantity).toBe(5);
		expect(result.items[0]?.unitPrice).toBeCloseTo(9.99);
		expect(result.total).toBeCloseTo(49.95);
	});

	it('requires at least one item', () => {
		try {
			purchaseOrderSchema.parse({
				vendor: { name: 'Vendor Co', address: '1 Supplier Way' },
				purchaser: { name: 'Buyer Inc', address: '2 Client Road' },
				items: [],
				total: 0,
			});
			expect.fail('Expected parse to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(ZodError);
			const issue = (error as ZodError).issues[0];
			expect(issue?.message).toBe('At least one item is required.');
		}
	});
});
