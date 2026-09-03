/**
 * Document import/delete orchestration with compensating transactions.
 */

import { AppError } from '@/src/domain/errors';
import { defaultDocumentTitle } from '@/src/domain/documents';
import type { Document, DocumentType } from '@/src/domain/types';
import type { SqlDatabase } from '@/src/db/types';
import { DocumentRepository } from '@/src/repositories/documentRepository';
import { ItemRepository } from '@/src/repositories/itemRepository';
import { Analytics } from '@/src/services/AnalyticsService';
import {
  deleteManagedFileByRelativePath,
  importManagedFile,
} from '@/src/services/managedFileService';

export interface PendingDocumentFile {
  sourceUri: string;
  mimeType?: string | null;
  originalName?: string | null;
  fileSize?: number | null;
}

export class DocumentService {
  private readonly documents: DocumentRepository;
  private readonly items: ItemRepository;

  constructor(db: SqlDatabase) {
    this.documents = new DocumentRepository(db);
    this.items = new ItemRepository(db);
  }

  listByItem(itemId: string): Document[] {
    return this.documents.listByItemId(itemId);
  }

  getById(id: string): Document | null {
    return this.documents.getById(id);
  }

  /**
   * Import file to managed storage, then persist metadata.
   * Cleans up imported file if DB insert fails.
   */
  async createDocument(input: {
    itemId: string;
    type: DocumentType;
    title: string;
    file: PendingDocumentFile;
  }): Promise<Document> {
    const item = this.items.getById(input.itemId);
    if (!item) {
      throw new AppError('Вещь не найдена', { code: 'NOT_FOUND' });
    }

    const title = input.title.trim() || defaultDocumentTitle(input.type);

    let relativePath: string;
    try {
      const ref = await importManagedFile({
        sourceUri: input.file.sourceUri,
        category: 'documents',
        mimeType: input.file.mimeType ?? null,
        originalName: input.file.originalName ?? null,
      });
      relativePath = ref.relativePath;
    } catch {
      throw new AppError('Не удалось сохранить документ');
    }

    try {
      const doc = this.documents.create({
        itemId: input.itemId,
        type: input.type,
        title,
        filePath: relativePath,
        mimeType: input.file.mimeType ?? null,
        originalName: input.file.originalName ?? null,
        fileSize: input.file.fileSize ?? null,
      });
      // Privacy-safe: document type only — never title, path, or filename.
      Analytics.documentAdded(doc.type);
      return doc;
    } catch (err) {
      try {
        await deleteManagedFileByRelativePath(relativePath);
      } catch {
        // Preserve the DB error; managed cleanup is best effort.
      }
      throw err;
    }
  }

  /** Delete DB row first, then remove managed file best-effort. */
  async deleteDocument(id: string): Promise<void> {
    const existing = this.documents.getById(id);
    if (!existing) {
      throw new AppError('Документ не найден', { code: 'NOT_FOUND' });
    }

    const filePath = existing.filePath;
    this.documents.delete(id);
    await deleteManagedFileByRelativePath(filePath);
  }
}
