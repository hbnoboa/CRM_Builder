import {
  Injectable,
  BadRequestException,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityService, FieldDefinition } from '../entity/entity.service';
import { CurrentUser } from '../../common/types';
import { checkEntityAction } from '../../common/utils/check-module-permission';
import { getEffectiveTenantId } from '../../common/utils/tenant.util';
import { DataService, QueryDataDto } from './data.service';
import * as ExcelJS from 'exceljs';

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  imported: number;
  errors: ImportError[];
  total: number;
}

const MAX_EXPORT_ROWS = 5000;
const IMPORT_BATCH_SIZE = 500;
const PREVIEW_ROWS = 5;

export interface SheetInfo {
  name: string;
  rowCount: number;
}

export interface ImportPreview {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
  entityFields: Array<{
    slug: string;
    name: string;
    type: string;
    required: boolean;
  }>;
  suggestedMapping: Record<string, string>; // header -> fieldSlug
  sheets: SheetInfo[];
  selectedSheet: string;
}

@Injectable()
export class DataIoService {
  private readonly logger = new Logger(DataIoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entityService: EntityService,
    private readonly dataService: DataService,
  ) {}

  // =========================================================================
  // EXPORT
  // =========================================================================

  async exportData(
    entitySlug: string,
    query: QueryDataDto,
    format: 'xlsx' | 'json',
    user: CurrentUser,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    checkEntityAction(user, entitySlug, 'canExport');

    // Reutilizar findAll com limit alto para obter dados filtrados + field permissions
    const exportQuery: QueryDataDto = {
      ...query,
      limit: MAX_EXPORT_ROWS,
      page: 1,
      cursor: undefined,
    };

    const result = await this.dataService.findAll(entitySlug, exportQuery, user);
    const records = result.data as Array<Record<string, unknown>>;
    const entityFields = (result.entity.fields as unknown) as FieldDefinition[];

    // Determinar campos visiveis (field-level permissions ja aplicadas pelo findAll)
    const visibleFields = (result as Record<string, unknown>).visibleFields as string[] | undefined;
    const exportFields = visibleFields
      ? entityFields.filter(f => visibleFields.includes(f.slug))
      : entityFields.filter(f => f.type !== 'sub-entity' && f.type !== 'password' && f.type !== 'hidden');

    const entityName = result.entity.namePlural || result.entity.name || entitySlug;
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const jsonData = records.map(record => {
        const data = record.data as Record<string, unknown>;
        const row: Record<string, unknown> = {};
        for (const field of exportFields) {
          const val = data?.[field.slug] ?? null;
          // Extract label from {value, label} objects (e.g. relation fields)
          if (val && typeof val === 'object' && !Array.isArray(val) && 'label' in (val as Record<string, unknown>)) {
            row[field.name || field.slug] = (val as Record<string, unknown>).label;
          } else {
            row[field.name || field.slug] = val;
          }
        }
        return row;
      });

      return {
        buffer: Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8'),
        contentType: 'application/json',
        filename: `${entityName}_${dateStr}.json`,
      };
    }

    // Excel export
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CRM Builder';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(entityName);

    // Headers
    worksheet.columns = exportFields.map(field => ({
      header: field.name || field.slug,
      key: field.slug,
      width: Math.max(12, (field.name || field.slug).length + 4),
    }));

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    // Data rows
    for (const record of records) {
      const data = record.data as Record<string, unknown>;
      const rowData: Record<string, unknown> = {};
      for (const field of exportFields) {
        const value = data?.[field.slug];
        // Multiselect/array: join com ;
        if (Array.isArray(value)) {
          rowData[field.slug] = value.join('; ');
        } else if (value !== null && value !== undefined && typeof value === 'object') {
          // Extract label from {value, label} objects (e.g. relation fields)
          const obj = value as Record<string, unknown>;
          rowData[field.slug] = obj.label ? String(obj.label) : JSON.stringify(value);
        } else {
          rowData[field.slug] = value ?? '';
        }
      }
      worksheet.addRow(rowData);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return {
      buffer: Buffer.from(buffer),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${entityName}_${dateStr}.xlsx`,
    };
  }

  // =========================================================================
  // IMPORT PREVIEW
  // =========================================================================

  async previewImport(
    entitySlug: string,
    file: Express.Multer.File,
    user: CurrentUser,
    tenantId?: string,
    sheetName?: string,
  ): Promise<ImportPreview> {
    checkEntityAction(user, entitySlug, 'canImport');

    if (!file || !file.buffer) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    const effectiveTenantId = getEffectiveTenantId(user, tenantId);

    // Buscar entidade e campos
    const entity = await this.prisma.entity.findFirst({
      where: {
        slug: entitySlug,
        tenantId: effectiveTenantId,
      },
    });

    if (!entity) {
      throw new BadRequestException(`Entidade "${entitySlug}" nao encontrada`);
    }

    const fields = (entity.fields as unknown) as FieldDefinition[];
    const importableFields = fields.filter(
      f => f.type !== 'sub-entity' && f.type !== 'password' && f.type !== 'hidden',
    );

    // Parse file
    let rawRows: Record<string, unknown>[];
    let sheets: SheetInfo[] = [];
    let selectedSheet = '';
    const ext = file.originalname?.toLowerCase() || '';

    this.logger.log(`Preview: file="${file.originalname}" size=${file.buffer.length} ext="${ext}" sheetName="${sheetName || ''}"`);

    if (ext.endsWith('.json')) {
      rawRows = this.parseJson(file.buffer);
    } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      const result = await this.parseExcel(file.buffer, sheetName);
      rawRows = result.rows;
      sheets = result.sheets;
      selectedSheet = result.selectedSheet;
    } else {
      throw new BadRequestException('Formato nao suportado. Use .xlsx ou .json');
    }

    this.logger.log(`Preview: parsed ${rawRows.length} rows`);

    if (rawRows.length === 0) {
      throw new BadRequestException('Arquivo vazio ou sem dados');
    }

    // Get headers from first row keys
    const headers = Object.keys(rawRows[0]);

    // Build suggested mapping (auto-match)
    const suggestedMapping: Record<string, string> = {};
    for (const header of headers) {
      const lowerHeader = header.toLowerCase().trim();

      // Try exact slug match
      let field = importableFields.find(f => f.slug === header);
      if (!field) {
        // Try slug case-insensitive
        field = importableFields.find(f => f.slug.toLowerCase() === lowerHeader);
      }
      if (!field) {
        // Try exact name match
        field = importableFields.find(f => f.name?.toLowerCase() === lowerHeader);
      }
      if (!field) {
        // Try label match
        field = importableFields.find(f => f.label?.toLowerCase() === lowerHeader);
      }

      if (field) {
        suggestedMapping[header] = field.slug;
      }
    }

    return {
      headers,
      sampleRows: rawRows.slice(0, PREVIEW_ROWS),
      totalRows: rawRows.length,
      entityFields: importableFields.map(f => ({
        slug: f.slug,
        name: f.name || f.slug,
        type: f.type || 'text',
        required: f.required || false,
      })),
      suggestedMapping,
      sheets,
      selectedSheet,
    };
  }

  // =========================================================================
  // IMPORT WITH MAPPING
  // =========================================================================

  async importData(
    entitySlug: string,
    file: Express.Multer.File,
    user: CurrentUser,
    tenantId?: string,
    columnMapping?: Record<string, string>, // header -> fieldSlug
    sheetName?: string,
  ): Promise<ImportResult> {
    checkEntityAction(user, entitySlug, 'canImport');

    if (!file || !file.buffer) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    const effectiveTenantId = getEffectiveTenantId(user, tenantId);

    // Buscar entidade e campos
    const entity = await this.prisma.entity.findFirst({
      where: {
        slug: entitySlug,
        tenantId: effectiveTenantId,
      },
    });

    if (!entity) {
      throw new BadRequestException(`Entidade "${entitySlug}" nao encontrada`);
    }

    const fields = (entity.fields as unknown) as FieldDefinition[];
    const importableFields = fields.filter(
      f => f.type !== 'sub-entity' && f.type !== 'password' && f.type !== 'hidden',
    );

    // Parse file
    let rawRows: Record<string, unknown>[];
    const ext = file.originalname?.toLowerCase() || '';

    if (ext.endsWith('.json')) {
      rawRows = this.parseJson(file.buffer);
    } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      const result = await this.parseExcel(file.buffer, sheetName);
      rawRows = result.rows;
    } else {
      throw new BadRequestException('Formato nao suportado. Use .xlsx ou .json');
    }

    if (rawRows.length === 0) {
      return { imported: 0, errors: [], total: 0 };
    }

    // Map column headers to field slugs (use custom mapping or auto-detect)
    const fieldMap = columnMapping
      ? this.buildFieldMapFromMapping(columnMapping, importableFields)
      : this.buildFieldMap(rawRows[0], importableFields);

    // Validate and coerce each row
    const validRows: Record<string, unknown>[] = [];
    const errors: ImportError[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2; // +2 because row 1 is header in Excel, 0-indexed in code
      const rawRow = rawRows[i];
      const { data, rowErrors } = this.processRow(rawRow, fieldMap, importableFields, rowNum);

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        validRows.push(data);
      }
    }

    // Insert in batches
    let imported = 0;
    for (let i = 0; i < validRows.length; i += IMPORT_BATCH_SIZE) {
      const batch = validRows.slice(i, i + IMPORT_BATCH_SIZE);
      const result = await this.prisma.entityData.createMany({
        data: batch.map(data => ({
          entityId: entity.id,
          tenantId: effectiveTenantId,
          data: data as object,
          createdById: user.id,
          updatedById: user.id,
        })),
      });
      imported += result.count;
    }

    this.logger.log(
      `Import ${entitySlug}: ${imported} imported, ${errors.length} errors, ${rawRows.length} total`,
    );

    return {
      imported,
      errors,
      total: rawRows.length,
    };
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private parseJson(buffer: Buffer): Record<string, unknown>[] {
    try {
      const parsed = JSON.parse(buffer.toString('utf-8'));
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('JSON deve ser um array de objetos');
      }
      return parsed;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('JSON invalido');
    }
  }

  private async parseExcel(
    buffer: Buffer,
    sheetName?: string,
  ): Promise<{ rows: Record<string, unknown>[]; sheets: SheetInfo[]; selectedSheet: string }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    this.logger.log(`Excel: ${workbook.worksheets.length} worksheets found`);

    // Collect info about all sheets with data
    const sheetsWithData: Array<{ worksheet: ExcelJS.Worksheet; info: SheetInfo }> = [];

    for (const worksheet of workbook.worksheets) {
      if (!worksheet || worksheet.rowCount < 2) continue;
      // Quick check: does it have at least a header row with 2+ cells?
      const headerRow = worksheet.getRow(1);
      let cellCount = 0;
      headerRow.eachCell({ includeEmpty: false }, () => { cellCount++; });
      if (cellCount < 2) {
        // Try rows 2-5 for header
        let found = false;
        for (let r = 2; r <= Math.min(5, worksheet.rowCount); r++) {
          let cc = 0;
          worksheet.getRow(r).eachCell({ includeEmpty: false }, () => { cc++; });
          if (cc >= 2) { found = true; break; }
        }
        if (!found) continue;
      }
      sheetsWithData.push({
        worksheet,
        info: { name: worksheet.name, rowCount: Math.max(0, worksheet.rowCount - 1) },
      });
    }

    const sheets = sheetsWithData.map(s => s.info);

    // Select which worksheet to parse
    let target = sheetsWithData[0];
    if (sheetName) {
      const found = sheetsWithData.find(s => s.info.name === sheetName);
      if (found) target = found;
    }

    if (!target) {
      return { rows: [], sheets, selectedSheet: '' };
    }

    const rows = this.parseWorksheet(target.worksheet);

    this.logger.log(`Sheet "${target.info.name}": parsed ${rows.length} data rows`);

    return { rows, sheets, selectedSheet: target.info.name };
  }

  private parseWorksheet(worksheet: ExcelJS.Worksheet): Record<string, unknown>[] {
    // Find header row - try rows 1-5 in case there's a title row
    let headerRowNum = 0;
    let headers: string[] = [];

    for (let tryRow = 1; tryRow <= Math.min(5, worksheet.rowCount); tryRow++) {
      const candidateHeaders: string[] = [];
      const row = worksheet.getRow(tryRow);
      let cellCount = 0;

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const val = String(cell.value || '').trim();
        if (val) {
          candidateHeaders[colNumber] = val;
          cellCount++;
        }
      });

      if (cellCount >= 2) {
        headers = candidateHeaders;
        headerRowNum = tryRow;
        break;
      }
    }

    if (headerRowNum === 0) return [];

    // Read data rows starting after header
    const rows: Record<string, unknown>[] = [];
    for (let rowNum = headerRowNum + 1; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      let hasValue = false;
      const rowData: Record<string, unknown> = {};

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          let value = cell.value;
          // Handle ExcelJS rich text
          if (value && typeof value === 'object' && 'richText' in value) {
            value = (value as { richText: Array<{ text: string }> }).richText
              .map(rt => rt.text)
              .join('');
          }
          // Handle ExcelJS date
          if (value instanceof Date) {
            value = value.toISOString();
          }
          // Handle ExcelJS formula result
          if (value && typeof value === 'object' && 'result' in value) {
            value = (value as { result: ExcelJS.CellValue }).result;
          }
          rowData[header] = value;
          hasValue = true;
        }
      });

      if (hasValue) {
        rows.push(rowData);
      }
    }

    return rows;
  }

  /**
   * Build a map from column header (name or slug) to field slug
   */
  private buildFieldMap(
    sampleRow: Record<string, unknown>,
    fields: FieldDefinition[],
  ): Map<string, FieldDefinition> {
    const fieldMap = new Map<string, FieldDefinition>();
    const columnHeaders = Object.keys(sampleRow);

    for (const header of columnHeaders) {
      const lowerHeader = header.toLowerCase().trim();

      // Try exact slug match
      let field = fields.find(f => f.slug === header);
      if (!field) {
        // Try exact name match
        field = fields.find(f => f.name?.toLowerCase() === lowerHeader);
      }
      if (!field) {
        // Try label match
        field = fields.find(f => f.label?.toLowerCase() === lowerHeader);
      }

      if (field) {
        fieldMap.set(header, field);
      }
    }

    return fieldMap;
  }

  /**
   * Build field map from explicit column mapping (header -> fieldSlug)
   */
  private buildFieldMapFromMapping(
    mapping: Record<string, string>,
    fields: FieldDefinition[],
  ): Map<string, FieldDefinition> {
    const fieldMap = new Map<string, FieldDefinition>();

    for (const [header, fieldSlug] of Object.entries(mapping)) {
      if (!fieldSlug) continue; // Skip unmapped columns
      const field = fields.find(f => f.slug === fieldSlug);
      if (field) {
        fieldMap.set(header, field);
      }
    }

    return fieldMap;
  }

  /**
   * Process a single row: coerce types and validate
   */
  private processRow(
    rawRow: Record<string, unknown>,
    fieldMap: Map<string, FieldDefinition>,
    allFields: FieldDefinition[],
    rowNum: number,
  ): { data: Record<string, unknown>; rowErrors: ImportError[] } {
    const data: Record<string, unknown> = {};
    const rowErrors: ImportError[] = [];

    // Process mapped columns
    for (const [header, field] of fieldMap.entries()) {
      const rawValue = rawRow[header];
      const { value, error } = this.coerceValue(rawValue, field);

      if (error) {
        rowErrors.push({ row: rowNum, field: field.name || field.slug, message: error });
      } else {
        data[field.slug] = value;
      }
    }

    // Check required fields that are missing
    for (const field of allFields) {
      if (field.required && (data[field.slug] === undefined || data[field.slug] === null || data[field.slug] === '')) {
        // Only error if field is not in the data at all or empty
        if (!(field.slug in data) || data[field.slug] === undefined || data[field.slug] === null || data[field.slug] === '') {
          rowErrors.push({
            row: rowNum,
            field: field.name || field.slug,
            message: 'Campo obrigatorio',
          });
        }
      }
    }

    return { data, rowErrors };
  }

  /**
   * Coerce a raw value to the expected field type
   */
  private coerceValue(
    rawValue: unknown,
    field: FieldDefinition,
  ): { value: unknown; error?: string } {
    // Null/undefined/empty handling
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return { value: null };
    }

    const type = field.type?.toLowerCase() || 'text';
    const textTypes = ['text', 'textarea', 'richtext', 'url', 'phone', 'cpf', 'cnpj', 'cep', 'color'];
    const numberTypes = ['number', 'currency', 'percentage', 'rating', 'slider'];

    // Text types
    if (textTypes.includes(type)) {
      return { value: String(rawValue).trim() };
    }

    // Email
    if (type === 'email') {
      const email = String(rawValue).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { value: null, error: 'Email invalido' };
      }
      return { value: email };
    }

    // Number types
    if (numberTypes.includes(type)) {
      const str = String(rawValue).replace(/[^\d.,-]/g, '').replace(',', '.');
      const num = Number(str);
      if (isNaN(num)) {
        return { value: null, error: 'Deve ser um numero' };
      }
      return { value: num };
    }

    // Boolean
    if (type === 'boolean') {
      const str = String(rawValue).toLowerCase().trim();
      const trueValues = ['true', '1', 'sim', 'yes', 's', 'y'];
      const falseValues = ['false', '0', 'nao', 'no', 'n'];
      if (trueValues.includes(str)) return { value: true };
      if (falseValues.includes(str)) return { value: false };
      return { value: null, error: 'Valor booleano invalido (use sim/nao, true/false, 1/0)' };
    }

    // Date types
    if (type === 'date' || type === 'datetime' || type === 'time') {
      const str = String(rawValue).trim();

      // Already ISO format
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return { value: str };
      }

      // dd/mm/yyyy or dd-mm-yyyy
      const brDate = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
      if (brDate) {
        const [, day, month, year, hours, minutes] = brDate;
        const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        if (type === 'datetime' && hours) {
          return { value: `${iso}T${hours.padStart(2, '0')}:${minutes}:00.000Z` };
        }
        return { value: iso };
      }

      // Try Date parse
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        return { value: parsed.toISOString() };
      }

      return { value: null, error: 'Data invalida' };
    }

    // Select
    if (type === 'select' || type === 'api-select' || type === 'relation') {
      const str = String(rawValue).trim();
      if (field.options && field.options.length > 0) {
        const validOptions = field.options.map(opt =>
          typeof opt === 'string' ? opt : opt.value,
        );
        if (!validOptions.includes(str)) {
          return { value: null, error: `Opcao invalida: "${str}"` };
        }
      }
      return { value: str };
    }

    // Multiselect
    if (type === 'multiselect') {
      const items = String(rawValue).split(';').map(s => s.trim()).filter(Boolean);
      if (field.options && field.options.length > 0) {
        const validOptions = field.options.map(opt =>
          typeof opt === 'string' ? opt : opt.value,
        );
        const invalid = items.filter(item => !validOptions.includes(item));
        if (invalid.length > 0) {
          return { value: null, error: `Opcoes invalidas: ${invalid.join(', ')}` };
        }
      }
      return { value: items };
    }

    // Fallback: treat as text
    return { value: String(rawValue) };
  }
}
