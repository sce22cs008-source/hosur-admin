import sys

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_table = """<div className="table-responsive">
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
                </div>"""

new_table = """<div className="table-responsive">
                  <table className="muster-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Staff Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyStaffData.filter(s => s.status === 'Present').length === 0 ? (
                        <tr><td style={{ textAlign: 'center', padding: '16px', color: '#5F6368' }}>No present staff</td></tr>
                      ) : (
                        dailyStaffData.filter(s => s.status === 'Present').map((staff, idx) => (
                          <tr key={idx}>
                            <td style={{ textAlign: 'left', fontWeight: 500, color: '#202124' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>{typeof staff.name === 'object' ? '' : staff.name || 'Unknown Staff'}</span>
                                <span style={{ fontSize: '12px', color: '#5F6368', fontWeight: 'normal' }}>{staff.dept || 'No Department'}</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>"""

if old_table in content:
    content = content.replace(old_table, new_table)
    with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Table updated successfully.")
else:
    print("Could not find the old table layout.")
