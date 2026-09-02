/**
 * Document repository — metadata for managed files linked to items.
 */

import { AppError } from '@/src/domain/errors';
import { createEntityIdSync } from '@/src/domain/ids';
import type { Document, DocumentType } from '@/src/domain/types';
import type { DocumentListFilters } from '@/src/domain/documents';
import type { SqlDatabase } from '@/src/db/types';
import { nowUtcInstant } from '@/src/utils/datetime';

type DocumentRow = {
  id: string;
  item_id: string;
  type: string;
  title: string;
  file_path: string;
  mime_type: string | null;
  original_name: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
};

export type DocumentListRow = {
  document: Document;
  itemName: string;
  itemBrand: string | null;
  itemModel: string | null;
};

function mapRow(row: DocumentRow): Document {
  return {
    id: row.id,
    itemId: row.item_id,
    type: row.type as DocumentType,
    title: row.title,
    filePath: row.file_path,
    mimeType: row.mime_type,
    originalName: row.original_name,
    fileSize: row.file_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

export interface DocumentCreateInput {
  itemId: string;
  type: DocumentType;
  title: string;
  filePath: string;
  mimeType?: string | null;
  originalName?: string | null;
  fileSize?: number | null;
}

export class DocumentRepository {
  constructor(private readonly db: SqlDatabase) {}

  getById(id: string): Document | null {
    const row = this.db.getFirst<DocumentRow>(
      'SELECT * FROM documents WHERE id = ?',
      [id],
    );
    return row ? mapRow(row) : null;
  }

  listByItemId(itemId: string): Document[] {
    const rows = this.db.getAll<DocumentRow>(
      `SELECT * FROM documents WHERE item_id = ?
       ORDER BY created_at DESC`,
      [itemId],
    );
    return rows.map(mapRow);
  }

  listForProperty(propertyId: string, filters: DocumentListFilters): DocumentListRow[] {
    const params: (string | number)[] = [propertyId];
    let sql = `
      SELECT d.*, i.name AS item_name, i.brand AS item_brand, i.model AS item_model
      FROM documents d
      JOIN items i ON i.id = d.item_id
      WHERE i.property_id = ? AND i.status = 'active'
    `;

    if (filters.type !== 'all') {
      sql += ' AND d.type = ?';
      params.push(filters.type);
    }

    const search = filters.search.trim();
    if (search) {
      const like = `%${escapeLike(search)}%`;
      sql += ` AND (
        d.title LIKE ? ESCAPE '\\' OR
        i.name LIKE ? ESCAPE '\\' OR
        IFNULL(i.brand, '') LIKE ? ESCAPE '\\' OR
        IFNULL(i.model, '') LIKE ? ESCAPE '\\'
      )`;
      params.push(like, like, like, like);
    }

    sql += ' ORDER BY d.created_at DESC';

    const rows = this.db.getAll<
      DocumentRow & { item_name: string; item_brand: string | null; item_model: string | null }
    >(sql, params);

    return rows.map((row) => ({
      document: mapRow(row),
      itemName: row.item_name,
      itemBrand: row.item_brand,
      itemModel: row.item_model,
    }));
  }

  create(input: DocumentCreateInput): Document {
    const id = createEntityIdSync();
    const now = nowUtcInstant();
    this.db.run(
      `INSERT INTO documents
       (id, item_id, type, title, file_path, mime_type, original_name, file_size, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.itemId,
        input.type,
        input.title,
        input.filePath,
        input.mimeType ?? null,
        input.originalName ?? null,
        input.fileSize ?? null,
        now,
        now,
      ],
    );
    return this.getById(id)!;
  }

  delete(id: string): Document {
    const existing = this.getById(id);
    if (!existing) {
      throw new AppError('Документ не найден', { code: 'NOT_FOUND' });
    }
    this.db.run('DELETE FROM documents WHERE id = ?', [id]);
    return existing;
  }

  listFilePathsByItemId(itemId: string): string[] {
    const rows = this.db.getAll<{ file_path: string }>(
      'SELECT file_path FROM documents WHERE item_id = ?',
      [itemId],
    );
    return rows.map((r) => r.file_path);
  }
}
