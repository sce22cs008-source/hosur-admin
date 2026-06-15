import sys

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Add drawer state
state_code = """  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState(null); // 'present' or 'absent'
"""
for i, line in enumerate(lines):
    if 'const [showMusterRollModal, setShowMusterRollModal]' in line:
        lines.insert(i + 1, state_code)
        break

# 2. Add Payment to sidebar
payment_sidebar_code = """          <div 
            className={`sidebar-item ${activeTab === 'payment' ? 'active' : ''}`}
            onClick={() => setActiveTab('payment')}
          >
            <CreditCard size={20} />
            <span>Payment</span>
            {activeTab === 'payment' && <div className="active-indicator"></div>}
          </div>
"""
for i, line in enumerate(lines):
    if '<span>Cash Book</span>' in line:
        lines.insert(i + 3, payment_sidebar_code)
        break

# 3. Modify Things to Do Card
# Remove Approve overtime
start_overtime = -1
end_overtime = -1
for i, line in enumerate(lines):
    if '<span className="action-title">Approve overtime</span>' in line:
        start_overtime = i - 6
        end_overtime = i + 5
        break
if start_overtime != -1:
    del lines[start_overtime:end_overtime+1]

# Rename Review Fine to Late Fine
for i, line in enumerate(lines):
    if '<span className="action-title">Review Fine</span>' in line:
        lines[i] = line.replace('Review Fine', 'Late Fine')
        
# Add onClick handlers to Approve punches and Manage leaves
for i, line in enumerate(lines):
    if '<span className="action-title">Approve punches</span>' in line:
        for j in range(i-6, i):
            if '<div className="action-item" onClick={() => setActiveTab(' in lines[j]:
                lines[j] = lines[j].replace("onClick={() => setActiveTab('attendance')}", "onClick={() => { setIsDrawerOpen(true); setDrawerType('present'); }}")
    if '<span className="action-title">Manage leaves</span>' in line:
        for j in range(i-6, i):
            if '<div className="action-item" onClick={() => setActiveTab(' in lines[j]:
                lines[j] = lines[j].replace("onClick={() => setActiveTab('attendance')}", "onClick={() => { setIsDrawerOpen(true); setDrawerType('absent'); }}")

# 4. Extract Payment Section and wrap in Payment Tab
start_payment = -1
end_payment = -1
for i, line in enumerate(lines):
    if '{/* 1. Payment Section */}' in line:
        start_payment = i
    if '{/* 3. Attendance Muster Roll Reports */}' in line:
        end_payment = i - 1
        break

if start_payment != -1 and end_payment != -1:
    payment_lines = lines[start_payment:end_payment+1]
    del lines[start_payment:end_payment+1]
    
    for i, line in enumerate(lines):
        if "{/* ONLINE PAYMENT VIEW -> PAYROLL PAYMENT PORTAL */}" in line:
            wrapper_start = "        {activeTab === 'payment' && (\n          <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>\n"
            wrapper_end = "          </div>\n        )}\n\n"
            
            lines.insert(i, wrapper_end)
            for p_line in reversed(payment_lines):
                lines.insert(i, p_line)
            lines.insert(i, wrapper_start)
            break

# 5. Add drawer component at the end of the root div
drawer_code = """
      {/* Right Side Drawer */}
      <div className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={() => setIsDrawerOpen(false)}></div>
      <div className={`right-drawer ${isDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2>{drawerType === 'present' ? 'Present Staff' : 'Absent / Leave List'}</h2>
          <button className="close-drawer-btn" onClick={() => setIsDrawerOpen(false)}>×</button>
        </div>
        <div className="drawer-content">
          {drawerType === 'present' && (
            <div className="drawer-list">
              {dailyStaffData.filter(s => s.status === 'Present' || s.status === 'Late' || (s.in && s.in !== '-')).map((staff, idx) => (
                <div key={idx} className="drawer-list-item">
                  <div className="drawer-staff-info">
                    <div className="drawer-staff-name">{staff.name}</div>
                    <div className="drawer-staff-time">Check-in: {staff.in || '--:--'}</div>
                  </div>
                  <div className="drawer-staff-status">{staff.status || 'Present'}</div>
                </div>
              ))}
              {dailyStaffData.filter(s => s.status === 'Present' || s.status === 'Late' || (s.in && s.in !== '-')).length === 0 && (
                <div className="drawer-empty">No present staff found.</div>
              )}
            </div>
          )}
          {drawerType === 'absent' && (
            <div className="drawer-list">
              {dailyStaffData.filter(s => s.status === 'Absent' || s.status === 'On Leave').map((staff, idx) => (
                <div key={idx} className="drawer-list-item">
                  <div className="drawer-staff-info">
                    <div className="drawer-staff-name">{staff.name}</div>
                    <div className="drawer-staff-time">{staff.status === 'On Leave' ? 'On Leave' : 'Absent'}</div>
                  </div>
                </div>
              ))}
              {dailyStaffData.filter(s => s.status === 'Absent' || s.status === 'On Leave').length === 0 && (
                <div className="drawer-empty">No absent staff found.</div>
              )}
            </div>
          )}
        </div>
      </div>
"""
# find the last closing div of dashboard-root
last_div_idx = -1
for i in range(len(lines)-1, -1, -1):
    if '</div>' in lines[i]:
        last_div_idx = i
        break

if last_div_idx != -1:
    lines.insert(last_div_idx, drawer_code)

with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('DashboardScreen.jsx patched successfully.')
