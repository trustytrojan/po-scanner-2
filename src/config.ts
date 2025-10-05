import 'dotenv/config';
import process from 'node:process';

const DEFAULT_PORT = 4000;

export const config = {
	port: Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10),
	mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/po-scanner',
	mongoDbName: process.env.MONGODB_DB ?? 'po-scanner',
	mistralApiKey: process.env.MISTRAL_API_KEY
		?? process.env.MIXTRAL_API_KEY
		?? '',
	mistralApiUrl: process.env.MISTRAL_API_URL
		?? process.env.MIXTRAL_API_URL
		?? 'https://api.mistral.ai/v1',
	mistralOcrModel: process.env.MISTRAL_OCR_MODEL
		?? process.env.MIXTRAL_MODEL
		?? 'mistral-ocr-latest',
	mistralResponsesModel: process.env.MISTRAL_RESPONSES_MODEL
		?? 'mistral-large-latest',
};

export const isProduction = process.env.NODE_ENV === 'production';
