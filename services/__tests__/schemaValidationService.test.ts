import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaValidationService } from '../schemaValidationService';
import { NotionAdapter } from '../../notion.adapter';

describe('SchemaValidationService', () => {
  let service: SchemaValidationService;
  let mockNotion: any;
  let mockSendEvent: any;

  beforeEach(() => {
    mockNotion = {
      init: vi.fn(),
      retrieveDataSource: vi.fn(),
      renameProperty: vi.fn(),
      updateDatabaseProperty: vi.fn(),
    };

    mockSendEvent = vi.fn();

    service = new SchemaValidationService(mockNotion as unknown as NotionAdapter);
  });

  it('renames title column if it is not Lp', async () => {
    mockNotion.retrieveDataSource.mockResolvedValueOnce({
      properties: {
        'Name': { name: 'Name', type: 'title' }
      }
    }).mockResolvedValueOnce({
      properties: {
        'Lp': { name: 'Lp', type: 'title' }
      }
    });

    await service.runSchemaValidation(mockSendEvent, () => false);

    expect(mockNotion.renameProperty).toHaveBeenCalledWith('Name', 'Lp');
  });

  it('creates missing properties', async () => {
    mockNotion.retrieveDataSource.mockResolvedValue({
      properties: {
        'Lp': { name: 'Lp', type: 'title' }
        // Missing others
      }
    });

    await service.runSchemaValidation(mockSendEvent, () => false);

    expect(mockNotion.updateDatabaseProperty).toHaveBeenCalledWith('Autor', 'multi_select');
    expect(mockNotion.updateDatabaseProperty).toHaveBeenCalledWith('Tytuł polski', 'rich_text');
    // Cycle columns + closing the old debt are provisioned too.
    expect(mockNotion.updateDatabaseProperty).toHaveBeenCalledWith('Kategoria', 'select');
    expect(mockNotion.updateDatabaseProperty).toHaveBeenCalledWith('Cykl', 'rich_text');
    expect(mockNotion.updateDatabaseProperty).toHaveBeenCalledWith('CyklNr', 'number');
    expect(mockNotion.updateDatabaseProperty).toHaveBeenCalledWith('Źródło', 'multi_select');
    expect(mockNotion.updateDatabaseProperty).toHaveBeenCalledWith('VintedData', 'rich_text');
    expect(mockNotion.updateDatabaseProperty).toHaveBeenCalledWith('ShelfOrder', 'number');
    expect(mockNotion.updateDatabaseProperty).toHaveBeenCalledWith('ISBN', 'rich_text');
  });
});
