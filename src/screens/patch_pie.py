import sys
import re

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports for Recharts
import_recharts = "import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';\n"
if "from 'recharts'" not in content:
    # insert near lucide-react
    content = content.replace("import {", import_recharts + "import {", 1)

# 2. Fix Things to do alignment
old_things_to_do = '<div className="attendance-bottom-links">'
new_things_to_do = '<div className="attendance-bottom-links" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>'
# Only replace the first occurrence which is in "Things to do"
content = content.replace(old_things_to_do, new_things_to_do, 1)

# 3. Add Pie Chart below metric-row-2
pie_chart_code = """
                <div style={{ height: 260, marginTop: '24px', borderTop: '1px solid #E8EAED', paddingTop: '24px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#5F6368', fontWeight: 600 }}>Attendance Distribution</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Present', value: presentCount, color: '#0F9D58' },
                          { name: 'Absent', value: absentCount, color: '#DB4437' },
                          { name: 'Late', value: dailyStaffData.filter(s => s.status === 'Late').length, color: '#F4B400' },
                          { name: 'Half Day', value: halfDayCount, color: '#4285F4' },
                          { name: 'On Leave', value: onLeaveCount, color: '#AB47BC' }
                        ].filter(d => d.value > 0).length > 0 ? [
                          { name: 'Present', value: presentCount, color: '#0F9D58' },
                          { name: 'Absent', value: absentCount, color: '#DB4437' },
                          { name: 'Late', value: dailyStaffData.filter(s => s.status === 'Late').length, color: '#F4B400' },
                          { name: 'Half Day', value: halfDayCount, color: '#4285F4' },
                          { name: 'On Leave', value: onLeaveCount, color: '#AB47BC' }
                        ].filter(d => d.value > 0) : [{ name: 'No Data', value: 1, color: '#E8EAED' }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {([
                          { name: 'Present', value: presentCount, color: '#0F9D58' },
                          { name: 'Absent', value: absentCount, color: '#DB4437' },
                          { name: 'Late', value: dailyStaffData.filter(s => s.status === 'Late').length, color: '#F4B400' },
                          { name: 'Half Day', value: halfDayCount, color: '#4285F4' },
                          { name: 'On Leave', value: onLeaveCount, color: '#AB47BC' }
                        ].filter(d => d.value > 0).length > 0 ? [
                          { name: 'Present', value: presentCount, color: '#0F9D58' },
                          { name: 'Absent', value: absentCount, color: '#DB4437' },
                          { name: 'Late', value: dailyStaffData.filter(s => s.status === 'Late').length, color: '#F4B400' },
                          { name: 'Half Day', value: halfDayCount, color: '#4285F4' },
                          { name: 'On Leave', value: onLeaveCount, color: '#AB47BC' }
                        ].filter(d => d.value > 0) : [{ name: 'No Data', value: 1, color: '#E8EAED' }]).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
"""

old_metric_row_2 = """                  <div className="metric-item">
                    <div className="metric-label">Deactivated</div>
                    <div className="metric-value">{deactivatedCount}</div>
                  </div>
                </div>"""

new_metric_row_2 = old_metric_row_2 + pie_chart_code

content = content.replace(old_metric_row_2, new_metric_row_2)

with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("DashboardScreen.jsx patched for pie chart.")
