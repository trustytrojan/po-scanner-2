export interface Party {
	name: string;
	address: string;
	contact?: string;
	email?: string;
	phone?: string;
}

export interface PurchaseItem {
	name: string;
	description?: string;
	sku?: string;
	quantity: number;
	unitPrice: number;
	totalPrice?: number;
	currency?: string;
}

export interface PurchaseOrderCore {
	purchaseOrderNumber?: string;
	issueDate?: string;
	vendor: Party;
	purchaser: Party;
	items: PurchaseItem[];
	subtotal?: number;
	tax?: number;
	total: number;
	currency?: string;
	notes?: string;
}

export interface PurchaseOrderRecord extends PurchaseOrderCore {
	_id?: string;
	createdAt: Date;
	sourceFileName: string;
	rawText: string;
	updatedAt?: Date;
}
