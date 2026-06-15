import sys

with open('Dashboard.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# Replace the hardcoded background and color in .drawer-staff-status
old_css = """.drawer-staff-status {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
  background-color: #E6F4EA;
  color: #137333;
}"""

new_css = """.drawer-staff-status {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
}

.drawer-staff-status.present {
  background-color: #E6F4EA;
  color: #137333;
}

.drawer-staff-status.absent {
  background-color: #FCE8E6;
  color: #D93025;
}

.drawer-staff-status.late {
  background-color: #FEF7E0;
  color: #E37400;
}

.drawer-staff-status.half-day {
  background-color: #E8F0FE;
  color: #1A73E8;
}

.drawer-staff-status.on-leave {
  background-color: #F3E8FD;
  color: #9334E6;
}"""

css_content = css_content.replace(old_css, new_css)
with open('Dashboard.css', 'w', encoding='utf-8') as f:
    f.write(css_content)

print("Dashboard.css patched successfully.")

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    jsx_content = f.read()

old_jsx = """<div className="drawer-staff-status">{staff.status || 'Present'}</div>"""
new_jsx = """<div className={`drawer-staff-status ${String(staff.status || 'present').toLowerCase().replace(' ', '-')}`}>{staff.status || 'Present'}</div>"""

jsx_content = jsx_content.replace(old_jsx, new_jsx)

with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
    f.write(jsx_content)

print("DashboardScreen.jsx patched successfully.")
