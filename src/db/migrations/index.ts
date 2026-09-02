/**
 * Ordered list of schema migrations and the current target schema version.
 */

import { migration001Initial } from './001_initial';
import { migration002WarrantyIntegrity } from './002_warranty_integrity';
import { migration003ConsumableStock } from './003_consumable_stock';
import type { Migration } from '../types';

export const MIGRATIONS: readonly Migration[] = [
  migration001Initial,
  migration002WarrantyIntegrity,
  migration003ConsumableStock,
];

export const CURRENT_SCHEMA_VERSION = 3;
