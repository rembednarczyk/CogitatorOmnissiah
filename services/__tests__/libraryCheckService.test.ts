// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import axios from 'axios';
import { LibraryCheckService } from '../libraryCheckService';
import { NotionAdapter } from '../../notion.adapter';

const mockedGet = axios.get as unknown as ReturnType<typeof vi.fn>;

const OPAC_HIT = `
<html><body>
  <div class="record">
    <dl>
      <dt>Tytuł:</dt><dd><span>Solaris</span></dd>
      <dt>Autor:</dt><dd><span>Stanisław Lem</span></dd>
    </dl>
  </div>
</body></html>`;

const OPAC_MISS = `<html><body><p>Brak wyników</p></body></html>`;

function makeNotion(books: any[]) {
  return {
    getBooksForStats: vi.fn().mockResolvedValue(books),
  } as unknown as NotionAdapter;
}

describe('LibraryCheckService', () => {
  let sendEvent: any;
  const never = () => false;

  beforeEach(() => {
    vi.clearAllMocks();
    sendEvent = vi.fn();
  });

  it('skips books already owned/read and only scans real candidates', async () => {
    const notion = makeNotion([
      { id: '1', plTitle: 'Solaris', author: 'Stanisław Lem', zrodlo: [] },
      { id: '2', plTitle: 'Diuna', author: 'Frank Herbert', zrodlo: ['Przeczytane'] },
      { id: '3', plTitle: '', author: 'Nikt', zrodlo: [] },
    ]);
    mockedGet.mockResolvedValue({ data: OPAC_MISS });

    const svc = new LibraryCheckService(notion);
    await svc.runLibraryCheck('LUB01', sendEvent, never);

    // Only book #1 is a valid candidate (2 is read, 3 has empty title)
    expect(mockedGet).toHaveBeenCalledTimes(1);
    const complete = sendEvent.mock.calls.map((c: any) => c[0]).find((e: any) => e.type === 'complete');
    expect(complete?.result.success).toBe(true);
    expect(complete?.result.results).toHaveLength(0);
  });

  it('emits a match when OPAC returns a matching record', async () => {
    const notion = makeNotion([
      { id: '1', plTitle: 'Solaris', author: 'Stanisław Lem', zrodlo: [] },
    ]);
    mockedGet.mockResolvedValue({ data: OPAC_HIT });

    const svc = new LibraryCheckService(notion);
    await svc.runLibraryCheck('LUB01', sendEvent, never);

    const match = sendEvent.mock.calls.map((c: any) => c[0]).find((e: any) => e.type === 'match');
    expect(match).toBeDefined();
    expect(match.result.id).toBe('1');
    expect(match.result.extractedTitle).toBe('Solaris');
  });

  it('reports cancellation without throwing', async () => {
    const notion = makeNotion([
      { id: '1', plTitle: 'Solaris', author: 'Stanisław Lem', zrodlo: [] },
    ]);
    mockedGet.mockResolvedValue({ data: OPAC_MISS });

    const svc = new LibraryCheckService(notion);
    await svc.runLibraryCheck('LUB01', sendEvent, () => true);

    // Cancelled before the first request → no HTTP call, complete reports cancelled
    expect(mockedGet).not.toHaveBeenCalled();
    const complete = sendEvent.mock.calls.map((c: any) => c[0]).find((e: any) => e.type === 'complete');
    expect(complete?.result.cancelled).toBe(true);
  });
});
