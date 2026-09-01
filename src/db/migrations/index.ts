/**
 * Ordered list of schema migrations and the current target schema version.
 */

import { migration001Initial } from './001_initial';
import type { Migration } from '../types';

export const MIGRATIONS: readonly Migration[] = [migration001Initial];

export const CURRENT_SCHEMA_VERSION = 1;
