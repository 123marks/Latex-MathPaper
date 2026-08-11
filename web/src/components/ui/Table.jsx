import { classes } from "./_utils.js";

export default function Table({
  caption,
  className,
  columns = [],
  emptyMessage = "暂无数据",
  rowKey = "id",
  rows = [],
}) {
  return (
    <div className="tbl-wrap">
      <table className={classes("tbl", className)}>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={classes(column.numeric && "tbl__numeric", column.className)}
                aria-sort={column.ariaSort}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="tbl__empty" colSpan={Math.max(1, columns.length)}>{emptyMessage}</td>
            </tr>
          ) : rows.map((row, index) => (
            <tr key={typeof rowKey === "function" ? rowKey(row, index) : (row[rowKey] ?? index)}>
              {columns.map((column) => {
                const value = row[column.key];
                return (
                  <td
                    key={column.key}
                    data-label={typeof column.header === "string" ? column.header : undefined}
                    className={classes(column.numeric && "tbl__numeric", column.cellClassName)}
                  >
                    {column.render ? column.render(value, row, index) : value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
