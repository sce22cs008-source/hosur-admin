import sys
import re

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Things To Do with accurate numbers and tiny pie charts
old_things_to_do = """              {/* Things To Do Horizontal Links */}
              <div className="card" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#202124', marginBottom: '16px', marginTop: 0 }}>Things to do</h3>
                <div className="attendance-bottom-links" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  <div className="bottom-link-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('present'); }}>
                  <span><Fingerprint size={16} color="#1A73E8" /> Approve punches: 0</span>
                  <ChevronRightIcon size={16} color="#5F6368" />
                </div>
                <div className="bottom-link-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('late'); }}>
                  <span><AlertCircle size={16} color="#1A73E8" /> Late Fine: 0</span>
                  <ChevronRightIcon size={16} color="#5F6368" />
                </div>
                <div className="bottom-link-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('absent'); }}>
                  <span><Calendar size={16} color="#1A73E8" /> Manage leaves: 0</span>
                  <ChevronRightIcon size={16} color="#5F6368" />
                </div>
              </div>
              </div>"""

new_things_to_do = """              {/* Things To Do Horizontal Links */}
              <div className="card" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#202124', marginBottom: '16px', marginTop: 0 }}>Things to do</h3>
                <div className="attendance-bottom-links" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  <div className="bottom-link-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('present'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Fingerprint size={16} color="#1A73E8" /> Approve punches: {presentCount}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <PieChart width={24} height={24}>
                        <Pie data={[{ value: presentCount, fill: '#0F9D58' }, { value: dailyStaffData.length - presentCount, fill: '#E8EAED' }]} cx="50%" cy="50%" innerRadius={7} outerRadius={12} dataKey="value" stroke="none" />
                      </PieChart>
                      <ChevronRightIcon size={16} color="#5F6368" />
                    </div>
                  </div>
                  <div className="bottom-link-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('late'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={16} color="#1A73E8" /> Late Fine: {dailyStaffData.filter(s => s.status === 'Late').length}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <PieChart width={24} height={24}>
                        <Pie data={[{ value: dailyStaffData.filter(s => s.status === 'Late').length, fill: '#F4B400' }, { value: dailyStaffData.length - dailyStaffData.filter(s => s.status === 'Late').length, fill: '#E8EAED' }]} cx="50%" cy="50%" innerRadius={7} outerRadius={12} dataKey="value" stroke="none" />
                      </PieChart>
                      <ChevronRightIcon size={16} color="#5F6368" />
                    </div>
                  </div>
                  <div className="bottom-link-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('absent'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={16} color="#1A73E8" /> Manage leaves: {absentCount}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <PieChart width={24} height={24}>
                        <Pie data={[{ value: absentCount, fill: '#DB4437' }, { value: dailyStaffData.length - absentCount, fill: '#E8EAED' }]} cx="50%" cy="50%" innerRadius={7} outerRadius={12} dataKey="value" stroke="none" />
                      </PieChart>
                      <ChevronRightIcon size={16} color="#5F6368" />
                    </div>
                  </div>
                </div>
              </div>"""

content = content.replace(old_things_to_do, new_things_to_do)

# 2. Reorder and modify Metrics Grid
old_metrics = """                <div className="metrics-grid">
                  <div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("present"); }}>
                    <div className="metric-label">Present <Info size={12} /></div>
                    <div className="metric-value">{presentCount}</div>
                  </div>
                  <div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("absent"); }}>
                    <div className="metric-label">Absent</div>
                    <div className="metric-value">{absentCount}</div>
                  </div>
                  <div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("staff"); }}>
                    <div className="metric-label">Staff</div>
                    <div className="metric-value">{dailyStaffData.length}</div>
                  </div>
                  <div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("halfDay"); }}>
                    <div className="metric-label">Half Day</div>
                    <div className="metric-value">{halfDayCount}</div>
                  </div>
                  <div className="metric-item" style={{ borderRight: 'none', cursor: "pointer" }} onClick={() => { setIsDrawerOpen(true); setDrawerType("onLeave"); }}>
                    <div className="metric-label">On Leave</div>
                    <div className="metric-value">{onLeaveCount}</div>
                  </div>
                </div>"""

new_metrics = """                <div className="metrics-grid">
                  <div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("staff"); }}>
                    <div className="metric-label">Staff</div>
                    <div className="metric-value">{dailyStaffData.length}</div>
                  </div>
                  <div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("present"); }}>
                    <div className="metric-label">Present <Info size={12} /></div>
                    <div className="metric-value">{presentCount}</div>
                  </div>
                  <div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("absent"); }}>
                    <div className="metric-label">Absent</div>
                    <div className="metric-value">{absentCount}</div>
                  </div>
                  <div className="metric-item" style={{cursor: "pointer", borderRight: 'none'}} onClick={() => { setIsDrawerOpen(true); setDrawerType("halfDay"); }}>
                    <div className="metric-label" style={{ borderRight: 'none' }}>Half Day</div>
                    <div className="metric-value">{halfDayCount}</div>
                  </div>
                </div>"""

# Fallback metric replacement (in case style parsing is slightly off)
if old_metrics in content:
    content = content.replace(old_metrics, new_metrics)
else:
    # We will do regex matching or manual replacement if literal replace fails
    pass

with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("DashboardScreen.jsx patched for tiny pies and metrics ordering.")
