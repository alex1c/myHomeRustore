/**
 * Document domain labels and list filters.
 */

import type { DocumentType } from '@/src/domain/types';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  receipt: 'Чек',
  warranty: 'Гарантийный талон',
  manual: 'Инструкция',
  contract: 'Договор',
  label: 'Шильдик / серийный номер',
  other: 'Другое',
};

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'receipt',
  'warranty',
  'manual',
  'contract',
  'label',
  'other',
] as const;

export type DocumentFilterType = DocumentType | 'all';

export interface DocumentListFilters {
  search: string;
  type: DocumentFilterType;
}

export interface DocumentFormValues {
  type: DocumentType;
  title: string;
}

export const EMPTY_DOCUMENT_FORM: DocumentFormValues = {
  type: 'receipt',
  title: '',
};

/** Default title when user leaves title empty. */
export function defaultDocumentTitle(type: DocumentType): string {
  return DOCUMENT_TYPE_LABELS[type];
}
