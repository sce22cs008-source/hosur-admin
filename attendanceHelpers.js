/** Attendance time rules (24h, minutes from midnight) */
const RULES = {
  LOGIN_START: 8 * 60 + 30,         // 8:30 AM — earliest login
  LOGIN_ON_TIME_END: 9 * 60 + 30,     // 9:30 AM — after this = Late Entry (approval)
  LOGIN_LATE_END: 10 * 60,            // 10:00 AM — after this = Blocked until Half Day
  HALF_DAY_LOGIN_START: 12 * 60,      // 12:00 PM — Half Day Login opens
  HALF_DAY_LOGIN_END: 13 * 60,        // 1:00 PM — Half Day Login ends
  LOGOUT_START: 17 * 60 + 30,       // 5:30 PM — earliest normal logout
  LOGOUT_NORMAL_END: 18 * 60 + 30,   // 6:30 PM — after this = OT (approval)
};

function getDayBounds(date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatTime12(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function minutesToHours(minutes) {
  return parseFloat((minutes / 60).toFixed(2));
}

function computeWorkedHours(checkInTime, checkOutTime) {
  const diff = parseTimeToMinutes(checkOutTime) - parseTimeToMinutes(checkInTime);
  return minutesToHours(Math.max(0, diff));
}

function getCurrentTimeStr() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Classify check-in based on current time */
function classifyCheckIn(nowMin = getNowMinutes()) {
  if (nowMin < RULES.LOGIN_START) {
    return { allowed: false, reason: 'TOO_EARLY', message: `Login opens at ${formatTime12(RULES.LOGIN_START)}` };
  }
  
  // 08:30 - 09:30 => Present
  if (nowMin <= RULES.LOGIN_ON_TIME_END) {
    return { allowed: true, status: 'Present', approvalStatus: 'Approved', category: 'regular', isLate: false };
  }
  
  // 09:30 - 10:00 => Late Entry
  if (nowMin <= RULES.LOGIN_LATE_END) {
    return {
      allowed: true,
      status: 'Late',
      approvalStatus: 'Pending',
      category: 'late_entry',
      isLate: true,
      message: 'Late Entry — sent for admin approval',
    };
  }

  // 10:00 - 12:00 => Blocked Dead Zone
  if (nowMin < RULES.HALF_DAY_LOGIN_START) {
    return { allowed: false, reason: 'BLOCKED', message: `Login closed at ${formatTime12(RULES.LOGIN_LATE_END)}. Half Day login opens at ${formatTime12(RULES.HALF_DAY_LOGIN_START)}.` };
  }

  // 12:00 - 13:00 => Half Day Login
  if (nowMin <= RULES.HALF_DAY_LOGIN_END) {
    return {
      allowed: true,
      status: 'Half Day',
      approvalStatus: 'Approved',
      category: 'half_day_login',
      isLate: false,
      message: 'Half Day Login recorded.',
    };
  }

  // After 13:00 => Blocked
  return { allowed: false, reason: 'TOO_LATE', message: `Check-in is closed for today.` };
}

/** Classify check-out based on current time */
function classifyCheckOut(nowMin = getNowMinutes()) {
  // 12:00 - 13:00 => Half Day Logout
  if (nowMin >= RULES.HALF_DAY_LOGIN_START && nowMin <= RULES.HALF_DAY_LOGIN_END) {
    return {
      allowed: true,
      status: 'Half Day',
      approvalStatus: 'Approved',
      category: 'half_day_logout',
      isOT: false,
      message: 'Half Day Logout recorded.',
    };
  }

  // Before 17:30 (and not half day) => Blocked
  if (nowMin < RULES.LOGOUT_START) {
    return {
      allowed: false,
      reason: 'TOO_EARLY_LOGOUT',
      message: `Logout opens at ${formatTime12(RULES.LOGOUT_START)}`,
      logoutOpensAt: formatTime12(RULES.LOGOUT_START),
    };
  }
  
  // 17:30 - 18:30 => Normal Logout
  if (nowMin <= RULES.LOGOUT_NORMAL_END) {
    return { allowed: true, status: 'Present', approvalStatus: 'Approved', category: 'regular', isOT: false };
  }

  // After 18:30 => Overtime
  return {
    allowed: true,
    status: 'Present',
    approvalStatus: 'Pending',
    category: 'overtime',
    isOT: true,
    message: 'Overtime (OT) — sent for admin approval',
  };
}

function determineCheckInStatus(timeStr) {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes >= RULES.HALF_DAY_LOGIN_START) return 'Half Day';
  if (minutes > RULES.LOGIN_ON_TIME_END) return 'Late';
  return 'Present';
}

module.exports = {
  RULES,
  getDayBounds,
  parseTimeToMinutes,
  getNowMinutes,
  formatTime12,
  minutesToHours,
  computeWorkedHours,
  getCurrentTimeStr,
  classifyCheckIn,
  classifyCheckOut,
  determineCheckInStatus,
};
