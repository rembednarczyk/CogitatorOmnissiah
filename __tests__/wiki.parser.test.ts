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

    it('takes both fields from the latest edition and does not backfill series from an older one', () => {
      // Design decision: the latest edition is authoritative. The 2022 edition (Rebis)
      // has a publisher but an empty series — the series from the 1989 edition must NOT be backfilled.
      const wikitext = `
        {{tabela wydania
        |informacja1={{infowydanie|wydawca= klubówka |seria= Wielkie Serie SF|isbn= }}
        |informacja3={{infowydanie|wydawca= Rebis|seria= |isbn= 9788381885492}}
        }}
      `;
      const result = WikiParser.extractPublisherAndSeries(wikitext);
      expect(result.wydawca).toBe('Rebis');
      expect(result.seria).toBe('');
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

    it('ignores empty parameters like "redaktor = " (space before newline)', () => {
      const wikitext = '{{Książka\n | autor           = Isaac Asimov\n | redaktor        = \n | autor okladki   = Chris Moore\n}}';
      expect(WikiParser.extractAuthor(wikitext)).toBe('Isaac Asimov');
    });

    it('does not truncate a {{sortname}} author at the first pipe', () => {
      // Regression: [^\n|]+ captured only "{{sortname" and the cleanup was dead.
      expect(WikiParser.extractAuthor('| autor = {{sortname|Ursula K.|Le Guin}}')).toBe('Ursula K. Le Guin');
    });

    it('resolves a {{Autor}} template author', () => {
      expect(WikiParser.extractAuthor('| autor = {{Autor|Jan Kowalski|1950}}')).toBe('Jan Kowalski');
    });

    it('resolves a piped wikilink author without leaking brackets', () => {
      expect(WikiParser.extractAuthor('| autor = [[Stanisław Lem|Lem, Stanisław]]')).toBe('Lem, Stanisław');
    });
  });

  describe('parseAwardTable', () => {
    it('parses an award wikitable into books with winner labelling', () => {
      const wikitext = `
{| class="wikitable"
|-
! Rok
! Autor
! Tytuł oryginalny
! Tytuł polski
|- style="background: #ccffcc"
| [[1961]] || [[Stanisław Lem]] || ''Solaris'' || Solaris
|}`;
      const books = WikiParser.parseAwardTable(wikitext, 'Nagroda Test');
      expect(books).toHaveLength(1);
      expect(books[0]).toEqual(expect.objectContaining({
        year: '1961', author: 'Stanisław Lem', originalTitle: 'Solaris',
        polishTitle: 'Solaris', award: 'Nagroda Test',
      }));
    });

    it('returns [] for empty wikitext', () => {
      expect(WikiParser.parseAwardTable('', 'Nagroda Hugo')).toEqual([]);
    });
  });

});
