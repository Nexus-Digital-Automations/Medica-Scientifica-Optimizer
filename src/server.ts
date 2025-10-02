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
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // API: Start optimization with SSE progress updates
  if (req.url === '/api/optimize' && req.method === 'POST') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    try {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        const requestData = body ? JSON.parse(body) : { config: DEFAULT_GA_CONFIG };
        const config = requestData.config || DEFAULT_GA_CONFIG;

        // FORCE custom pricing and demand parameters into fixedParams (market conditions, not optimizable)
        const fixedParams = {
          ...(config.fixedParams || {}),
          customBasePrice: 106.56,      // From historical regression baseline at 5-day target
          customPenaltyPerDay: 0.27,    // From historical regression slope
          customTargetDeliveryDays: 5,  // Data-driven optimal premium service target
          customDemandMean1: 25,        // Phase 1 (days 51-172) mean demand
          customDemandStdDev1: 5,       // Phase 1 standard deviation
          customDemandMean2: 32.5,      // Phase 2 (days 173-400) mean demand
          customDemandStdDev2: 6.5,     // Phase 2 standard deviation
        };

        // Remove custom pricing and demand from variableParams if present (cannot be optimized)
        const variableParams = config.variableParams ? {
          ...config.variableParams,
          customBasePrice: undefined,
          customPenaltyPerDay: undefined,
          customTargetDeliveryDays: undefined,
          customDemandMean1: undefined,
          customDemandStdDev1: undefined,
          customDemandMean2: undefined,
          customDemandStdDev2: undefined,
        } : undefined;

        const startingState = requestData.startingState;
        const demandForecast = requestData.demandForecast;

        console.log('🚀 Starting optimization with config:', config);
        if (startingState) {
          console.log('📍 Starting from custom state at day:', startingState.currentDay);
        }
        if (demandForecast) {
          console.log('📈 Using custom demand forecast with', demandForecast.length, 'data points');
        }
        if (fixedParams && Object.keys(fixedParams).length > 0) {
          console.log('🔒 Fixed parameters (hard constraints):', fixedParams);
        }
        if (variableParams && Object.keys(variableParams).length > 0) {
          console.log('🔄 Variable parameters (seeds for optimization):', variableParams);
        }

        const result = await optimize(
          config,
          (generation, stats) => {
            // Send progress update via SSE
            const progressData = {
              type: 'progress',
              generation,
              totalGenerations: config.generations,
              bestFitness: stats.bestFitness,
              avgFitness: stats.avgFitness,
              progress: (generation / config.generations) * 100,
            };
            res.write(`data: ${JSON.stringify(progressData)}\n\n`);
          },
          startingState,
          demandForecast,
          fixedParams,
          variableParams
        );

        // Send final result
        const finalData = {
          type: 'complete',
          result,
        };
        res.write(`data: ${JSON.stringify(finalData)}\n\n`);
        res.end();
      });
    } catch (error) {
      console.error('Optimization error:', error);
      const errorData = {
        type: 'error',
        error: 'Optimization failed',
      };
      res.write(`data: ${JSON.stringify(errorData)}\n\n`);
      res.end();
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
