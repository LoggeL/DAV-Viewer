export function render(container, ctx, { start, end }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'week-grid';

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push(d);
  }

  const allDayRow = document.createElement('div');
  allDayRow.className = 'allday-row';
  const allDayHeader = document.createElement('div');
  allDayHeader.className = 'time-col allday-label';
  allDayHeader.textContent = 'Ganztägig';
  allDayRow.appendChild(allDayHeader);

  const allDayContainer = document.createElement('div');
  allDayContainer.className = 'allday-cells';
  for (let i = 0; i < 7; i++) {
    const cell = document.createElement('div');
    cell.className = 'allday-cell';
    cell.dataset.date = ctx.toInputDate(days[i]);
    cell.appendChild(ctx.createDayHeader(days[i]));
    cell.addEventListener('click', () => {
      const date = days[i];
      const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      ctx.showEditor({ calendarUrl: ctx.state.calendars[0]?.url || '', start: startDate.toISOString(), end: endDate.toISOString(), allDay: true });
    });
    allDayContainer.appendChild(cell);
  }
  allDayRow.appendChild(allDayContainer);
  wrapper.appendChild(allDayRow);

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

  const events = ctx.getEventsForVisibleCalendars();
  const eventsByDay = new Map();
  for (const d of days) eventsByDay.set(ctx.toInputDate(d), []);
  for (const item of events) {
    const dateKey = ctx.toInputDate(new Date(item.e.start));
    if (eventsByDay.has(dateKey)) eventsByDay.get(dateKey).push(item);
  }

  for (let i = 0; i < 7; i++) {
    const dayDate = days[i];
    const dateKey = ctx.toInputDate(dayDate);
    const col = document.createElement('div');
    col.className = 'day-col';
    col.dataset.date = dateKey;

    const colInner = document.createElement('div');
    colInner.className = 'day-col-inner';
    col.appendChild(colInner);

    col.addEventListener('click', (evt) => {
      const bounds = col.getBoundingClientRect();
      const y = evt.clientY - bounds.top;
      const minutes = Math.max(0, Math.min(1439, Math.round((y / bounds.height) * 1440)));
      const snapped = Math.round(minutes / 30) * 30;
      const startDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), Math.floor(snapped / 60), snapped % 60);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      ctx.showEditor({ calendarUrl: ctx.state.calendars[0]?.url || '', start: startDate.toISOString(), end: endDate.toISOString(), allDay: false });
    });

    const dayEvents = (eventsByDay.get(dateKey) || []);
    const allDayEvents = dayEvents.filter(x => x.e.allDay);
    const timedEvents = dayEvents.filter(x => !x.e.allDay);

    const alldayCell = allDayContainer.children[i];
    for (const { cal, e } of allDayEvents) {
      const chip = ctx.createEventChip(cal, e);
      alldayCell.appendChild(chip);
    }

    const layouts = ctx.layoutOverlappingEvents(timedEvents.map(x => ({
      cal: x.cal,
      e: x.e,
      start: new Date(x.e.start),
      end: new Date(x.e.end)
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
      block.innerHTML = `<div class="evt-time">${ctx.formatTimeLabel(it.start)}–${ctx.formatTimeLabel(it.end)}</div><div class="evt-title">${ctx.escapeHtml(it.e.summary || '')}</div>`;
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
  }

  wrapper.appendChild(grid);
  wrapper.appendChild(daysWrap);
  container.appendChild(wrapper);
}

