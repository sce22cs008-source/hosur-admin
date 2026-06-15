import sys
import re

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Late Fine Button
content = content.replace(
    """<div className="bottom-link-card" onClick={() => setActiveTab('attendance')}>
                  <span><AlertCircle size={16} color="#1A73E8" /> Late Fine: 0</span>""",
    """<div className="bottom-link-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('late'); }}>
                  <span><AlertCircle size={16} color="#1A73E8" /> Late Fine: 0</span>"""
)

# 2. Upcoming leaves removal
upcoming_leaves_block = """<div className="bottom-link-card" onClick={() => { setActiveTab('attendance'); showToast('View Upcoming Leaves'); }}>
                    <span>Upcoming leaves: 0</span>
                    <ChevronRightIcon size={16} color="#5F6368" />
                  </div>"""
if upcoming_leaves_block in content:
    content = content.replace(upcoming_leaves_block, "")

# 3. Metric filters
# Add onClick to metric items
metrics_mapping = [
    ('<div className="metric-item">', '<div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("present"); }}>', 'Present <Info size={12} />'),
    ('<div className="metric-item">', '<div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("absent"); }}>', 'Absent</div>'),
    ('<div className="metric-item">', '<div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("staff"); }}>', 'Staff</div>'),
    ('<div className="metric-item">', '<div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("halfDay"); }}>', 'Half Day</div>'),
    ('<div className="metric-item">', '<div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("onLeave"); }}>', 'On Leave</div>')
]

lines = content.split('\n')
for i, line in enumerate(lines):
    if '<div className="metric-item">' in line:
        # Check next line for the label to identify which metric it is
        if i + 1 < len(lines):
            next_line = lines[i+1]
            if 'Present <Info' in next_line:
                lines[i] = line.replace('<div className="metric-item">', '<div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("present"); }}>')
            elif 'Absent</div>' in next_line:
                lines[i] = line.replace('<div className="metric-item">', '<div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("absent"); }}>')
            elif 'Staff</div>' in next_line:
                lines[i] = line.replace('<div className="metric-item">', '<div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("staff"); }}>')
            elif 'Half Day</div>' in next_line:
                lines[i] = line.replace('<div className="metric-item">', '<div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("halfDay"); }}>')
            elif 'On Leave</div>' in next_line:
                # This one might have style={{ borderRight: 'none' }}
                pass
    if '<div className="metric-item" style={{ borderRight: \'none\' }}>' in line:
        if i + 1 < len(lines) and 'On Leave</div>' in lines[i+1]:
            lines[i] = line.replace('<div className="metric-item" style={{ borderRight: \'none\' }}>', '<div className="metric-item" style={{ borderRight: \'none\', cursor: "pointer" }} onClick={() => { setIsDrawerOpen(true); setDrawerType("onLeave"); }}>')

content = '\n'.join(lines)

# 4. Department / Shift Attendance Tables (NM -> S)
content = content.replace(
    "<th>P</th><th>A</th><th>NM</th><th>HD</th><th>OT</th><th>F</th><th>L</th>",
    "<th>P</th><th>A</th><th>S</th><th>HD</th><th>OT</th><th>F</th><th>L</th>"
)
# In DashboardScreen.jsx, the NM calc is: <td>{deptStaff.length - (counts.present + counts.absent + counts.halfDay + counts.onLeave)}</td>
# I'll find all instances of this and replace with <td>{deptStaff.length}</td>, and for shift table: <td>{shiftStaff.length - ...}</td> -> <td>{shiftStaff.length}</td>
content = re.sub(r'<td>\{deptStaff\.length - \(counts\.present \+ counts\.absent \+ counts\.halfDay \+ counts\.onLeave\)\}</td>', r'<td>{deptStaff.length}</td>', content)
content = re.sub(r'<td>\{shiftStaff\.length - \(counts\.present \+ counts\.absent \+ counts\.halfDay \+ counts\.onLeave\)\}</td>', r'<td>{shiftStaff.length}</td>', content)

# 5. Staff Month Attendance (Muster Roll)
content = content.replace("Attendance Muster Roll Reports", "Staff Month Attendance")
# Remove Expand All button
expand_btn = "<button className=\"action-dropdown\" style={{ fontWeight: 500 }} onClick={() => { showToast('Expand All toggled'); setCalendarExpanded(!calendarExpanded); }}>Expand All</button>"
content = content.replace(expand_btn, "")

# Replace Download Select with Button
download_select = """<select className="action-dropdown" onChange={(e) => { if(e.target.value !== 'download') handleReportDownload(e.target.value); e.target.value = 'download'; }} style={{ appearance: 'none', paddingRight: '24px', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%235F6368%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', outline: 'none' }}>
                  <option value="download" disabled hidden selected>Download</option>
                  <option value="Muster_Roll_PDF">As PDF</option>
                  <option value="Muster_Roll_Excel">As Excel</option>
                </select>"""
new_download_btn = """<button className="action-dropdown" style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => handleReportDownload('Muster_Roll_PDF')}><Download size={16} /> Download PDF</button>"""
content = content.replace(download_select, new_download_btn)

# 6. Reports Section Customise -> View
content = content.replace(">Customise PDF</button>", ">View</button>")

# 7. Update Drawer Content Logic
old_drawer_content = """        <div className="drawer-content">
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
        </div>"""

new_drawer_content = """        <div className="drawer-content">
          <div className="drawer-list">
            {dailyStaffData
              .filter(s => {
                if (drawerType === 'present') return s.status === 'Present' || s.status === 'Late' || (s.in && s.in !== '-');
                if (drawerType === 'absent') return s.status === 'Absent';
                if (drawerType === 'late') return s.status === 'Late';
                if (drawerType === 'halfDay') return s.status === 'Half Day';
                if (drawerType === 'onLeave') return s.status === 'On Leave';
                if (drawerType === 'staff') return True; // all staff
                return false;
              })
              .map((staff, idx) => (
                <div key={idx} className="drawer-list-item">
                  <div className="drawer-staff-info">
                    <div className="drawer-staff-name">{staff.name}</div>
                    <div className="drawer-staff-time">{staff.status === 'On Leave' ? 'On Leave' : (staff.status || 'Present')} {staff.in && staff.in !== '-' ? `(In: ${staff.in})` : ''}</div>
                  </div>
                  <div className="drawer-staff-status">{staff.status || 'Present'}</div>
                </div>
              ))}
            {dailyStaffData.filter(s => {
                if (drawerType === 'present') return s.status === 'Present' || s.status === 'Late' || (s.in && s.in !== '-');
                if (drawerType === 'absent') return s.status === 'Absent';
                if (drawerType === 'late') return s.status === 'Late';
                if (drawerType === 'halfDay') return s.status === 'Half Day';
                if (drawerType === 'onLeave') return s.status === 'On Leave';
                if (drawerType === 'staff') return True; // all staff
                return false;
              }).length === 0 && (
              <div className="drawer-empty">No staff found for this filter.</div>
            )}
          </div>
        </div>"""

content = content.replace(old_drawer_content, new_drawer_content)

# Update drawer title
old_drawer_title = "<h2>{drawerType === 'present' ? 'Present Staff' : 'Absent / Leave List'}</h2>"
new_drawer_title = """<h2>{drawerType === 'present' ? 'Present Staff' : 
                     drawerType === 'absent' ? 'Absent Staff' : 
                     drawerType === 'late' ? 'Late Staff' : 
                     drawerType === 'halfDay' ? 'Half Day Staff' : 
                     drawerType === 'onLeave' ? 'On Leave Staff' : 
                     drawerType === 'staff' ? 'All Staff' : 'Staff List'}</h2>"""
content = content.replace(old_drawer_title, new_drawer_title)

# Note: JS 'True' in filter must be 'true'. Let me fix the filter code above.
content = content.replace("return True; // all staff", "return true; // all staff")

with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("DashboardScreen.jsx patched for phase 2 upgrades.")
