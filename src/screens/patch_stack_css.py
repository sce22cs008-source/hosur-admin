import sys

css_to_append = """
/* Make the dashboard grid items stack vertically */
.dashboard-grid {
  flex-direction: column !important;
}
"""

with open('Dashboard.css', 'a', encoding='utf-8') as f:
    f.write(css_to_append)

print('Dashboard.css appended for vertical stacking.')
