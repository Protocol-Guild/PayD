import request from 'supertest';
import express from 'express';
import cspReportRoutes from '../cspReport.routes.js';
import logger from '../../utils/logger.js';

const app = express();
app.use('/api/csp-report', cspReportRoutes);

describe('CSP report routes', () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('accepts a classic application/csp-report envelope without authentication', async () => {
    const res = await request(app)
      .post('/api/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(
        JSON.stringify({
          'csp-report': {
            'document-uri': 'https://payd.example/payroll',
            'violated-directive': 'script-src',
            'blocked-uri': 'https://evil.example/x.js',
            'source-file': 'https://payd.example/bundle.js',
            'line-number': 42,
          },
        })
      );

    expect(res.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledWith(
      'CSP violation reported',
      expect.objectContaining({
        documentUri: 'https://payd.example/payroll',
        violatedDirective: 'script-src',
        blockedUri: 'https://evil.example/x.js',
        sourceFile: 'https://payd.example/bundle.js',
        lineNumber: 42,
      })
    );
  });

  it('accepts application/json content type too', async () => {
    const res = await request(app)
      .post('/api/csp-report')
      .set('Content-Type', 'application/json')
      .send({
        'csp-report': {
          'document-uri': 'https://payd.example/',
          'violated-directive': 'style-src',
          'blocked-uri': 'inline',
        },
      });

    expect(res.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('handles a malformed report body without crashing the process', async () => {
    const res = await request(app)
      .post('/api/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send('not json at all {{{');

    // The body-parser rejects unparsable JSON with a 400 (standard, not a
    // crash); a report with a recognizable shape but missing/odd fields is
    // still recorded gracefully (see the empty-object case below).
    expect(res.status).toBe(400);
  });

  it('records a report with an unrecognized shape using placeholder fields, without crashing', async () => {
    const res = await request(app)
      .post('/api/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(JSON.stringify({ unexpected: 'shape' }));

    expect(res.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledWith(
      'CSP violation reported',
      expect.objectContaining({ documentUri: 'unknown', violatedDirective: 'unknown' })
    );
  });

  it('deduplicates identical directive+blocked-uri reports within the window', async () => {
    const report = {
      'csp-report': {
        'document-uri': 'https://payd.example/',
        'violated-directive': 'img-src',
        'blocked-uri': 'https://tracker.example/pixel.gif',
      },
    };

    await request(app)
      .post('/api/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(JSON.stringify(report));
    await request(app)
      .post('/api/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(JSON.stringify(report));

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('lists recently recorded violations for review', async () => {
    await request(app)
      .post('/api/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(
        JSON.stringify({
          'csp-report': {
            'document-uri': 'https://payd.example/list-me',
            'violated-directive': 'connect-src',
            'blocked-uri': 'https://other.example/api',
          },
        })
      );

    const res = await request(app).get('/api/csp-report');
    expect(res.status).toBe(200);
    expect(res.body.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentUri: 'https://payd.example/list-me' }),
      ])
    );
  });
});
