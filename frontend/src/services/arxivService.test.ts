import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchArxiv, parseArxivXml, testArxivConnection } from './arxivService';

// Sample arXiv XML response for testing
const sampleArxivXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <title>ArXiv Query: search_query=all:transformer</title>
  <id>http://arxiv.org/api/query</id>
  <updated>2024-01-15T00:00:00-05:00</updated>
  <opensearch:totalResults xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">100</opensearch:totalResults>
  <opensearch:startIndex xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">0</opensearch:startIndex>
  <opensearch:itemsPerPage xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">1</opensearch:itemsPerPage>
  <entry>
    <id>http://arxiv.org/abs/1706.03762v7</id>
    <updated>2023-08-02T00:49:56Z</updated>
    <published>2017-06-12T17:57:34Z</published>
    <title>Attention Is All You Need</title>
    <summary>The dominant sequence transduction models are based on complex recurrent or
convolutional neural networks that include an encoder and a decoder.</summary>
    <author>
      <name>Ashish Vaswani</name>
    </author>
    <author>
      <name>Noam Shazeer</name>
    </author>
    <author>
      <name>Niki Parmar</name>
    </author>
    <link href="http://arxiv.org/abs/1706.03762v7" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/1706.03762v7" rel="related" type="application/pdf"/>
    <arxiv:primary_category xmlns:arxiv="http://arxiv.org/schemas/atom" term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>`;

// Empty results XML
const emptyArxivXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ArXiv Query: search_query=all:xyznonexistent123</title>
  <id>http://arxiv.org/api/query</id>
  <updated>2024-01-15T00:00:00-05:00</updated>
  <opensearch:totalResults xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">0</opensearch:totalResults>
</feed>`;

describe('arxivService', () => {
  describe('parseArxivXml', () => {
    it('correctly extracts paper data from XML', () => {
      const papers = parseArxivXml(sampleArxivXml);

      expect(papers).toHaveLength(1);
      expect(papers[0]).toMatchObject({
        id: '1706.03762v7',
        arxivId: '1706.03762v7',
        title: 'Attention Is All You Need',
        source: 'arXiv',
        year: 2017,
      });
      expect(papers[0].authors).toContain('Ashish Vaswani');
      expect(papers[0].authors).toContain('Noam Shazeer');
      expect(papers[0].authors).toHaveLength(3);
      expect(papers[0].abstract).toContain('dominant sequence transduction');
      expect(papers[0].pdfUrl).toBe('http://arxiv.org/pdf/1706.03762v7');
      expect(papers[0].url).toBe('http://arxiv.org/abs/1706.03762v7');
      expect(papers[0].categories).toContain('cs.CL');
      expect(papers[0].categories).toContain('cs.LG');
    });

    it('returns empty array for empty results', () => {
      const papers = parseArxivXml(emptyArxivXml);
      expect(papers).toHaveLength(0);
    });

    it('throws error for invalid XML', () => {
      expect(() => parseArxivXml('not valid xml <>')).toThrow();
    });
  });

  describe('searchArxiv', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('returns empty array for empty query', async () => {
      const results = await searchArxiv('');
      expect(results).toHaveLength(0);
    });

    it('returns empty array for whitespace query', async () => {
      const results = await searchArxiv('   ');
      expect(results).toHaveLength(0);
    });

    it('calls arXiv API with correct URL format', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleArxivXml),
      });
      vi.stubGlobal('fetch', mockFetch);

      await searchArxiv('transformer');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://export.arxiv.org/api/query')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search_query=all%3Atransformer')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('max_results=20')
      );
    });

    it('returns Paper objects from API response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleArxivXml),
      });
      vi.stubGlobal('fetch', mockFetch);

      const papers = await searchArxiv('transformer');

      expect(papers).toHaveLength(1);
      expect(papers[0].title).toBe('Attention Is All You Need');
    });

    it('respects maxResults option', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(sampleArxivXml),
      });
      vi.stubGlobal('fetch', mockFetch);

      await searchArxiv('transformer', { maxResults: 50 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('max_results=50')
      );
    });

    it('throws error on API failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(searchArxiv('transformer')).rejects.toThrow('arXiv API error');
    });

    it('throws error on network failure', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      await expect(searchArxiv('transformer')).rejects.toThrow('Network error');
    });
  });

  describe('testArxivConnection', () => {
    it('returns true when API is reachable', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const result = await testArxivConnection();
      expect(result).toBe(true);
    });

    it('returns false when API is unreachable', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const result = await testArxivConnection();
      expect(result).toBe(false);
    });
  });
});
