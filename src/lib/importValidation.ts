export interface SchemaIssue {
  entity: string;
  issue: string;
  severity: 'error' | 'warning';
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  initiatives: ['id', 'name', 'programmeId', 'assetId', 'startDate', 'endDate', 'capex', 'opex'],
  assets: ['id', 'name', 'categoryId'],
  programmes: ['id', 'name', 'color'],
  strategies: ['id', 'name', 'color'],
  milestones: ['id', 'assetId', 'date', 'name', 'type'],
  dependencies: ['id', 'sourceId', 'targetId', 'type'],
  assetCategories: ['id', 'name'],
};

function getMissingFieldSeverity(entityType: string, field: string): SchemaIssue['severity'] {
  if (entityType === 'initiatives') {
    return field === 'id' || field === 'name' || field === 'programmeId' || field === 'assetId'
      ? 'error'
      : 'warning';
  }

  return field === 'id' || field === 'name' ? 'error' : 'warning';
}

export function validateImportSchema(data: Record<string, unknown[]>): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  for (const [entityType, fields] of Object.entries(REQUIRED_FIELDS)) {
    const records = data[entityType] as Record<string, unknown>[] | undefined;
    if (!records?.length) continue;
    for (const field of fields) {
      const missingCount = records.filter(r => r[field] === undefined || r[field] === null || r[field] === '').length;
      if (missingCount > 0) {
        issues.push({
          entity: entityType,
          issue: `"${field}" missing in ${missingCount} record${missingCount > 1 ? 's' : ''}`,
          severity: getMissingFieldSeverity(entityType, field),
        });
      }
    }
  }

  const initiatives = data.initiatives as Record<string, unknown>[] | undefined;
  if (initiatives) {
    for (let i = 0; i < initiatives.length; i++) {
      const init = initiatives[i];

      for (const dateField of ['startDate', 'endDate']) {
        const dateValue = init[dateField];
        if (dateValue && typeof dateValue === 'string') {
          const parsedDate = new Date(dateValue);
          if (isNaN(parsedDate.getTime())) {
            issues.push({
              entity: 'initiatives',
              issue: `Row ${i + 1}: invalid date format for "${dateField}" (expected YYYY-MM-DD)`,
              severity: 'error',
            });
          }
        }
      }

      for (const numField of ['capex', 'opex']) {
        const numValue = init[numField];
        if (numValue !== undefined && numValue !== null && numValue !== '') {
          const num = typeof numValue === 'number' ? numValue : parseFloat(String(numValue));
          if (!isNaN(num) && num < 0) {
            issues.push({
              entity: 'initiatives',
              issue: `Row ${i + 1}: "${numField}" cannot be negative (found ${num})`,
              severity: 'error',
            });
          }
        }
      }

      const startDate = init.startDate;
      const endDate = init.endDate;
      if (startDate && endDate && typeof startDate === 'string' && typeof endDate === 'string') {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
          issues.push({
            entity: 'initiatives',
            issue: `Row ${i + 1}: startDate must be before or equal to endDate`,
            severity: 'error',
          });
        }
      }
    }
  }

  return issues;
}
