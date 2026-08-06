import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaValidationService } from '../schemaValidationService';
import { NotionAdapter } from '../../notion.adapter';

describe('SchemaValidationService', () => {
  let service: SchemaValidationService;
  let mockNotion: any;
  let mockSendEvent: any;

  beforeEach(() => {
    process.env.NOTION_DATABASE_ID = 'test-db-id';
    mockNotion = {
      init: vi.fn(),
      resolveDataSourceId: vi.fn().mockResolvedValue('actual-id'),
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

    expect(mockNotion.renameProperty).toHaveBeenCalledWith('actual-id', 'Name', 'Lp');
  });

  it('creates missing properties', async () => {
    mockNotion.retrieveDataSource.mockResolvedValue({
      properties: {
        'Lp': { name: 'Lp', type: 'title' }
        // Missing others
      }
    });

    await service.runSchemaValidation(mockSendEvent, () => false);

    expect(mockNotion.updateDatabaseProperty).toHaveBeenCalledWith('actual-id', 'Autor', 'multi_select');
    expect(mockNotion.updateDatabaseProperty).toHaveBeenCalledWith('actual-id', 'Tytuł polski', 'rich_text');
  });
});
