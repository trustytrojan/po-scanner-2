import process from 'node:process';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { connectMongo, disconnectMongo } from './db/mongo.ts';

async function main() {
	try {
		await connectMongo();
		const app = createApp();
		const server = app.listen(config.port, () => {
			console.log(
				`Purchase order scanner listening on http://localhost:${config.port}`,
			);
		});

		const shutdown = async (signal: string) => {
			console.log(`Received ${signal}. Closing gracefully...`);
			await new Promise<void>((resolve) => {
				server.close(() => {
					console.log('HTTP server closed.');
					resolve();
				});
			});
			await disconnectMongo();
			process.exit(0);
		};

		process.on('SIGINT', () => {
			shutdown('SIGINT');
		});
		process.on('SIGTERM', () => {
			shutdown('SIGTERM');
		});
	} catch (error) {
		console.error('Failed to start server:', error);
		process.exit(1);
	}
}

await main();
