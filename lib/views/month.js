export function render(container, ctx, { start }) {
  const month = ctx.state.currentDate.getMonth();
  const year = ctx.state.currentDate.getFullYear();

  const header = document.createElement('div');
  header.className = 'weekday-header';
  const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  for (const wd of weekdays) {
    const cell = document.createElement('div');
    cell.textContent = wd;
    header.appendChild(cell);
  }
  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'month-grid';
  container.appendChild(grid);

  const events = ctx.getEventsForVisibleCalendars();
  const eventsByDateKey = ctx.groupEventsByDateKey(events);

  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const isOutside = date.getMonth() !== month;
    const isToday = ctx.isSameDate(date, new Date());
    const dateKey = ctx.toInputDate(date);

    const cell = document.createElement('div');
    cell.className = 'month-day' + (isOutside ? ' outside' : '') + (isToday ? ' today' : '');
    cell.dataset.date = dateKey;

    const head = document.createElement('div');
    head.className = 'month-date';
    head.textContent = String(date.getDate());
    cell.appendChild(head);

    const list = document.createElement('div');
    list.className = 'month-events';
    const dayEvents = eventsByDateKey.get(dateKey) || [];
    const maxChips = 4;
    dayEvents.slice(0, maxChips).forEach(({ cal, e }) => {
      const chip = ctx.createEventChip(cal, e);
      list.appendChild(chip);
    });
    if (dayEvents.length > maxChips) {
      const more = document.createElement('button');
      more.className = 'more-chip';
      more.textContent = `+${dayEvents.length - maxChips} mehr`;
      more.addEventListener('click', (evt) => {
        evt.stopPropagation();
        showDayEventListModal(ctx, dateKey, dayEvents);
      });
      list.appendChild(more);
    }
    cell.appendChild(list);

    cell.addEventListener('click', () => {
      const startTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      ctx.showEditor({ calendarUrl: ctx.state.calendars[0]?.url || '', start: startTime.toISOString(), end: endTime.toISOString(), allDay: false });
    });

    grid.appendChild(cell);
  }
}

function showDayEventListModal(ctx, dateKey, items) {
  const existing = document.querySelector('.modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.className = 'modal';
  const modalCard = document.createElement('div');
  modalCard.className = 'modal-card';
  const title = document.createElement('div');
  title.className = 'modal-title';
  const d = new Date(dateKey + 'T00:00:00');
  title.textContent = ctx.formatLongDate(d);
  const list = document.createElement('div');
  list.className = 'modal-list';
  for (const { cal, e } of items) {
    const row = document.createElement('button');
    row.className = 'modal-row';
    row.innerHTML = `<span class="dot" style="background:${cal.color || 'var(--muted)'}"></span><span>${ctx.escapeHtml(e.summary || '')}</span><span class="time">${ctx.formatDateTime(e.start, e.allDay)}</span>`;
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
      modal.remove();
    });
    list.appendChild(row);
  }
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = 'Schließen';
  closeBtn.addEventListener('click', () => modal.remove());
  modalCard.append(title, list, closeBtn);
  modal.appendChild(modalCard);
  document.body.appendChild(modal);
}

