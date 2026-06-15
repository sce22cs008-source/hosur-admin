import sys

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '<div className="metrics-grid">'
end_marker = '</div>\n                \n                <div className="metric-row-2">'

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    new_metrics = """<div className="metrics-grid">
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
                  <div className="metric-item" style={{cursor: "pointer"}} onClick={() => { setIsDrawerOpen(true); setDrawerType("halfDay"); }}>
                    <div className="metric-label" style={{ borderRight: 'none' }}>Half Day</div>
                    <div className="metric-value">{halfDayCount}</div>
                  </div>
                """
    
    content = content[:start_idx] + new_metrics + content[end_idx:]
    
    with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Metrics grid replaced successfully.")
else:
    print("Could not find markers for metrics grid.")
