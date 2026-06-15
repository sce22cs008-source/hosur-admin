import sys

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to find the start and end of the "Staff Month Attendance" section
start_marker = "{/* 3. Staff Month Attendance */}"
end_marker = """                  </tbody>
                </table>
              </div>
            </div>"""

if start_marker in content:
    start_idx = content.find(start_marker)
    # find the next instance of the end_marker after start_idx
    end_idx = content.find(end_marker, start_idx) + len(end_marker)
    
    new_tables = """{/* 3. Daily Staff Status Tables */}
            <div className="status-tables-container" style={{ display: 'flex', gap: '24px', marginTop: '32px' }}>
              <div className="card status-table-card" style={{ flex: 1, padding: '24px' }}>
                <h3 className="section-title" style={{ fontSize: '16px', marginBottom: '16px', color: '#137333', borderBottom: '1px solid #E8EAED', paddingBottom: '12px' }}>Present Staff</h3>
                <div className="table-responsive">
                  <table className="muster-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Staff Name</th>
                        <th>In Time</th>
                        <th>Out Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyStaffData.filter(s => s.status === 'Present').length === 0 ? (
                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '16px', color: '#5F6368' }}>No present staff</td></tr>
                      ) : (
                        dailyStaffData.filter(s => s.status === 'Present').map((staff, idx) => (
                          <tr key={idx}>
                            <td style={{ textAlign: 'left', fontWeight: 500 }}>{staff.name}</td>
                            <td>{staff.in || '-'}</td>
                            <td>{staff.out || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card status-table-card" style={{ flex: 1, padding: '24px' }}>
                <h3 className="section-title" style={{ fontSize: '16px', marginBottom: '16px', color: '#D93025', borderBottom: '1px solid #E8EAED', paddingBottom: '12px' }}>Absent Staff</h3>
                <div className="table-responsive">
                  <table className="muster-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Staff Name</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyStaffData.filter(s => s.status === 'Absent' || s.status === 'On Leave').length === 0 ? (
                        <tr><td colSpan="2" style={{ textAlign: 'center', padding: '16px', color: '#5F6368' }}>No absent staff</td></tr>
                      ) : (
                        dailyStaffData.filter(s => s.status === 'Absent' || s.status === 'On Leave').map((staff, idx) => (
                          <tr key={idx}>
                            <td style={{ textAlign: 'left', fontWeight: 500 }}>{staff.name}</td>
                            <td><span className={`drawer-staff-status ${String(staff.status || 'absent').toLowerCase().replace(' ', '-')}`}>{staff.status}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>"""
    
    content = content[:start_idx] + new_tables + content[end_idx:]
    
    with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced Staff Month Attendance with Present/Absent tables successfully.")
else:
    print("Could not find start marker for Staff Month Attendance.")
