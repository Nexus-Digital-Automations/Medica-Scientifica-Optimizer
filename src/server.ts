/**
 * Simple HTTP server for Medica Scientifica Optimizer
 * Serves the web UI and handles optimization requests
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize, DEFAULT_GA_CONFIG } from './optimizer/geneticAlgorithm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = 3000;

const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Serve HTML UI
  if (req.url === '/' || req.url === '/index.html') {
    try {
      const html = await readFile(join(__dirname, '../public/index.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // API: Start optimization
  if (req.url === '/api/optimize' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });

    try {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        const config = body ? JSON.parse(body) : DEFAULT_GA_CONFIG;

        console.log('🚀 Starting optimization with config:', config);

        const result = await optimize(config, (generation, stats) => {
          // Could send progress updates via SSE in future
          if (generation % 10 === 0) {
            console.log(`Generation ${generation}: $${stats.bestFitness.toFixed(2)}`);
          }
        });

        res.end(JSON.stringify(result, null, 2));
      });
    } catch (error) {
      console.error('Optimization error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Optimization failed' }));
    }
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🚀 Medica Scientifica Optimizer server running at http://localhost:${PORT}`);
  console.log(`📊 Open your browser to start optimization`);
});
