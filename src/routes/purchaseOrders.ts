import { Router } from 'express';
import multer from 'multer';
import {
	listPurchaseOrders,
	processPurchaseOrder,
} from '../services/purchaseOrderService.ts';

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 20 * 1024 * 1024 },
});

export const purchaseOrdersRouter = Router();

purchaseOrdersRouter.get('/', async (_req: any, res: any, next: any) => {
	try {
		const records = await listPurchaseOrders();
		res.json(records);
	} catch (error) {
		next(error);
	}
});

purchaseOrdersRouter.post(
	'/upload',
	upload.single('file'),
	async (req: any, res: any, next: any) => {
		try {
			if (!req.file) {
				res.status(400).json({ message: 'No PDF uploaded' });
				return;
			}

			const record = await processPurchaseOrder({
				buffer: req.file.buffer,
				fileName: req.file.originalname,
				fileSize: req.file.size,
				mimeType: req.file.mimetype,
			});

			res.status(201).json(record);
		} catch (error) {
			next(error);
		}
	},
);
