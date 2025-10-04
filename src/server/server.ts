/**
 * Express Server for Medica Scientifica Simulator
 * Serves React frontend and handles simulation API requests
 */

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { handleSimulate } from './api/simulationRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // For large simulation results

// API Routes
app.post('/api/simulate', handleSimulate);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'medica-scientifica-simulator' });
});

// Serve React static files (production)
const clientPath = join(__dirname, '../../dist/client');
app.use(express.static(clientPath));

// Serve index.html for all other routes (SPA fallback)
// Use a middleware instead of route to avoid path-to-regexp issues
app.use((_req: Request, res: Response) => {
  res.sendFile(join(clientPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Medica Scientifica Simulator running at http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🎯 Ready to run simulations!`);
});

export default app;
