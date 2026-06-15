export function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

export function getCurrentTimeString() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

export function handleKioskScan(staffId) {
  const today = getTodayDateString();
  const time = getCurrentTimeString();
  
  const attendance = JSON.parse(localStorage.getItem('hosur_attendance') || '{}');
  if (!attendance[today]) {
    attendance[today] = {};
  }
  
  // Custom detailed tracking for today
  const dailyDetails = JSON.parse(localStorage.getItem('hosur_attendance_details') || '{}');
  if (!dailyDetails[today]) {
    dailyDetails[today] = {};
  }
  if (!dailyDetails[today][staffId]) {
    dailyDetails[today][staffId] = { inTime: null, outTime: null, events: [] };
  }
  
  const record = dailyDetails[today][staffId];
  let action = '';

  if (!record.inTime) {
    // First scan -> Clock In
    record.inTime = time;
    record.events.push({ time, type: 'CLOCK_IN' });
    attendance[today][staffId] = 'Present';
    action = 'CLOCK_IN';
  } else {
    // Already clocked in -> Clock Out
    // If they already clocked out, scanning again might update outTime (like a real system)
    record.outTime = time;
    record.events.push({ time, type: 'CLOCK_OUT' });
    action = 'CLOCK_OUT';
    
    // Add 1 day salary
    addSalaryForDay(staffId, today);
  }
  
  localStorage.setItem('hosur_attendance', JSON.stringify(attendance));
  localStorage.setItem('hosur_attendance_details', JSON.stringify(dailyDetails));
  
  return { action, time };
}

function addSalaryForDay(staffId, dateStr) {
  const staffList = JSON.parse(localStorage.getItem('hosur_staff') || '[]');
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) return;
  
  let dailyWage = 0;
  if (staff.salaryType === 'Monthly') {
    dailyWage = Math.round(Number(staff.salaryAmount) / 30);
  } else if (staff.salaryType === 'Daily') {
    dailyWage = Number(staff.salaryAmount);
  } else {
    dailyWage = 500; // fallback piece rate
  }
  
  const salaryLog = JSON.parse(localStorage.getItem('hosur_salary_log') || '{}');
  if (!salaryLog[staffId]) {
    salaryLog[staffId] = { totalEarned: 0, daysWorked: [] };
  }
  
  // Only add salary once per day
  if (!salaryLog[staffId].daysWorked.includes(dateStr)) {
    salaryLog[staffId].totalEarned += dailyWage;
    salaryLog[staffId].daysWorked.push(dateStr);
    localStorage.setItem('hosur_salary_log', JSON.stringify(salaryLog));
  }
}

export function getSalaryTotal(staffId) {
  const salaryLog = JSON.parse(localStorage.getItem('hosur_salary_log') || '{}');
  if (!salaryLog[staffId]) return 0;
  return salaryLog[staffId].totalEarned;
}

// For Dashboard / logs
export function getRecentKioskEvents() {
  const today = getTodayDateString();
  const dailyDetails = JSON.parse(localStorage.getItem('hosur_attendance_details') || '{}');
  const staffList = JSON.parse(localStorage.getItem('hosur_staff') || '[]');
  
  if (!dailyDetails[today]) return [];
  
  const events = [];
  Object.keys(dailyDetails[today]).forEach(staffId => {
    const record = dailyDetails[today][staffId];
    const staff = staffList.find(s => s.id === staffId);
    const name = staff ? staff.name : 'Unknown';
    
    record.events.forEach(ev => {
      events.push({
        staffId,
        name,
        time: ev.time,
        type: ev.type
      });
    });
  });
  
  // Sort by time descending
  events.sort((a, b) => b.time.localeCompare(a.time));
  return events;
}
