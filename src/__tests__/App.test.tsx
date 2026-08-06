import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';
import React from 'react';

// Mocking SSE and fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('App Main Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default config response
    mockFetch.mockImplementation((url, options) => {
      if (url === '/api/config') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hasNotionKey: true, hasDatabaseId: true }),
        });
      }
      if (url.startsWith('/api/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authorStats: [{ name: "Lem", read: 1, total: 2, books: [] }],
            awardBooksStats: { read: 5, total: 10 },
            ownedUnread: [],
            awardCoverage: [{ name: "Hugo", count: 1, total: 2 }],
            allAwardsStats: { read: 1, total: 2 },
            yearlyStats: [],
            libraryStats: []
          }),
        });
      }
      if (url === '/api/notion/schema') {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            "Autor": { type: "multi_select", multi_select: { options: [{ name: "Lem" }, { name: "Dukaj" }] } },
            "Status": { type: "select", select: { options: [{ name: "Do przeczytania" }] } },
            "Nagrody": { type: "multi_select", multi_select: { options: [{ name: "Hugo" }] } }
          })),
          status: 200
        });
      }
      if (url === '/api/sync' && options?.method === 'POST') {
        const stream = new ReadableStream({
          start(controller) {
            (global as any).setLastStreamController(controller);
          }
        });
        return Promise.resolve({
          ok: true,
          body: stream
        });
      }
    if (url === '/api/sync-duplicates' && options?.method === 'POST') {
        const stream = new ReadableStream({
          start(controller) {
            (global as any).setLastStreamController(controller);
          }
        });
        return Promise.resolve({
          ok: true,
          body: stream
        });
      }
      if (url === '/api/vinted-check' && options?.method === 'POST') {
        const stream = new ReadableStream({
          start(controller) {
            (global as any).setLastStreamController(controller);
          }
        });
        return Promise.resolve({
          ok: true,
          body: stream
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders Status Ducha Maszyny and award links', async () => {
    render(<App />);
    
    const configTabButton = screen.getByRole('button', { name: /Liturgie Synchronizacji/i });
    await act(async () => {
      fireEvent.click(configTabButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Status Ducha Maszyny/i)).toBeInTheDocument();
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Pieczęć Przyłożona/i)).toBeInTheDocument();
      expect(screen.getByText(/Baza Zlokalizowana/i)).toBeInTheDocument();
    });

    // Check award links
    expect(screen.getByText('Hugo')).toHaveAttribute('href', expect.stringContaining('Hugo_nagroda_powie%C5%9B%C4%87'));
    expect(screen.getByText('Locus')).toHaveAttribute('href', expect.stringContaining('Locus_nagroda_powie%C5%9B%C4%87'));
    expect(screen.getByText('Nebula')).toHaveAttribute('href', expect.stringContaining('Nebula_nagroda_najlepsza_powie%C5%9B%C4%87'));
  });

  it('shows all award options in the dropdown', async () => {
    render(<App />);
    
    const configTabButton = screen.getByRole('button', { name: /Liturgie Synchronizacji/i });
    await act(async () => {
      fireEvent.click(configTabButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Pieczęć Przyłożona/i)).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/Wybierz Nagrodę do Synchronizacji/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('Nagroda Hugo');
    expect(options).toContain('Nagroda Nebula');
    expect(options).toContain('Nagroda Locus');
    expect(options).toContain('Wszystkie Nagrody');
  });

  it('handles single award sync flow (UI state)', async () => {
    render(<App />);
    
    const configTabButton = screen.getByRole('button', { name: /Liturgie Synchronizacji/i });
    await act(async () => {
      fireEvent.click(configTabButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Pieczęć Przyłożona/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByText(/Inicjuj Synchronizację/i);
    fireEvent.click(syncButton);
    
    // Should show loading state (mocking SSE is complex, so we check if it starts)
    expect(mockFetch).toHaveBeenCalledWith('/api/sync', expect.any(Object));
  });

  it('handles "Wszystkie Nagrody" sync flow', async () => {
    render(<App />);
    
    const configTabButton = screen.getByRole('button', { name: /Liturgie Synchronizacji/i });
    await act(async () => {
      fireEvent.click(configTabButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Pieczęć Przyłożona/i)).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/Wybierz Nagrodę do Synchronizacji/i);
    fireEvent.change(select, { target: { value: 'Wszystkie Nagrody' } });
    
    const syncButton = screen.getByText(/Inicjuj Synchronizację/i);
    fireEvent.click(syncButton);
    
    expect(mockFetch).toHaveBeenCalledWith('/api/sync', expect.objectContaining({
      body: JSON.stringify({
        awardName: "Wszystkie Nagrody",
        pageTitle: "Wszystkie",
        syncAll: true
      })
    }));
  });

  it('displays synchronization summary with added items', async () => {
    (global as any).resetLastStreamController();
    render(<App />);
    
    const configTabButton = screen.getByRole('button', { name: /Liturgie Synchronizacji/i });
    await act(async () => {
      fireEvent.click(configTabButton);
    });
    
    const select = screen.getByLabelText(/Wybierz Nagrodę do Synchronizacji/i) as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: 'Nagroda Hugo' } });
    });
    expect(select.value).toBe('Nagroda Hugo');

    const syncButton = screen.getByText(/Inicjuj Synchronizację/i);
    expect(syncButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(syncButton);
    });

    // Wait for stream controller to be created
    await waitFor(() => {
      expect((global as any).getLastStreamController()).toBeTruthy();
    });

    // Simulate streaming events
    await act(async () => {
      (global as any).pushStreamEvent('status', { message: 'Inicjowanie...' });
    });

    await act(async () => {
      (global as any).pushStreamEvent('progress', { 
        message: 'Synchronizacja w toku...',
        current: 50,
        total: 100
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Synchronizacja w toku.../i)).toBeInTheDocument();
    });

    await act(async () => {
      (global as any).pushStreamEvent('complete', {
        result: {
          updated: 2,
          summary: {
            added: ['Solaris', 'Cyberiada', 'Book 3', 'Book 4', 'Book 5'],
            updated: ['Updated 1', 'Updated 2'],
            skipped: ['Skipped 1']
          }
        }
      });
    });

    // Check for completion summary
    await waitFor(() => {
      expect(screen.getByText(/Zapisy Archiwisty Adeptus/i)).toBeInTheDocument();
      expect(screen.getByText(/Dodano/i)).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText(/Zaktualizowano/i)).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText(/Pominięto/i)).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText(/Nowe Zapisy \(5\)/i)).toBeInTheDocument();
      expect(screen.getByText('Solaris')).toBeInTheDocument();
      expect(screen.getByText('Cyberiada')).toBeInTheDocument();
    });
  });

  it('renders other tools: Rytuał Wydania, Rytuał Oznaczania Cykli, Rytuał Rekonstrukcji Liczb', async () => {
    render(<App />);
    
    const configTabButton = screen.getByRole('button', { name: /Liturgie Synchronizacji/i });
    await act(async () => {
      fireEvent.click(configTabButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Pieczęć Przyłożona/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Rytuał Wydania/i)).toBeInTheDocument();
    expect(screen.getByText(/Rytuał Oznaczania Cykli/i)).toBeInTheDocument();
    expect(screen.getByText(/Rytuał Rekonstrukcji Liczb/i)).toBeInTheDocument();
  });

  it('renders Schema Editor with correct properties and status', async () => {
    render(<App />);
    
    const configTabButton = screen.getByRole('button', { name: /Liturgie Synchronizacji/i });
    await act(async () => {
      fireEvent.click(configTabButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Katalog Bazy \(Schemat Archiwalny\)/i)).toBeInTheDocument();
    });

    const expandButton = screen.getByRole('button', { name: '' }); // We need to find the chevron button. It's better to find by test id or aria-label, but let's find the section first.
    // Actually, let's just find the button inside the SchemaSection.
    // The button has no aria-label. Let's add one or find it by some other means.
    // Wait, let's just find the button that is inside the section with text "Katalog Bazy (Schemat Archiwalny)".
    
    // Instead of adding aria-label, let's just find the button by its icon or class, or just add aria-label to the button in SchemaSection.tsx.
    // Let's just click the button that is next to the heading.
    const schemaHeading = screen.getByText(/Katalog Bazy \(Schemat Archiwalny\)/i);
    const expandBtn = schemaHeading.parentElement?.nextElementSibling as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(expandBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Konfiguracja Systemowa Kolumn/i)).toBeInTheDocument();
    });

    // Check properties
    expect(screen.getByText('Autor')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Nagrody')).toBeInTheDocument();

    // Check status display (records count) for multiselect
    // "Nagrody" has 1 option, so it should show "1 / 100"
    const statusElements = screen.getAllByText('1 / 100');
    expect(statusElements.length).toBeGreaterThan(0);
    
    // "Autor" should NOT have the status display (as per requirement)
    // In our mock, Autor has 2 options.
    expect(screen.queryByText('2 / 100')).not.toBeInTheDocument();
  });

  it('allows deleting options from Schema Editor except for Autor', async () => {
    render(<App />);
    
    const configTabButton = screen.getByRole('button', { name: /Liturgie Synchronizacji/i });
    await act(async () => {
      fireEvent.click(configTabButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Katalog Bazy \(Schemat Archiwalny\)/i)).toBeInTheDocument();
    });

    const schemaHeading = screen.getByText(/Katalog Bazy \(Schemat Archiwalny\)/i);
    const expandBtn = schemaHeading.parentElement?.nextElementSibling as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(expandBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Nagrody')).toBeInTheDocument();
    });

    // Find delete button for "Hugo" in "Nagrody"
    // It's an X icon inside a button with title "Usuń opcję"
    const nagrodyHeading = screen.getByText('Nagrody');
    const nagrodySection = nagrodyHeading.closest('.group') as HTMLElement;
    expect(nagrodySection).toBeInTheDocument();
    
    const deleteButtons = within(nagrodySection).queryAllByTitle('Usuń opcję');
    expect(deleteButtons.length).toBeGreaterThan(0);

    // Check "Autor" section
    const autorHeading = screen.getByText('Autor');
    const autorSection = autorHeading.closest('.group') as HTMLElement;
    expect(autorSection).toBeInTheDocument();
    
    const autorDeleteButtons = within(autorSection).queryAllByTitle('Usuń opcję');
    expect(autorDeleteButtons.length).toBe(0);
  });

  it('handles Vinted search flow (UI state)', async () => {
    render(<App />);
    
    const vintedTabButton = screen.getByRole('button', { name: /Skaner Vinted/i });
    await act(async () => {
      fireEvent.click(vintedTabButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Katalog Beletrystyka/i)).toBeInTheDocument();
    });
    
    const searchButton = screen.getByText(/Uruchom Skaner Vinted/i);
    
    await act(async () => {
      fireEvent.click(searchButton);
    });
    
    // Use waitFor because state update might not be immediate
    await waitFor(() => {
      expect(screen.getByText(/Zatrzymaj Skanowanie/i)).toBeInTheDocument();
    });
  });

  it('handles duplicate sync flow (UI state)', async () => {
    render(<App />);
    
    const configTabButton = screen.getByRole('button', { name: /Liturgie Synchronizacji/i });
    await act(async () => {
      fireEvent.click(configTabButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Pieczęć Przyłożona/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByText(/Rytuał Wykrycia Duplikacji/i);
    fireEvent.click(syncButton);
    
    // Should show loading state
    expect(mockFetch).toHaveBeenCalledWith('/api/sync-duplicates', expect.any(Object));
  });

  it('displays duplicate sync summary', async () => {
    (global as any).resetLastStreamController();
    render(<App />);
    
    const configTabButton = screen.getByRole('button', { name: /Liturgie Synchronizacji/i });
    await act(async () => {
      fireEvent.click(configTabButton);
    });
    
    const syncButton = screen.getByText(/Rytuał Wykrycia Duplikacji/i);
    expect(syncButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(syncButton);
    });

    // Wait for stream controller to be created
    await waitFor(() => {
      expect((global as any).getLastStreamController()).toBeTruthy();
    });

    // Simulate streaming events
    await act(async () => {
      (global as any).pushStreamEvent('status', { message: 'Inicjowanie...' });
    });

    await act(async () => {
      (global as any).pushStreamEvent('complete', {
        result: {
          duplicates: [
            { bookA: 'Solaris', bookB: 'Solaris (aka)' },
            { bookA: 'Cyberiada', bookB: 'Cyberiada (aka)' }
          ]
        }
      });
    });

    // Check for completion summary
    await waitFor(() => {
      expect(screen.getByText(/Zapisy Archiwisty Adeptus/i)).toBeInTheDocument();
      expect(screen.getByText(/Solaris <-> Solaris \(aka\)/)).toBeInTheDocument();
      expect(screen.getByText(/Cyberiada <-> Cyberiada \(aka\)/)).toBeInTheDocument();
    });
  });
});
