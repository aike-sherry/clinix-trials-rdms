import re

path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ProjectCRFView.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find the broken header block
old = '''              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? (
                  <><ChevronRight className="w-3.5 h-3.5 mr-1" /> 收起预览</>
                ) : (
                  <><Eye className="w-3.5 h-3.5 mr-1" /> 展开预览</>
                )}
          )}
        </div>
      </div>'''

new = '''              </Button>
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
    print('Fixed broken header block.')
else:
    print('Pattern not found, checking what is actually there...')
    # Print surrounding area for debugging
    idx = content.find('收起预览')
    if idx >= 0:
        print(repr(content[idx-200:idx+300]))
