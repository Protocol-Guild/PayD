import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { tenantMiddleware } from './middleware/multi-tenant';
import { auditRequest } from './middleware/audit';
import { rateLimit } from './middleware/rate-limit';
import tenantsRouter from './routes/api/tenants';
import { getAuditLogger } from './services/audit.service';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(auditRequest);
app.use(tenantMiddleware);

app.use('/api/v1/tenants', tenantsRouter);

app.use(rateLimit({ points: 100, duration: 60, keyPrefix: 'rl:api' }));

app.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: Request, res: Response, _next: Function): void => {
  res.status(500).json({ error: 'Internal server error' });
});

process.on('SIGTERM', async () => {
  const auditLogger = getAuditLogger();
  await auditLogger.flush();
  process.exit(0);
});

process.on('SIGINT', async () => {
  const auditLogger = getAuditLogger();
  await auditLogger.flush();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
