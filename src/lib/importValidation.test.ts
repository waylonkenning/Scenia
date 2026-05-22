import { describe, expect, it } from 'vitest';
import { validateImportSchema } from './importValidation';

describe('validateImportSchema', () => {
  it('treats missing initiative programmeId and assetId as blocking errors', () => {
    const issues = validateImportSchema({
      initiatives: [
        {
          id: 'init-1',
          name: 'Broken initiative',
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          capex: 1000,
          opex: 500,
        },
      ],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: 'initiatives', issue: '"programmeId" missing in 1 record', severity: 'error' }),
        expect.objectContaining({ entity: 'initiatives', issue: '"assetId" missing in 1 record', severity: 'error' }),
      ]),
    );
  });

  it('keeps missing initiative startDate as a non-blocking warning', () => {
    const issues = validateImportSchema({
      initiatives: [
        {
          id: 'init-2',
          name: 'Legacy initiative',
          programmeId: 'prog-1',
          assetId: 'asset-1',
          endDate: '2025-12-31',
          capex: 1000,
          opex: 500,
        },
      ],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: 'initiatives', issue: '"startDate" missing in 1 record', severity: 'warning' }),
      ]),
    );
  });
});
