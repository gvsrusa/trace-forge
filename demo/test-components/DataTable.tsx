// DataTable.tsx — deliberately flawed for TraceForge demo
// Known issues: renders entire dataset on every sort (no virtualization),
//   sort state mutates array in place, no aria-sort, no keyboard nav on headers,
//   unique key uses index, inline style on every cell, no column resize a11y
import React, { useState } from "react";

interface Row {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface DataTableProps {
  rows: Row[];
  onRowClick: (row: Row) => void;
}

export function DataTable({ rows, onRowClick }: DataTableProps) {
  const [sortKey, setSortKey] = useState<keyof Row>("name");
  const [ascending, setAscending] = useState(true);
  const [filter, setFilter] = useState("");

  // Issue: mutates the prop array directly instead of copying
  const sorted = rows.sort((a, b) => {
    const va = a[sortKey] ?? "";
    const vb = b[sortKey] ?? "";
    return ascending ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  // Issue: filter runs on every render, O(n) inside render with no memoization
  const visible = sorted.filter(
    (r) =>
      r.name.toLowerCase().includes(filter.toLowerCase()) ||
      r.email.toLowerCase().includes(filter.toLowerCase())
  );

  const handleSort = (key: keyof Row) => {
    if (key === sortKey) setAscending((a) => !a);
    else { setSortKey(key); setAscending(true); }
  };

  return (
    <div>
      {/* Issue: no label on filter input */}
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter..."
        style={{ marginBottom: 8, padding: 4 }}
      />
      {/* Issue: no role="grid", no aria-rowcount, no aria-colcount */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {(["name", "email", "role", "createdAt"] as (keyof Row)[]).map((col) => (
              // Issue: no aria-sort attribute, no keyboard handler (Enter/Space)
              <th
                key={col}
                onClick={() => handleSort(col)}
                style={{ cursor: "pointer", padding: "8px", borderBottom: "1px solid #ccc", textAlign: "left" }}
              >
                {col} {sortKey === col ? (ascending ? "▲" : "▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            // Issue: key is index, not stable row.id
            <tr
              key={index}
              onClick={() => onRowClick(row)}
              style={{ cursor: "pointer", padding: "8px" }}
            >
              {/* Issue: inline style object created on every render */}
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>{row.name}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>{row.email}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>{row.role}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #eee" }}>{row.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Issue: live region missing — screen readers won't hear row count change */}
      <p>{visible.length} results</p>
    </div>
  );
}
