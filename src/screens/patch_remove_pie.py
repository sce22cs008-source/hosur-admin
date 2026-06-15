import sys
import re

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix aggregateStats
old_aggregate = """  const aggregateStats = (groupKey) => {
    const stats = {};
    dailyStaffData.forEach(s => {
      const key = s[groupKey] || 'Unassigned';
      if (!stats[key]) stats[key] = { name: key, p: 0, a: 0, nm: 0, hd: 0, ot: 0, f: 0, l: 0 };
      if (s.status === 'Present') stats[key].p++;
      else if (s.status === 'Absent') stats[key].a++;
      else if (s.status === 'Half Day') stats[key].hd++;
      else if (s.status === 'Late') stats[key].l++;
      else stats[key].nm++;
    });
    return Object.values(stats);
  };"""

new_aggregate = """  const aggregateStats = (groupKey) => {
    const stats = {};
    dailyStaffData.forEach(s => {
      const key = s[groupKey] || 'Unassigned';
      if (!stats[key]) stats[key] = { name: key, p: 0, a: 0, nm: 0, hd: 0, ot: 0, f: 0, l: 0, s: 0 };
      stats[key].s++; // total staff
      if (s.status === 'Present') stats[key].p++;
      else if (s.status === 'Absent') stats[key].a++;
      else if (s.status === 'Half Day') stats[key].hd++;
      else if (s.status === 'Late') stats[key].l++;
      else stats[key].nm++;
    });
    return Object.values(stats);
  };"""
content = content.replace(old_aggregate, new_aggregate)

# 2. Fix the detailed tables to use d.s instead of d.nm and rename NM to S
# The headers in detailed view might still be NM
content = content.replace("<th>P</th><th>A</th><th>NM</th><th>HD</th><th>OT</th><th>F</th><th>L</th>", "<th>P</th><th>A</th><th>S</th><th>HD</th><th>OT</th><th>F</th><th>L</th>")

# Replace the data cells for detailed view
content = content.replace("<td>{d.p}</td><td>{d.a}</td><td>{d.nm}</td><td>{d.hd}</td><td>{d.ot}</td><td>{d.f}</td><td>{d.l}</td>", "<td>{d.p}</td><td>{d.a}</td><td>{d.s}</td><td>{d.hd}</td><td>{d.ot}</td><td>{d.f}</td><td>{d.l}</td>")

# 3. Remove Pie Chart
# Let's find the pie chart div block. It's inside metric-row-2
pie_start = "<div style={{ height: 260, marginTop: '24px', borderTop: '1px solid #E8EAED', paddingTop: '24px' }}>"
pie_end = "</div>\n                </div>"
if pie_start in content:
    start_idx = content.find(pie_start)
    # find the matching responsive container end
    end_idx = content.find("</ResponsiveContainer>", start_idx) + len("</ResponsiveContainer>\n                </div>")
    
    # Actually, let's just use regex to remove the whole div safely or a targeted replace
    # We added it right after the deactivatedCount block:
    old_pie_block = """                  <div className="metric-item">
                    <div className="metric-label">Deactivated</div>
                    <div className="metric-value">{deactivatedCount}</div>
                  </div>
                </div>
                <div style={{ height: 260, marginTop: '24px', borderTop: '1px solid #E8EAED', paddingTop: '24px' }}>"""
    
    if old_pie_block in content:
        # We need to extract the whole pie chart text to replace it
        # Let's read from file and find exact text
        pass

# A simpler way to remove pie chart: we know exactly what we injected in patch_pie.py
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
if pie_chart_code in content:
    content = content.replace(pie_chart_code, "")

with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("DashboardScreen.jsx patched for A/S column fix and pie chart removal.")
