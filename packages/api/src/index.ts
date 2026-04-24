import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { initSchema, closeDriver } from './db/neo4j';
import personsRouter from './routes/persons';
import relationshipsRouter from './routes/relationships';
import mediaRouter from './routes/media';
import treeRouter from './routes/tree';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/persons', personsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/tree', treeRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

async function start(): Promise<void> {
  try {
    await initSchema();
    app.listen(PORT, () => {
      console.log(`Taproot API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await closeDriver();
  process.exit(0);
});

start();
