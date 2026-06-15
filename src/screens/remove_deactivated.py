import sys

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The specific deactivated block to remove
deactivated_block = """                  <div className="metric-item">
                    <div className="metric-label">Deactivated</div>
                    <div className="metric-value">{deactivatedCount}</div>
                  </div>"""

if deactivated_block in content:
    content = content.replace(deactivated_block, "")
    
    with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Deactivated metric removed successfully.")
else:
    print("Could not find Deactivated block. Check formatting.")
