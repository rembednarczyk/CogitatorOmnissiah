import { describe, it, expect } from 'vitest';
import { WikiParser } from '../wiki.parser';

describe('WikiParser', () => {
  describe('cleanWikitext', () => {
    it('cleans wikitext formatting', () => {
      expect(WikiParser.cleanWikitext('[[Link|Text]]')).toBe('Text');
      expect(WikiParser.cleanWikitext('{{sortname|John|Doe}}')).toBe('John Doe');
      expect(WikiParser.cleanWikitext("''Italic''")).toBe('Italic');
    });
  });

  describe('extractPublisherAndSeries', () => {
    it('extracts publisher and series from wikitext', () => {
      const wikitext = `
        {{Książka
        |autor = Stanisław Lem
        |tytuł = Solaris
        |wydawca = Wydawnictwo Literackie
        |seria = Dzieła
        }}
      `;
      const result = WikiParser.extractPublisherAndSeries(wikitext);
      expect(result.wydawca).toBe('Wydawnictwo Literackie');
      expect(result.seria).toBe('Dzieła');
    });

    it('handles missing series', () => {
      const wikitext = `
        {{Książka
        |wydawca = Iskry
        }}
      `;
      const result = WikiParser.extractPublisherAndSeries(wikitext);
      expect(result.wydawca).toBe('Iskry');
      expect(result.seria).toBe('');
    });

    it('handles missing publisher', () => {
      const wikitext = `
        {{Książka
        |seria = Fantastyka-Przygoda
        }}
      `;
      const result = WikiParser.extractPublisherAndSeries(wikitext);
      expect(result.wydawca).toBe('');
      expect(result.seria).toBe('Fantastyka-Przygoda');
    });

    it('resolves piped wiki links instead of truncating them', () => {
      const wikitext = `
        {{Książka
        |autor = Frank Herbert
        |wydawca = [[Zysk i S-ka|Zysk]]
        |seria = [[Kameleon (seria)|Kameleon]]
        }}
      `;
      const result = WikiParser.extractPublisherAndSeries(wikitext);
      expect(result.wydawca).toBe('Zysk');
      expect(result.seria).toBe('Kameleon');
    });

    it('extracts piped links from infowydanie with priority over {{Książka}}', () => {
      const wikitext = `
        {{Książka
        |wydawca = Stare Wydawnictwo
        }}
        {{tabela wydania
        |informacja1 = {{infowydanie |rok= 1999 |wydawca= [[Prószyński i S-ka|Prószyński]] |seria= Klasyka}}
        }}
      `;
      const result = WikiParser.extractPublisherAndSeries(wikitext);
      expect(result.wydawca).toBe('Prószyński');
      expect(result.seria).toBe('Klasyka');
    });

    it('does not match wydawca inside współwydawca', () => {
      const wikitext = `
        {{tabela wydania
        |informacja1 = {{infowydanie |współwydawca= Niewłaściwy |rok= 2000}}
        }}
      `;
      const result = WikiParser.extractPublisherAndSeries(wikitext);
      expect(result.wydawca).toBe('');
    });
  });

  describe('extractAuthor', () => {
    it('extracts author from infobox', () => {
      const wikitext = `
        {{Książka
        |autor = [[Stanisław Lem]]
        }}
      `;
      expect(WikiParser.extractAuthor(wikitext)).toBe('Stanisław Lem');
    });
  });

  describe('checkCycle', () => {
    it('detects cycle from parameters', () => {
      expect(WikiParser.checkCycle('| cykl = Fundacja')).toBe(true);
      expect(WikiParser.checkCycle('| seria = Diuna')).toBe(true);
    });

    it('detects cycle from templates', () => {
      expect(WikiParser.checkCycle('{{Cykl | nazwa = Wiedźmin}}')).toBe(true);
    });

    it('returns false when no cycle is present', () => {
      expect(WikiParser.checkCycle('{{Książka | autor = Lem}}')).toBe(false);
    });
  });
});
