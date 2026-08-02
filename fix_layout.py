path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Close the left div before the aside starts
old1 = '''            </div>
          )}
        {/* 右侧：实时预览 */}'''

new1 = '''            </div>
          )}
        </div>

        {/* 右侧：实时预览 */}'''

if old1 in content:
    content = content.replace(old1, new1)
    print('Fix 1 applied: closed left div before aside.')
else:
    print('Fix 1 pattern not found!')

# Fix 2: Remove the extra closing div at the end of VisitModulesView
# Current has: </aside>\n        )}\n      </div>\n    </div>\n  </div>\n)\n}\n
# Should be: </aside>\n        )}\n      </div>\n    </div>\n)\n}\n
old2 = '''          </aside>
        )}
      </div>
    </div>
  </div>
)
}

// ==================== 模块预览视图（右侧分栏）===================='''

new2 = '''          </aside>
        )}
      </div>
    </div>
)
}

// ==================== 模块预览视图（右侧分栏）===================='''

if old2 in content:
    content = content.replace(old2, new2)
    print('Fix 2 applied: removed extra closing div at VisitModulesView end.')
else:
    print('Fix 2 pattern not found!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
