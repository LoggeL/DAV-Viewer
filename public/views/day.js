export function render(container, ctx, { start }) {
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  const alldayRow = document.createElement('div');
  alldayRow.className = 'allday-row';
  const allDayHeader = document.createElement('div');
  allDayHeader.className = 'time-col allday-label';
  allDayHeader.textContent = 'Ganztägig';
  alldayRow.appendChild(allDayHeader);

  const allDayContainer = document.createElement('div');
  allDayContainer.className = 'allday-cells';
  const cell = document.createElement('div');
  cell.className = 'allday-cell';
  cell.dataset.date = ctx.toInputDate(day);
  cell.appendChild(ctx.createDayHeader(day));
  cell.addEventListener('click', () => {
    const startDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const endDate = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    ctx.showEditor({ calendarUrl: ctx.state.calendars[0]?.url || '', start: startDate.toISOString(), end: endDate.toISOString(), allDay: true });
  });
  allDayContainer.appendChild(cell);
  alldayRow.appendChild(allDayContainer);
  container.appendChild(alldayRow);

  const grid = document.createElement('div');
  grid.className = 'time-grid';
  const timeCol = document.createElement('div');
  timeCol.className = 'time-col';
  for (let h = 0; h < 24; h++) {
    const hour = document.createElement('div');
    hour.className = 'hour';
    hour.textContent = String(h).padStart(2, '0') + ':00';
    timeCol.appendChild(hour);
  }
  grid.appendChild(timeCol);

  const daysWrap = document.createElement('div');
  daysWrap.className = 'days-wrap';
  const col = document.createElement('div');
  col.className = 'day-col';
  col.dataset.date = ctx.toInputDate(day);
  const colInner = document.createElement('div');
  colInner.className = 'day-col-inner';
  col.appendChild(colInner);
  col.addEventListener('click', (evt) => {
    const bounds = col.getBoundingClientRect();
    const y = evt.clientY - bounds.top;
    const minutes = Math.max(0, Math.min(1439, Math.round((y / bounds.height) * 1440)));
    const snapped = Math.round(minutes / 30) * 30;
    const startDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(snapped / 60), snapped % 60);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    ctx.showEditor({ calendarUrl: ctx.state.calendars[0]?.url || '', start: startDate.toISOString(), end: endDate.toISOString(), allDay: false });
  });

  const events = ctx.getEventsForVisibleCalendars().filter(({ e }) => ctx.isSameDate(new Date(e.start), day));
  const allDayEvents = events.filter(x => x.e.allDay);
  const timedEvents = events.filter(x => !x.e.allDay);
  for (const { cal, e } of allDayEvents) {
    const chip = ctx.createEventChip(cal, e);
    cell.appendChild(chip);
  }
  const layouts = ctx.layoutOverlappingEvents(timedEvents.map(x => ({
    cal: x.cal, e: x.e, start: new Date(x.e.start), end: new Date(x.e.end)
  })));
  for (const it of layouts) {
    const block = document.createElement('button');
    block.className = 'event-block';
    block.style.borderLeftColor = it.cal.color || 'var(--accent)';
    const top = ctx.minutesFromStartOfDay(it.start) / 60 * ctx.getHourHeightPx();
    const height = Math.max(20, ((ctx.minutesFromStartOfDay(it.end) - ctx.minutesFromStartOfDay(it.start)) / 60) * ctx.getHourHeightPx());
    const widthPercent = 100 / it.trackCount;
    const leftPercent = widthPercent * it.trackIndex;
    block.style.top = `${top}px`;
    block.style.height = `${height}px`;
    block.style.left = `calc(${leftPercent}% + 2px)`;
    block.style.width = `calc(${widthPercent}% - 4px)`;
    block.innerHTML = `<div class=\"evt-time\">${ctx.formatTimeLabel(it.start)}–${ctx.formatTimeLabel(it.end)}</div><div class=\"evt-title\">${ctx.escapeHtml(it.e.summary || '')}</div>`;
    block.addEventListener('click', (ev) => {
      ev.stopPropagation();
      ctx.showEditor({
        href: it.e.href,
        etag: it.e.etag,
        calendarUrl: it.cal.url,
        summary: it.e.summary,
        description: it.e.description,
        location: it.e.location,
        start: it.e.start,
        end: it.e.end,
        allDay: it.e.allDay
      });
    });
    colInner.appendChild(block);
  }

  daysWrap.appendChild(col);
  container.appendChild(grid);
  container.appendChild(daysWrap);
}

