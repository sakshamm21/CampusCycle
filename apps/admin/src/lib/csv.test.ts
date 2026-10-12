import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportCsv } from './csv';

describe('exportCsv', () => {
  let mockLink: {
    setAttribute: ReturnType<typeof vi.fn>;
    click: ReturnType<typeof vi.fn>;
  };
  let originalDocument: unknown;

  beforeEach(() => {
    originalDocument = (global as unknown as { document?: unknown }).document;

    // Mock URL APIs
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock document
    mockLink = {
      setAttribute: vi.fn(),
      click: vi.fn(),
    };

    (global as unknown as { document: unknown }).document = {
      createElement: vi.fn((tagName: string) => (tagName === 'a' ? mockLink : {})),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };
  });

  afterEach(() => {
    (global as unknown as { document: unknown }).document = originalDocument;
  });

  it('exports simple rows without explicit columns', () => {
    const rows = [
      { id: '1', name: 'Stand A' },
      { id: '2', name: 'Stand B' },
    ];

    exportCsv('stands.csv', rows);

    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'stands.csv');
    expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:mock-url');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('formats rows according to custom column mappings', () => {
    const rows = [
      { id: '1', name: 'Stand A', extra: 'ignored' },
      { id: '2', name: 'Stand B', extra: 'ignored' },
    ];

    exportCsv('stands-custom.csv', rows, [
      { key: 'name', header: 'Stand Name' },
      { key: 'id', header: 'Identifier' },
    ]);

    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'stands-custom.csv');
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('handles empty rows array cleanly', () => {
    exportCsv('empty.csv', []);
    expect(mockLink.click).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});
