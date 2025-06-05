import type { SQL } from "drizzle-orm/sql";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm/sql";
import { getTableColumns } from "drizzle-orm/utils";

export const buildConflictUpdateColumns = <
  T extends SQLiteTable,
  Q extends keyof T["_"]["columns"],
>(
  table: T,
  columns: Q[],
) => {
  const cls = getTableColumns(table);
  return columns.reduce(
    (acc, column) => {
      const colName = cls[column]?.name;
      acc[column] = sql.raw(`excluded.${colName}`);
      return acc;
    },
    {} as Record<Q, SQL>,
  );
};

export * from "drizzle-orm/sql";
export { alias } from "drizzle-orm/sqlite-core";
