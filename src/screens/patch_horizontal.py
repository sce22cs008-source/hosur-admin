import sys
import re

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We want to replace the Things to do Card.
# Let's find the start and end of it.
start_marker = '{/* Things To Do Card */}'
end_marker = '{/* Attendance Overview Card */}'

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    new_things_to_do = """{/* Things To Do Horizontal Links */}
              <div className="attendance-bottom-links" style={{ marginBottom: '24px' }}>
                <div className="bottom-link-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('present'); }}>
                  <span><Fingerprint size={16} color="#1A73E8" /> Approve punches: 0</span>
                  <ChevronRightIcon size={16} color="#5F6368" />
                </div>
                <div className="bottom-link-card" onClick={() => setActiveTab('attendance')}>
                  <span><AlertCircle size={16} color="#1A73E8" /> Late Fine: 0</span>
                  <ChevronRightIcon size={16} color="#5F6368" />
                </div>
                <div className="bottom-link-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('absent'); }}>
                  <span><Calendar size={16} color="#1A73E8" /> Manage leaves: 0</span>
                  <ChevronRightIcon size={16} color="#5F6368" />
                </div>
              </div>

              """
    
    new_content = content[:start_idx] + new_things_to_do + content[end_idx:]
    
    with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("DashboardScreen.jsx patched for horizontal Things to Do.")
else:
    print("Could not find markers.")
