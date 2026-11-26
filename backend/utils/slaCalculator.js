/**
 * Business-hours-aware SLA Calculator for IT Help Desk.
 * Accounts for working hours, configurable working days, holidays, and SLA pauses.
 */

const DEFAULT_WORKING_HOURS = {
  start: '08:30',
  end: '17:30',
  workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat default; Sun=0
};

function parseTimeToMinutes(hhmm, fallbackMinutes) {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return fallbackMinutes;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallbackMinutes;
  return h * 60 + m;
}

function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildHolidaySet(holidays) {
  const set = new Set();
  if (!Array.isArray(holidays)) return set;
  for (const h of holidays) {
    if (typeof h === 'string' && h.trim()) {
      set.add(h.trim().slice(0, 10));
    } else if (h && typeof h === 'object' && h.date) {
      set.add(String(h.date).trim().slice(0, 10));
    }
  }
  return set;
}

function getWorkingWindow(date, workingHours, holidaySet) {
  const wh = workingHours || DEFAULT_WORKING_HOURS;
  const workingDays = Array.isArray(wh.workingDays) && wh.workingDays.length > 0
    ? wh.workingDays
    : DEFAULT_WORKING_HOURS.workingDays;

  if (!workingDays.includes(date.getDay())) return null;
  if (holidaySet.has(getDateKey(date))) return null;

  const startMin = parseTimeToMinutes(wh.start, 8 * 60 + 30);
  const endMin = parseTimeToMinutes(wh.end, 17 * 60 + 30);
  if (endMin <= startMin) return null;

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  return {
    start: new Date(dayStart.getTime() + startMin * 60000),
    end: new Date(dayStart.getTime() + endMin * 60000),
  };
}

/**
 * Adds `businessMinutes` forward from `startDate` respecting working hours & holidays.
 */
function addBusinessMinutes(startDate, businessMinutes, workingHours, holidays) {
  const totalMinutes = Math.max(0, Number(businessMinutes) || 0);
  if (totalMinutes === 0) return new Date(startDate);

  const holidaySet = buildHolidaySet(holidays);
  let remaining = totalMinutes;
  let cursor = new Date(startDate);

  // Guard against infinite loop if someone misconfigures 0 working days
  for (let safetyDay = 0; safetyDay < 365; safetyDay++) {
    const win = getWorkingWindow(cursor, workingHours, holidaySet);
    if (win) {
      const effectiveStart = cursor > win.start ? cursor : win.start;
      if (effectiveStart < win.end) {
        const availableMin = Math.floor((win.end.getTime() - effectiveStart.getTime()) / 60000);
        if (remaining <= availableMin) {
          return new Date(effectiveStart.getTime() + remaining * 60000);
        }
        remaining -= availableMin;
      }
    }
    // Move cursor to midnight of next day
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0, 0, 0, 0);
  }

  return new Date(startDate.getTime() + totalMinutes * 60000);
}

/**
 * Computes elapsed working minutes between `fromDate` and `toDate`.
 */
function diffBusinessMinutes(fromDate, toDate, workingHours, holidays) {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  if (end <= start) return 0;

  const holidaySet = buildHolidaySet(holidays);
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  let total = 0;

  for (let safetyDay = 0; safetyDay < 3650; safetyDay++) {
    if (cursor > end) break;
    const win = getWorkingWindow(cursor, workingHours, holidaySet);
    if (win) {
      const segStart = start > win.start ? start : win.start;
      const segEnd = end < win.end ? end : win.end;
      if (segEnd > segStart) {
        total += Math.floor((segEnd.getTime() - segStart.getTime()) / 60000);
      }
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 0, 0, 0, 0);
  }

  return total;
}

function computeInitialSlaDeadlines(createdAt, slaRule, settings) {
  const baseDate = new Date(createdAt || Date.now());
  const firstRespMin = slaRule?.firstResponseMinutes ?? 120;
  const resolutionMin = slaRule?.resolutionMinutes ?? 480;
  const workingHours = settings?.workingHours || DEFAULT_WORKING_HOURS;
  const holidays = settings?.holidays || [];

  return {
    firstResponseDueAt: addBusinessMinutes(baseDate, firstRespMin, workingHours, holidays),
    resolutionDueAt: addBusinessMinutes(baseDate, resolutionMin, workingHours, holidays),
  };
}

function evaluateTicketSla(ticket, slaRule, settings, nowDate = new Date()) {
  if (!ticket) return { slaStatus: 'ON_TRACK', remainingMinutes: null, overdueMinutes: 0 };

  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    const resolvedOrNow = ticket.resolvedAt ? new Date(ticket.resolvedAt) : nowDate;
    if (ticket.resolutionDueAt && resolvedOrNow > new Date(ticket.resolutionDueAt)) {
      const overdue = Math.max(1, Math.round((resolvedOrNow - new Date(ticket.resolutionDueAt)) / 60000));
      return { slaStatus: 'BREACHED', remainingMinutes: 0, overdueMinutes: overdue };
    }
    return { slaStatus: 'MET', remainingMinutes: 0, overdueMinutes: 0 };
  }

  if (ticket.status === 'PENDING' && ticket.slaPausedAt) {
    const due = ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt) : null;
    const rem = due ? Math.max(0, Math.round((due - new Date(ticket.slaPausedAt)) / 60000)) : null;
    return { slaStatus: 'PAUSED', remainingMinutes: rem, overdueMinutes: 0 };
  }

  const now = new Date(nowDate);
  const due = ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt) : null;
  if (!due) {
    return { slaStatus: 'ON_TRACK', remainingMinutes: null, overdueMinutes: 0 };
  }

  const diffMs = due.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 0) {
    return {
      slaStatus: 'BREACHED',
      remainingMinutes: 0,
      overdueMinutes: Math.abs(diffMin),
    };
  }

  // Check warning threshold
  const totalWindowMin = slaRule?.resolutionMinutes || 480;
  const warningPct = slaRule?.warningThresholdPercent ?? 75;
  const thresholdRemaining = Math.max(15, Math.round(totalWindowMin * ((100 - warningPct) / 100)));

  if (diffMin <= thresholdRemaining) {
    return {
      slaStatus: 'APPROACHING',
      remainingMinutes: diffMin,
      overdueMinutes: 0,
    };
  }

  return {
    slaStatus: 'ON_TRACK',
    remainingMinutes: diffMin,
    overdueMinutes: 0,
  };
}

module.exports = {
  DEFAULT_WORKING_HOURS,
  addBusinessMinutes,
  diffBusinessMinutes,
  computeInitialSlaDeadlines,
  evaluateTicketSla,
};
