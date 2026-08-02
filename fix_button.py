path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '''            {modules.length > 0 && (
              </Button>
            )}
            {!readOnly && (
              <Button className="bg-teal-500 hover:bg-teal-600" onClick={onAddModule}>
                <Plus className="w-4 h-4 mr-1" /> 添加模块
              </Button>
            )}
          </div>
        </div>
      </div>'''

new = '''            {modules.length > 0 && (
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? (
                  <><ChevronRight className="w-3.5 h-3.5 mr-1" /> 收起预览</>
                ) : (
                  <><Eye className="w-3.5 h-3.5 mr-1" /> 展开预览</>
                )}
              </Button>
            )}
            {!readOnly && (
              <Button className="bg-teal-500 hover:bg-teal-600" onClick={onAddModule}>
                <Plus className="w-4 h-4 mr-1" /> 添加模块
              </Button>
            )}
          </div>
        </div>
      </div>'''

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed missing Button opening tag.')
else:
    print('Pattern not found!')
