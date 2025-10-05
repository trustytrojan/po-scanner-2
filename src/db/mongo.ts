import { Collection, Db, MongoClient } from 'mongodb';
import { config } from '../config.ts';
import type { PurchaseOrderRecord } from '../types/purchaseOrder.ts';

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectMongo(): Promise<Db> {
	if (database)
		return database;

	if (!config.mongoUri)
		throw new Error('MONGODB_URI is not configured');

	client = new MongoClient(config.mongoUri, {
		maxPoolSize: 10,
	});

	await client.connect();
	database = client.db(config.mongoDbName);
	return database;
}

export function getMongoClient(): MongoClient {
	if (!client) {
		throw new Error(
			'Mongo client not initialized. Call connectMongo() first.',
		);
	}
	return client;
}

export function getPurchaseOrdersCollection(): Collection<PurchaseOrderRecord> {
	if (!database) {
		throw new Error(
			'Mongo database not initialized. Call connectMongo() first.',
		);
	}
	return database.collection<PurchaseOrderRecord>('purchase_orders');
}

export async function disconnectMongo(): Promise<void> {
	if (client) {
		await client.close();
		client = null;
		database = null;
	}
}
