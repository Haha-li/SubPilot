import { db } from '../db';

type StatementFactory = (executor: any) => any[];

export async function executeStatementsAtomically(factory: StatementFactory): Promise<void> {
  if (typeof db.batch === 'function') {
    const statements = factory(db);
    if (statements.length > 0) await db.batch(statements);
    return;
  }

  if (typeof db.transaction === 'function') {
    const result = db.transaction((transaction: any) => {
      const statements = factory(transaction);
      for (const statement of statements) {
        if (typeof statement.run !== 'function') {
          throw new Error('当前数据库事务不支持该写入语句');
        }
        statement.run();
      }
    });
    if (result && typeof result.then === 'function') await result;
    return;
  }

  const statements = factory(db);
  for (const statement of statements) await statement;
}
