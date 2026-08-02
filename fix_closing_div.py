path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the exact pattern at end of VisitModulesView
old = '''          </aside>
        )}
      </div>
    </div>
  )
}

// ==================== 模块预览视图（右侧分栏）===================='''

new = '''          </aside>
        )}
      </div>
    </div>
  </div>
)
}

// ==================== 模块预览视图（右侧分栏）===================='''

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed missing closing </div> in VisitModulesView.')
else:
    print('Pattern not found!')
    # Try to print context
    idx = content.find('</aside>')
    if idx >= 0:
        # Find last occurrence
        idx = content.rfind('</aside>')
        print(repr(content[idx-50:idx+200]))
