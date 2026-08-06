/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';

process.env.NODE_ENV = 'test';

import { app, closeServer } from '../server';

// Mocking adapters
vi.mock('../notion.adapter', () => {
  const NotionAdapter = vi.fn();
  NotionAdapter.prototype.init = vi.fn().mockResolvedValue(undefined);
  NotionAdapter.prototype.getSchema = vi.fn().mockResolvedValue({
    "Autor": { type: "multi_select", multi_select: { options: [] } }
  });
  NotionAdapter.prototype.updateSchema = vi.fn().mockResolvedValue(undefined);
  NotionAdapter.prototype.queryAllBooks = vi.fn().mockResolvedValue([]);
  NotionAdapter.prototype.updatePage = vi.fn().mockResolvedValue(undefined);
  NotionAdapter.prototype.addRow = vi.fn().mockResolvedValue({ id: 'new-page-id' });
  NotionAdapter.prototype.resolveDataSourceId = vi.fn().mockResolvedValue('test-ds-id');
  NotionAdapter.prototype.retrieveDataSource = vi.fn().mockResolvedValue({ properties: {} });
  NotionAdapter.prototype.updateDatabaseProperty = vi.fn().mockResolvedValue(undefined);
  NotionAdapter.prototype.createColumnIfNeeded = vi.fn().mockResolvedValue(undefined);
  NotionAdapter.prototype.updateLp = vi.fn().mockResolvedValue(undefined);
  return { NotionAdapter };
});

vi.mock('../wiki.adapter', () => {
  const WikiAdapter = vi.fn();
  WikiAdapter.prototype.fetchPageContent = vi.fn().mockResolvedValue('{| class="wikitable"\n|-\n! Rok !! Autor !! Tytuł oryginalny !! Tytuł polski\n|-\n| 1961 || [[Stanisław Lem]] || \'\'Solaris\'\' || Solaris\n|}');
  WikiAdapter.prototype.fetchPageContentWithSlots = vi.fn().mockResolvedValue('{{Książka|wydawca=Wydawnictwo Literackie|seria=Dzieła}}');
  return { WikiAdapter };
});

describe('Backend API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTION_API_KEY = 'test-key';
    process.env.NOTION_DATABASE_ID = 'test-db';
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', isSyncing: false });
  });

  it('GET /api/config returns environment status', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hasNotionKey', true);
    expect(res.body).toHaveProperty('hasDatabaseId', true);
  });

  it('GET /api/notion/schema returns properties', async () => {
    const res = await request(app).get('/api/notion/schema');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('Autor');
  });

  it('PATCH /api/notion/schema updates property', async () => {
    const res = await request(app)
      .patch('/api/notion/schema')
      .send({
        propertyName: 'Autor',
        propertyType: 'multi_select',
        newOptions: [{ name: 'Lem' }]
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('PATCH /api/notion/schema rejects a disallowed property type', async () => {
    const res = await request(app)
      .patch('/api/notion/schema')
      .send({ propertyName: 'Autor', propertyType: 'title', newOptions: [{ name: 'x' }] });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/notion/schema rejects malformed options', async () => {
    const res = await request(app)
      .patch('/api/notion/schema')
      .send({ propertyName: 'Autor', propertyType: 'multi_select', newOptions: "not-an-array" });
    expect(res.status).toBe(400);
  });

  it('POST /api/sync starts a sync stream', async () => {
    const res = await request(app)
      .post('/api/sync')
      .send({
        awardName: 'Nagroda Hugo',
        pageTitle: 'Hugo nagroda powieść',
        syncAll: false
      });
    
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/event-stream');
    // We don't wait for full stream completion in this simple test
  });

  it('POST /api/sync-duplicates starts a duplicate check stream', async () => {
    const res = await request(app)
      .post('/api/sync-duplicates')
      .send({});
    
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/event-stream');
  });

  it('POST /api/sync-duplicates/stop stops a duplicate check', async () => {
    const res = await request(app).post('/api/sync-duplicates/stop');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
  });

  afterAll(() => {
    closeServer();
  });
});
