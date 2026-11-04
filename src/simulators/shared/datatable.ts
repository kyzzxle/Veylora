/**
 * createDataTable — records experiment trials into a <DataTable> component.
 *
 *   const table = createDataTable(root, 'drops', [
 *     { key: 'h', label: 'Height (m)', format: (v) => v.toFixed(2) },
 *     { key: 't', label: 'Time (s)', format: (v) => v.toFixed(3) },
 *   ], { onRecord: () => ({ h: state.h, t: state.t }), filename: 'drop-times.csv' });
 */

export interface Column<R> {
  key: keyof R & string;
  label: string;
  format?: (v: R[keyof R]) => string;
}

export function createDataTable<R extends Record<string, number | string>>(
  root: HTMLElement,
  id: string,
  columns: Column<R>[],
  opts: {
    /** Return the row to record, or null if nothing can be recorded yet. */
    onRecord: () => R | null;
    onChange?: (rows: R[]) => void;
    filename?: string;
    max?: number;
  },
) {
  const found = root.querySelector<HTMLElement>(`[data-table="${id}"]`);
  if (!found) throw new Error(`Data table not found: ${id}`);
  const box: HTMLElement = found;
  const body = box.querySelector<HTMLTableSectionElement>('[data-table-body]')!;
  const emptyRow = body.querySelector('.empty-row');
  const count = box.querySelector<HTMLElement>('[data-table-count]');
  const recordBtn = box.querySelector<HTMLButtonElement>('[data-table-record]');
  const csvBtn = box.querySelector<HTMLButtonElement>('[data-table-csv]');
  const clearBtn = box.querySelector<HTMLButtonElement>('[data-table-clear]');
  const rows: R[] = [];
  const max = opts.max ?? 50;

  const fmt = (c: Column<R>, r: R) => (c.format ? c.format(r[c.key]) : String(r[c.key]));

  function render(newest = false) {
    body.querySelectorAll('tr:not(.empty-row)').forEach((tr) => tr.remove());
    if (emptyRow) (emptyRow as HTMLElement).hidden = rows.length > 0;
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (newest && i === rows.length - 1) tr.className = 'is-new';
      tr.innerHTML = `<th scope="row">${i + 1}</th>` + columns.map((c) => `<td>${fmt(c, r)}</td>`).join('');
      body.appendChild(tr);
    });
    if (count) count.textContent = `${rows.length} trial${rows.length === 1 ? '' : 's'}`;
    if (csvBtn) csvBtn.disabled = rows.length === 0;
    if (clearBtn) clearBtn.disabled = rows.length === 0;
    opts.onChange?.(rows);
  }

  function add(row: R) {
    rows.push(row);
    if (rows.length > max) rows.shift();
    render(true);
    // Scroll only inside the table, never the page (the simulator must stay in view)
    const wrap = box.querySelector<HTMLElement>('.table-wrap');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }

  recordBtn?.addEventListener('click', () => {
    const row = opts.onRecord();
    if (row) add(row);
  });
  clearBtn?.addEventListener('click', () => {
    rows.length = 0;
    render();
  });
  csvBtn?.addEventListener('click', () => {
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [['Trial', ...columns.map((c) => c.label)].map(esc).join(',')];
    rows.forEach((r, i) => lines.push([String(i + 1), ...columns.map((c) => fmt(c, r))].map(esc).join(',')));
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = opts.filename ?? `${id}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  render();
  return {
    rows,
    add,
    clear() {
      rows.length = 0;
      render();
    },
    setRecordEnabled(on: boolean) {
      if (recordBtn) recordBtn.disabled = !on;
    },
  };
}
