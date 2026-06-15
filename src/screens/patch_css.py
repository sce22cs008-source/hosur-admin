import sys

with open('Dashboard.css', 'a', encoding='utf-8') as f:
    f.write("""
/* Right Side Drawer Styles */
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.4);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
  z-index: 10000;
}

.drawer-overlay.open {
  opacity: 1;
  visibility: visible;
}

.right-drawer {
  position: fixed;
  top: 0;
  right: -400px;
  width: 400px;
  height: 100vh;
  background-color: #fff;
  box-shadow: -4px 0 15px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease;
  z-index: 10001;
  display: flex;
  flex-direction: column;
}

.right-drawer.open {
  right: 0;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #E8EAED;
}

.drawer-header h2 {
  margin: 0;
  font-size: 20px;
  color: #202124;
  font-weight: 600;
}

.close-drawer-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #5F6368;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-drawer-btn:hover {
  background-color: #F1F3F4;
  color: #202124;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background-color: #F8F9FA;
}

.drawer-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drawer-list-item {
  background-color: #fff;
  border: 1px solid #E8EAED;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.drawer-staff-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawer-staff-name {
  font-size: 16px;
  font-weight: 500;
  color: #202124;
}

.drawer-staff-time {
  font-size: 13px;
  color: #5F6368;
}

.drawer-staff-status {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
  background-color: #E6F4EA;
  color: #137333;
}

.drawer-empty {
  text-align: center;
  color: #5F6368;
  padding: 40px 0;
  font-size: 15px;
}

/* Adjust action items styling to make it look cleaner like the second image bottom buttons */
.things-to-do-card .action-item {
  border: 1px solid #E8EAED;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.things-to-do-card .action-item:last-child {
  margin-bottom: 0;
}

.things-to-do-card .action-item:hover {
  border-color: #1A73E8;
  box-shadow: 0 2px 6px rgba(26,115,232,0.1);
  background-color: #fff;
}
""")
print("Dashboard.css appended.")
