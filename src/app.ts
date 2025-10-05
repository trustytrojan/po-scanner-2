import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { purchaseOrdersRouter } from './routes/purchaseOrders.ts';

export function createApp() {
	const app = express();

	app.use(express.json({ limit: '2mb' }));

	const currentFile = fileURLToPath(import.meta.url);
	const frontendDir = path.resolve(path.dirname(currentFile), '../frontend');

	app.get('/api/health', (_req: any, res: any) => {
		res.json({ status: 'ok' });
	});

	app.use('/api/purchase-orders', purchaseOrdersRouter);
	app.use(express.static(frontendDir));

	app.use((error: any, _req: any, res: any, _next: any) => {
		console.error('[ERROR]', error);
		const status = error?.status ?? 500;
		res.status(status).json({
			message: error?.message ?? 'Unexpected server error',
		});
	});

	return app;
}
