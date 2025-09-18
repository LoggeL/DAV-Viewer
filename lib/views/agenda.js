export function render(container, ctx, { start, end }) {
  const list = document.createElement('div');
  list.className = 'agenda-list';

  const all = ctx.getEventsForVisibleCalendars();
  const within = all.filter(({ e }) => {
    const s = new Date(e.start);
    return s >= start && s <= end;
  });

  const byDate = ctx.groupEventsByDateKey(within);
  const keys = Array.from(byDate.keys()).sort();

  for (const key of keys) {
    const dayDate = new Date(key + 'T00:00:00');
    const day = document.createElement('div');
    day.className = 'agenda-day';

    const dateLabel = document.createElement('div');
    dateLabel.className = 'agenda-date';
    dateLabel.textContent = ctx.formatLongDate(dayDate);
    day.appendChild(dateLabel);

    const items = document.createElement('div');
    items.className = 'agenda-items';

    const entries = byDate.get(key) || [];
    for (const { cal, e } of entries) {
      const row = document.createElement('button');
      row.className = 'agenda-row';
      const timeLabel = e.allDay ? 'Ganztägig' : `${ctx.formatTimeLabel(new Date(e.start))} – ${ctx.formatTimeLabel(new Date(e.end))}`;
      row.innerHTML = `<span class="dot" style="background:${cal.color || 'var(--muted)'}"></span><span class="title">${ctx.escapeHtml(e.summary || '')}</span><span class="time">${ctx.escapeHtml(timeLabel)}</span>`;
      row.addEventListener('click', () => {
        ctx.showEditor({
          href: e.href,
          etag: e.etag,
          calendarUrl: cal.url,
          summary: e.summary,
          description: e.description,
          location: e.location,
          start: e.start,
          end: e.end,
          allDay: e.allDay
        });
      });
      items.appendChild(row);
    }

    day.appendChild(items);
    list.appendChild(day);
  }

  if (keys.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'msg';
    empty.textContent = 'Keine Termine im Zeitraum.';
    list.appendChild(empty);
  }

  container.appendChild(list);
}

