import sys

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """<div className="status-tables-container" style={{ display: 'flex', gap: '24px', marginTop: '32px' }}>
              <div className="card status-table-card" style={{ flex: 1, padding: '24px' }}>
                <h3 className="section-title" style={{ fontSize: '16px', marginBottom: '16px', color: '#137333', borderBottom: '1px solid #E8EAED', paddingBottom: '12px' }}>Present Staff</h3>
                <div className="table-responsive">
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
                            <td style={{ textAlign: 'left', fontWeight: 500 }}>{typeof staff.name === 'object' ? '' : staff.name || 'Unknown Staff'}</td>
                            <td><span className={`drawer-staff-status ${String(staff.status || 'absent').toLowerCase().replace(' ', '-')}`}>{staff.status}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>"""

new_block = """<div className="card" style={{ marginTop: '32px', padding: '24px' }}>
              <div className="status-tables-container" style={{ display: 'flex', gap: '32px' }}>
                <div className="status-table-section" style={{ flex: 1 }}>
                  <h3 className="section-title" style={{ fontSize: '16px', marginBottom: '16px', color: '#137333', borderBottom: '1px solid #E8EAED', paddingBottom: '12px' }}>Present Staff</h3>
                  <div className="table-responsive">
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
                  </div>
                </div>

                <div style={{ width: '1px', backgroundColor: '#E8EAED' }}></div>

                <div className="status-table-section" style={{ flex: 1 }}>
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
                              <td style={{ textAlign: 'left', fontWeight: 500, color: '#202124' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span>{typeof staff.name === 'object' ? '' : staff.name || 'Unknown Staff'}</span>
                                  <span style={{ fontSize: '12px', color: '#5F6368', fontWeight: 'normal' }}>{staff.dept || 'No Department'}</span>
                                </div>
                              </td>
                              <td><span className={`drawer-staff-status ${String(staff.status || 'absent').toLowerCase().replace(' ', '-')}`}>{staff.status}</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Combined tables into a single card successfully.")
else:
    # try a more robust replacement strategy or look for partials if exact string match fails
    print("Could not find the exact old block.")
