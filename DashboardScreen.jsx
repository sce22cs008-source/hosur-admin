import React, { useState, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, Label } from 'recharts';
import { 
  LayoutDashboard, Users, Clock, FileText, BookOpen, 
  CreditCard, HelpCircle, Settings, ChevronDown,
  Fingerprint, AlertCircle, Calendar, ChevronLeft, ChevronRight,
  Info, Briefcase, ChevronRight as ChevronRightIcon,
  ArrowLeft, Filter, Search, Download, ExternalLink,
  TriangleAlert, UserPlus, FileSpreadsheet, UploadCloud,
  CheckCircle2, Circle, Lock, LogIn, Coffee, LogOut, Clock3,
  Building2, CalendarDays, Trash2, User, Check, Receipt, MapPin, Camera, Map, CheckSquare, ThumbsDown, X, Menu, Eye
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import './Dashboard.css';
import './SalarySlip.css';
import './StaffRegistration.css';
import './SiteWork.css';

const AnimatedNumber = ({ end, duration = 1000 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    let animationFrame;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeProgress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <>{count}</>;
};


// --- WAGE CALCULATION UTILITY ---
export const calculateWageBreakdown = (fixedGross, dutyDays, totalMonthDays, otHours, deductionsAmount) => {
  const gross = Number(fixedGross) || 0;
  const duty = Number(dutyDays) || 0;
  const monthDays = Number(totalMonthDays) || 30;
  const ot = Number(otHours) || 0;
  const otherDedn = Number(deductionsAmount) || 0;

  // 1. Fixed Wages
  const fixedBasic = Math.round(gross * 0.40);
  const fixedHra = Math.round(gross * 0.20);
  const fixedConv = Math.round(gross * 0.17);
  const fixedMed = Math.round(gross * 0.03);
  const fixedSpl = Math.round(gross * 0.20);

  // Pro-ration factor (cap at 1 to prevent > 100% if duty > monthDays)
  const ratio = Math.min(duty / monthDays, 1);

  // 2. Earned Wages
  const earnedBasic = Math.round(fixedBasic * ratio);
  const earnedHra = Math.round(fixedHra * ratio);
  const earnedConv = Math.round(fixedConv * ratio);
  const earnedMed = Math.round(fixedMed * ratio);
  const earnedSpl = Math.round(fixedSpl * ratio);
  const earnedGross = earnedBasic + earnedHra + earnedConv + earnedMed + earnedSpl;

  // 3. OT Amount (Hourly rate based on 8 hour workday)
  const perDay = gross / monthDays;
  const otRate = perDay / 8;
  const otAmt = Math.round(ot * otRate);

  // 4. Total Gross
  const totalGross = earnedGross + otAmt;

  // 5. Deductions
  const pf = Math.round(earnedBasic * 0.12);
  const esi = Math.round(totalGross * 0.0075);
  const totalDedn = pf + esi + otherDedn;

  // 6. Net Salary
  const netSalary = totalGross - totalDedn;

  return {
    fixed: { gross, basic: fixedBasic, hra: fixedHra, conv: fixedConv, med: fixedMed, spl: fixedSpl },
    attendance: { duty, ot },
    earned: { basic: earnedBasic, hra: earnedHra, conv: earnedConv, med: earnedMed, spl: earnedSpl, gross: earnedGross, otAmt, totalGross },
    deductions: { pf, esi, other: otherDedn, total: totalDedn },
    netSalary
  };
};
// --------------------------------

const renderPieLabel = (props) => {
  const { cx, cy, midAngle, outerRadius, fill, name } = props;
  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius) * cos;
  const sy = cy + (outerRadius) * sin;
  const mx = cx + (outerRadius + 15) * cos;
  const my = cy + (outerRadius + 15) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 20;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#999" fill="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 5} y={ey - 5} textAnchor={textAnchor} fill="#333" fontSize="12" fontWeight="600">
        {name}
      </text>
      <line x1={ex + (cos >= 0 ? 1 : -1) * 5} y1={ey + 4} x2={ex + (cos >= 0 ? 1 : -1) * 40} y2={ey + 4} stroke={fill} strokeWidth="3" />
    </g>
  );
};

const DashboardScreen = () => {

  const parseTime = (timeStr) => {
    if (!timeStr || timeStr === '-') return 0;
    const parts = timeStr.trim().split(' ');
    const time = parts[0];
    const modifier = parts.length > 1 ? parts[1] : '';
    let [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours)) hours = 0;
    if (isNaN(minutes)) minutes = 0;
    if (modifier) {
      if (hours === 12) { hours = modifier.toUpperCase() === 'AM' ? 0 : 12; }
      else if (modifier.toUpperCase() === 'PM') { hours = hours + 12; }
    }
    return hours * 60 + minutes;
  };

  const format12Hour = (timeStr) => {
    if (!timeStr || timeStr === '-') return '-';
    // If already 12-hour format with AM/PM, don't change
    if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) return timeStr;
    let mins = parseTime(timeStr);
    let h = Math.floor(mins / 60);
    let m = mins % 60;
    let ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const getFineMins = (shiftName, inTimeStr) => {
    if (!inTimeStr || inTimeStr === '-') return 0;
    let shiftStartStr = '09:30 AM'; // Default as requested by user
    if (shiftName === 'Night Shift') shiftStartStr = '09:30 PM';
    else if (shiftName === 'Office Shift') shiftStartStr = '09:30 AM';
    else if (shiftName === 'Day Shift') shiftStartStr = '09:30 AM';
    
    const inMins = parseTime(inTimeStr);
    const startMins = parseTime(shiftStartStr);
    let diff = inMins - startMins;
    if (diff <= 0) return 0;
    return diff;
  };
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dailyAttendanceFilter, setDailyAttendanceFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3000); };
  const [dashboardView, setDashboardView] = useState('overview');
  const [expandedStaffId, setExpandedStaffId] = useState(null);
  const [staffViewMode, setStaffViewMode] = useState('list');
  const [siteWorkView, setSiteWorkView] = useState('assignments');
  const [siteAssignments, setSiteAssignments] = useState([]);
  const [siteActivityLogs, setSiteActivityLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPresent, setFilterPresent] = useState(true);
  const [filterAbsent, setFilterAbsent] = useState(true);
  const [filterPending, setFilterPending] = useState(true);

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterDept, setFilterDept] = useState('All');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [trackInOutTime, setTrackInOutTime] = useState(false);
  const [dailyWorkEntry, setDailyWorkEntry] = useState(false);
  
  // Custom dropdown states for bulk onboarding
  const [staffTypeOpen, setStaffTypeOpen] = useState(false);
  const [selectedStaffType, setSelectedStaffType] = useState('');
  const [salaryTemplateOpen, setSalaryTemplateOpen] = useState(false);
  const [selectedSalaryTemplate, setSelectedSalaryTemplate] = useState('');
  const [workHoursDate, setWorkHoursDate] = useState(new Date().toISOString().split('T')[0]);
  const [workHoursSearch, setWorkHoursSearch] = useState('');

  // Dropdown & Report states
  const [attendanceViewTab, setAttendanceViewTab] = useState('daily');
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);
  const [reportTab, setReportTab] = useState('payment'); // 'payment' or 'attendance'
  const [attendanceSettingsOpen, setAttendanceSettingsOpen] = useState(false);
  const [smsToggle, setSmsToggle] = useState(true);
  const [expandedReport, setExpandedReport] = useState(null);
  const [addEntryModalOpen, setAddEntryModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState('You Paid');
  const [reportsSelectedStaff, setReportsSelectedStaff] = useState('');
  const [reportsSearchQuery, setReportsSearchQuery] = useState('');

  // Ledger State
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerType, setLedgerType] = useState('Allowance');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerStaffId, setLedgerStaffId] = useState('');
  const [ledgerDescription, setLedgerDescription] = useState('');

  // Settings State
  const [settingsView, setSettingsView] = useState('main'); // 'main', 'shift-settings', 'create-shift', 'automation-rules', 'attendance-holidays', 'holiday-policy', 'leave-policy', 'staff-details'
  const [attendanceSettingsModalOpen, setAttendanceSettingsModalOpen] = useState(false);
  const [staffAccessModalOpen, setStaffAccessModalOpen] = useState(false);
  const [trackTimeModalOpen, setTrackTimeModalOpen] = useState(false);
  const [markAbsentModalOpen, setMarkAbsentModalOpen] = useState(false);
  const [inviteStaffModalOpen, setInviteStaffModalOpen] = useState(false);
  const [monthCalculationModalOpen, setMonthCalculationModalOpen] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState('Staff attendance with Selfie & Location');
  const [trackInOutToggle, setTrackInOutToggle] = useState(false);
  const [noAttendanceToggle, setNoAttendanceToggle] = useState(false);

  // Salary Slip State
  const [slipSelectedStaff, setSlipSelectedStaff] = useState('');
  const [slipMonthYear, setSlipMonthYear] = useState('06/2026');
  const [cashBookDate, setCashBookDate] = useState(new Date());

  // New Add Staff Form State
  const [addStaffModalOpen, setAddStaffModalOpen] = useState(false);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [showFineModal, setShowFineModal] = useState(false);
  const [showMusterRollModal, setShowMusterRollModal] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState(null); // 'present' or 'absent'
  const [musterRollMonthYear, setMusterRollMonthYear] = useState(new Date().toISOString().slice(0, 7));
  const [newStaff, setNewStaff] = useState({ 
    name: '', phone: '', empId: '', address: '', joinDate: '',
    dept: '', shift: '', aadharNumber: '',
    basicSalary: '', bankName: '', accountNumber: '', ifsc: '',
    photo: null
  });

  // Firestore Staff Data & Logs
  const [staffData, setStaffData] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [salaryTransactions, setSalaryTransactions] = useState([]);

  useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, "staff"), (snapshot) => {
      const staffList = [];
      snapshot.forEach((doc) => {
        staffList.push({ id: doc.id, ...doc.data() });
      });
      staffList.sort((a, b) => a.name.localeCompare(b.name));
      setStaffData(staffList);
    });

    const unsubLogs = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const logsList = [];
      snapshot.forEach((doc) => logsList.push({ id: doc.id, ...doc.data() }));
      setAttendanceLogs(logsList);
    });

    const unsubTx = onSnapshot(collection(db, "salary_transactions"), (snapshot) => {
      const txList = [];
      snapshot.forEach((doc) => txList.push({ id: doc.id, ...doc.data() }));
      setSalaryTransactions(txList);
    });

    return () => {
      unsubStaff();
      unsubLogs();
      unsubTx();
    };
  }, []);

  // Continuous silent deduplication script to enforce unique staff names
  useEffect(() => {
  const deduplicateStaff = async () => {
      if (staffData.length > 0) {
        const seenNames = new Set();
        const duplicates = [];
        
        for (const staff of staffData) {
          const lowerName = String(staff.name || '').toLowerCase().trim();
          if (seenNames.has(lowerName)) {
            duplicates.push(staff.id);
          } else {
            seenNames.add(lowerName);
          }
        }
        
        if (duplicates.length > 0) {
          for (const id of duplicates) {
            try {
              await deleteDoc(doc(db, "staff", id));
            } catch (error) {
              console.error("Error deleting duplicate doc:", id, error);
            }
          }
        }
      }
    };
    deduplicateStaff();
  }, [staffData]);

  const getLocalDateStr = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const isToday = attendanceDate === new Date().toISOString().split('T')[0];
  
  const dailyStaffData = staffData.map(staff => {
    const dayLogs = attendanceLogs.filter(l => l.employeeId === staff.id && getLocalDateStr(l.dateIso) === attendanceDate);
    const checkin = dayLogs.find(l => l.type === 'checkin');
    const checkout = dayLogs.find(l => l.type === 'checkout');
    
    if (!checkin && !checkout) {
      const isFutureDate = attendanceDate > new Date().toISOString().split('T')[0];
      return { ...staff, status: isFutureDate ? 'Not Marked' : 'Absent', in: '-', out: '-', ot: '00:00', otMins: 0 };
    }
    
    let status = 'Not Marked';
    if (checkin) {
      status = checkin.status || 'Present';
    }
    if (checkout && checkout.status && checkout.status !== 'Present') {
      status = checkout.status;
    }
    
    let ot = '00:00';
    let otMins = 0;
    if (checkout) {
      const outMins = parseTime(checkout.time);
      if (outMins > 1110) {
        otMins = outMins - 1110;
        const h = Math.floor(otMins / 60).toString().padStart(2, '0');
        const m = (otMins % 60).toString().padStart(2, '0');
        ot = `${h}:${m}`;
      }
    }
    
    return {
      ...staff,
      status: status || 'Present',
      in: (checkin && status !== 'Absent') ? format12Hour(checkin.time) : '-',
      out: (checkout && status !== 'Absent') ? format12Hour(checkout.time) : '-',
      ot,
      otMins
    };
  });

  const allDeptsList = [...new Set([...['Plant Head', 'Design', 'Technician', 'Supervisor', 'Accounts', 'Welder', 'Helper-weld', 'Helper', 'Helper-site', 'Housekeeping'], ...staffData.map(s => s.dept).filter(Boolean)])];

  const filteredData = dailyStaffData.filter(staff => {
    const matchesSearch = String(staff.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = filterDept === 'All' || staff.dept === filterDept;
    
    let matchesStatus = true;
    const s = staff.status || 'Pending';
    if (s === 'Present' || s === 'Half Day' || s === 'Late' || s === 'Late / Present') {
      matchesStatus = filterPresent;
    } else if (s === 'Absent') {
      matchesStatus = filterAbsent;
    } else {
      matchesStatus = filterPending;
    }

    return matchesSearch && matchesDept && matchesStatus;
  });

  const summaryMetrics = {
    total: filteredData.length,
    present: filteredData.filter(s => s.status === 'Present').length,
    absent: filteredData.filter(s => s.status === 'Absent').length,
    halfDay: filteredData.filter(s => s.status === 'Half Day').length,
    late: filteredData.filter(s => s.status === 'Late' || s.status === 'Late / Present').length,
    paidLeave: filteredData.filter(s => s.status === 'Paid Leave').length,
    site: filteredData.filter(s => s.status === 'Site').length,
    otMins: 0,
    fineAmt: 0
  };

  filteredData.forEach(s => {
    if (s.ot && s.ot !== '00:00' && s.ot !== '-') {
      const parts = s.ot.split(':');
      if (parts.length === 2) {
        summaryMetrics.otMins += (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
      }
    }
    if (s.fine) {
      summaryMetrics.fineAmt += Number(s.fine);
    }
  });

  const formattedOt = `${Math.floor(summaryMetrics.otMins / 60).toString().padStart(2, '0')}:${(summaryMetrics.otMins % 60).toString().padStart(2, '0')}`;
  const formattedFine = summaryMetrics.fineAmt > 0 ? summaryMetrics.fineAmt.toString() : '00:00';

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_SIZE = 400;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setNewStaff(prev => ({ ...prev, photo: dataUrl, photoFile: null }));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.phone) {
      alert('Name and Phone are required.');
      return;
    }
    try {
      const staffDataToSave = {
        name: newStaff.name || '',
        phone: newStaff.phone || '',
        empId: newStaff.empId || '',
        address: newStaff.address || '',
        joinDate: newStaff.joinDate || '',
        dept: newStaff.dept || '',
        shift: newStaff.shift || '',
        aadharNumber: newStaff.aadharNumber || '',
        basicSalary: newStaff.basicSalary || '',
        bankName: newStaff.bankName || '',
        accountNumber: newStaff.accountNumber || '',
        ifsc: newStaff.ifsc || '',
        photo: newStaff.photo || '',
      };

      if (newStaff.id) {
        await updateDoc(doc(db, "staff", newStaff.id), staffDataToSave);
      } else {
        await addDoc(collection(db, "staff"), {
          ...staffDataToSave,
          status: 'Pending', 
          in: '-',
          out: '-',
          ot: '00:00'
        });
      }
      setAddStaffModalOpen(false);
      setNewStaff({ 
        name: '', phone: '', empId: '', address: '', joinDate: '',
        dept: '', shift: '', aadharNumber: '',
        basicSalary: '', bankName: '', accountNumber: '', ifsc: '',
        photo: null
      });
      setStaffViewMode('list');
    } catch (e) {
      console.error("Error adding document: ", e);
      alert('Failed to add staff');
    }
  };

  const handleSaveLedger = async () => {
    if (!ledgerStaffId || !ledgerAmount) {
      alert('Please select staff and enter an amount.');
      return;
    }
    try {
      await addDoc(collection(db, 'salary_transactions'), {
        employeeId: ledgerStaffId,
        type: ledgerType,
        amount: Number(ledgerAmount),
        description: ledgerDescription,
        dateIso: new Date().toISOString()
      });
      setLedgerModalOpen(false);
      setLedgerAmount('');
      setLedgerDescription('');
      showToast(`${ledgerType} saved successfully!`);
    } catch (e) {
      console.error(e);
      alert('Failed to save transaction');
    }
  };

  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to permanently delete ALL staff from the database?")) {
      try {
        for (const staff of staffData) {
          await deleteDoc(doc(db, "staff", staff.id));
        }
        alert("All staff data has been cleared!");
      } catch (error) {
        console.error("Error clearing data: ", error);
        alert("Failed to clear data.");
      }
    }
  };

  const aggregateStats = (groupKey) => {
    const stats = {};
    dailyStaffData.forEach(s => {
      const key = s[groupKey] || 'Unassigned';
      if (!stats[key]) stats[key] = { name: key, p: 0, a: 0, nm: 0, hd: 0, ot: 0, f: 0, l: 0, s: 0 };
      stats[key].s++; // total staff
      if (s.status === 'Present') { stats[key].p++; }
      else if (s.status === 'Absent') { stats[key].a++; }
      else if (s.status === 'Half Day') { stats[key].p++; stats[key].hd++; }
      else if (s.status === 'Late' || s.status === 'Late / Present') { stats[key].p++; stats[key].l++; }
      else { stats[key].nm++; }
    });
    return Object.values(stats);
  };
  const deptStats = aggregateStats('dept');
  const shiftStats = aggregateStats('shift');

  const handleDownload = () => {
    const headers = ['Name', 'Department', 'Shift', 'Attendance', 'In Time', 'Out Time', 'Overtime'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => 
        `"${row.name}","${row.dept}","${row.shift}","${row.status}","${row.in}","${row.out}","${row.ot}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Attendance_Report_${attendanceDate}.csv`;
    link.click();
  };

  const generateDailyAttendancePDF = () => {
    const element = document.getElementById('daily-attendance-table-container');
    if (!element) return;

    // Show the title for PDF
    const titleElement = element.querySelector('.pdf-only-title');
    if (titleElement) titleElement.style.display = 'block';

    const opt = {
      margin:       10,
      filename:     `Attendance_Daily_${attendanceDate}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      // Hide the title again
      if (titleElement) titleElement.style.display = 'none';
    });
  };

  const viewDailyAttendancePDF = () => {
    const element = document.getElementById('daily-attendance-table-container');
    if (!element) return;

    const titleElement = element.querySelector('.pdf-only-title');
    if (titleElement) titleElement.style.display = 'block';

    const opt = {
      margin:       10,
      filename:     `Attendance_Daily_${attendanceDate}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).toPdf().get('pdf').then(function (pdf) {
      if (titleElement) titleElement.style.display = 'none';
      window.open(pdf.output('bloburl'), '_blank');
    });
  };


  const downloadAttendancePDF = () => {
    const element = document.getElementById('pdf-export-container');
    if (!element) return;
    
    // Temporarily bring it on screen to ensure proper capture
    element.style.left = '0px';
    element.style.zIndex = '9999';

    const opt = {
      margin:       0.2,
      filename:     `Attendance_Report_${musterRollMonthYear}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a3', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
        // Restore
        element.style.left = '-9999px';
        element.style.zIndex = 'initial';
    });
  };

  const downloadAttendanceExcel = () => {
    const [rYear, rMonth] = musterRollMonthYear.split('-');
    const rDaysInMonth = new Date(rYear, rMonth, 0).getDate();
    const rDaysArray = Array.from({length: rDaysInMonth}, (_, i) => i + 1);
    const todayStr = new Date().toISOString().split('T')[0];
    
    const headers = ['S.No', 'Staff Name', ...rDaysArray.map(d => `${d}`), 'Present Count', 'Absent Count'];
    const csvRows = [headers.join(',')];
    
    staffData.forEach((staff, idx) => {
        const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
        let presentCount = 0;
        let absentCount = 0;
        const dayStatuses = rDaysArray.map(dayStr => {
           const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
           const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
           const checkin = dayLogs.find(l => l.type === 'checkin');
           if (checkin && checkin.status === 'Half Day') {
               presentCount += 0.5;
               return 'H';
           } else if (checkin && checkin.status !== 'Absent') {
               presentCount++;
               return 'P';
           } else {
               const isFutureDate = dateStr > todayStr;
               if (!isFutureDate) {
                   absentCount++;
                   return 'A';
               }
               return '-';
           }
        });
        const row = [
            idx + 1,
            `"${staff.name || ''}"`,
            ...dayStatuses,
            presentCount,
            absentCount
        ];
        csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Report_${musterRollMonthYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReportDownload = (reportName) => {
    const dataToExport = reportsSelectedStaff 
      ? staffData.filter(s => s.id === reportsSelectedStaff) 
      : staffData;

    const currentMonth = new Date(attendanceDate).getMonth();
    const currentYear = new Date(attendanceDate).getFullYear();
    
    const headers = ['Staff Name', 'Department', 'Basic Salary', 'Days Worked', 'OT Hours', 'Allowance', 'Bonus', 'Deduction', 'Net Salary'];
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row => {
        const staffLogs = attendanceLogs.filter(l => l.employeeId === row.id && new Date(l.dateIso).getMonth() === currentMonth && new Date(l.dateIso).getFullYear() === currentYear);
        
        const uniqueDays = new Set();
        let otMins = 0;
        staffLogs.forEach(l => {
           if(l.type === 'checkin') uniqueDays.add(new Date(l.dateIso).toDateString());
           if(l.type === 'checkout' && l.otMinutes) otMins += l.otMinutes;
        });
        
        const daysWorked = uniqueDays.size;
        const otHours = Math.floor(otMins / 60) + (otMins % 60) / 100;
        
        const staffTxs = salaryTransactions.filter(t => t.employeeId === row.id && new Date(t.dateIso).getMonth() === currentMonth && new Date(t.dateIso).getFullYear() === currentYear);
        const allowance = staffTxs.filter(t => t.type === 'Allowance').reduce((s, t) => s + Number(t.amount), 0);
        const bonus = staffTxs.filter(t => t.type === 'Bonus').reduce((s, t) => s + Number(t.amount), 0);
        const deduction = staffTxs.filter(t => t.type === 'Deduction').reduce((s, t) => s + Number(t.amount), 0);
        
        const basic = Number(row.basicSalary) || 0;
        const perDay = basic / 30;
        const otRate = perDay / 8;
        
        const netSalary = Math.round((daysWorked * perDay) + (otHours * otRate) + allowance + bonus - deduction);
        
        return `"${row.name || ''}","${row.dept || ''}","${basic}","${daysWorked}","${otHours.toFixed(2)}","${allowance}","${bonus}","${deduction}","${netSalary}"`;
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileNameSuffix = reportsSelectedStaff && dataToExport.length > 0 ? `_${dataToExport[0].name.replace(/\s+/g, '_')}` : '';
    link.download = `${reportName.replace(/\s+/g, '_')}_Payroll_Report${fileNameSuffix}.csv`;
    link.click();
    showToast(`${reportName} downloaded successfully!`);
  };

  const handleCustomisePDF = (reportName) => {
    alert(`Customise PDF: You can select specific columns for the ${reportName}. Proceeding to download default format...`);
    handleReportDownload(reportName);
  };

  const handlePrevAttendanceDay = () => {
    const d = new Date(attendanceDate);
    d.setDate(d.getDate() - 1);
    setAttendanceDate(d.toISOString().split('T')[0]);
  };

  const handleNextAttendanceDay = () => {
    const d = new Date(attendanceDate);
    d.setDate(d.getDate() + 1);
    setAttendanceDate(d.toISOString().split('T')[0]);
  };

  const handleApproveAllAttendance = () => {
    alert(`All attendance records for ${new Date(attendanceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} have been successfully marked as 'Approved'.`);
  };

  const totalAllowance = 0; // salaryTransactions.filter(t => t.type === 'Allowance').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalBonus = salaryTransactions.filter(t => t.type === 'Bonus').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalDeduction = salaryTransactions.filter(t => t.type === 'Deduction').reduce((sum, t) => sum + Number(t.amount || 0), 0);

  // Dynamic Metrics Calculation
  const presentCount = dailyStaffData.filter(s => s.status === 'Present' || s.status === 'Late' || s.status === 'Late / Present' || (s.in && s.in !== '-')).length;
  const absentCount = dailyStaffData.filter(s => s.status === 'Absent').length;
  const halfDayCount = dailyStaffData.filter(s => s.status === 'Half Day').length;
  const onLeaveCount = dailyStaffData.filter(s => s.status === 'On Leave').length;
  const notMarkedCount = Math.max(0, dailyStaffData.length - (presentCount + absentCount + halfDayCount + onLeaveCount));
  const deactivatedCount = dailyStaffData.filter(s => s.status === 'Deactivated').length;

  let totalOtMinutes = 0;
  dailyStaffData.forEach(s => {
    if (s.ot && s.ot !== '00:00' && s.ot !== '-') {
      const parts = String(s.ot).split(':');
      if (parts.length === 2) {
        totalOtMinutes += parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
    }
  });
  const otHours = Math.floor(totalOtMinutes / 60);
  const otMins = totalOtMinutes % 60;
  
  const overtimeDisplay = `${otHours}h ${otMins}m`;

  // Helper to calculate time difference
  const calculateWorkingHours = (inTime, outTime) => {
    if (!inTime || !outTime || inTime === '-' || outTime === '-') return '-';
    try {
      const inMins = parseTime(inTime);
      const outMins = parseTime(outTime);
      let diff = outMins - inMins;
      if (diff < 0) diff += 24 * 60; // Crosses midnight
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return `${h}h ${m}m`;
    } catch (e) {
      return '-';
    }
  };


  const handlePrevWorkHoursDay = () => {
    const d = new Date(workHoursDate);
    d.setDate(d.getDate() - 1);
    setWorkHoursDate(d.toISOString().split('T')[0]);
  };
  
  const handleNextWorkHoursDay = () => {
    const d = new Date(workHoursDate);
    d.setDate(d.getDate() + 1);
    setWorkHoursDate(d.toISOString().split('T')[0]);
  };

  const handleClearAttendance = async (staffId) => {
    if (!window.confirm('Are you sure you want to clear attendance for this staff for today? This will delete their check-in and check-out logs.')) return;
    
    const logsToDelete = attendanceLogs.filter(l => l.employeeId === staffId && getLocalDateStr(l.dateIso) === attendanceDate);
    
    for (const log of logsToDelete) {
      try {
        await deleteDoc(doc(db, "attendanceLogs", log.id));
      } catch (e) {
        console.error("Error deleting log", e);
      }
    }
    showToast("Attendance cleared for today.");
  };
  const calculateMonthlyWorkHours = (empId, dateStr, shiftName) => {
    const monthPrefix = dateStr.substring(0, 7); // YYYY-MM
    const monthLogs = attendanceLogs.filter(l => l.employeeId === empId && l.dateIso && l.dateIso.startsWith(monthPrefix));
    
    // Group logs by date
    const logsByDate = {};
    monthLogs.forEach(l => {
      const dStr = getLocalDateStr(l.dateIso);
      if (!logsByDate[dStr]) logsByDate[dStr] = [];
      logsByDate[dStr].push(l);
    });

    let totalMins = 0;

    Object.keys(logsByDate).forEach(dStr => {
      // Only count days up to the given dateStr
      // Removed so it calculates for the entire month
      // if (dStr > dateStr) return;
      
      const dayLogs = logsByDate[dStr];
      const checkin = dayLogs.find(l => l.type === 'checkin');
      const checkout = dayLogs.find(l => l.type === 'checkout');
      
      let dailyMins = 0;
      if (checkin && checkout) {
        try {
          const inMins = parseTime(checkin.time);
          const outMins = parseTime(checkout.time);
          let diff = outMins - inMins;
          if (diff < 0) diff += 24 * 60;
          dailyMins = diff;
        } catch(e) {}
      }
      
      let otMins = 0;
      if (checkout && checkout.otMinutes) {
        otMins = checkout.otMinutes;
      }
      
      let fineMins = 0;
      if (checkin) {
         fineMins = getFineMins(shiftName, checkin.time);
      }
      
      totalMins += (dailyMins + otMins - fineMins);
    });

    if (totalMins <= 0) return '-';
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}h ${m}m`;
  };

  const calculateFineHours = (shiftName, inTimeStr) => {
    const mins = getFineMins(shiftName, inTimeStr);
    if (mins <= 0) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0 && m === 0) return '-';
    return `${h}h ${m}m`;
  };


  return (
    <div className="dashboard-root">
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#323232', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
          <CheckCircle2 size={18} color="#10b981" /> {toastMessage}
        </div>
      )}
      {/* Sidebar */}
      <div className="dashboard-sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/hosur-logo.png.jpeg" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'contain', backgroundColor: 'white' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '18px', margin: 0, lineHeight: '1.2' }}>HOSUR INFRATECH</h2>
            <span style={{ fontSize: '9px', color: '#8AB4F8', fontWeight: '600', letterSpacing: '0.5px' }}>EXCEEDING EXPECTATIONS</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <div 
            className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
            {activeTab === 'dashboard' && <div className="active-indicator"></div>}
          </div>
          <div 
            className={`sidebar-item ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            <Clock size={20} />
            <span>Attendance</span>
            {activeTab === 'attendance' && <div className="active-indicator"></div>}
          </div>

          <div 
            className={`sidebar-item ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => { setActiveTab('staff'); setStaffViewMode('list'); }}
          >
            <Users size={20} />
            <span>Staff</span>
            {activeTab === 'staff' && <div className="active-indicator"></div>}
          </div>
          <div 
            className={`sidebar-item ${activeTab === 'work-hours' ? 'active' : ''}`}
            onClick={() => setActiveTab('work-hours')}
          >
            <Clock size={20} />
            <span> Work Hours</span>
            {activeTab === 'work-hours' && <div className="active-indicator"></div>}
          </div>
          <div 
            className={`sidebar-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <FileText size={20} />
            <span>Reports</span>
            {activeTab === 'reports' && <div className="active-indicator"></div>}
          </div>

          <div style={{ flexGrow: 1 }}></div>
          <div 
            className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            <span>Settings</span>
            {activeTab === 'settings' && <div className="active-indicator"></div>}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="dashboard-main">
        {activeTab === 'dashboard' && dashboardView === 'overview' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <h1 className="section-title" style={{ margin: 0 }}>Attendance</h1>
                <a href="#" className="detailed-view-link" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: '#1A73E8', fontWeight: 500, textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setDashboardView('detailed'); }}>
                  Detailed Attendance View <ChevronRight size={16} />
                </a>
              </div>
            {/* Calendar Block (Big, like attendance tab) */}
            <div className="card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center', padding: '16px 0', border: '1px solid #E8EAED', borderRadius: '12px', marginTop: '24px' }}>
              <div className="date-selector" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                
                <span className="date-nav" onClick={handlePrevAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8' }}><ChevronLeft size={24} strokeWidth={2.5} /></span>
                <span style={{ fontSize: '24px', fontWeight: '600', color: '#202124', minWidth: '220px', textAlign: 'center', letterSpacing: '-0.5px' }}>
                  {new Date(attendanceDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '')}
                </span>
                <span className="date-nav" onClick={handleNextAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8' }}><ChevronRight size={24} strokeWidth={2.5} /></span>
                <button className="calendar-icon-btn" style={{ position: 'relative', border: 'none', backgroundColor: '#E8F0FE', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '12px' }}>
                  <Calendar size={22} color="#1A73E8" strokeWidth={2} />
                  <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                </button>
              </div>
            </div>

            <div className="dashboard-grid">
              {/* Stats Overview Skew Cards */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div className="skew-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('staff'); }} style={{ '--border-color': '#1A73E8', '--text-color': '#1A73E8', flex: 1 }}>
                  <div className="skew-card-bg"></div>
                  <div className="skew-card-content">
                    <div className="skew-card-icon"><Users size={32} color="#1A73E8" /></div>
                    <div className="skew-card-text">
                      <div className="skew-card-value" style={{ color: '#1A73E8' }}><AnimatedNumber end={dailyStaffData.length} /></div>
                      <div className="skew-card-label" style={{ color: '#555', fontSize: '13px', fontWeight: '500' }}>Employees</div>
                    </div>
                  </div>
                </div>
                <div className="skew-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('present'); }} style={{ '--border-color': '#34A853', '--text-color': '#34A853', flex: 1 }}>
                  <div className="skew-card-bg"></div>
                  <div className="skew-card-content">
                    <div className="skew-card-icon"><User size={32} color="#34A853" /></div>
                    <div className="skew-card-text">
                      <div className="skew-card-value" style={{ color: '#34A853' }}><AnimatedNumber end={presentCount} /></div>
                      <div className="skew-card-label" style={{ color: '#555', fontSize: '13px', fontWeight: '500' }}>Present</div>
                    </div>
                  </div>
                </div>
                <div className="skew-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('absent'); }} style={{ '--border-color': '#EA4335', '--text-color': '#EA4335', flex: 1 }}>
                  <div className="skew-card-bg"></div>
                  <div className="skew-card-content">
                    <div className="skew-card-icon"><ThumbsDown size={32} color="#EA4335" /></div>
                    <div className="skew-card-text">
                      <div className="skew-card-value" style={{ color: '#EA4335' }}><AnimatedNumber end={absentCount} /></div>
                      <div className="skew-card-label" style={{ color: '#555', fontSize: '13px', fontWeight: '500' }}>Absent</div>
                    </div>
                  </div>
                </div>
                <div className="skew-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('late'); }} style={{ '--border-color': '#FBBC04', '--text-color': '#FBBC04', flex: 1 }}>
                  <div className="skew-card-bg"></div>
                  <div className="skew-card-content">
                    <div className="skew-card-icon"><Clock size={32} color="#FBBC04" /></div>
                    <div className="skew-card-text">
                      <div className="skew-card-value" style={{ color: '#FBBC04' }}><AnimatedNumber end={dailyStaffData.filter(s => s.status === 'Late').length} /></div>
                      <div className="skew-card-label" style={{ color: '#555', fontSize: '13px', fontWeight: '500' }}>Late Comers</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="metric-row-2" style={{ display: 'flex', gap: '16px', marginTop: '8px', marginBottom: '24px' }}>
                  <div className="metric-item metric-card-overtime" style={{ cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', borderRadius: '12px', backgroundColor: '#F8F9FA', border: '1px solid #E8EAED' }} onClick={() => { setIsDrawerOpen(true); setDrawerType('overtime'); }}>
                    <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#3C4043' }}><Clock size={14} /> Overtime Hour</div>
                  </div>
                  <div className="metric-item metric-card-fine" style={{ cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', borderRadius: '12px', backgroundColor: '#FFF0F5', border: '1px solid #FAD2CF' }} onClick={() => { setIsDrawerOpen(true); setDrawerType('late'); }}>
                    <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#C5221F' }}><AlertCircle size={14} /> Late Hour</div>
                  </div>
                </div>

              {/* Summary Tables from Detailed View */}
              
                            {/* Summary Tables from Detailed View */}
              <div className="summary-tables-container">
              <div className="summary-table-wrapper">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Department</th>
                      <th>P</th><th>A</th><th>S</th><th>HD</th><th>OT</th><th>F</th><th>L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptStats.map(d => (
                      <tr key={d.name}>
                        <td style={{ textAlign: 'left' }}>{typeof d.name === 'object' ? '' : d.name}</td>
                        <td>{d.p}</td><td>{d.a}</td><td>{d.s}</td><td>{d.hd}</td><td>{d.ot}</td><td>{d.f}</td><td>{d.l}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="summary-table-wrapper">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Shift Name</th>
                      <th>P</th><th>A</th><th>S</th><th>HD</th><th>OT</th><th>F</th><th>L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftStats.map(d => (
                      <tr key={d.name}>
                        <td style={{ textAlign: 'left' }}>{typeof d.name === 'object' ? '' : d.name}</td>
                        <td>{d.p}</td><td>{d.a}</td><td>{d.s}</td><td>{d.hd}</td><td>{d.ot}</td><td>{d.f}</td><td>{d.l}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Space and Blue Line for Pie Chart */}
                <div style={{ borderTop: '2px solid #1A73E8', margin: '20px 0 10px 0' }}></div>
                <div className="pie-chart-animated" style={{ width: '100%', height: '250px', display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Present', value: summaryMetrics.present || 0, color: '#34A853' },
                          { name: 'Absent', value: summaryMetrics.absent || 0, color: '#EA4335' },
                          { name: 'Half Day', value: summaryMetrics.halfDay || 0, color: '#4285F4' },
                          { name: 'Late', value: summaryMetrics.late || 0, color: '#FFC107' },
                          { name: 'Paid Leave', value: summaryMetrics.paidLeave || 0, color: '#4285F4' },
                          { name: 'Site', value: summaryMetrics.site || 0, color: '#9C27B0' }
                        ].filter(d => d.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        isAnimationActive={true}
                        animationDuration={1500}
                        animationEasing="ease-out"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        onClick={(entry) => {
                          if (!entry || !entry.name) return;
                          let type = 'staff';
                          if (entry.name === 'Present') type = 'present';
                          else if (entry.name === 'Absent') type = 'absent';
                          else if (entry.name === 'Half Day') type = 'halfDay';
                          else if (entry.name === 'Paid Leave') type = 'onLeave';
                          else if (entry.name === 'Site') type = 'site';
                          setIsDrawerOpen(true);
                          setDrawerType(type);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {
                          [
                            { name: 'Present', value: summaryMetrics.present || 0, color: '#34A853' },
                            { name: 'Absent', value: summaryMetrics.absent || 0, color: '#EA4335' },
                            { name: 'Half Day', value: summaryMetrics.halfDay || 0, color: '#4285F4' },
                            { name: 'Paid Leave', value: summaryMetrics.paidLeave || 0, color: '#4285F4' },
                            { name: 'Site', value: summaryMetrics.site || 0, color: '#9C27B0' }
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))
                        }
                        <Label value={`Total: ${summaryMetrics.total}`} position="center" fill="#333" fontSize={16} fontWeight="bold" />
                      </Pie>
                      <Tooltip />
                      <Legend 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center" 
                        wrapperStyle={{ cursor: 'pointer' }}
                        onClick={(entry) => {
                          if (!entry || !entry.name) return;
                          let type = 'staff';
                          if (entry.name === 'Present') type = 'present';
                          else if (entry.name === 'Absent') type = 'absent';
                          else if (entry.name === 'Half Day') type = 'halfDay';
                          else if (entry.name === 'Late') type = 'late';
                          else if (entry.name === 'Paid Leave') type = 'onLeave';
                          else if (entry.name === 'Site') type = 'site';
                          setIsDrawerOpen(true);
                          setDrawerType(type);
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            </div>

            {/* 4 Column Box - Daily Staff Status */}
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#202124', margin: 0 }}>Daily Staff Status</h3>
                <div className="attendance-toggle-pill" style={{ display: 'flex', background: '#F1F3F4', borderRadius: '8px', padding: '4px' }}>
                  <button 
                    onClick={() => setDailyAttendanceFilter('all')}
                    style={{ padding: '6px 16px', borderRadius: '4px', border: 'none', background: dailyAttendanceFilter === 'all' ? '#fff' : 'transparent', color: dailyAttendanceFilter === 'all' ? '#1A73E8' : '#5F6368', fontWeight: '600', cursor: 'pointer', boxShadow: dailyAttendanceFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', fontSize: '13px' }}
                  >
                    All Staff
                  </button>
                  <button 
                    onClick={() => setDailyAttendanceFilter('site')}
                    style={{ padding: '6px 16px', borderRadius: '4px', border: 'none', background: dailyAttendanceFilter === 'site' ? '#fff' : 'transparent', color: dailyAttendanceFilter === 'site' ? '#1A73E8' : '#5F6368', fontWeight: '600', cursor: 'pointer', boxShadow: dailyAttendanceFilter === 'site' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', fontSize: '13px' }}
                  >
                    Site Attendance
                  </button>
                </div>
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {dailyAttendanceFilter === 'site' ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#5F6368' }}>Staff Name</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#5F6368' }}>Status</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#5F6368' }}>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.filter(staff => siteAssignments.includes(staff.id)).map((staff, idx) => {
                        const log = siteActivityLogs.find(l => l.staffId === staff.id);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#202124' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#202124' }}>
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                padding: '4px 8px', 
                                borderRadius: '12px', 
                                fontSize: '12px', 
                                fontWeight: '500',
                                backgroundColor: staff.status === 'Late / Present' ? '#fff9c4' : (staff.status === 'Present' ? '#E6F4EA' : (staff.status === 'Late' ? '#FFF9C4' : '#FCE8E6')),
                                background: staff.status === 'Late / Present' ? 'linear-gradient(90deg, #FFF9C4 50%, #E6F4EA 50%)' : undefined,
                                color: staff.status === 'Present' ? '#1E8E3E' : (staff.status === 'Late' || staff.status === 'Late / Present' ? '#B08D00' : '#D93025')
                              }}>
                                {typeof staff.status === 'object' ? '' : (staff.status || 'Pending')}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#5F6368' }}>
                              {log ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                  <span style={{ color: '#10b981', fontWeight: 600 }}>{log.locationName}</span>
                                </div>
                              ) : <span style={{ color: '#9CA3AF' }}>-</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredData.filter(staff => siteAssignments.includes(staff.id)).length === 0 && (
                        <tr>
                          <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#5F6368' }}>No site staff found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#5F6368' }}>Staff Name</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#5F6368' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((staff, idx) => {
                        const getStatusEmoji = (status) => {
                          const s = (status || '').toLowerCase().trim();
                          if (s === 'present') return 'Present';
                          if (s === 'late') return 'Late';
                          if (s === 'half day') return 'Half Day';
                          if (s === 'absent') return 'Absent';
                          if (s === 'on leave') return 'On Leave';
                          return 'Not Marked';
                        };
                        const statusStr = getStatusEmoji(staff.status);
                        const isLate = statusStr === 'Late';
                        const hasLoggedOut = staff.out && staff.out !== '-';
                        const isPresentGreen = statusStr === 'Present' && hasLoggedOut;
                        const isPresentWorking = statusStr === 'Present' && !hasLoggedOut;
                        const isHalfDay = statusStr === 'Half Day';
                        const isAbsent = statusStr === 'Absent' || statusStr === 'On Leave';
                        
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '12px 16px', fontSize: '14px', color: '#202124' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                            <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                padding: '4px 8px', 
                                borderRadius: '12px', 
                                fontSize: '12px', 
                                fontWeight: '500',
                                backgroundColor: isPresentGreen ? '#E6F4EA' : isLate ? '#FEF3C7' : isPresentWorking ? '#E8F0FE' : isHalfDay ? '#E8F0FE' : (isAbsent ? '#FCE8E6' : '#F1F3F4'),
                                color: isPresentGreen ? '#1E8E3E' : isLate ? '#D97706' : isPresentWorking ? '#1A73E8' : isHalfDay ? '#1A73E8' : (isAbsent ? '#D93025' : '#5F6368')
                              }}>
                                {statusStr}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredData.length === 0 && (
                        <tr>
                          <td colSpan="2" style={{ padding: '24px', textAlign: 'center', color: '#5F6368' }}>No staff found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </>
        )}

        {activeTab === 'dashboard' && dashboardView === 'detailed' && (
          <div className="detailed-attendance-view">
            <button className="back-button" onClick={() => setDashboardView('overview')}>
              <ArrowLeft size={16} /> Back
            </button>
            
            <div className="detailed-header">
              <h1 className="section-title" style={{ margin: 0 }}>Attendance Details</h1>
              <div className="detailed-header-actions" style={{ display: 'flex', gap: '12px' }}>
                <div style={{ position: 'relative', border: '1px solid #D2D6DC', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', background: '#fff' }}>
                  <Calendar size={18} color="#1A73E8" style={{ marginRight: '8px' }} />
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#202124', fontWeight: '500' }}>{attendanceDate.split('-').reverse().join('/')}</span>
                  </div>
                  <input 
                    type="date" 
                    value={attendanceDate} 
                    onChange={(e) => setAttendanceDate(e.target.value)} 
                    onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                    style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                  />
                </div>
                <button className="btn-outline-blue" onClick={generateDailyAttendancePDF} style={{ border: '1px solid #1A73E8', color: '#1A73E8', background: '#fff', padding: '6px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                  <Download size={16} color="#1A73E8" /> Download
                </button>
                <button className="btn-filter" onClick={viewDailyAttendancePDF} style={{ background: '#1A73E8', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                  <Eye size={16} color="#fff" /> View
                </button>
              </div>
            </div>

            <div className="daily-attendance-section">
              <div className="daily-toolbar" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                <h2 className="sub-section-title" style={{ margin: 0, marginRight: 'auto' }}>Daily Attendance</h2>
                
                <div className="search-wrapper" style={{ display: 'flex', alignItems: 'center', border: '1px solid #D2D6DC', borderRadius: '8px', padding: '8px 16px', background: '#fff', width: '300px', gap: '8px' }}>
                  <Search size={18} color="#1A73E8" />
                  <input 
                    type="text" 
                    placeholder="Search staff by name or phone..." 
                    className="search-input" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px', color: '#202124' }}
                  />
                </div>

                <div style={{ position: 'relative' }}>
                  <button className="btn-filter" onClick={() => setShowFilterMenu(!showFilterMenu)} style={{ background: '#f1f3f4', color: '#3C4043', border: '1px solid #dadce0', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>
                    <Filter size={16} color="#3C4043" /> Filter
                  </button>
                  {showFilterMenu && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#fff', border: '1px solid #D2D6DC', borderRadius: '8px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, width: '200px' }}>
                      <p style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: '#202124' }}>Filter by Status</p>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={filterPresent} onChange={(e) => setFilterPresent(e.target.checked)} /> Present
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={filterAbsent} onChange={(e) => setFilterAbsent(e.target.checked)} /> Absent
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={filterPending} onChange={(e) => setFilterPending(e.target.checked)} /> Pending
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div id="daily-attendance-table-container" className="data-table-wrapper card" style={{ padding: '20px', background: 'white' }}>
                <h3 style={{ marginBottom: '16px', display: 'none' }} className="pdf-only-title">Daily Attendance Report - {attendanceDate.split('-').reverse().join('/')}</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name <ChevronDown size={12} color="#BDC1C6" /></th>
                      <th>Department <ChevronDown size={12} color="#BDC1C6" /></th>
                      <th>Shift <ChevronDown size={12} color="#BDC1C6" /></th>
                      <th>Attendance <ChevronDown size={12} color="#BDC1C6" /></th>
                      <th>In Time <ChevronDown size={12} color="#BDC1C6" /></th>
                      <th>Out Time <ChevronDown size={12} color="#BDC1C6" /></th>
                      <th>Overtime <ChevronDown size={12} color="#BDC1C6" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((staff, idx) => (
                      <tr key={idx}>
                        <td className="staff-name">{typeof staff.name === 'object' ? '' : staff.name}</td>
                        <td className="dept-name">{typeof staff.dept === 'object' ? '' : staff.dept}</td>
                        <td className="shift-name">{typeof staff.shift === 'object' ? '' : staff.shift}</td>
                        <td className={`status-${String(staff.status || 'Pending').toLowerCase().replace(' ', '-')}`}>{typeof staff.status === 'object' ? '' : (staff.status || 'Pending')}</td>
                        <td>{typeof staff.in === 'object' ? '' : staff.in}</td>
                        <td>{typeof staff.out === 'object' ? '' : staff.out}</td>
                        <td>{typeof staff.ot === 'object' ? '' : staff.ot}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HIDDEN EXPORT CONTAINER (For PDF Split) */}
            <div id="pdf-export-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '297mm', backgroundColor: '#fff', padding: '20px', color: '#000' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                Attendance Sheet - {new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h2>
              
              {/* TABLE 1: Days 1-20 */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 1: Days 1-20</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: 20}, (_, i) => i + 1).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: 20}, (_, i) => i + 1).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > new Date().toISOString().split('T')[0];
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* TABLE 2: Days 21-End */}
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 2: Days 21-{new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate()}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate() - 20}, (_, i) => i + 21).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Present</th>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      let presentCount = 0;
                      let absentCount = 0;
                      
                      const rDaysInMonth = new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate();
                      const todayStr = new Date().toISOString().split('T')[0];
                      
                      for (let i=1; i<=rDaysInMonth; i++) {
                         const dateStr = `${musterRollMonthYear}-${String(i).padStart(2, '0')}`;
                         const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                         const checkin = dayLogs.find(l => l.type === 'checkin');
                         if (checkin && checkin.status !== 'Absent') {
                             presentCount++;
                         } else {
                             const isFutureDate = dateStr > todayStr;
                             if (!isFutureDate) absentCount++;
                         }
                      }

                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: rDaysInMonth - 20}, (_, i) => i + 21).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > todayStr;
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{presentCount}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{absentCount}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && dashboardView === 'overtime' && (
          <div className="detailed-attendance-view">
            <button className="back-button" onClick={() => setDashboardView('overview')}>
              <ArrowLeft size={16} /> Back
            </button>
            <div className="detailed-header">
              <h1 className="section-title" style={{ margin: 0 }}>Overtime Details</h1>
            </div>
            <div className="summary-tables-container">
              <div className="summary-table-wrapper" style={{ width: '100%' }}>
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Staff Name</th>
                      <th>Status</th>
                      <th>Overtime (Hours)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyStaffData.filter(s => s.status === 'Overtime' || s.otMins > 0).map(s => (
                      <tr key={s.name}>
                        <td style={{ textAlign: 'left' }}>{s.name}</td>
                        <td>{s.status}</td>
                        <td>{Math.floor((s.otMins || 0) / 60)}h {(s.otMins || 0) % 60}m</td>
                      </tr>
                    ))}
                    {dailyStaffData.filter(s => s.status === 'Overtime' || s.otMins > 0).length === 0 && (
                      <tr><td colSpan="3">No overtime records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HIDDEN EXPORT CONTAINER (For PDF Split) */}
            <div id="pdf-export-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '297mm', backgroundColor: '#fff', padding: '20px', color: '#000' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                Attendance Sheet - {new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h2>
              
              {/* TABLE 1: Days 1-20 */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 1: Days 1-20</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: 20}, (_, i) => i + 1).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: 20}, (_, i) => i + 1).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > new Date().toISOString().split('T')[0];
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* TABLE 2: Days 21-End */}
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 2: Days 21-{new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate()}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate() - 20}, (_, i) => i + 21).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Present</th>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      let presentCount = 0;
                      let absentCount = 0;
                      
                      const rDaysInMonth = new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate();
                      const todayStr = new Date().toISOString().split('T')[0];
                      
                      for (let i=1; i<=rDaysInMonth; i++) {
                         const dateStr = `${musterRollMonthYear}-${String(i).padStart(2, '0')}`;
                         const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                         const checkin = dayLogs.find(l => l.type === 'checkin');
                         if (checkin && checkin.status !== 'Absent') {
                             presentCount++;
                         } else {
                             const isFutureDate = dateStr > todayStr;
                             if (!isFutureDate) absentCount++;
                         }
                      }

                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: rDaysInMonth - 20}, (_, i) => i + 21).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > todayStr;
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{presentCount}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{absentCount}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && dashboardView === 'fine' && (
          <div className="detailed-attendance-view">
            <button className="back-button" onClick={() => setDashboardView('overview')}>
              <ArrowLeft size={16} /> Back
            </button>
            <div className="detailed-header">
              <h1 className="section-title" style={{ margin: 0 }}>Late Hour Details</h1>
            </div>
            <div className="summary-tables-container">
              <div className="summary-table-wrapper" style={{ width: '100%' }}>
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Staff Name</th>
                      <th>Status</th>
                      <th>Fine Amount / Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyStaffData.filter(s => s.fineAmt > 0).map(s => (
                      <tr key={s.name}>
                        <td style={{ textAlign: 'left' }}>{s.name}</td>
                        <td>{s.status}</td>
                        <td>₹{s.fineAmt}</td>
                      </tr>
                    ))}
                    {dailyStaffData.filter(s => s.fineAmt > 0).length === 0 && (
                      <tr><td colSpan="3">No fine records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HIDDEN EXPORT CONTAINER (For PDF Split) */}
            <div id="pdf-export-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '297mm', backgroundColor: '#fff', padding: '20px', color: '#000' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                Attendance Sheet - {new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h2>
              
              {/* TABLE 1: Days 1-20 */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 1: Days 1-20</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: 20}, (_, i) => i + 1).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: 20}, (_, i) => i + 1).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > new Date().toISOString().split('T')[0];
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* TABLE 2: Days 21-End */}
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 2: Days 21-{new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate()}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate() - 20}, (_, i) => i + 21).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Present</th>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      let presentCount = 0;
                      let absentCount = 0;
                      
                      const rDaysInMonth = new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate();
                      const todayStr = new Date().toISOString().split('T')[0];
                      
                      for (let i=1; i<=rDaysInMonth; i++) {
                         const dateStr = `${musterRollMonthYear}-${String(i).padStart(2, '0')}`;
                         const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                         const checkin = dayLogs.find(l => l.type === 'checkin');
                         if (checkin && checkin.status !== 'Absent') {
                             presentCount++;
                         } else {
                             const isFutureDate = dateStr > todayStr;
                             if (!isFutureDate) absentCount++;
                         }
                      }

                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: rDaysInMonth - 20}, (_, i) => i + 21).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > todayStr;
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{presentCount}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{absentCount}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'staff' && staffViewMode === 'list' && (
          <div className="staff-view">
            {/* Header */}
            <div className="staff-header">
              <h1>Total Staff</h1>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-primary" onClick={() => {
                  setNewStaff({ 
                    name: '', phone: '', empId: '', address: '',
                    dept: '', shift: '', aadharNumber: '',
                    basicSalary: '', bankName: '', accountNumber: '', ifsc: '',
                    photo: null
                  });
                  setStaffViewMode('add-regular-staff-form');
                }}>
                  <UserPlus size={16} /> Add Staff
                </button>
              </div>
            </div>

            {/* Alert Banner Removed */}

            {/* Toolbar */}
            <div className="staff-toolbar" style={{ display: 'flex', gap: '16px', background: '#f8f9fa', padding: '16px', borderRadius: '8px', border: '1px solid #e8eaed', alignItems: 'center' }}>
              <div className="search-wrapper" style={{ flex: 1, backgroundColor: 'white', border: '1px solid #d2d6dc', borderRadius: '6px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <Search size={18} color="#5f6368" />
                <input 
                  type="text" 
                  placeholder="Search staff by name or phone..." 
                  className="search-input"
                  style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14px', background: 'transparent' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ position: 'relative', width: '200px' }}>
                <button className="action-dropdown" style={{ width: '100%', justifyContent: 'space-between', backgroundColor: 'white', border: '1px solid #d2d6dc', borderRadius: '6px', padding: '8px 12px', color: '#3c4043', display: 'flex', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onClick={() => setShowFilterDropdown(!showFilterDropdown)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Filter size={16} /> {filterDept === 'All' ? 'All Departments' : filterDept}</span>
                  <ChevronDown size={16} />
                </button>
                {showFilterDropdown && (
                  <div className="custom-dropdown-menu" style={{ display: 'block', top: '100%', left: 0, width: '100%', zIndex: 100 }}>
                    <div className="custom-dropdown-item" onClick={() => { setFilterDept('All'); setShowFilterDropdown(false); }}>All Departments</div>
                    {allDeptsList.map(d => (
                      <div className="custom-dropdown-item" key={d} onClick={() => { setFilterDept(d); setShowFilterDropdown(false); }}>{d}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Staff List */}
            <div className="staff-list-section">
              <div className="staff-list-header">
                <h3>Staff List</h3>
                <span className="staff-count-badge">{filteredData.length}</span>
              </div>

              {filteredData.length === 0 ? (
                <div className="card staff-row-card" style={{ justifyContent: 'center', color: '#5F6368' }}>
                  No staff registered yet.
                </div>
              ) : (
                filteredData.map((staff, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    <div className="card staff-row-card" style={{ zIndex: 2, position: 'relative' }}>
                      <div className="staff-profile-info">
                        <div className="staff-avatar" title="Click to view details" style={{ overflow: 'hidden', cursor: 'pointer', border: expandedStaffId === staff.id ? '2px solid #1A73E8' : 'none' }} onClick={() => setExpandedStaffId(expandedStaffId === staff.id ? null : staff.id)}>
                          {staff.photo ? (
                            <img src={staff.photo} alt={staff.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            staff.name ? staff.name.substring(0, 2).toUpperCase() : 'ST'
                          )}
                        </div>
                        <span className="staff-name-text">{staff.name}</span>
                      </div>
                      <div className="staff-payment-info" style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" title="Edit Staff" style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8f0fe', color: '#1a73e8', border: 'none', borderRadius: '50%' }} onClick={() => {
                          setNewStaff(staff);
                          setStaffViewMode('add-regular-staff-form');
                        }}>
                          <Info size={18} />
                        </button>
                        <button className="btn-secondary" title="Delete Staff" style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fce8e6', color: '#d93025', border: 'none', borderRadius: '50%' }} onClick={async () => {
                          if (window.confirm(`Are you sure you want to delete ${staff.name}?`)) {
                            try {
                              await deleteDoc(doc(db, "staff", staff.id));
                            } catch (e) {
                              console.error(e);
                              alert('Failed to delete staff');
                            }
                          }
                        }}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    {expandedStaffId === staff.id && (
                      <div className="card" style={{ padding: '16px', backgroundColor: '#f8f9fa', border: '1px solid #e8eaed', marginTop: '-8px', borderTopLeftRadius: 0, borderTopRightRadius: 0, paddingTop: '24px', zIndex: 1 }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#202124' }}>Registration Details</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', color: '#5f6368' }}>
                          <div><strong>Phone:</strong> {staff.phone || 'N/A'}</div>
                          <div><strong>Dept:</strong> {staff.dept || 'N/A'}</div>
                          <div><strong>Basic Salary:</strong> {staff.basicSalary ? `₹${staff.basicSalary}` : 'N/A'}</div>
                          <div><strong>Address:</strong> {staff.address || 'N/A'}</div>
                          <div><strong>Join Date:</strong> {staff.joinDate ? new Date(staff.joinDate).toLocaleDateString() : 'N/A'}</div>
                          <div><strong>Aadhar No:</strong> {staff.aadharNumber || 'N/A'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}



        {/* COMPREHENSIVE STAFF REGISTRATION FORM */}
        {activeTab === 'staff' && staffViewMode === 'add-regular-staff-form' && (
          <div className="add-regular-staff-view">
            <div className="rs-header">
              <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); setStaffViewMode('list'); }}>
                <ArrowLeft size={16} /> Back
              </a>
              <h1 className="rs-title">Register Regular Staff</h1>
              <p className="rs-subtitle">Enter comprehensive staff details for reports, facial recognition, and salary slips.</p>
            </div>

            <div className="rs-form-container" id="staff-registration-form">
              {/* SECTION 1: Personal Details */}
              <div className="rs-section">
                <h3 className="rs-section-title">1. Personal Details</h3>
                <div className="rs-grid">
                  <div className="rs-input-group">
                    <label>Full Name *</label>
                    <input type="text" value={newStaff.name} onChange={(e) => setNewStaff({...newStaff, name: e.target.value})} placeholder="e.g. John Doe" />
                  </div>
                  <div className="rs-input-group">
                    <label>Phone Number *</label>
                    <input type="tel" value={newStaff.phone} onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})} placeholder="10-digit number" />
                  </div>
                  <div className="rs-input-group">
                    <label>Employee ID</label>
                    <input type="text" value={newStaff.empId} onChange={(e) => setNewStaff({...newStaff, empId: e.target.value})} placeholder="e.g. EMP12345" />
                  </div>
                  <div className="rs-input-group">
                    <label>Address / Location</label>
                    <input type="text" value={newStaff.address} onChange={(e) => setNewStaff({...newStaff, address: e.target.value})} placeholder="City, State" />
                  </div>
                  <div className="rs-input-group">
                    <label>Join Date</label>
                    <input type="date" value={newStaff.joinDate} onChange={(e) => setNewStaff({...newStaff, joinDate: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Facial Recognition Photo */}
              <div className="rs-section">
                <h3 className="rs-section-title">2. Facial Recognition Photo</h3>
                <p style={{fontSize: '13px', color: '#5f6368', marginBottom: '16px'}}>Upload a clear face photo. This will be securely saved and used by the Staff App for daily facial recognition check-ins.</p>
                <div className="rs-photo-upload-box">
                  <label className="rs-photo-label">
                    {newStaff.photo ? (
                      <img src={newStaff.photo} alt="Staff Preview" className="rs-photo-preview" />
                    ) : (
                      <div className="rs-photo-placeholder">
                        <UploadCloud size={32} color="#1a73e8" />
                        <span>Click to Upload Photo</span>
                        <span style={{fontSize: '12px', color: '#9aa0a6'}}>JPG or PNG format</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{display: 'none'}} />
                  </label>
                  {newStaff.photo && (
                    <button className="btn-secondary" style={{marginTop: '12px'}} onClick={() => setNewStaff({...newStaff, photo: null})}>Remove Photo</button>
                  )}
                </div>
              </div>

              {/* SECTION 3: Work Details */}
              <div className="rs-section">
                <h3 className="rs-section-title">3. Work Details</h3>
                <div className="rs-grid">
                  <div className="rs-input-group">
                    <label>Department</label>
                    <select 
                      value={newStaff.dept} 
                      onChange={(e) => setNewStaff({...newStaff, dept: e.target.value})}
                      style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #d2d6dc', backgroundColor: '#fff', fontSize: '15px', color: '#202124', outline: 'none' }}
                    >
                      <option value="">Select Department</option>
                      <option value="Plant Head ">Plant Head</option>
                      <option value="Design">Design</option>
                      <option value="Technician">Technician</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Accounts">Accounts</option>
                       <option value="Welder">Welder</option>
                        <option value="Helper-weld">Helper-weld</option>
                         <option value="Helper">Helper</option>
                          <option value="Helper-site">Helper-site</option>
                    </select>
                  </div>
                  <div className="rs-input-group">
                    <label>Designation / Shift</label>
                    <select 
                      value={newStaff.shift} 
                      onChange={(e) => setNewStaff({...newStaff, shift: e.target.value})}
                      style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #d2d6dc', backgroundColor: '#fff', fontSize: '15px', color: '#202124', outline: 'none' }}
                    >
                      <option value="">Select Shift</option>
                      <option value="Day Shift">Day Shift</option>
                      <option value="Night Shift">Night Shift</option>
                      <option value="Office Shift">Office Shift</option>
                    </select>
                  </div>

                </div>
              </div>

              {/* SECTION 4: Salary & Banking */}
              <div className="rs-section">
                <h3 className="rs-section-title">4. Salary & Banking (For Payslips)</h3>
                <div className="rs-grid">
                  <div className="rs-input-group">
                    <label>Basic Salary (Monthly) ₹</label>
                    <input type="number" value={newStaff.basicSalary} onChange={(e) => setNewStaff({...newStaff, basicSalary: e.target.value})} placeholder="e.g. 25000" />
                  </div>
                 
                </div>
              </div>

              {/* SECTION 5: Aadhar Details */}
              <div className="rs-section">
                <h3 className="rs-section-title">5. Aadhar Card Number Details</h3>
                <div className="rs-grid">
                  <div className="rs-input-group" style={{ width: '100%', gridColumn: '1 / -1' }}>
                    <label>Aadhar Card Number</label>
                    <input type="text" value={newStaff.aadharNumber} onChange={(e) => setNewStaff({...newStaff, aadharNumber: e.target.value})} placeholder="12-digit Aadhar Number" />
                  </div>
                </div>
              </div>

              <div className="rs-footer">
                <button className="btn-modal-cancel" onClick={() => setStaffViewMode('list')}>Cancel</button>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn-secondary" onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById('staff-registration-form');
                    if (element) {
                      const opt = {
                        margin:       0.5,
                        filename:     `${newStaff.name || 'Staff'}_Registration.pdf`,
                        image:        { type: 'jpeg', quality: 0.98 },
                        html2canvas:  { scale: 2 },
                        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
                      };
                      html2pdf().set(opt).from(element).save();
                    }
                  }} style={{padding: '12px 32px', fontSize: '16px', display: 'flex', alignItems: 'center'}}>
                    <Download size={18} style={{marginRight: '8px'}}/> Download PDF Form
                  </button>
                  <button className="btn-modal-save" onClick={handleAddStaff} style={{padding: '12px 32px', fontSize: '16px'}}>Save Staff Profile</button>
                </div>
              </div>
            </div>

            {/* HIDDEN EXPORT CONTAINER (For PDF Split) */}
            <div id="pdf-export-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '297mm', backgroundColor: '#fff', padding: '20px', color: '#000' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                Attendance Sheet - {new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h2>
              
              {/* TABLE 1: Days 1-20 */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 1: Days 1-20</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: 20}, (_, i) => i + 1).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: 20}, (_, i) => i + 1).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > new Date().toISOString().split('T')[0];
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* TABLE 2: Days 21-End */}
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 2: Days 21-{new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate()}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate() - 20}, (_, i) => i + 21).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Present</th>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      let presentCount = 0;
                      let absentCount = 0;
                      
                      const rDaysInMonth = new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate();
                      const todayStr = new Date().toISOString().split('T')[0];
                      
                      for (let i=1; i<=rDaysInMonth; i++) {
                         const dateStr = `${musterRollMonthYear}-${String(i).padStart(2, '0')}`;
                         const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                         const checkin = dayLogs.find(l => l.type === 'checkin');
                         if (checkin && checkin.status !== 'Absent') {
                             presentCount++;
                         } else {
                             const isFutureDate = dateStr > todayStr;
                             if (!isFutureDate) absentCount++;
                         }
                      }

                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: rDaysInMonth - 20}, (_, i) => i + 21).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > todayStr;
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{presentCount}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{absentCount}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'staff' && staffViewMode === 'bulk-onboarding' && (
          <div className="onboarding-view">
            <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); setStaffViewMode('add-type-selection'); }}>
              <ArrowLeft size={16} /> Back
            </a>
            
            <h1 className="onboarding-title">Excel Bulk Onboarding - Regular Staff</h1>
            
            <div className="stepper-container">
              <div className="step-indicator">
                <div className="step-circle">1</div>
                <div className="step-text">
                  <span className="step-label">Step 1</span>
                  <span className="step-title">Upload File</span>
                </div>
              </div>
              
              <div className="step-divider"></div>
              
              <div className="step-indicator">
                <div className="step-circle inactive">2</div>
                <div className="step-text">
                  <span className="step-label">Step 2</span>
                  <span className="step-title" style={{ color: '#5F6368' }}>Validate & Save</span>
                </div>
              </div>
            </div>
            
            <div className="template-download-section">
              <span className="template-download-text">Don't have a template?</span>
              <button className="btn-download-template" onClick={() => alert('Downloading Template...')}>Download Template</button>
            </div>
            
            <div className="upload-section">
              <h2 className="upload-section-title">Upload Template</h2>
              
              <div className="upload-dropdowns">
                {/* Staff Type Dropdown */}
                <div className="custom-dropdown-container">
                  <label className="custom-dropdown-label">Select Staff Type</label>
                  <div 
                    className={`custom-dropdown-trigger ${!selectedStaffType ? 'placeholder' : ''} ${staffTypeOpen ? 'active' : ''}`}
                    onClick={() => { setStaffTypeOpen(!staffTypeOpen); setSalaryTemplateOpen(false); }}
                  >
                    {selectedStaffType || 'Select Staff Type'}
                    <ChevronDown size={16} />
                  </div>
                  
                  {staffTypeOpen && (
                    <div className="custom-dropdown-menu">
                      <div className="custom-dropdown-item" onClick={() => { setSelectedStaffType('Monthly Regular'); setStaffTypeOpen(false); }}>Monthly Regular</div>
                      <div className="custom-dropdown-item" onClick={() => { setSelectedStaffType('Hourly Regular'); setStaffTypeOpen(false); }}>Hourly Regular</div>
                      <div className="custom-dropdown-item" onClick={() => { setSelectedStaffType('Daily Regular'); setStaffTypeOpen(false); }}>Daily Regular</div>
                    </div>
                  )}
                </div>
                
                {/* Salary Template Dropdown */}
                <div className="custom-dropdown-container">
                  <label className="custom-dropdown-label">Select Salary Structure Template</label>
                  <div 
                    className={`custom-dropdown-trigger ${!selectedSalaryTemplate ? 'placeholder' : ''} ${salaryTemplateOpen ? 'active' : ''}`}
                    onClick={() => { setSalaryTemplateOpen(!salaryTemplateOpen); setStaffTypeOpen(false); }}
                  >
                    {selectedSalaryTemplate || 'Salary Template'}
                    <ChevronDown size={16} />
                  </div>
                  
                  {salaryTemplateOpen && (
                    <div className="custom-dropdown-menu">
                      <div className="custom-dropdown-item highlight" onClick={() => { setSelectedSalaryTemplate('Salary Template'); setSalaryTemplateOpen(false); }}>Salary Template</div>
                      <div className="custom-dropdown-item" onClick={() => { setSelectedSalaryTemplate('Default'); setSalaryTemplateOpen(false); }}>Default</div>
                      <a href="#" className="custom-dropdown-link" onClick={(e) => { e.preventDefault(); alert('Create new template clicked'); setSalaryTemplateOpen(false); }}>Create new template</a>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="upload-dropzone">
                <UploadCloud className="upload-cloud-icon" />
                <span className="upload-dropzone-text">Drag File or browse for the file</span>
              </div>
            </div>

            {/* HIDDEN EXPORT CONTAINER (For PDF Split) */}
            <div id="pdf-export-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '297mm', backgroundColor: '#fff', padding: '20px', color: '#000' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                Attendance Sheet - {new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h2>
              
              {/* TABLE 1: Days 1-20 */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 1: Days 1-20</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: 20}, (_, i) => i + 1).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: 20}, (_, i) => i + 1).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > new Date().toISOString().split('T')[0];
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* TABLE 2: Days 21-End */}
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 2: Days 21-{new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate()}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate() - 20}, (_, i) => i + 21).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Present</th>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      let presentCount = 0;
                      let absentCount = 0;
                      
                      const rDaysInMonth = new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate();
                      const todayStr = new Date().toISOString().split('T')[0];
                      
                      for (let i=1; i<=rDaysInMonth; i++) {
                         const dateStr = `${musterRollMonthYear}-${String(i).padStart(2, '0')}`;
                         const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                         const checkin = dayLogs.find(l => l.type === 'checkin');
                         if (checkin && checkin.status !== 'Absent') {
                             presentCount++;
                         } else {
                             const isFutureDate = dateStr > todayStr;
                             if (!isFutureDate) absentCount++;
                         }
                      }

                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: rDaysInMonth - 20}, (_, i) => i + 21).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > todayStr;
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{presentCount}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{absentCount}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'staff' && staffViewMode === 'report' && (
          <div className="report-view">
            <div style={{ padding: '24px 40px' }}>
              <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); setStaffViewMode('list'); }}>
                <ArrowLeft size={16} /> Back
              </a>

              <div className="report-header-area">
                <h1 className="report-title">Staff Report</h1>
                <div className="report-header-actions">
                  <button className="btn-outline-blue" onClick={() => setStaffViewMode('bulk-salary-slip')}>
                    Download Bulk Salary Slip
                  </button>
                  <button className="btn-outline-blue" onClick={() => alert('Payment Options')}>
                    <CreditCard size={16} /> Payment Options
                  </button>
                </div>
              </div>

              <div className="segment-tabs">
                <div 
                  className={`segment-tab ${reportTab === 'payment' ? 'active' : ''}`}
                  onClick={() => setReportTab('payment')}
                >
                  Payment
                </div>
                <div 
                  className={`segment-tab ${reportTab === 'attendance' ? 'active' : ''}`}
                  onClick={() => setReportTab('attendance')}
                >
                  Attendance
                </div>
              </div>

              {/* Payment Tab View */}
              {reportTab === 'payment' && (
                <>
                  <div className="report-section">
                    <div className="report-section-header">
                      <div className="report-section-title">
                        Non weekly Staff <span className="report-badge">1</span>
                      </div>
                      <div className="report-section-actions">
                        <a href="#" className="view-link" style={{ fontWeight: 400 }} onClick={(e) => { e.preventDefault(); alert('Download Non Weekly Report'); }}>Download <Download size={14} style={{verticalAlign: 'middle', marginLeft: '4px'}}/></a>
                        <button className="action-dropdown" onClick={() => alert('Filter clicked: Apr 2023')}>Apr 2023 <ChevronDown size={14} /></button>
                      </div>
                    </div>
                    
                    {filteredData.length === 0 ? (
                      <div className="report-card empty-card" style={{ padding: '24px', textAlign: 'center', color: '#5F6368' }}>
                        No staff registered yet.
                      </div>
                    ) : (
                      filteredData.map((staff, idx) => (
                        <div className="report-card" key={idx}>
                          <div className="report-card-top">
                            <div className="report-profile">
                              <span className="report-name">{staff.name}</span>
                              <span className="report-subtitle">{staff.shift || 'Regular Staff'}</span>
                            </div>
                            <div className="report-financials">
                              <div className="financial-block">
                                <span className="financial-amount">₹ 0</span>
                                <span className="financial-label">Pending Dues</span>
                                <a href="#" className="view-link" onClick={(e) => { e.preventDefault(); alert('View Breakup Dues'); }}>View Breakup <ChevronDown size={14} style={{verticalAlign: 'middle'}}/></a>
                              </div>
                              <div className="financial-block">
                                <span className="financial-amount"> ₹ 0</span>
                                <span className="financial-label">Net Salary Till Date</span>
                                <a href="#" className="view-link" onClick={(e) => { e.preventDefault(); alert('View Breakup Net Salary'); }}>View Breakup <ChevronDown size={14} style={{verticalAlign: 'middle'}}/></a>
                              </div>
                              <div className="financial-block">
                                <span className="financial-amount"> ₹ 0</span>
                                <span className="financial-label">Payable Salary</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="report-section">
                    <div className="report-section-header">
                      <div className="report-section-title">
                        Weekly Staff <span className="report-badge">0</span>
                      </div>
                      <div className="report-section-actions">
                        <button className="action-dropdown" onClick={() => alert('Filter clicked: Current Cycle')}>Current Cycle <ChevronDown size={14} /></button>
                      </div>
                    </div>
                    
                    <div className="report-card empty-card">
                      No Staff Found
                    </div>
                  </div>
                </>
              )}

              {/* Attendance Tab View */}
              {reportTab === 'attendance' && (
                <>
                  <div className="report-section">
                    <div className="report-section-header">
                      <div style={{ flexGrow: 1 }}></div>
                      <div className="report-section-actions">
                        <a href="#" className="view-link" style={{ fontWeight: 400 }} onClick={(e) => { e.preventDefault(); alert('Download Attendance Report'); }}>Download <Download size={14} style={{verticalAlign: 'middle', marginLeft: '4px'}}/></a>
                        <button className="action-dropdown" onClick={() => alert('Filter clicked: Current Cycle')}>Current Cycle <ChevronDown size={14} /></button>
                      </div>
                    </div>
                    
                    {filteredData.length === 0 ? (
                      <div className="report-card empty-card" style={{ padding: '24px', textAlign: 'center', color: '#5F6368' }}>
                        No staff registered yet.
                      </div>
                    ) : (
                      filteredData.map((staff, idx) => (
                        <div className="report-card" key={idx}>
                          <div className="report-card-top">
                            <div className="report-profile">
                              <span className="report-name">{staff.name}</span>
                              <span className="report-subtitle">{staff.shift || 'Regular Staff'}</span>
                            </div>
                            <div className="report-date-range">
                              1 Apr - 13 Apr
                            </div>
                          </div>
                          
                          <div className="report-attendance-metrics">
                            <div className="report-metric-col">
                              <span className="rm-val">-</span>
                              <span className="rm-lbl">Present</span>
                            </div>
                            <div className="report-metric-col">
                              <span className="rm-val">-</span>
                              <span className="rm-lbl">Absent</span>
                            </div>
                            <div className="report-metric-col">
                              <span className="rm-val">-</span>
                              <span className="rm-lbl">Half Day</span>
                            </div>
                            <div className="report-metric-col">
                              <span className="rm-val">-</span>
                              <span className="rm-lbl">Overtime</span>
                            </div>
                            <div className="report-metric-col">
                              <span className="rm-val">-</span>
                              <span className="rm-lbl">Fine</span>
                            </div>
                            <div className="report-metric-col">
                              <span className="rm-val">-</span>
                              <span className="rm-lbl">Paid Leave</span>
                            </div>
                            <div className="report-metric-col">
                              <span className="rm-val">-</span>
                              <span className="rm-lbl">Not Marked</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        )}

        {activeTab === 'staff' && staffViewMode === 'bulk-salary-slip' && (
          <div className="bulk-salary-slip-view">
            <div className="bss-header">
              <a href="#" className="back-link" style={{ marginBottom: 0 }} onClick={(e) => { e.preventDefault(); setStaffViewMode('report'); }}>
                <ArrowLeft size={20} color="#202124" />
              </a>
              <h1 className="bss-title">Bulk Salary Slip</h1>
            </div>

            <div className="bss-card">
              <div className="bss-form-row">
                <div className="bss-form-label">Report Cycle</div>
                <select className="bss-form-select">
                  <option>Apr 2023</option>
                  <option>May 2023</option>
                  <option>Jun 2023</option>
                </select>
              </div>
              <div className="bss-form-row">
                <div className="bss-form-label">Report Type</div>
                <select className="bss-form-select">
                  <option>Half Page Salary Slip</option>
                  <option>Full Page Salary Slip</option>
                </select>
              </div>
            </div>

            <div className="bss-card">
              <div className="bss-empty-state">
                You do not have any generated bulk salary slip report. Please generate a report to download.
              </div>
            </div>

            {/* HIDDEN EXPORT CONTAINER (For PDF Split) */}
            <div id="pdf-export-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '297mm', backgroundColor: '#fff', padding: '20px', color: '#000' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                Attendance Sheet - {new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h2>
              
              {/* TABLE 1: Days 1-20 */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 1: Days 1-20</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: 20}, (_, i) => i + 1).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: 20}, (_, i) => i + 1).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > new Date().toISOString().split('T')[0];
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* TABLE 2: Days 21-End */}
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 2: Days 21-{new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate()}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate() - 20}, (_, i) => i + 21).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Present</th>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      let presentCount = 0;
                      let absentCount = 0;
                      
                      const rDaysInMonth = new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate();
                      const todayStr = new Date().toISOString().split('T')[0];
                      
                      for (let i=1; i<=rDaysInMonth; i++) {
                         const dateStr = `${musterRollMonthYear}-${String(i).padStart(2, '0')}`;
                         const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                         const checkin = dayLogs.find(l => l.type === 'checkin');
                         if (checkin && checkin.status !== 'Absent') {
                             presentCount++;
                         } else {
                             const isFutureDate = dateStr > todayStr;
                             if (!isFutureDate) absentCount++;
                         }
                      }

                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: rDaysInMonth - 20}, (_, i) => i + 21).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > todayStr;
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{presentCount}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{absentCount}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="attendance-view">
            <div className="attendance-header-area">
              <h1 className="attendance-title">Attendance Summary</h1>
              <div className="attendance-actions">
                <button className="btn-header-link" onClick={() => setActiveTab('reports')} style={{ border: '1px solid #1A73E8', borderRadius: '4px', padding: '6px 12px', color: '#1A73E8', fontWeight: '600', backgroundColor: '#FFFFFF' }}>
                  View Report <FileText size={16} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', marginTop: '24px' }}>
              <div className="date-selector" style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '12px 24px', borderRadius: '30px', border: '1px solid #E8EAED', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <span className="date-nav" onClick={handlePrevAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronLeft size={22} strokeWidth={2.5} /></span>
                <span style={{ fontSize: '18px', fontWeight: '600', color: '#202124', minWidth: '180px', textAlign: 'center' }}>
                  {new Date(attendanceDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '')}
                </span>
                <span className="date-nav" onClick={handleNextAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronRight size={22} strokeWidth={2.5} /></span>
                <div style={{ width: '1px', height: '24px', backgroundColor: '#E8EAED', margin: '0 8px' }}></div>
                <button className="calendar-icon-btn" style={{ position: 'relative', border: 'none', backgroundColor: 'transparent', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={22} color="#1A73E8" strokeWidth={2} />
                  <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                </button>
              </div>
            </div>
            <div className="search-bar-full" style={{ border: '1px solid #D2D6DC', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
              <Search size={20} color="#9AA0A6" />
              <input 
                type="text" 
                placeholder="Search Staff by Name, Phone Number or EmployeeID" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', marginLeft: '12px', fontSize: '15px' }}
              />
            </div>

            <div className="report-section" style={{ padding: '24px', border: '1px solid #1A73E8', borderRadius: '12px', backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div className="report-section-header" style={{ marginBottom: '24px', borderBottom: '1px solid #F1F3F4', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="report-section-title" style={{ fontSize: '18px', color: '#1A73E8', fontWeight: '600' }}>
                  Attendance Records <span className="report-badge">{filteredData.length}</span>
                </div>
                <div style={{ display: 'flex', backgroundColor: '#F1F3F4', borderRadius: '6px', padding: '4px' }}>
                  <button 
                    onClick={() => setAttendanceViewTab('daily')}
                    style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', backgroundColor: attendanceViewTab === 'daily' ? '#FFFFFF' : 'transparent', color: attendanceViewTab === 'daily' ? '#1A73E8' : '#5F6368', boxShadow: attendanceViewTab === 'daily' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                  >
                    Daily Attendance
                  </button>
                  <button 
                    onClick={() => setAttendanceViewTab('monthly')}
                    style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', backgroundColor: attendanceViewTab === 'monthly' ? '#FFFFFF' : 'transparent', color: attendanceViewTab === 'monthly' ? '#1A73E8' : '#5F6368', boxShadow: attendanceViewTab === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                  >
                    Month Attendance
                  </button>
                </div>
              </div>
              
              {filteredData.length === 0 ? (
                <div className="att-staff-card" style={{ justifyContent: 'center', padding: '24px', color: '#5F6368' }}>
                  No staff matching search.
                </div>
              ) : attendanceViewTab === 'daily' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ padding: '16px', fontWeight: '600', color: '#3c4043' }}>Name</th>
                      <th style={{ padding: '16px', fontWeight: '600', color: '#3c4043' }}>Status</th>
                      <th style={{ padding: '16px', fontWeight: '600', color: '#3c4043' }}>Time Login</th>
                      <th style={{ padding: '16px', fontWeight: '600', color: '#3c4043' }}>Time Logout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((staff, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '16px', color: '#202124', fontWeight: '500' }}>{staff.name}</td>
                        <td style={{ padding: '16px', color: staff.status === 'Present' ? '#188038' : staff.status === 'Absent' ? '#d93025' : (staff.status === 'Late' || staff.status === 'Late / Present') ? '#B08D00' : '#5f6368', fontWeight: '600' }}>
                          {staff.status === 'Late / Present' ? (
                            <span style={{ background: 'linear-gradient(90deg, #FFF9C4 50%, #E6F4EA 50%)', padding: '4px 8px', borderRadius: '4px' }}>{staff.status}</span>
                          ) : staff.status}
                        </td>
                        <td style={{ padding: '16px', color: '#5f6368' }}>{staff.in}</td>
                        <td style={{ padding: '16px', color: '#5f6368' }}>{staff.out}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ padding: '16px', fontWeight: '600', color: '#3c4043' }}>Name</th>
                      <th style={{ padding: '16px', fontWeight: '600', color: '#3c4043' }}>Total Present</th>
                      <th style={{ padding: '16px', fontWeight: '600', color: '#3c4043' }}>Total Absent</th>
                      <th style={{ padding: '16px', fontWeight: '600', color: '#3c4043' }}>Total Half Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((staff, idx) => {
                      const curDate = new Date(attendanceDate);
                      const mYear = curDate.getFullYear();
                      const mMonth = curDate.getMonth();
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && new Date(l.dateIso).getFullYear() === mYear && new Date(l.dateIso).getMonth() === mMonth);
                      
                      let pres = 0;
                      let hd = 0;
                      
                      // Calculate unique days present/halfday
                      const uniqueDays = new Set();
                      staffLogs.forEach(l => {
                        const dStr = new Date(l.dateIso).toDateString();
                        uniqueDays.add(dStr);
                      });
                      
                      pres = uniqueDays.size;

                      // Real Absent calculation:
                      const daysInMonth = new Date(mYear, mMonth + 1, 0).getDate();
                      const today = new Date();
                      let daysPassed = daysInMonth;
                      if (mYear === today.getFullYear() && mMonth === today.getMonth()) {
                        daysPassed = today.getDate();
                      } else if (mYear > today.getFullYear() || (mYear === today.getFullYear() && mMonth > today.getMonth())) {
                        daysPassed = 0;
                      }

                      const abs = Math.max(0, daysPassed - pres - hd);

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          <td style={{ padding: '16px', color: '#202124', fontWeight: '500' }}>{staff.name}</td>
                          <td style={{ padding: '16px', color: '#188038', fontWeight: '600' }}>{pres}</td>
                          <td style={{ padding: '16px', color: '#d93025', fontWeight: '600' }}>{abs}</td>
                          <td style={{ padding: '16px', color: '#e37400', fontWeight: '600' }}>{hd}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        )}

        {activeTab === 'reports' && (
          <div className="reports-view-main">
            <div className="reports-view-header">
              <h1 className="reports-view-title">Reports</h1>
            </div>

            <div className="reports-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
              <div className="report-accordion-card expanded">
                <div className="report-accordion-header" style={{ cursor: 'default' }}>
                  <div className="report-premium-icon attendance">
                    <Calendar size={24} />
                  </div>
                  <div className="report-accordion-title-area">
                    <h2 className="report-accordion-title">Attendance Reports</h2>
                    <p className="report-accordion-subtitle">Attendance Report, Daily Attendance Report</p>
                  </div>
                </div>
                
                <div className="report-accordion-body">
                  <div className="report-accordion-row">
                    <div className="report-accordion-info">
                      <h3 className="report-accordion-row-title">Attendance Report</h3>
                      <p className="report-accordion-row-subtitle">Staff level summary for individual attendance cycle</p>
                    </div>
                    <div className="report-accordion-actions">
                      <button className="btn-premium-outline" onClick={() => setActiveTab('attendance-report-view')} style={{ padding: '8px 24px' }}>
                        View
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* HIDDEN EXPORT CONTAINER (For PDF Split) */}
            <div id="pdf-export-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '297mm', backgroundColor: '#fff', padding: '20px', color: '#000' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                Attendance Sheet - {new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h2>
              
              {/* TABLE 1: Days 1-20 */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 1: Days 1-20</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: 20}, (_, i) => i + 1).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: 20}, (_, i) => i + 1).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > new Date().toISOString().split('T')[0];
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* TABLE 2: Days 21-End */}
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 2: Days 21-{new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate()}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate() - 20}, (_, i) => i + 21).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Present</th>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      let presentCount = 0;
                      let absentCount = 0;
                      
                      const rDaysInMonth = new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate();
                      const todayStr = new Date().toISOString().split('T')[0];
                      
                      for (let i=1; i<=rDaysInMonth; i++) {
                         const dateStr = `${musterRollMonthYear}-${String(i).padStart(2, '0')}`;
                         const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                         const checkin = dayLogs.find(l => l.type === 'checkin');
                         if (checkin && checkin.status !== 'Absent') {
                             presentCount++;
                         } else {
                             const isFutureDate = dateStr > todayStr;
                             if (!isFutureDate) absentCount++;
                         }
                      }

                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: rDaysInMonth - 20}, (_, i) => i + 21).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > todayStr;
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{presentCount}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{absentCount}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance-report-view' && (
          <div className="attendance-report-view-main" style={{ padding: '24px', backgroundColor: '#F8F9FA', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '24px' }}>
              <button onClick={() => setActiveTab('reports')} style={{ background: 'none', border: 'none', color: '#1A73E8', display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: '500', padding: 0 }}>
                <ChevronLeft size={16} /> Back
              </button>
            </div>

            {/* Dashboard-Style Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#202124', margin: 0 }}>Attendance Details</h1>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Standard Dashboard Date Selector using musterRollMonthYear state */}
                <div className="date-selector" style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #dadce0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <span className="date-nav" onClick={() => {
                    const [y, m] = musterRollMonthYear.split('-');
                    const d = new Date(y, m - 1, 1);
                    d.setMonth(d.getMonth() - 1);
                    const newY = d.getFullYear();
                    const newM = String(d.getMonth() + 1).padStart(2, '0');
                    setMusterRollMonthYear(`${newY}-${newM}`);
                  }} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronLeft size={20} strokeWidth={2.5} /></span>
                  
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#202124', minWidth: '130px', textAlign: 'center' }}>
                    {new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </span>
                  
                  <span className="date-nav" onClick={() => {
                    const [y, m] = musterRollMonthYear.split('-');
                    const d = new Date(y, parseInt(m) - 1, 1);
                    d.setMonth(d.getMonth() + 1);
                    const newY = d.getFullYear();
                    const newM = String(d.getMonth() + 1).padStart(2, '0');
                    setMusterRollMonthYear(`${newY}-${newM}`);
                  }} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronRight size={20} strokeWidth={2.5} /></span>
                  
                  <button className="calendar-icon-btn" style={{ position: 'relative', border: 'none', backgroundColor: '#E8F0FE', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px' }}>
                    <Calendar size={18} color="#1A73E8" strokeWidth={2.5} />
                    <input type="month" value={musterRollMonthYear} onChange={(e) => setMusterRollMonthYear(e.target.value)} style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                  </button>
                </div>

                {/* Download Dropdown */}
                <div style={{ position: 'relative' }}>
                  <select 
                    style={{ padding: '10px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', outline: 'none', fontSize: '14px', appearance: 'none', paddingRight: '32px' }}
                    onChange={(e) => {
                        if (e.target.value === 'pdf') {
                            showToast('Generating PDF...');
                            downloadAttendancePDF();
                        } else if (e.target.value === 'excel') {
                            showToast('Generating Excel...');
                            downloadAttendanceExcel();
                        }
                        e.target.value = ''; 
                    }}
                  >
                    <option value="" disabled selected>Download ▼</option>
                    <option value="pdf">Download PDF</option>
                    <option value="excel">Download Excel</option>
                  </select>
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'white' }}>
                    <Download size={16} />
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Grid */}
            <div id="attendance-grid-container" style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E8EAED', flex: 1, padding: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: '100%', overflowX: 'auto', flex: 1, border: '1px solid #D9D9D9' }}>
                <table style={{ minWidth: 'max-content', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px', width: '100%' }}>
                  <thead>
                    <tr>
                      <th colSpan="35" style={{ backgroundColor: '#4A72C8', color: '#FFFFFF', padding: '12px', fontSize: '20px', fontWeight: '600', border: '1px solid #D9D9D9' }}>
                        Attendance Sheet for {new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                      </th>
                    </tr>
                    <tr style={{ backgroundColor: '#4A72C8', color: '#FFFFFF' }}>
                      <th style={{ padding: '8px 16px', border: '1px solid #D9D9D9', fontWeight: '500', minWidth: '80px' }}>S.No</th>
                      <th style={{ padding: '8px 16px', border: '1px solid #D9D9D9', fontWeight: '500', minWidth: '150px' }}>Staff Name</th>
                      {(() => {
                        const [rYear, rMonth] = musterRollMonthYear.split('-');
                        const rDaysInMonth = new Date(rYear, rMonth, 0).getDate();
                        const rDaysArray = Array.from({length: rDaysInMonth}, (_, i) => i + 1);
                        return rDaysArray.map(dayStr => {
                          const monthShort = new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'short' });
                          return (
                            <th key={dayStr} style={{ padding: '8px 4px', border: '1px solid #D9D9D9', fontWeight: '500', height: '100px', backgroundColor: '#B4C6E7', color: '#333' }}>
                              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                {dayStr}-{monthShort}
                              </div>
                            </th>
                          );
                        });
                      })()}
                      <th style={{ padding: '8px 16px', border: '1px solid #D9D9D9', fontWeight: '500', backgroundColor: '#548235', color: '#FFFFFF' }}>Present Count</th>
                      <th style={{ padding: '8px 16px', border: '1px solid #D9D9D9', fontWeight: '500', backgroundColor: '#D93025', color: '#FFFFFF' }}>Absent Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                        const [rYear, rMonth] = musterRollMonthYear.split('-');
                        const rDaysInMonth = new Date(rYear, rMonth, 0).getDate();
                        const rDaysArray = Array.from({length: rDaysInMonth}, (_, i) => i + 1);
                        const todayStr = new Date().toISOString().split('T')[0];

                        return staffData.map((staff, idx) => {
                          const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                          
                          let presentCount = 0;
                          let absentCount = 0;

                          const dayStatuses = rDaysArray.map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             
                             if (checkin && checkin.status === 'Late') {
                                 presentCount++;
                                 return 'L';
                             } else if (checkin && checkin.status !== 'Absent') {
                                 const hasCheckout = dayLogs.some(l => l.type === 'checkout');
                                 presentCount++;
                                 return hasCheckout ? 'P' : 'W';
                             } else {
                                 const isFutureDate = dateStr > todayStr;
                                 if (!isFutureDate) {
                                     absentCount++;
                                     return 'A';
                                 }
                                 return '-';
                             }
                          });

                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #D9D9D9' }}>
                              <td style={{ padding: '8px', border: '1px solid #D9D9D9', color: '#333' }}>{idx + 1}</td>
                              <td style={{ padding: '8px', border: '1px solid #D9D9D9', color: '#333', textAlign: 'left', fontWeight: '500' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                              {dayStatuses.map((status, i) => (
                                <td key={i} style={{ padding: '8px 4px', border: '1px solid #D9D9D9' }}>
                                  {status === 'P' ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#E2F0CB' }}>
                                      <Check size={14} color="#548235" strokeWidth={3} />
                                    </div>
                                  ) : status === 'L' ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#FEF3C7' }}>
                                      <Check size={14} color="#D97706" strokeWidth={3} />
                                    </div>
                                  ) : status === 'W' ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#E8F0FE' }}>
                                      <Check size={14} color="#1A73E8" strokeWidth={3} />
                                    </div>
                                  ) : status === 'A' ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#FFD9D9' }}>
                                      <X size={14} color="#D93025" strokeWidth={3} />
                                    </div>
                                  ) : (
                                    <div style={{ color: '#9AA0A6' }}>-</div>
                                  )}
                                </td>
                              ))}
                              <td style={{ padding: '8px', border: '1px solid #D9D9D9', color: '#333', fontWeight: '600' }}>{presentCount}</td>
                              <td style={{ padding: '8px', border: '1px solid #D9D9D9', color: '#333', fontWeight: '600' }}>{absentCount}</td>
                            </tr>
                          );
                        });
                    })()}
                    {staffData.length === 0 && (
                      <tr>
                        <td colSpan="35" style={{ padding: '24px', textAlign: 'center', color: '#5F6368', border: '1px solid #D9D9D9' }}>No staff found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HIDDEN EXPORT CONTAINER (For PDF Split) */}
            <div id="pdf-export-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '297mm', backgroundColor: '#fff', padding: '20px', color: '#000' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                Attendance Sheet - {new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h2>
              
              {/* TABLE 1: Days 1-20 */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 1: Days 1-20</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: 20}, (_, i) => i + 1).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: 20}, (_, i) => i + 1).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > new Date().toISOString().split('T')[0];
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* TABLE 2: Days 21-End */}
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 2: Days 21-{new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate()}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate() - 20}, (_, i) => i + 21).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Present</th>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      let presentCount = 0;
                      let absentCount = 0;
                      
                      const rDaysInMonth = new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate();
                      const todayStr = new Date().toISOString().split('T')[0];
                      
                      for (let i=1; i<=rDaysInMonth; i++) {
                         const dateStr = `${musterRollMonthYear}-${String(i).padStart(2, '0')}`;
                         const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                         const checkin = dayLogs.find(l => l.type === 'checkin');
                         if (checkin && checkin.status !== 'Absent') {
                             presentCount++;
                         } else {
                             const isFutureDate = dateStr > todayStr;
                             if (!isFutureDate) absentCount++;
                         }
                      }

                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: rDaysInMonth - 20}, (_, i) => i + 21).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > todayStr;
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{presentCount}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{absentCount}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'dashboard' && activeTab !== 'staff' && activeTab !== 'attendance' && activeTab !== 'reports' && activeTab !== 'cash-book' && activeTab !== 'online-payment' && activeTab !== 'settings' && activeTab !== 'salary-slip' && activeTab !== 'work-hours' && activeTab !== 'payment' && activeTab !== 'attendance-report-view' && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: '16px' }}>
            <LayoutDashboard size={48} color="#D2D6DC" />
            <h2 style={{ color: '#5F6368', fontWeight: 500, textTransform: 'capitalize' }}>{activeTab.replace('-', ' ')} Area</h2>
            <p style={{ color: '#9AA0A6' }}>This section is currently under construction.</p>
          </div>
        )}

        {/* UNIFIED COMPREHENSIVE STAFF PROFILE (PDF VIEW) */}
        {activeTab === 'staff-profile-pdf' && (
          <div className="salary-slip-view">
            <div className="slip-controls no-print">
              <button className="btn-primary" onClick={() => setActiveTab('reports')} style={{ backgroundColor: '#5f6368', borderColor: '#5f6368' }}>
                <ArrowLeft size={16} style={{marginRight: '8px'}} /> Back to Reports
              </button>
              <button className="btn-primary slip-print-btn" onClick={() => window.print()} style={{ marginLeft: 'auto' }}>
                <Download size={16} style={{marginRight: '8px'}} /> Print / Download PDF
              </button>
            </div>

            {(() => {
              const staffListToRender = reportsSelectedStaff 
                ? dailyStaffData.filter(s => s.id === reportsSelectedStaff) 
                : dailyStaffData;

              if (!staffListToRender || staffListToRender.length === 0) return <div style={{padding: '40px'}}>No staff data available.</div>;

              return (
                <div>
                  {staffListToRender.map((staff, index) => (
                    <div key={staff.id || index} className="payslip-container" style={{ maxWidth: '900px', pageBreakAfter: 'always', marginBottom: '40px' }}>
                      <div className="payslip-header" style={{ borderBottom: '3px solid #1a73e8', paddingBottom: '16px', marginBottom: '24px' }}>
                    <h1 className="payslip-company">HOSUR INFRATECH</h1>
                    <h2 className="payslip-title">Comprehensive Staff Profile & Activity Report</h2>
                    <p style={{ textAlign: 'center', color: '#5f6368', fontSize: '14px', marginTop: '8px' }}>Generated on: {new Date().toLocaleDateString()}</p>
                  </div>
                  
                  {/* Section 1: Personal Details */}
                  <h3 style={{ fontSize: '18px', color: '#1a73e8', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px', marginBottom: '16px' }}>1. Personal & Employment Details</h3>
                  <div className="payslip-details-grid" style={{ marginBottom: '32px' }}>
                    <div className="payslip-detail-col">
                      <div className="payslip-detail-row"><span className="payslip-label">Name:</span> <span className="payslip-val">{staff.name}</span></div>
                      <div className="payslip-detail-row"><span className="payslip-label">Phone:</span> <span className="payslip-val">{staff.phone}</span></div>
                      <div className="payslip-detail-row"><span className="payslip-label">Department:</span> <span className="payslip-val">{staff.dept || 'N/A'}</span></div>
                    </div>
                    <div className="payslip-detail-col">
                      <div className="payslip-detail-row"><span className="payslip-label">Designation/Shift:</span> <span className="payslip-val">{staff.shift || 'N/A'}</span></div>
                      <div className="payslip-detail-row"><span className="payslip-label">Aadhar Number:</span> <span className="payslip-val">{staff.aadharNumber || 'N/A'}</span></div>
                      <div className="payslip-detail-row"><span className="payslip-label">Status:</span> <span className="payslip-val">{staff.status}</span></div>
                    </div>
                  </div>

                  {/* Section 2: Banking Details */}
                  <h3 style={{ fontSize: '18px', color: '#1a73e8', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px', marginBottom: '16px' }}>2. Financial & Banking Information</h3>
                  <div className="payslip-details-grid" style={{ marginBottom: '32px' }}>
                    <div className="payslip-detail-col">
                      <div className="payslip-detail-row"><span className="payslip-label">Basic Salary:</span> <span className="payslip-val">₹ {staff.basicSalary || '0'}</span></div>
                      <div className="payslip-detail-row"><span className="payslip-label">Bank Name:</span> <span className="payslip-val">{staff.bankName || 'N/A'}</span></div>
                    </div>
                    <div className="payslip-detail-col">
                      <div className="payslip-detail-row"><span className="payslip-label">Account Number:</span> <span className="payslip-val">{staff.accountNumber || 'N/A'}</span></div>
                      <div className="payslip-detail-row"><span className="payslip-label">IFSC Code:</span> <span className="payslip-val">{staff.ifsc || 'N/A'}</span></div>
                    </div>
                  </div>

                  {/* Section 3: Attendance & Logs Summary */}
                  <h3 style={{ fontSize: '18px', color: '#1a73e8', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px', marginBottom: '16px' }}>3. Recent Activity & Compliance Summary</h3>
                  <div className="payslip-table-wrapper" style={{ marginBottom: '32px' }}>
                    <table className="payslip-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Category</th>
                          <th style={{ textAlign: 'right' }}>Status / Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Daily Attendance Status</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{staff.status || 'Not Marked'}</td>
                        </tr>
                        <tr>
                          <td>In Time (Punch In)</td>
                          <td style={{ textAlign: 'right' }}>{staff.in || '--'}</td>
                        </tr>
                        <tr>
                          <td>Out Time (Punch Out)</td>
                          <td style={{ textAlign: 'right' }}>{staff.out || '--'}</td>
                        </tr>
                        <tr>
                          <td>Total Overtime (OT)</td>
                          <td style={{ textAlign: 'right' }}>{staff.ot || '00:00'} hrs</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px dashed #ccc', display: 'flex', justifyContent: 'space-between', color: '#5f6368' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p>_______________________</p>
                      <p style={{ marginTop: '8px', fontSize: '14px' }}>Employer Signature</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p>_______________________</p>
                      <p style={{ marginTop: '8px', fontSize: '14px' }}>Employee Signature</p>
                    </div>
                  </div>
                </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* SALARY SLIP VIEW */}
        {activeTab === 'salary-slip' && (
          <div className="salary-slip-view">
            <div className="slip-controls no-print">
              <div className="slip-control-group">
                <label>Select Staff</label>
                <select value={slipSelectedStaff} onChange={(e) => setSlipSelectedStaff(e.target.value)} className="slip-select">
                  <option value="">-- Choose Staff --</option>
                  {staffData.map(staff => (
                    <option key={staff.id} value={staff.id}>{staff.name} {staff.dept ? `(${staff.dept})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="slip-control-group">
                <label>Month / Year</label>
                <input type="text" value={slipMonthYear} onChange={(e) => setSlipMonthYear(e.target.value)} placeholder="MM/YYYY" className="slip-input-small" />
              </div>
              <button className="btn-primary slip-print-btn" onClick={() => window.print()}>
                Print / Download PDF
              </button>
            </div>

            <div className="payslip-container" key={slipSelectedStaff}>
              <div className="payslip-header">
                <h1 className="payslip-company">HOSUR INFRATECH</h1>
                <h2 className="payslip-title">Salary Slip for {slipMonthYear}</h2>
              </div>
              
              <div className="payslip-details-grid">
                <div className="payslip-detail-col">
                  <div className="payslip-detail-row"><span className="payslip-label">Name:</span> <span className="payslip-val">{slipSelectedStaff ? staffData.find(s => s.id === slipSelectedStaff)?.name : '__________________'}</span></div>
                  <div className="payslip-detail-row"><span className="payslip-label">Designation:</span> <span className="payslip-val">{slipSelectedStaff ? staffData.find(s => s.id === slipSelectedStaff)?.shift || 'Employee' : '__________________'}</span></div>
                  <div className="payslip-detail-row"><span className="payslip-label">Location:</span> <span className="payslip-val">Hosur</span></div>
                </div>
                <div className="payslip-detail-col">
                  <div className="payslip-detail-row"><span className="payslip-label">Department:</span> <span className="payslip-val">{slipSelectedStaff ? staffData.find(s => s.id === slipSelectedStaff)?.dept || 'General' : '__________________'}</span></div>
                  <div className="payslip-detail-row"><span className="payslip-label">Bank Name:</span> <input type="text" className="payslip-editable-inline" placeholder="__________________" defaultValue={slipSelectedStaff ? staffData.find(s => s.id === slipSelectedStaff)?.bankName : ''} /></div>
                  <div className="payslip-detail-row"><span className="payslip-label">Account No:</span> <input type="text" className="payslip-editable-inline" placeholder="__________________" defaultValue={slipSelectedStaff ? staffData.find(s => s.id === slipSelectedStaff)?.accountNumber : ''} /></div>
                </div>
              </div>

              <div className="payslip-table-wrapper">
                <table className="payslip-table">
                  <thead>
                    <tr>
                      <th colSpan="3" style={{borderRight: '1px solid #ddd'}}>Earnings</th>
                      <th colSpan="3">Deductions</th>
                    </tr>
                    <tr className="payslip-subhead">
                      <th width="10%">S. No.</th>
                      <th width="60%">Salary Head</th>
                      <th width="30%" style={{borderRight: '1px solid #ddd'}}>Amount</th>
                      <th width="10%">S. No.</th>
                      <th width="60%">Salary Head</th>
                      <th width="30%">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="center">1.</td><td>Basic</td><td className="right" style={{borderRight: '1px solid #ddd'}}><input type="text" className="payslip-editable-amount" placeholder="0" defaultValue={slipSelectedStaff ? staffData.find(s => s.id === slipSelectedStaff)?.basicSalary : ''} /></td>
                      <td className="center">1.</td><td>Professional Tax</td><td className="right"><input type="text" className="payslip-editable-amount" placeholder="0" /></td>
                    </tr>
                    <tr>
                      <td className="center">2.</td><td>Dearness Allowance</td><td className="right" style={{borderRight: '1px solid #ddd'}}><input type="text" className="payslip-editable-amount" placeholder="0" /></td>
                      <td className="center">2.</td><td>TDS</td><td className="right"><input type="text" className="payslip-editable-amount" placeholder="0" /></td>
                    </tr>
                    <tr>
                      <td className="center">3.</td><td>House Rent Allowance</td><td className="right" style={{borderRight: '1px solid #ddd'}}><input type="text" className="payslip-editable-amount" placeholder="0" /></td>
                      <td className="center">3.</td><td>EPF</td><td className="right"><input type="text" className="payslip-editable-amount" placeholder="0" /></td>
                    </tr>
                    <tr>
                      <td className="center">4.</td><td>Conveyance Allowance</td><td className="right" style={{borderRight: '1px solid #ddd'}}><input type="text" className="payslip-editable-amount" placeholder="0" /></td>
                      <td className="center"></td><td></td><td className="right"></td>
                    </tr>
                    <tr>
                      <td className="center">5.</td><td>Medical Allowance</td><td className="right" style={{borderRight: '1px solid #ddd'}}><input type="text" className="payslip-editable-amount" placeholder="0" /></td>
                      <td className="center"></td><td></td><td className="right"></td>
                    </tr>
                    <tr>
                      <td className="center">6.</td><td>Special Allowance</td><td className="right" style={{borderRight: '1px solid #ddd'}}><input type="text" className="payslip-editable-amount" placeholder="0" /></td>
                      <td className="center"></td><td></td><td className="right"></td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="2" className="right bold">Gross Salary</td>
                      <td className="right bold" style={{borderRight: '1px solid #ddd'}}><input type="text" className="payslip-editable-amount bold" placeholder="0" /></td>
                      <td colSpan="2" className="right bold">Total Deduction</td>
                      <td className="right bold"><input type="text" className="payslip-editable-amount bold" placeholder="0" /></td>
                    </tr>
                    <tr>
                      <td colSpan="2" className="right bold">Reimbursement</td>
                      <td className="right bold" style={{borderRight: '1px solid #ddd'}}><input type="text" className="payslip-editable-amount bold" placeholder="0" /></td>
                      <td colSpan="3" rowSpan="2" style={{verticalAlign: 'middle', textAlign: 'right', paddingRight: '16px'}}>
                        <div style={{color: '#1a73e8', fontWeight: 600, fontStyle: 'italic'}}>HOSUR INFRATECH</div>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan="2" className="right bold" style={{fontSize: '16px'}}>Net Salary</td>
                      <td className="right bold" style={{borderRight: '1px solid #ddd', fontSize: '16px'}}><input type="text" className="payslip-editable-amount bold" style={{fontSize: '16px'}} placeholder="0" /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* HIDDEN EXPORT CONTAINER (For PDF Split) */}
            <div id="pdf-export-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '297mm', backgroundColor: '#fff', padding: '20px', color: '#000' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                Attendance Sheet - {new Date(musterRollMonthYear + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h2>
              
              {/* TABLE 1: Days 1-20 */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 1: Days 1-20</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: 20}, (_, i) => i + 1).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: 20}, (_, i) => i + 1).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > new Date().toISOString().split('T')[0];
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* TABLE 2: Days 21-End */}
              <div>
                <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Part 2: Days 21-{new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate()}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>S.No</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Staff Name</th>
                      {Array.from({length: new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate() - 20}, (_, i) => i + 21).map(d => (
                        <th key={d} style={{ border: '1px solid #000', padding: '4px' }}>{d}</th>
                      ))}
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Present</th>
                      <th style={{ border: '1px solid #000', padding: '4px' }}>Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, idx) => {
                      const staffLogs = attendanceLogs.filter(l => l.employeeId === staff.id && l.dateIso && l.dateIso.startsWith(musterRollMonthYear));
                      let presentCount = 0;
                      let absentCount = 0;
                      
                      const rDaysInMonth = new Date(musterRollMonthYear.split('-')[0], musterRollMonthYear.split('-')[1], 0).getDate();
                      const todayStr = new Date().toISOString().split('T')[0];
                      
                      for (let i=1; i<=rDaysInMonth; i++) {
                         const dateStr = `${musterRollMonthYear}-${String(i).padStart(2, '0')}`;
                         const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                         const checkin = dayLogs.find(l => l.type === 'checkin');
                         if (checkin && checkin.status !== 'Absent') {
                             presentCount++;
                         } else {
                             const isFutureDate = dateStr > todayStr;
                             if (!isFutureDate) absentCount++;
                         }
                      }

                      return (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '4px' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>{typeof staff.name === 'object' ? '' : staff.name}</td>
                          {Array.from({length: rDaysInMonth - 20}, (_, i) => i + 21).map(dayStr => {
                             const dateStr = `${musterRollMonthYear}-${String(dayStr).padStart(2, '0')}`;
                             const dayLogs = staffLogs.filter(l => getLocalDateStr(l.dateIso) === dateStr);
                             const checkin = dayLogs.find(l => l.type === 'checkin');
                             let status = '-';
                             if (checkin && checkin.status !== 'Absent') {
                                 status = 'P';
                             } else {
                                 const isFutureDate = dateStr > todayStr;
                                 if (!isFutureDate) status = 'A';
                             }
                             return <td key={dayStr} style={{ border: '1px solid #000', padding: '4px', color: status==='P' ? '#15803d' : status==='A' ? '#b91c1c' : '#000', fontWeight: 'bold' }}>{status}</td>;
                          })}
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{presentCount}</td>
                          <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>{absentCount}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CASH BOOK VIEW -> MONTHLY SALARY CALCULATOR */}
        {activeTab === 'cash-book' && (() => {
          const cbYear = cashBookDate.getFullYear();
          const cbMonth = cashBookDate.getMonth();
          const monthName = cashBookDate.toLocaleString('default', { month: 'short' });

          const monthlyLogs = attendanceLogs.filter(l => {
            const d = new Date(l.dateIso);
            return d.getFullYear() === cbYear && d.getMonth() === cbMonth;
          });

          let totalMonthPayout = 0;
          const staffSalaryData = staffData.map(staff => {
            const staffLogs = monthlyLogs.filter(l => l.employeeId === staff.id);
            const uniqueDays = new Set();
            staffLogs.forEach(l => {
              if (l.type === 'checkin') {
                uniqueDays.add(new Date(l.dateIso).toISOString().split('T')[0]);
              }
            });
            const presentDays = uniqueDays.size;
            const dailyWage = parseFloat(staff.dailyWage) || 0;
            const totalSalary = presentDays * dailyWage;
            totalMonthPayout += totalSalary;

            return {
              ...staff,
              presentDays,
              totalSalary
            };
          });

          const changeCashBookMonth = (delta) => {
            setCashBookDate(prev => {
              const d = new Date(prev);
              d.setMonth(d.getMonth() + delta);
              return d;
            });
          };

          const handleDailyWageChange = async (staffId, newValue) => {
            try {
              await updateDoc(doc(db, "staff", staffId), { dailyWage: newValue });
            } catch (e) {
              console.error("Failed to update daily wage", e);
            }
          };

          const downloadSalaryReport = () => {
             const element = document.getElementById('salary-report-content');
             html2pdf().from(element).save(`Salary_Report_${monthName}_${cbYear}.pdf`);
          };

          return (
            <div className="cash-book-view">
              <div className="cb-header">
                <h1 className="cb-title">Monthly Salary Calculator</h1>
              </div>

              <div className="cb-summary-card" style={{ marginBottom: '16px' }}>
                <div className="cb-summary-left">
                  <div className="cb-date-nav">
                    <span className="cb-date-arrow" onClick={() => changeCashBookMonth(-1)}>&lt;</span>
                    <span>{monthName}, {cbYear}</span>
                    <span className="cb-date-arrow" onClick={() => changeCashBookMonth(1)}>&gt;</span>
                  </div>
                  <div className="cb-metrics">
                    <div className="cb-metric-col">
                      <div className="cb-metric-val red">₹ {totalMonthPayout.toFixed(2)}</div>
                      <div className="cb-metric-label">Total Estimated Payout</div>
                    </div>
                  </div>
                </div>
                <button className="btn-outline-grey" onClick={downloadSalaryReport}>Download Report (PDF)</button>
              </div>

              <div id="salary-report-content" className="salary-table-container" style={{ background: 'white', borderRadius: '8px', padding: '16px', overflowX: 'auto', border: '1px solid #E8EAED' }}>
                <h3 style={{ marginBottom: '16px', color: '#202124' }}>Salary Report - {monthName} {cbYear}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E8EAED' }}>
                      <th style={{ padding: '12px 16px', color: '#5F6368', fontWeight: '500' }}>Staff Member</th>
                      <th style={{ padding: '12px 16px', color: '#5F6368', fontWeight: '500' }}>Present Days</th>
                      <th style={{ padding: '12px 16px', color: '#5F6368', fontWeight: '500' }}>Daily Wage (₹)</th>
                      <th style={{ padding: '12px 16px', color: '#5F6368', fontWeight: '500', textAlign: 'right' }}>Total Salary (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffSalaryData.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: '#5F6368' }}>No staff data available.</td>
                      </tr>
                    ) : (
                      staffSalaryData.map((staff, idx) => (
                        <tr key={staff.id} style={{ borderBottom: idx === staffSalaryData.length - 1 ? 'none' : '1px solid #E8EAED' }}>
                          <td style={{ padding: '16px' }}>
                            <div style={{ fontWeight: '500', color: '#202124' }}>{staff.name}</div>
                            <div style={{ fontSize: '12px', color: '#5F6368', marginTop: '4px' }}>{staff.dept || 'General'}</div>
                          </td>
                          <td style={{ padding: '16px', color: '#202124' }}>{staff.presentDays} Days</td>
                          <td style={{ padding: '16px' }}>
                            <input 
                              type="number" 
                              className="modal-input" 
                              style={{ width: '120px', margin: 0, padding: '8px' }}
                              placeholder="0.00"
                              defaultValue={staff.dailyWage || ''}
                              onBlur={(e) => handleDailyWageChange(staff.id, e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: '#D93025' }}>
                            ₹ {staff.totalSalary.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {activeTab === 'payment' && (
          <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
            {/* 1. Payment Section */}
            <h1 className="section-title" style={{ marginTop: '32px' }}>Payment</h1>
            
            <div className="payment-grid">
              {/* Staff Payment Summary */}
              <div className="payment-card-premium">
                <div className="payment-card-header">
                  <h3><CreditCard size={20} /> Staff Payment Summary</h3>
                  <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <a href="#" className="view-link" onClick={(e) => { e.preventDefault(); setActiveTab('reports'); }}>View Details</a>
                    <div className="date-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="date-nav" onClick={handlePrevAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronLeft size={18} strokeWidth={2.5} /></span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#202124' }}>
                        {new Date(attendanceDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '')}
                      </span>
                      <span className="date-nav" onClick={handleNextAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronRight size={18} strokeWidth={2.5} /></span>
                      <button className="calendar-icon-btn" style={{ position: 'relative', border: 'none', backgroundColor: '#E8F0FE', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Calendar size={16} color="#1A73E8" strokeWidth={2} />
                        <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="summary-row">
                    <span>Closing Balance</span>
                    <span className="amount">₹ 0</span>
                  </div>
                  <div className="summary-row">
                    <span>{new Date(attendanceDate).toLocaleDateString('en-GB', { month: 'short' })} Payment</span>
                    <span className="amount">₹ 0</span>
                  </div>
                  <div className="summary-row">
                    <span>Pending Dues</span>
                    <span className="amount">₹ 0</span>
                  </div>
                </div>
              </div>

              {/* Summary of Loan */}
              <div className="payment-card-premium">
                <div className="payment-card-header">
                  <h3><Receipt size={20} /> Summary of Loan</h3>
                  <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <a href="#" className="view-link" onClick={(e) => { e.preventDefault(); setActiveTab('reports'); }}>View Details</a>
                    <span style={{ color: '#E8EAED' }}>|</span>
                    <a href="#" className="view-link" style={{ fontWeight: 400 }} onClick={(e) => { e.preventDefault(); handleReportDownload('Loan_Report'); }}>Download Report</a>
                  </div>
                </div>
                <div>
                  <div className="summary-row">
                    <span>Loan Amount</span>
                    <span className="amount">₹ 0</span>
                  </div>
                  <div className="summary-row">
                    <span>Received</span>
                    <span className="amount">₹ 0</span>
                  </div>
                  <div className="summary-row">
                    <span>Pending Loan</span>
                    <span className="amount">₹ 0</span>
                  </div>
                </div>
              </div>

              {/* Payment Log */}
              <div className="payment-card-premium">
                <div className="payment-card-header">
                  <h3><FileSpreadsheet size={20} /> Payment Log</h3>
                  <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <a href="#" className="view-link" style={{ fontWeight: 400 }} onClick={(e) => { e.preventDefault(); handleReportDownload('Payment_Log'); }}>Download Report</a>
                    <div className="date-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="date-nav" onClick={handlePrevAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronLeft size={18} strokeWidth={2.5} /></span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#202124' }}>
                        {new Date(attendanceDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '')}
                      </span>
                      <span className="date-nav" onClick={handleNextAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronRight size={18} strokeWidth={2.5} /></span>
                      <button className="calendar-icon-btn" style={{ position: 'relative', border: 'none', backgroundColor: '#E8F0FE', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Calendar size={16} color="#1A73E8" strokeWidth={2} />
                        <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                      </button>
                    </div>
                  </div>
                </div>
                <table className="card-table">
                  <thead>
                    <tr>
                      <th style={{ width: '50%' }}>Date</th>
                      <th style={{ width: '50%', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                </table>
                <div className="empty-state-premium">
                  <FileText size={48} strokeWidth={1} color="#DADCE0" />
                  <span>No records found</span>
                </div>
              </div>

              {/* Statutory Expenses */}
              <div className="payment-card-premium">
                <div className="payment-card-header">
                  <h3><Building2 size={20} /> Statutory Expenses</h3>
                  <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="date-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="date-nav" onClick={handlePrevAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronLeft size={18} strokeWidth={2.5} /></span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#202124' }}>
                        {new Date(attendanceDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '')}
                      </span>
                      <span className="date-nav" onClick={handleNextAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronRight size={18} strokeWidth={2.5} /></span>
                      <button className="calendar-icon-btn" style={{ position: 'relative', border: 'none', backgroundColor: '#E8F0FE', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Calendar size={16} color="#1A73E8" strokeWidth={2} />
                        <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                      </button>
                    </div>
                  </div>
                </div>
                <table className="card-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Staff</th>
                      <th>Employer</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>PF</td>
                      <td>0</td>
                      <td>0 <ExternalLink size={14} className="link-icon" /></td>
                    </tr>
                    <tr>
                      <td>ESI</td>
                      <td>0</td>
                      <td>-</td>
                    </tr>
                    <tr>
                      <td>LWF</td>
                      <td>-</td>
                      <td>-</td>
                    </tr>
                    <tr>
                      <td>Profession Tax</td>
                      <td>0</td>
                      <td>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Allowance & Work Report Section */}
            <div className="payment-grid">
              {/* Allowance/Deduction/Bonus */}
              <div className="payment-card-premium">
                <div className="payment-card-header">
                  <h3><Briefcase size={20} /> Allowance/Deduction/Bonus</h3>
                  <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="date-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="date-nav" onClick={handlePrevAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronLeft size={18} strokeWidth={2.5} /></span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#202124' }}>
                        {new Date(attendanceDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '')}
                      </span>
                      <span className="date-nav" onClick={handleNextAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronRight size={18} strokeWidth={2.5} /></span>
                      <button className="calendar-icon-btn" style={{ position: 'relative', border: 'none', backgroundColor: '#E8F0FE', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Calendar size={16} color="#1A73E8" strokeWidth={2} />
                        <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                      </button>
                    </div>
                  </div>
                </div>
                <table className="card-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>To Be Paid</th>
                      <th>Paid</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Allowance</td>
                      <td>₹ {totalAllowance}</td>
                      <td>₹ {totalAllowance}</td>
                      <td><a href="#" className="view-link" onClick={(e) => { e.preventDefault(); setLedgerType('Allowance'); setLedgerModalOpen(true); }}>Add Allowance</a> <ExternalLink size={14} className="link-icon" /></td>
                    </tr>
                    <tr>
                      <td>Bonus</td>
                      <td>₹ {totalBonus}</td>
                      <td>₹ {totalBonus}</td>
                      <td><a href="#" className="view-link" onClick={(e) => { e.preventDefault(); setLedgerType('Bonus'); setLedgerModalOpen(true); }}>Add Bonus</a> <ExternalLink size={14} className="link-icon" /></td>
                    </tr>
                    <tr>
                      <td>Deduction</td>
                      <td>₹ {totalDeduction}</td>
                      <td>₹ {totalDeduction}</td>
                      <td><a href="#" className="view-link" onClick={(e) => { e.preventDefault(); setLedgerType('Deduction'); setLedgerModalOpen(true); }}>Add Deduction</a> <ExternalLink size={14} className="link-icon" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Work Report */}
              <div className="payment-card-premium">
                <div className="payment-card-header">
                  <h3><Clock size={20} /> Work Report</h3>
                  <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <a href="#" className="view-link" style={{ fontWeight: 400 }} onClick={(e) => { e.preventDefault(); handleReportDownload('Work_Report'); }}>Download Report</a>
                    <div className="date-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="date-nav" onClick={handlePrevAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronLeft size={18} strokeWidth={2.5} /></span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#202124' }}>
                        {new Date(attendanceDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '')}
                      </span>
                      <span className="date-nav" onClick={handleNextAttendanceDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronRight size={18} strokeWidth={2.5} /></span>
                      <button className="calendar-icon-btn" style={{ position: 'relative', border: 'none', backgroundColor: '#E8F0FE', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Calendar size={16} color="#1A73E8" strokeWidth={2} />
                        <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                      </button>
                    </div>
                  </div>
                </div>
                <table className="card-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center' }}>Day as Date</th>
                      <th style={{ textAlign: 'center' }}>Quantity</th>
                      <th style={{ textAlign: 'center' }}>Amount</th>
                    </tr>
                  </thead>
                </table>
                <div className="empty-state-premium">
                  <FileText size={48} strokeWidth={1} color="#DADCE0" />
                  <span>No work reports found</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ONLINE PAYMENT VIEW -> PAYROLL PAYMENT PORTAL */}
        {activeTab === 'online-payment' && (() => {
          const opYear = cashBookDate.getFullYear();
          const opMonth = cashBookDate.getMonth();
          const monthName = cashBookDate.toLocaleString('default', { month: 'long' });

          const monthlyLogs = attendanceLogs.filter(l => {
            const d = new Date(l.dateIso);
            return d.getFullYear() === opYear && d.getMonth() === opMonth;
          });

          const staffPaymentData = staffData.map(staff => {
            const staffLogs = monthlyLogs.filter(l => l.employeeId === staff.id);
            const uniqueDays = new Set();
            staffLogs.forEach(l => {
              if (l.type === 'checkin') {
                uniqueDays.add(new Date(l.dateIso).toISOString().split('T')[0]);
              }
            });
            const presentDays = uniqueDays.size;
            const dailyWage = parseFloat(staff.dailyWage) || 0;
            const totalSalary = presentDays * dailyWage;

            // Find if already paid (Mock check based on salaryTransactions or just generic state)
            const isPaid = salaryTransactions.some(t => t.staffId === staff.id && t.month === opMonth && t.year === opYear);

            return {
              ...staff,
              totalSalary,
              isPaid
            };
          });

          const handleRecordPayment = async (staffId, amount, name) => {
            if (amount === 0) return alert(`No pending salary calculated for ${name} this month.`);
            try {
              await addDoc(collection(db, "salaryTransactions"), {
                staffId,
                amount,
                month: opMonth,
                year: opYear,
                date: new Date().toISOString(),
                status: 'Paid'
              });
              setToastMessage(`Payment of ₹${amount} recorded for ${name}`);
            } catch (error) {
              console.error("Error recording payment:", error);
            }
          };

          return (
            <div className="online-payment-view" style={{ padding: '32px', flex: 1, overflowY: 'auto', background: '#F8F9FA' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
                <div>
                  <h1 style={{ fontSize: '28px', color: '#202124', fontWeight: 600, letterSpacing: '-0.5px' }}>Payroll Processing</h1>
                  <p style={{ color: '#5F6368', fontSize: '15px', marginTop: '8px' }}>Process and record staff payments directly via bank transfer details.</p>
                </div>
                
                {/* Re-using cashBookDate for consistency across financial tabs */}
                <div style={{ background: 'white', border: '1px solid #E8EAED', borderRadius: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                  <span style={{ cursor: 'pointer', color: '#5F6368', padding: '4px' }} onClick={() => setCashBookDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d; })}>&lt;</span>
                  <span style={{ fontWeight: '600', color: '#1A73E8', minWidth: '100px', textAlign: 'center' }}>{monthName} {opYear}</span>
                  <span style={{ cursor: 'pointer', color: '#5F6368', padding: '4px' }} onClick={() => setCashBookDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d; })}>&gt;</span>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                {staffPaymentData.length === 0 ? (
                  <div style={{ background: 'white', padding: '48px', textAlign: 'center', borderRadius: '12px', color: '#5F6368', border: '1px solid #E8EAED' }}>
                    <CreditCard size={48} style={{ opacity: 0.2, marginBottom: '16px', margin: '0 auto' }} />
                    <p style={{ fontSize: '16px' }}>No staff registered for payroll processing.</p>
                  </div>
                ) : (
                  staffPaymentData.map(staff => (
                    <div key={staff.id} style={{ 
                      background: 'white', 
                      borderRadius: '12px', 
                      padding: '24px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      border: '1px solid #E8EAED',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      transition: 'all 0.2s ease',
                      borderLeft: staff.isPaid ? '4px solid #34A853' : '4px solid #1A73E8'
                    }}>
                      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: '#F1F3F4', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {staff.photo ? <img src={staff.photo} alt={staff.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={24} color="#9AA0A6" />}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#202124', marginBottom: '4px' }}>{staff.name}</h3>
                          <div style={{ display: 'flex', gap: '16px', color: '#5F6368', fontSize: '13px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Building2 size={14}/> {staff.bankName || 'No Bank Added'}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CreditCard size={14}/> {staff.accountNumber ? `A/c: ****${staff.accountNumber.slice(-4)}` : 'No A/c No'}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={14}/> IFSC: {staff.ifsc || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', color: '#5F6368', marginBottom: '4px' }}>Calculated Salary</div>
                          <div style={{ fontSize: '24px', fontWeight: 700, color: '#202124' }}>₹ {staff.totalSalary.toFixed(2)}</div>
                        </div>
                        
                        {staff.isPaid ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34A853', background: '#E6F4EA', padding: '12px 24px', borderRadius: '8px', fontWeight: '600' }}>
                            <CheckCircle2 size={20} /> Paid
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleRecordPayment(staff.id, staff.totalSalary, staff.name)}
                            style={{ background: '#1A73E8', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#1557B0'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#1A73E8'}
                          >
                            <CreditCard size={18} /> Record Payment
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {/* EMPLOYEE WORK HOURS VIEW */}
        {activeTab === 'work-hours' && (
          <div className="work-hours-view" style={{ flex: 1, overflowY: 'auto', padding: '32px', backgroundColor: '#f8f9fa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h1 style={{ fontSize: '24px', color: '#202124', margin: 0, fontWeight: 600 }}>Work Hours</h1>
                <button 
                  onClick={() => { setActiveTab('staff'); setStaffViewMode('add-regular-staff-form'); }}
                  style={{ backgroundColor: '#1a73e8', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '14px' }}
                >
                  <UserPlus size={16} /> Add Staff
                </button>
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '0 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <Search size={18} color="#5f6368" />
                  <input 
                    type="text" 
                    placeholder="Search staff..." 
                    value={workHoursSearch}
                    onChange={(e) => setWorkHoursSearch(e.target.value)}
                    style={{ border: 'none', padding: '12px', outline: 'none', width: '220px', fontSize: '14px' }}
                  />
                </div>
                
                <div className="date-selector" style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #dadce0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <span className="date-nav" onClick={handlePrevWorkHoursDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronLeft size={20} strokeWidth={2.5} /></span>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#202124', minWidth: '130px', textAlign: 'center' }}>
                    {new Date(workHoursDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '')}
                  </span>
                  <span className="date-nav" onClick={handleNextWorkHoursDay} style={{ cursor: 'pointer', color: '#1A73E8', display: 'flex', alignItems: 'center' }}><ChevronRight size={20} strokeWidth={2.5} /></span>
                  <button className="calendar-icon-btn" style={{ position: 'relative', border: 'none', backgroundColor: '#E8F0FE', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px' }}>
                    <Calendar size={18} color="#1A73E8" strokeWidth={2.5} />
                    <input type="date" value={workHoursDate} onChange={(e) => setWorkHoursDate(e.target.value)} style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                  </button>
                </div>
              </div>
            </div>

            <div className="card" style={{ overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', borderRadius: '12px', backgroundColor: '#fff', border: '1px solid #e8eaed' }}>
              <table className="staff-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e8eaed' }}>
                    <th style={{ padding: '18px 24px', fontWeight: 600, color: '#3c4043', fontSize: '14px' }}>Staff Name</th>
                    <th style={{ padding: '18px 24px', fontWeight: 600, color: '#3c4043', fontSize: '14px' }}>Status</th>
                    <th style={{ padding: '18px 24px', fontWeight: 600, color: '#3c4043', fontSize: '14px' }}>Login Time</th>
                    <th style={{ padding: '18px 24px', fontWeight: 600, color: '#3c4043', fontSize: '14px' }}>Logout Time</th>
                    <th style={{ padding: '18px 24px', fontWeight: 600, color: '#34A853', fontSize: '14px' }}>Daily Work Hour</th>
                    <th style={{ padding: '18px 24px', fontWeight: 600, color: '#ea4335', fontSize: '14px' }}>Late Hour</th>
                    <th style={{ padding: '18px 24px', fontWeight: 600, color: '#FBBC04', fontSize: '14px' }}>OT Time</th>
                    <th style={{ padding: '18px 24px', fontWeight: 700, color: '#1a73e8', fontSize: '14px' }}>Total Work Hours (Month)</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredStaff = staffData.map(staff => {
                      const dayLogs = attendanceLogs.filter(l => l.employeeId === staff.id && getLocalDateStr(l.dateIso) === workHoursDate);
                      const checkin = dayLogs.find(l => l.type === 'checkin');
                      const checkout = dayLogs.find(l => l.type === 'checkout');
                      
                      let status = 'Absent';
                      if (!checkin && !checkout) {
                        const isFutureDate = workHoursDate > new Date().toISOString().split('T')[0];
                        status = isFutureDate ? 'Not Marked' : 'Absent';
                      } else {
                        status = checkin ? checkin.status : 'Present';
                        if (checkout && checkout.status && checkout.status !== 'Present') status = checkout.status;
                      }

                      let ot = '00:00';
                      if (checkout && checkout.otMinutes > 0) {
                        const h = Math.floor(checkout.otMinutes / 60).toString().padStart(2, '0');
                        const m = (checkout.otMinutes % 60).toString().padStart(2, '0');
                        ot = `${h}h ${m}m`;
                      }

                      const inTime = (checkin && status !== 'Absent') ? format12Hour(checkin.time) : '-';
                      const outTime = (checkout && status !== 'Absent') ? format12Hour(checkout.time) : '-';
                      const fineHours = calculateFineHours(staff.shift, inTime);
                      const dailyHours = calculateWorkingHours(inTime, outTime);
                      const monthlyTotal = calculateMonthlyWorkHours(staff.id, workHoursDate, staff.shift);

                      return { ...staff, status, in: inTime, out: outTime, ot, dailyHours, fineHours, monthlyTotal };
                    }).filter(s => {
                      return String(s.name || '').toLowerCase().includes(workHoursSearch.toLowerCase());
                    });

                    if (filteredStaff.length === 0) {
                      return (
                        <tr>
                          <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: '#80868b', fontSize: '15px' }}>
                            No staff members found matching your search.
                          </td>
                        </tr>
                      );
                    }

                    return filteredStaff.map((s, index) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #e8eaed', backgroundColor: index % 2 === 0 ? '#fff' : '#fafafa', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a73e8', fontWeight: 600, fontSize: '14px', overflow: 'hidden' }}>
                              {s.photo ? <img src={s.photo} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (s.name ? s.name.substring(0, 2).toUpperCase() : 'ST')}
                            </div>
                            <span style={{ fontWeight: 500, color: '#202124', fontSize: '15px' }}>{s.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span className={`status-badge ${s.status === 'Present' ? 'present' : s.status === 'Absent' ? 'absent' : s.status === 'Half Day' ? 'halfday' : s.status === 'Late' ? 'late' : s.status === 'Late / Present' ? 'late-present' : 'not-marked'}`} style={{fontWeight: 'bold'}}>
                            {s.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', color: '#5f6368', fontSize: '14px' }}>{s.in}</td>
                        <td style={{ padding: '16px 24px', color: '#5f6368', fontSize: '14px' }}>{s.out}</td>
                        <td style={{ padding: '16px 24px', color: '#34A853', fontWeight: 600, fontSize: '14px' }}>{s.dailyHours}</td>
                        <td style={{ padding: '16px 24px', color: '#ea4335', fontWeight: 600, fontSize: '14px' }}>{s.fineHours}</td>
                        <td style={{ padding: '16px 24px', color: '#FBBC04', fontWeight: 600, fontSize: '14px', textShadow: '0 0 1px rgba(0,0,0,0.2)' }}>{s.ot === '00:00' ? '-' : s.ot}</td>
                        <td style={{ padding: '16px 24px', color: '#1a73e8', fontWeight: 700, fontSize: '15px', backgroundColor: '#e8f0fe33' }}>{s.monthlyTotal}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}





        {/* SETTINGS VIEW */}
        {activeTab === 'settings' && (
          <div className="settings-view">
            
            {/* MAIN SETTINGS LIST */}
            {settingsView === 'main' && (
              <div className="settings-premium-grid">
                <div className="settings-header-area" style={{ marginBottom: 0 }}>
                  <h1 className="settings-title">Settings</h1>
                  <div className="settings-search" style={{ border: '1px solid #E8EAED', boxShadow: 'none' }}>
                    <Search size={18} color="#9AA0A6" />
                    <input type="text" placeholder="Search Settings" />
                  </div>
                </div>

                {[
                  {
                    title: 'Attendance Settings', icon: <Settings size={20} color="#1A73E8" />,
                    items: [
                      { title: 'Attendance Mode', desc: 'Choose how staff attendance is recorded', status: 'Mobile Punch In', onClick: () => setAttendanceSettingsModalOpen(true) },
                      { title: 'Late Fine & Overtime', desc: 'Manage rules for late arrivals and extra hours', status: 'Disabled', badge: 'inactive', onClick: () => setSettingsView('automation-rules') },
                      { title: 'Shift Settings', desc: 'Configure working hours and shifts', status: '0 Shifts', onClick: () => setSettingsView('shift-settings') },
                      { title: 'Track In & Out Time', desc: 'Enable tracking for precise timing', status: 'Disabled', badge: 'inactive', onClick: () => setTrackTimeModalOpen(true) },
                      { title: 'Attendance on Holidays', desc: 'Set policy for working on holidays', status: 'Comp Off', onClick: () => setSettingsView('attendance-holidays') },
                      { title: 'Mark Absent on Previous Days', desc: 'Allow marking past absences', status: 'Disabled', badge: 'inactive', onClick: () => setMarkAbsentModalOpen(true) },
                    ]
                  },
                  {
                    title: 'Business Settings', icon: <Building2 size={20} color="#137333" />,
                    items: [
                      { title: 'Business Info', desc: 'Update your company details', status: 'HOSUR INFRATECH', onClick: () => setSettingsView('business-info') },
                      { title: 'Company Documents', desc: 'Manage official documents', status: '0 Uploaded', badge: 'neutral', onClick: () => setSettingsView('company-documents') },
                      { title: 'Holiday Policy', desc: 'Set company holidays', status: 'Not Added', badge: 'inactive', onClick: () => setSettingsView('holiday-policy') },
                      { title: 'Leave Policy', desc: 'Configure leave types and balances', status: 'Not Added', badge: 'inactive', onClick: () => setSettingsView('leave-policy') },
                      { title: 'Admin Settings', desc: 'Manage administrator access', status: '1 Admin (You)', badge: 'active', onClick: () => setSettingsView('admin-settings') },
                      { title: 'Manager Settings', desc: 'Add and manage managers', status: 'No Manager Added', badge: 'neutral', onClick: () => setSettingsView('manager-settings') },
                      { title: 'Departments', desc: 'Manage company departments', status: 'Manage', onClick: () => setSettingsView('departments') },
                      { title: 'Manage Staff Data', desc: 'Add custom fields for staff', status: 'No Fields Added', onClick: () => setSettingsView('staff-details') },
                      { title: 'Weekly Holidays', desc: 'Set default weekly days off', status: 'Not Assigned', badge: 'inactive', onClick: () => setSettingsView('weekly-holidays') },
                      { title: 'Invite Staff', desc: 'Send invites to new employees', status: 'Invite', onClick: () => setInviteStaffModalOpen(true) },
                    ]
                  },
                  {
                    title: 'Salary Settings', icon: <CreditCard size={20} color="#E37400" />,
                    items: [
                      { title: 'Salary Calculation Logic', desc: 'Configure how salary is computed', status: 'Calendar Month', onClick: () => setMonthCalculationModalOpen(true) },
                      { title: 'Manage Salary Templates', desc: 'Create templates for different roles', status: '0 Templates', badge: 'neutral', onClick: () => setSettingsView('salary-templates') },
                      { title: 'Staff Bank Account Details', desc: 'Manage payment destinations', status: 'Add Bulk', onClick: () => setSettingsView('bank-details') },
                    ]
                  }
                ].map((section, idx) => (
                  <div key={idx} className="settings-premium-section">
                    <div className="settings-premium-section-header">
                      {section.icon}
                      <h2 className="settings-premium-section-title">{section.title}</h2>
                    </div>
                    <div>
                      {section.items.map((item, i) => (
                        <div key={i} className="settings-premium-row" onClick={item.onClick}>
                          <div className="settings-premium-info">
                            <span className="settings-premium-name">{item.title}</span>
                            <span className="settings-premium-desc">{item.desc}</span>
                          </div>
                          <div className="settings-premium-status">
                            {item.status && (
                              item.badge === 'verified' ? (
                                <span className="settings-row-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {item.status} <span className="badge-verified"><Check size={12} /> verified</span>
                                </span>
                              ) : (
                                <span className={item.badge ? `status-badge ${item.badge}` : 'settings-row-value'} style={item.blur ? { filter: 'blur(3px)' } : {}}>
                                  {item.status}
                                </span>
                              )
                            )}
                            <ChevronRightIcon size={20} className="settings-chevron-premium" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SHIFT SETTINGS VIEW */}
            {settingsView === 'shift-settings' && (
              <>
                <div className="settings-subview-header" onClick={() => setSettingsView('main')}>
                  <ArrowLeft size={16} /> Back
                </div>
                <div className="settings-subview-title-row">
                  <h1 className="settings-subview-title">Shift Settings</h1>
                  <button className="btn-primary" onClick={() => setSettingsView('create-shift')}>Add Shift</button>
                </div>
                <div className="shift-empty-state">
                  No Shift Added
                </div>
              </>
            )}

            {/* CREATE SHIFT VIEW */}
            {settingsView === 'create-shift' && (
              <>
                <div className="settings-subview-header" onClick={() => setSettingsView('shift-settings')}>
                  <ArrowLeft size={16} /> Back
                </div>
                <div className="settings-subview-title-row">
                  <h1 className="settings-subview-title">Create Shift</h1>
                </div>
                
                <div className="create-shift-card">
                  <div className="form-group-row">
                    <div className="form-label-col">Shift Type</div>
                    <div className="form-input-col">
                      <select className="styled-select" defaultValue="Fixed Shift">
                        <option>Fixed Shift</option>
                        <option>Rotational Shift</option>
                        <option>Open Shift</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="form-group-row">
                    <div className="form-label-col">Shift Name</div>
                    <div className="form-input-col">
                      <input type="text" className="styled-select" style={{ backgroundImage: 'none' }} />
                    </div>
                  </div>

                  <div className="form-group-row">
                    <div className="form-label-col">Shift Time</div>
                    <div className="form-input-col">
                      <div className="time-input-group">
                        <div className="time-input">
                          <span>Start Time</span>
                          <Clock size={16} color="#BDC1C6" />
                        </div>
                        <span style={{ fontSize: '14px', color: '#202124' }}>To</span>
                        <div className="time-input">
                          <span>End Time</span>
                          <Clock size={16} color="#BDC1C6" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-group-row" style={{ marginBottom: 0 }}>
                    <div className="form-label-col">
                      Unpaid Break <Info size={14} color="#BDC1C6" />
                    </div>
                    <div className="form-input-col">
                      <button className="btn-inline-add">Add</button>
                    </div>
                  </div>
                </div>

                <div className="accordion-section">
                  <div className="accordion-header">
                    <ChevronDown size={20} color="#1A73E8" />
                    <h3 className="accordion-title">Assigned Staff (0)</h3>
                  </div>
                  <div className="accordion-body">
                    <label className="staff-access-checkbox" style={{ marginLeft: '12px' }}>
                      <div className="custom-checkbox"></div>
                      <span className="staff-access-name" style={{ fontSize: '14px', fontWeight: 600 }}>Monthly Regular Staff ({filteredData.length})</span>
                    </label>
                    {filteredData.map((staff, idx) => (
                      <label className="staff-access-checkbox" style={{ marginLeft: '48px' }} key={idx}>
                        <div className="custom-checkbox"></div>
                        <span className="staff-access-name" style={{ fontSize: '14px', color: '#5F6368' }}>{staff.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* AUTOMATION RULES VIEW */}
            {settingsView === 'automation-rules' && (
              <>
                <div className="settings-subview-header" onClick={() => setSettingsView('main')}>
                  <ArrowLeft size={16} /> Back
                </div>

                <div className="ar-warning-banner">
                  <div className="ar-warning-left">
                    <AlertCircle size={20} className="ar-warning-icon" />
                    <h3 className="ar-warning-title">No shift found</h3>
                    <p className="ar-warning-subtitle">Please create a shift in this business before enable Automation Rules</p>
                  </div>
                  <a href="#" className="ar-warning-link" onClick={(e) => { e.preventDefault(); setSettingsView('create-shift'); }}>
                    Create Shift <ChevronRightIcon size={16} />
                  </a>
                </div>

                <h1 className="settings-subview-title">Automation Rules</h1>
                <p className="ar-subtitle">
                  Set rules for Late Entry, Early Exit, Breaks & Overtime based on punch-in and punch-out time. You just have to approve the fine/overtime entries.
                </p>

                <div className="ar-content-layout">
                  <div className="ar-rules-list">
                    
                    <div className="ar-rule-card">
                      <div className="ar-rule-icon-wrapper">
                        <LogIn size={24} />
                      </div>
                      <div className="ar-rule-text">
                        <h4 className="ar-rule-title">Late Entry Rules</h4>
                        <p className="ar-rule-desc">Automate late fine for employees who are coming late to work</p>
                      </div>
                      <Lock size={20} className="ar-rule-lock" />
                    </div>

                    <div className="ar-rule-card">
                      <div className="ar-rule-icon-wrapper">
                        <Coffee size={24} />
                      </div>
                      <div className="ar-rule-text">
                        <h4 className="ar-rule-title">Breaks Rules</h4>
                        <p className="ar-rule-desc">Automate late fine for employees who are coming late to work</p>
                      </div>
                      <Lock size={20} className="ar-rule-lock" />
                    </div>

                    <div className="ar-rule-card">
                      <div className="ar-rule-icon-wrapper">
                        <LogOut size={24} />
                      </div>
                      <div className="ar-rule-text">
                        <h4 className="ar-rule-title">Early Exit Rules</h4>
                        <p className="ar-rule-desc">Automate fine for employees who are leaving earlier than the shift out-time</p>
                      </div>
                      <Lock size={20} className="ar-rule-lock" />
                    </div>

                    <div className="ar-rule-card">
                      <div className="ar-rule-icon-wrapper">
                        <Clock3 size={24} />
                      </div>
                      <div className="ar-rule-text">
                        <h4 className="ar-rule-title">Overtime Rules</h4>
                        <p className="ar-rule-desc">Automate overtime for employees who are working extra after their shift hours</p>
                      </div>
                      <Lock size={20} className="ar-rule-lock" />
                    </div>

                  </div>

                  <div className="ar-instructions-panel">
                    <div className="ar-instruction-step highlight">
                      <h4 className="ar-instruction-title">1. Create your first rule</h4>
                      <p className="ar-instruction-desc">You can define a rule by selecting any of the checkboxes on the left.</p>
                    </div>
                    <div className="ar-instruction-step">
                      <h4 className="ar-instruction-title">2. Set a Rule value</h4>
                      <p className="ar-instruction-desc">Set a value for your rule type.</p>
                    </div>
                    <div className="ar-instruction-step">
                      <h4 className="ar-instruction-title">3. Assign Staff</h4>
                      <p className="ar-instruction-desc">Select the staff that you want the rule to be assigned to.</p>
                    </div>
                  </div>
                </div>

              </>
            )}

            {/* ATTENDANCE ON HOLIDAYS VIEW */}
            {settingsView === 'attendance-holidays' && (
              <>
                <div className="settings-subview-header" onClick={() => setSettingsView('main')}>
                  <ArrowLeft size={16} /> Back
                </div>
                <h1 className="settings-subview-title" style={{ marginBottom: '16px' }}>Attendance on Holidays</h1>
                <div className="aoh-info-text">
                  <Info size={16} /> By default, all the staff without any assigned rule are NOT allowed to mark attendance on paid holidays.
                </div>
                
                <div className="aoh-list">
                  <div className="aoh-row">
                    <span className="aoh-row-title">Allow attendance on paid holidays</span>
                    <div className="aoh-row-right">
                      0 Staff
                      <ChevronRightIcon size={20} color="#BDC1C6" />
                    </div>
                  </div>
                  <div className="aoh-row">
                    <span className="aoh-row-title">Comp Off Leave</span>
                    <div className="aoh-row-right">
                      0 Staff
                      <ChevronRightIcon size={20} color="#BDC1C6" />
                    </div>
                  </div>
                  <div className="aoh-row">
                    <span className="aoh-row-title">Do NOT Allow attendance on paid holidays</span>
                    <div className="aoh-row-right">
                      1 Staff
                      <ChevronRightIcon size={20} color="#BDC1C6" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* HOLIDAY POLICY VIEW */}
            {settingsView === 'holiday-policy' && (
              <>
                <div className="settings-subview-header" onClick={() => setSettingsView('main')}>
                  <ArrowLeft size={16} /> Back
                </div>
                <h1 className="settings-subview-title" style={{ marginBottom: '24px' }}>Holiday Calendar Template</h1>
                
                <div className="policy-top-form">
                  <div className="policy-form-group" style={{ flex: 1 }}>
                    <label className="policy-label">Template Name</label>
                    <input type="text" className="holiday-input" placeholder="Enter Template Name" />
                  </div>
                  <div className="policy-form-group" style={{ flex: 2 }}>
                    <label className="policy-label">Annual Holiday Period</label>
                    <div className="holiday-date-group">
                      <div className="holiday-date-input">
                        January 2023 <CalendarDays size={16} color="#80868B" />
                      </div>
                      <span style={{ color: '#5F6368', fontSize: '14px' }}>To</span>
                      <div className="holiday-date-input" style={{ backgroundColor: '#F8F9FA' }}>
                        <span style={{ color: '#BDC1C6' }}>December 2023</span> <CalendarDays size={16} color="#BDC1C6" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="holiday-section-header">
                  <h3 className="holiday-section-title">Holiday(s)</h3>
                  <button className="btn-light-blue">Add Holiday</button>
                </div>

                <div className="holiday-table-header">
                  <div className="holiday-col-1">Holiday Name</div>
                  <div className="holiday-col-2">Holiday Date</div>
                </div>

                <div className="holiday-row">
                  <div className="holiday-col-1">
                    <input type="text" className="holiday-input" defaultValue="New Year's Day" />
                  </div>
                  <div className="holiday-col-2" style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="holiday-date-input">
                      01 Jan 2023 | Sun <CalendarDays size={16} color="#80868B" />
                    </div>
                    <Trash2 size={20} className="trash-icon" />
                  </div>
                </div>

                <div className="holiday-row">
                  <div className="holiday-col-1">
                    <input type="text" className="holiday-input" defaultValue="Lohri/Makar Sakranti" />
                  </div>
                  <div className="holiday-col-2" style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="holiday-date-input">
                      14 Jan 2023 | Sat <CalendarDays size={16} color="#80868B" />
                    </div>
                    <Trash2 size={20} className="trash-icon" />
                  </div>
                </div>

                <div className="holiday-row">
                  <div className="holiday-col-1">
                    <input type="text" className="holiday-input" defaultValue="Republic Day" />
                  </div>
                  <div className="holiday-col-2" style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="holiday-date-input">
                      26 Jan 2023 | Thu <CalendarDays size={16} color="#80868B" />
                    </div>
                    <Trash2 size={20} className="trash-icon" />
                  </div>
                </div>

                <div className="holiday-footer">
                  27 Holiday(s) Added
                </div>
              </>
            )}

            {/* LEAVE POLICY VIEW */}
            {settingsView === 'leave-policy' && (
              <>
                <div className="settings-subview-header" onClick={() => setSettingsView('main')}>
                  <ArrowLeft size={16} /> Back
                </div>
                <h1 className="settings-subview-title" style={{ marginBottom: '24px' }}>Create Leave Template</h1>
                
                {/* Card 1: Template Settings */}
                <div className="leave-card">
                  <h3 className="leave-card-title">Template Settings</h3>
                  <div className="leave-card-body">
                    <div className="policy-form-group" style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex' }}>
                        <div style={{ width: '250px' }} className="policy-label">Template Name</div>
                        <div style={{ flex: 1, maxWidth: '400px' }}>
                          <input type="text" className="holiday-input" defaultValue="Leave Policy" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="policy-form-group" style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '250px' }} className="policy-label">Leave Policy Cycle</div>
                        <div className="toggle-pill-group">
                          <button className="toggle-pill">Monthly</button>
                          <button className="toggle-pill active">Yearly</button>
                        </div>
                      </div>
                    </div>

                    <div className="policy-form-group" style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '250px' }} className="policy-label">Leave Period</div>
                        <div className="holiday-date-group" style={{ maxWidth: '400px', flex: 1 }}>
                          <div className="holiday-date-input" style={{ width: '100%' }}>
                            January 2023 <CalendarDays size={16} color="#80868B" />
                          </div>
                          <span style={{ color: '#5F6368', fontSize: '14px' }}>To</span>
                          <div className="holiday-date-input" style={{ backgroundColor: '#F8F9FA', width: '100%' }}>
                            <span style={{ color: '#BDC1C6' }}>December 2023</span> <CalendarDays size={16} color="#BDC1C6" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="policy-form-group" style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '250px', display: 'flex', alignItems: 'center', gap: '8px' }} className="policy-label">
                          Accrual Type <Info size={14} color="#80868B" />
                        </div>
                        <div style={{ flex: 1, maxWidth: '400px' }}>
                          <select className="holiday-input" defaultValue="All at once" style={{ appearance: 'none' }}>
                            <option>All at once</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="policy-form-group">
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '250px', display: 'flex', alignItems: 'center', gap: '8px' }} className="policy-label">
                          Sandwich Leaves <Info size={14} color="#80868B" />
                        </div>
                        <div className="toggle-pill-group">
                          <button className="toggle-pill">Count</button>
                          <button className="toggle-pill active">Ignore</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Leave Categories */}
                <div className="leave-card">
                  <h3 className="leave-card-title">Leave Categories</h3>
                  <div className="leave-card-body">
                    <div className="leave-grid-header">
                      <div>Leave Category Name</div>
                      <div>Leave Count</div>
                      <div>Unused Leave Rule</div>
                      <div>Encashment/Carry Forward Limit</div>
                      <div></div>
                    </div>

                    {/* Row 1 */}
                    <div className="leave-grid-row">
                      <input type="text" className="holiday-input" defaultValue="Casual Leave" />
                      <div className="leave-input-with-suffix">
                        <input type="text" />
                        <span className="suffix">days per year</span>
                      </div>
                      <select className="holiday-input">
                        <option>Lapse</option>
                      </select>
                      <div className="leave-input-with-suffix">
                        <input type="text" style={{ backgroundColor: '#F8F9FA' }} disabled />
                        <span className="suffix">Days</span>
                      </div>
                      <Trash2 size={20} className="trash-icon" style={{ marginLeft: 0 }} />
                    </div>

                    {/* Row 2 */}
                    <div className="leave-grid-row">
                      <input type="text" className="holiday-input" defaultValue="Sick Leave" />
                      <div className="leave-input-with-suffix">
                        <input type="text" />
                        <span className="suffix">days per year</span>
                      </div>
                      <select className="holiday-input">
                        <option>Lapse</option>
                      </select>
                      <div className="leave-input-with-suffix">
                        <input type="text" style={{ backgroundColor: '#F8F9FA' }} disabled />
                        <span className="suffix">Days</span>
                      </div>
                      <Trash2 size={20} className="trash-icon" style={{ marginLeft: 0 }} />
                    </div>

                    {/* Row 3 */}
                    <div className="leave-grid-row">
                      <input type="text" className="holiday-input" defaultValue="Annual Leave" />
                      <div className="leave-input-with-suffix">
                        <input type="text" />
                        <span className="suffix">days per year</span>
                      </div>
                      <select className="holiday-input">
                        <option>Lapse</option>
                      </select>
                      <div className="leave-input-with-suffix">
                        <input type="text" style={{ backgroundColor: '#F8F9FA' }} disabled />
                        <span className="suffix">Days</span>
                      </div>
                      <Trash2 size={20} className="trash-icon" style={{ marginLeft: 0 }} />
                    </div>

                    <div style={{ marginTop: '24px' }}>
                      <button className="btn-light-blue">Add Leave Category</button>
                    </div>
                  </div>
                  
                  <div className="holiday-footer" style={{ padding: '24px', margin: 0, backgroundColor: '#FAFAFA' }}>
                    Total 0 Leave(s)
                  </div>
                </div>

                {/* Card 3: Leave Approval */}
                <div className="leave-card">
                  <h3 className="leave-card-title">Leave Approval</h3>
                  <div className="leave-card-body">
                    <div className="leave-approval-info">
                      <Info size={18} color="#80868B" /> Multilevel Approval Settings is set to Level 1 by default
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* STAFF DETAILS VIEW */}
            {settingsView === 'staff-details' && (
              <>
                <div className="settings-subview-header" onClick={() => setSettingsView('main')}>
                  <ArrowLeft size={16} /> Back
                </div>
                
                <div className="staff-details-banner">
                  <FileSpreadsheet size={20} color="#1A73E8" />
                  <div className="staff-banner-text">
                    <strong>NEW! Want to add details for all your staff together?</strong> 
                    <span className="staff-banner-sub">Use CSV upload to add staff details in bulk</span>
                  </div>
                </div>

                <div className="staff-header-actions">
                  <h1 className="staff-header-title">Staff Details</h1>
                  <div className="staff-header-buttons">
                    <button className="btn-outline-blue">
                      <Download size={16} /> Download Staff Details
                    </button>
                    <button className="btn-outline-blue">
                      <FileSpreadsheet size={16} /> Bulk Upload Details
                    </button>
                  </div>
                </div>

                <div className="staff-card">
                  <div className="staff-card-header">
                    <div>
                      <div className="staff-card-title">Custom Fields</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <span className="staff-card-subtitle">You can add upto 20 additional fields</span>
                    </div>
                    <div>
                      <button className="btn-blue-solid">Add Field</button>
                    </div>
                  </div>
                  <div className="staff-card-body-empty">
                    No Fields Added
                  </div>
                </div>

                <div className="staff-card staff-card-compact">
                  <div className="staff-card-title">Staff Personal Information</div>
                  <div className="staff-card-subtitle">Gender, Date of Birth, Address</div>
                </div>

                <div className="staff-card staff-card-compact">
                  <div className="staff-card-title">Employment Information</div>
                  <div className="staff-card-subtitle">Staff ID, Date of Joining, Department, Designation</div>
                </div>

                <div className="staff-card staff-card-compact">
                  <div className="staff-card-title">Government IDs</div>
                  <div className="staff-card-subtitle">PAN</div>
                </div>

              </>
            )}

            {/* BUSINESS INFO VIEW */}
            {settingsView === 'business-info' && (
              <>
                <div className="settings-subview-header" onClick={() => setSettingsView('main')}>
                  <ArrowLeft size={16} /> Back
                </div>
                <div className="staff-header-actions" style={{ marginBottom: '24px' }}>
                  <h1 className="staff-header-title">Business Info</h1>
                </div>
                <div className="staff-card">
                  <div className="staff-card-header">
                    <div className="staff-card-title">Company Details</div>
                  </div>
                  <div style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#3C4043' }}>Business Name</label>
                      <input type="text" className="search-input" defaultValue="HOSUR INFRATECH" style={{ width: '100%', maxWidth: '400px' }} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#3C4043' }}>Business Address</label>
                      <textarea className="search-input" style={{ width: '100%', maxWidth: '400px', minHeight: '80px', padding: '12px' }} defaultValue="Hosur, Tamil Nadu"></textarea>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#3C4043' }}>GSTIN / Tax ID</label>
                      <input type="text" className="search-input" placeholder="Enter GSTIN" style={{ width: '100%', maxWidth: '400px' }} />
                    </div>
                    <button className="btn-blue-solid" onClick={() => { showToast('Business Info Updated'); setSettingsView('main'); }}>Save Details</button>
                  </div>
                </div>
              </>
            )}

            {/* OTHER DYNAMIC SETTINGS VIEWS */}
            {['company-documents', 'holiday-policy', 'admin-settings', 'manager-settings', 'departments', 'weekly-holidays', 'salary-templates', 'bank-details', 'business-name-bank'].includes(settingsView) && (
              <>
                <div className="settings-subview-header" onClick={() => setSettingsView('main')}>
                  <ArrowLeft size={16} /> Back
                </div>
                
                <div className="staff-header-actions" style={{ marginBottom: '24px' }}>
                  <h1 className="staff-header-title" style={{ textTransform: 'capitalize' }}>
                    {settingsView.replace(/-/g, ' ')}
                  </h1>
                </div>

                <div className="staff-card">
                  <div className="staff-card-header">
                    <div>
                      <div className="staff-card-title">Manage {settingsView.replace(/-/g, ' ')}</div>
                    </div>
                    <div>
                      <button className="btn-blue-solid" onClick={() => showToast('Feature coming soon')}>Add / Update</button>
                    </div>
                  </div>
                  <div className="staff-card-body-empty" style={{ padding: '40px', textAlign: 'center', color: '#5F6368' }}>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Settings size={40} color="#D2D6DC" /></div>
                    <p style={{ fontSize: '16px', fontWeight: 500 }}>No data added yet for {settingsView.replace(/-/g, ' ')}.</p>
                    <p style={{ fontSize: '14px', color: '#9AA0A6', marginTop: '8px' }}>Click the Add / Update button above to configure this section.</p>
                  </div>
                </div>
              </>
            )}

          </div>
        )}

      </div>

      {/* ATTENDANCE SETTINGS MODAL */}
      {attendanceSettingsModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title">Attendance Settings</h2>
              <button className="modal-close" onClick={() => setAttendanceSettingsModalOpen(false)}>
                X
              </button>
            </div>
            <div className="modal-body" style={{ paddingBottom: '0' }}>
              <div className="modal-section-title">Auto Attendance</div>
              <div className="settings-radio-option" onClick={() => setAttendanceMode('Mark Present by Default')}>
                <div className={`settings-radio-circle ${attendanceMode === 'Mark Present by Default' ? 'selected' : ''}`}></div>
                <div className="settings-radio-text">
                  <span className="settings-radio-title">Mark Present by Default</span>
                  <span className="settings-radio-subtitle">Default auto present, can be changed manually</span>
                </div>
              </div>

              <div className="modal-section-title" style={{ marginTop: '24px' }}>Manual Attendance</div>
              <div className="settings-radio-option" onClick={() => setAttendanceMode('Manual Attendance')}>
                <div className={`settings-radio-circle ${attendanceMode === 'Manual Attendance' ? 'selected' : ''}`}></div>
                <div className="settings-radio-text">
                  <span className="settings-radio-title">Manual Attendance</span>
                  <span className="settings-radio-subtitle">Attendance is neutral by default, should be marked manually</span>
                </div>
              </div>
              
              <div className="settings-radio-option" onClick={() => setAttendanceMode('Staff Attendance with Location')}>
                <div className={`settings-radio-circle ${attendanceMode === 'Staff Attendance with Location' ? 'selected' : ''}`}></div>
                <div className="settings-radio-text">
                  <span className="settings-radio-title">Staff Attendance with Location</span>
                  <span className="settings-radio-subtitle">Staff can mark their own attendance. Location will be captured automatically</span>
                </div>
              </div>

              <div className="settings-radio-option" onClick={() => setAttendanceMode('Staff attendance with Selfie & Location')}>
                <div className={`settings-radio-circle ${attendanceMode === 'Staff attendance with Selfie & Location' ? 'selected' : ''}`}></div>
                <div className="settings-radio-text">
                  <span className="settings-radio-title">Staff attendance with Selfie & Location</span>
                  <span className="settings-radio-subtitle">Staff can mark their own attendance with Selfie. Location will be captured automatically</span>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '24px' }}>
              <button className="btn-modal-blue" onClick={() => setAttendanceSettingsModalOpen(false)}>Save & Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* STAFF ACCESS MODAL */}
      {staffAccessModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">Self Attendance Access</h2>
              <div className="modal-subtitle">Selfie & Location</div>
            </div>
            <div className="modal-body">
              <div className="staff-access-list">
                {staffData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#5F6368' }}>No staff registered yet.</div>
                ) : (
                  staffData.map((staff, idx) => (
                    <div className="staff-access-item" key={idx}>
                      <label className="staff-access-checkbox">
                        <div className="custom-checkbox"></div>
                        <span className="staff-access-name">{staff.name}</span>
                      </label>
                      <div className="staff-phone-input-wrapper">
                        <input type="text" placeholder="+91 Enter Phone Number" defaultValue={staff.phone || ''} />
                        <button className="btn-inline-save">Save</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer-row">
              <button className="btn-modal-cancel" onClick={() => setStaffAccessModalOpen(false)}>Back</button>
              <button className="btn-modal-save" style={{ backgroundColor: '#757575', color: 'white', borderColor: '#757575' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* TRACK IN/OUT TIME MODAL */}
      {trackTimeModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title">Track In/Out Time</h2>
              <button className="modal-close" onClick={() => setTrackTimeModalOpen(false)}>
                X
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-toggle-row">
                <div className="modal-toggle-text">
                  <h4 className="modal-toggle-title">Track In & Out Time</h4>
                  <p className="modal-toggle-desc">Record both In & Out time for all staff</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={trackInOutToggle} onChange={() => setTrackInOutToggle(!trackInOutToggle)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="modal-toggle-row">
                <div className="modal-toggle-text">
                  <h4 className="modal-toggle-title">No attendance without punch-out</h4>
                  <p className="modal-toggle-desc">
                    Punch out is required to mark attendance<br/>
                    <span style={{ fontSize: '11px' }}>Note: Enable 'Track In & Out Time' setting first</span>
                  </p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={noAttendanceToggle} onChange={() => setNoAttendanceToggle(!noAttendanceToggle)} disabled={!trackInOutToggle} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '24px' }}>
              <button className="btn-modal-blue" onClick={() => setTrackTimeModalOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* MARK ABSENT MODAL */}
      {markAbsentModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title">Mark Absent on Previous Days</h2>
              <button className="modal-close" onClick={() => setMarkAbsentModalOpen(false)}>
                X
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#202124', margin: '0 0 16px 0' }}>
                Enable this feature to mark absent on previous days
              </p>
              <ul className="modal-bullet-list">
                <li>Old staff attendance with no action on that day will be marked as absent</li>
                <li>Attendance for the last two days will not be affected. Days before those two days will be marked as absent</li>
              </ul>
            </div>
            <div className="modal-footer" style={{ padding: '24px' }}>
              <button className="btn-modal-blue" onClick={() => setMarkAbsentModalOpen(false)}>Enable</button>
            </div>
          </div>
        </div>
      )}

      {/* INVITE STAFF MODAL */}
      {inviteStaffModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header" style={{ paddingBottom: '8px' }}>
              <h2 className="modal-title">Share Staff App</h2>
            </div>
            <div className="modal-body" style={{ paddingTop: 0 }}>
              <p style={{ fontSize: '16px', color: '#5F6368', margin: '0 0 16px 0' }}>
                We will send them an SMS with invite link
              </p>
              
              <div className="invite-staff-missing">
                {staffData.filter(s => !s.phone).length} Phone numbers are missing!
              </div>

              <div className="invite-staff-list">
                {staffData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#5F6368' }}>No staff registered yet.</div>
                ) : (
                  staffData.map((staff, idx) => (
                    <div className="invite-staff-item" key={idx}>
                      <div className="invite-staff-left">
                        <input type="checkbox" disabled style={{ width: '18px', height: '18px', border: '1px solid #D2E3FC', borderRadius: '4px' }} />
                        <span>{staff.name}</span>
                      </div>
                      <a href="#" className="invite-staff-add-num" onClick={(e) => e.preventDefault()}>
                        {staff.phone ? 'Change Number' : 'Add Number'}
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '24px', display: 'flex', gap: '16px' }}>
              <button className="btn-modal-outline" style={{ flex: 1 }} onClick={() => setInviteStaffModalOpen(false)}>Cancel</button>
              <button className="btn-modal-blue" style={{ flex: 1, backgroundColor: '#80868B', color: '#FFFFFF', cursor: 'not-allowed' }}>Send Details</button>
            </div>
          </div>
        </div>
      )}

      {/* MONTH CALCULATION MODAL */}
      {monthCalculationModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header" style={{ paddingBottom: '8px' }}>
              <h2 className="modal-title">Month Calculation</h2>
            </div>
            <div className="modal-body" style={{ paddingTop: 0 }}>
              <p style={{ fontSize: '14px', color: '#5F6368', margin: '0 0 16px 0' }}>
                How do you Calculate Monthly Salary
              </p>

              <div className="calc-radio-card active">
                <div className="calc-radio-content">
                  <div className="calc-radio-title">Calendar Month</div>
                  <div className="calc-radio-desc">
                    Ex: March - 31 days, April - 30 Days etc<br/>
                    (Per day salary = Salary/No. of days in month)
                  </div>
                </div>
                <Check size={24} color="#1A73E8" />
              </div>

              <div className="calc-radio-card">
                <div className="calc-radio-content">
                  <div className="calc-radio-title">Every Month 30 Days</div>
                  <div className="calc-radio-desc">
                    Ex: March - 30 days, April - 30 Days etc<br/>
                    (Per day salary = Salary/30)
                  </div>
                </div>
                <Check size={24} color="#E0E0E0" />
              </div>

              <div className="calc-radio-card">
                <div className="calc-radio-content">
                  <div className="calc-radio-title">Exclude Weekly Offs</div>
                  <div className="calc-radio-desc">
                    Ex: Month with 31 days and 4 weekly-offs will have 27 payable days<br/>
                    (Per day salary = Salary/Payable Days)
                  </div>
                </div>
                <Check size={24} color="#E0E0E0" />
              </div>

            </div>
            <div className="modal-footer" style={{ padding: '24px', display: 'flex', gap: '16px' }}>
              <button className="btn-modal-outline" style={{ flex: 1 }} onClick={() => setMonthCalculationModalOpen(false)}>Cancel</button>
              <button className="btn-modal-blue" style={{ flex: 1, backgroundColor: '#80868B', color: '#FFFFFF', cursor: 'not-allowed' }}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ENTRY MODAL */}
      {addEntryModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">Add Entry</h2>
            </div>
            <div className="modal-body">
              <div className="modal-form-group">
                <label className="modal-label">Select Transaction Type</label>
                <div className="radio-pill-group">
                  <label className="radio-pill" onClick={() => setTransactionType('You Paid')}>
                    <input type="radio" checked={transactionType === 'You Paid'} readOnly />
                    You Paid
                  </label>
                  <label className="radio-pill" onClick={() => setTransactionType('You Took')}>
                    <input type="radio" checked={transactionType === 'You Took'} readOnly />
                    You Took
                  </label>
                </div>
              </div>
              <div className="modal-form-group">
                <label className="modal-label">Name</label>
                <input type="text" className="modal-input" placeholder="Type Name" />
              </div>
              <div className="modal-form-group">
                <label className="modal-label">Amount</label>
                <input type="text" className="modal-input" placeholder="₹ Type Amount" />
              </div>
              <div className="modal-form-group">
                <label className="modal-label">Description (Optional)</label>
                <textarea className="modal-textarea" placeholder="Type here"></textarea>
              </div>
              <div className="modal-form-group">
                <label className="modal-label">Date</label>
                <div className="modal-date-input">
                  <span>13 Apr, 2023</span>
                  <Calendar size={18} color="#5F6368" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-save">Save</button>
              <button className="btn-modal-cancel" onClick={() => setAddEntryModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {ledgerModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">Add {ledgerType}</h2>
            </div>
            <div className="modal-body">
              <div className="modal-form-group">
                <label className="modal-label">Select Staff</label>
                <select className="modal-input" value={ledgerStaffId} onChange={(e) => setLedgerStaffId(e.target.value)}>
                  <option value="">-- Choose Staff --</option>
                  {staffData.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.dept})</option>
                  ))}
                </select>
              </div>
              <div className="modal-form-group">
                <label className="modal-label">Amount (₹)</label>
                <input type="number" className="modal-input" value={ledgerAmount} onChange={(e) => setLedgerAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="modal-form-group">
                <label className="modal-label">Description / Note</label>
                <input type="text" className="modal-input" value={ledgerDescription} onChange={(e) => setLedgerDescription(e.target.value)} placeholder="e.g. Performance bonus" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-save" onClick={handleSaveLedger}>Save</button>
              <button className="btn-modal-cancel" onClick={() => setLedgerModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {addStaffModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Add New Staff</h2>
              <button className="btn-close" onClick={() => setAddStaffModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="modal-form-group">
                <label className="modal-label">Staff Name *</label>
                <input 
                  type="text" 
                  className="modal-input" 
                  placeholder="Enter Name"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                />
              </div>
              <div className="modal-form-group">
                <label className="modal-label">Phone Number *</label>
                <input 
                  type="tel" 
                  className="modal-input" 
                  placeholder="Enter Phone Number"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})}
                />
              </div>
              <div className="modal-form-group">
                <label className="modal-label">Department</label>
                <select 
                  className="modal-input" 
                  value={newStaff.dept}
                  onChange={(e) => setNewStaff({...newStaff, dept: e.target.value})}
                >
                  <option value="">Select Department</option>
                  <option value="Admin">Admin</option>
                  <option value="Sales">Sales</option>
                  <option value="Drivers">Drivers</option>
                  <option value="Labour">Labour</option>
                  <option value="Accounts">Accounts</option>
                </select>
              </div>
              <div className="modal-form-group">
                <label className="modal-label">Designation / Shift</label>
                <select 
                  className="modal-input" 
                  value={newStaff.shift}
                  onChange={(e) => setNewStaff({...newStaff, shift: e.target.value})}
                >
                  <option value="">Select Shift</option>
                  <option value="Day Shift">Day Shift</option>
                  <option value="Night Shift">Night Shift</option>
                  <option value="Morning Shift">Morning Shift</option>
                  <option value="Office Shift">Office Shift</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-save" onClick={handleAddStaff}>Save Staff</button>
              <button className="btn-modal-cancel" onClick={() => setAddStaffModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showOvertimeModal && (
        <div className="modal-overlay" onClick={() => setShowOvertimeModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Overtime Details - {new Date(attendanceDate).toLocaleDateString('en-GB')}</h2>
              <button className="modal-close" onClick={() => setShowOvertimeModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <th style={{ padding: '12px' }}>Name</th>
                    <th style={{ padding: '12px' }}>Department</th>
                    <th style={{ padding: '12px' }}>Overtime (HH:MM)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.filter(s => s.ot && s.ot !== '00:00').length > 0 ? (
                    filteredData.filter(s => s.ot && s.ot !== '00:00').map((staff, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '12px' }}>{staff.name}</td>
                        <td style={{ padding: '12px' }}>{staff.dept || '-'}</td>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{staff.ot}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#5f6368' }}>No overtime recorded for this date.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showFineModal && (
        <div className="modal-overlay" onClick={() => setShowFineModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Fine Details - {new Date(attendanceDate).toLocaleDateString('en-GB')}</h2>
              <button className="modal-close" onClick={() => setShowFineModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <th style={{ padding: '12px' }}>Name</th>
                    <th style={{ padding: '12px' }}>Department</th>
                    <th style={{ padding: '12px' }}>Fine Amount / Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.filter(s => s.fine && s.fine > 0).length > 0 ? (
                    filteredData.filter(s => s.fine && s.fine > 0).map((staff, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '12px' }}>{staff.name}</td>
                        <td style={{ padding: '12px' }}>{staff.dept || '-'}</td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#d93025' }}>{staff.fine}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#5f6368' }}>No fines recorded for this date.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showMusterRollModal && (
        <div className="modal-overlay" onClick={() => setShowMusterRollModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Muster Roll - Monthly View</h2>
              <button className="modal-close" onClick={() => setShowMusterRollModal(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontWeight: '600', color: '#3c4043' }}>Select Month:</label>
                <input 
                  type="month" 
                  value={musterRollMonthYear} 
                  onChange={(e) => setMusterRollMonthYear(e.target.value)} 
                  style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '12px' }}>Name</th>
                    <th style={{ padding: '12px' }}>Department</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Total Present Days</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    if (!musterRollMonthYear) return null;
                    const [yearStr, monthStr] = musterRollMonthYear.split('-');
                    const year = parseInt(yearStr, 10);
                    const month = parseInt(monthStr, 10) - 1;
                    
                    const monthlyLogs = attendanceLogs.filter(l => {
                      const d = new Date(l.dateIso);
                      return d.getFullYear() === year && d.getMonth() === month;
                    });

                    return staffData.map((staff, idx) => {
                      const staffLogs = monthlyLogs.filter(l => l.employeeId === staff.id);
                      const uniqueDays = new Set();
                      staffLogs.forEach(l => {
                        if (l.type === 'checkin') {
                          uniqueDays.add(new Date(l.dateIso).toDateString());
                        }
                      });
                      
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          <td style={{ padding: '12px' }}>{staff.name}</td>
                          <td style={{ padding: '12px' }}>{staff.dept || '-'}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#188038' }}>{uniqueDays.size}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* Right Side Drawer */}
      <div className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={() => setIsDrawerOpen(false)}></div>
      <div className={`right-drawer ${isDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2>{drawerType === 'present' ? 'Present Staff' : 
                     drawerType === 'absent' ? 'Absent Staff' : 
                     drawerType === 'late' ? 'Late Staff' : 
                     drawerType === 'halfDay' ? 'Half Day Staff' : 
                     drawerType === 'onLeave' ? 'On Leave Staff' : 
                     drawerType === 'site' ? 'Site Staff' : 
                     drawerType === 'staff' ? 'All Staff' : 'Staff List'}</h2>
          <button className="close-drawer-btn" onClick={() => setIsDrawerOpen(false)}>×</button>
        </div>
        <div className="drawer-content">
          <div className="drawer-list">
            {dailyStaffData
              .filter(s => {
                if (drawerType === 'present') return s.status === 'Present' || s.status === 'Late' || s.status === 'Late / Present' || (s.in && s.in !== '-');
                if (drawerType === 'absent') return s.status === 'Absent';
                if (drawerType === 'late') return s.status === 'Late' || s.status === 'Late / Present';
                if (drawerType === 'halfDay') return s.status === 'Half Day';
                if (drawerType === 'onLeave') return s.status === 'On Leave';
                if (drawerType === 'site') return s.status === 'Site';
                if (drawerType === 'staff') return true; // all staff
                return false;
              })
              .map((staff, idx) => (
                <div key={idx} className="drawer-list-item">
                  <div className="drawer-staff-info">
                    <div className="drawer-staff-name">{staff.name}</div>
                    {drawerType !== 'staff' && (
                      <div className="drawer-staff-time" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{staff.status === 'On Leave' ? 'On Leave' : (staff.status || 'Present')} {staff.in && staff.in !== '-' ? `(In: ${staff.in})` : ''}</span>
                      </div>
                    )}
                  </div>
                  {drawerType !== 'staff' && (
                    <div className="drawer-staff-status">{staff.status || 'Present'}</div>
                  )}
                </div>
              ))}
            {dailyStaffData.filter(s => {
                if (drawerType === 'present') return s.status === 'Present' || s.status === 'Late' || s.status === 'Late / Present' || (s.in && s.in !== '-');
                if (drawerType === 'absent') return s.status === 'Absent';
                if (drawerType === 'late') return s.status === 'Late' || s.status === 'Late / Present';
                if (drawerType === 'halfDay') return s.status === 'Half Day';
                if (drawerType === 'onLeave') return s.status === 'On Leave';
                if (drawerType === 'site') return s.status === 'Site';
                if (drawerType === 'staff') return true; // all staff
                return false;
              }).length === 0 && (
              <div className="drawer-empty">No staff found for this filter.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;

