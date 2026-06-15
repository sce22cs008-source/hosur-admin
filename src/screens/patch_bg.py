import sys

with open('DashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the specific block
old_block = """{/* Things To Do Horizontal Links */}
              <div className="attendance-bottom-links" style={{ marginBottom: '24px' }}>
                <div className="bottom-link-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('present'); }}>"""

new_block = """{/* Things To Do Horizontal Links */}
              <div className="card" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#202124', marginBottom: '16px', marginTop: 0 }}>Things to do</h3>
                <div className="attendance-bottom-links">
                  <div className="bottom-link-card" onClick={() => { setIsDrawerOpen(true); setDrawerType('present'); }}>"""

if old_block in content:
    content = content.replace(old_block, new_block)
    
    # Also we need to add the closing div for the new card
    # The end of the block is:
    old_end = """                  <ChevronRightIcon size={16} color="#5F6368" />
                </div>
              </div>"""
              
    new_end = """                  <ChevronRightIcon size={16} color="#5F6368" />
                </div>
              </div>
              </div>"""
              
    content = content.replace(old_end, new_end)

    with open('DashboardScreen.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("DashboardScreen.jsx patched for Things To Do background.")
else:
    print("Block not found!")
