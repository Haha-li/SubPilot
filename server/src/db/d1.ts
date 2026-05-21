import { drizzle } from 'drizzle-orm/d1';
import { setDb } from './index';
import * as schema from './schema';

export function initD1Db(d1Binding: any) {
  setDb(drizzle(d1Binding, { schema }));
}
