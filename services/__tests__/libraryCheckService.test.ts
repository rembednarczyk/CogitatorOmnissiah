// @vitest-environment node
import { fakeConfig } from "./testConfig";
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import axios from 'axios';
import { LibraryCheckService } from '../libraryCheckService';
import { NotionAdapter } from '../../notion.adapter';

const mockedGet = axios.get as unknown as ReturnType<typeof vi.fn>;

// Odwzorowanie realnej struktury OPAC (Prolib Integro): <article> + <dl> + ikona typu.
const ICON = { book: 'pdt-p-book', movie: 'pdt-p-movie', audiobook: 'pdt-p-audiobook' } as const;
const article = (id: string, title: string, author: string, icon: keyof typeof ICON) => `
<article data-item-id="${id}" data-type="cataloged" class="fixed-height-article">
  <dl class="dl-horizontal">
    <dt>Tytuł:</dt><dd><span class="">${title} </span><br /></dd>
    ${author ? `<dt>Autorzy:</dt><dd><span class=""><a href="#">${author}</a></span><br /></dd>` : ''}
    <dt>Rok wydania:</dt><dd><span class="">2014</span></dd>
  </dl>
  <div class="document-type document-type-result-list "><span class="${ICON[icon]}"></span><div class="document-type-text ">x</div></div>
</article>`;
const opacPage = (...articles: string[]) => `<div class="result-box">${articles.join('')}</div>`;
const OPAC_MISS = `<div class="result-box"></div>`;

function makeNotion(books: any[]) {
  return { getBooksForStats: vi.fn().mockResolvedValue(books) } as unknown as NotionAdapter;
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

    await new LibraryCheckService(notion, fakeConfig).runLibraryCheck('48', sendEvent, never);

    expect(mockedGet).toHaveBeenCalledTimes(1); // only book #1 is a valid candidate
    const complete = sendEvent.mock.calls.map((c: any) => c[0]).find((e: any) => e.type === 'complete');
    expect(complete?.result.success).toBe(true);
    expect(complete?.result.results).toHaveLength(0);
  });

  it('matches a physical book and ignores the film/audiobook of the same title', async () => {
    const notion = makeNotion([{ id: '1', plTitle: 'Solaris', author: 'Stanisław Lem', zrodlo: [] }]);
    mockedGet.mockResolvedValue({
      data: opacPage(
        article('a', 'Solaris', '', 'movie'),                     // film — ignorowany
        article('b', 'Solaris', 'Lem, Stanisław', 'audiobook'),   // audiobook — ignorowany
        article('c', 'Solaris', 'Lem, Stanisław (1921-2006)', 'book'), // książka — TO trafienie
      ),
    });

    await new LibraryCheckService(notion, fakeConfig).runLibraryCheck('48', sendEvent, never);

    const match = sendEvent.mock.calls.map((c: any) => c[0]).find((e: any) => e.type === 'match');
    expect(match).toBeDefined();
    expect(match.result.id).toBe('1');
    expect(match.result.extractedTitle).toBe('Solaris');
    expect(match.result.extractedAuthor).toContain('Lem');
  });

  it('reports no match when only other media / other titles are held (real "Gra o tron" case)', async () => {
    const notion = makeNotion([{ id: '1', plTitle: 'Gra o tron', author: 'George R. R. Martin', zrodlo: [] }]);
    mockedGet.mockResolvedValue({
      data: opacPage(
        article('a', 'Gra o tron', 'Martin, George R. R. (1948- )', 'audiobook'), // audiobook — nie liczy się
        article('b', 'Game of thrones. Sezon 1 = Gra o tron', '', 'movie'),        // film
        article('c', 'Rycerz Siedmiu Królestw', 'Martin, George R. R. (1948- )', 'book'), // inna książka Martina
      ),
    });

    await new LibraryCheckService(notion, fakeConfig).runLibraryCheck('48', sendEvent, never);

    const match = sendEvent.mock.calls.map((c: any) => c[0]).find((e: any) => e.type === 'match');
    expect(match).toBeUndefined();
    const complete = sendEvent.mock.calls.map((c: any) => c[0]).find((e: any) => e.type === 'complete');
    expect(complete.result.results).toHaveLength(0);
  });

  it('reports cancellation without throwing', async () => {
    const notion = makeNotion([{ id: '1', plTitle: 'Solaris', author: 'Stanisław Lem', zrodlo: [] }]);
    mockedGet.mockResolvedValue({ data: OPAC_MISS });

    await new LibraryCheckService(notion, fakeConfig).runLibraryCheck('48', sendEvent, () => true);

    expect(mockedGet).not.toHaveBeenCalled();
    const complete = sendEvent.mock.calls.map((c: any) => c[0]).find((e: any) => e.type === 'complete');
    expect(complete?.result.cancelled).toBe(true);
  });
});
