path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ModuleLibraryPage.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the selected-state Card to add drag attributes
old_card = '''                <Card
                  key={module.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedModule?.id === module.id
                      ? 'ring-2 ring-teal-500 border-teal-500'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedModule((prev) =>
                      prev?.id === module.id ? null : module
                    )
                  }
                >'''

new_card = '''                <Card
                  key={module.id}
                  draggable
                  onDragStart={(e) => handleModuleDragStart(e, module.id)}
                  onDragOver={(e) => handleModuleDragOver(e, module.id)}
                  onDrop={(e) => handleModuleDrop(e, module.id)}
                  onDragEnd={handleModuleDragEnd}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedModule?.id === module.id
                      ? 'ring-2 ring-teal-500 border-teal-500'
                      : ''
                  } ${dragOverModuleId === module.id ? 'border-teal-400 bg-teal-50/30' : ''} ${dragModuleId === module.id ? 'opacity-50' : ''}`}
                  onClick={() =>
                    setSelectedModule((prev) =>
                      prev?.id === module.id ? null : module
                    )
                  }
                >'''

if old_card in content:
    content = content.replace(old_card, new_card)
    print('Step 1: Added drag attributes to module cards.')
else:
    print('Step 1: Pattern not found!')

# Now add drag attributes to field items
# Find the field item div and add drag attributes
old_field_div = '''                          <div
                            key={field.id}
                            className={`group border rounded-lg transition-all bg-white ${
                              isEditing
                                ? 'border-teal-400 shadow-md ring-1 ring-teal-100'
                                : 'border-slate-200 hover:border-teal-300 hover:shadow-sm'
                            }`}
                          >'''

new_field_div = '''                          <div
                            key={field.id}
                            draggable={!isEditing}
                            onDragStart={(e) => handleFieldDragStart(e, field.id)}
                            onDragOver={handleFieldDragOver}
                            onDrop={(e) => handleFieldDrop(e, field.id)}
                            onDragEnd={handleFieldDragEnd}
                            className={`group border rounded-lg transition-all bg-white ${
                              isEditing
                                ? 'border-teal-400 shadow-md ring-1 ring-teal-100'
                                : 'border-slate-200 hover:border-teal-300 hover:shadow-sm'
                            } ${dragFieldId === field.id ? 'opacity-50' : ''}`}
                          >'''

if old_field_div in content:
    content = content.replace(old_field_div, new_field_div)
    print('Step 2: Added drag attributes to field items.')
else:
    print('Step 2: Pattern not found!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
