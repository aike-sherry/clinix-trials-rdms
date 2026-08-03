path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/pages/admin/ModuleLibraryPage.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update FIELD_TYPE_LABELS
old_labels = '''const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: '文本',
  textarea: '多行文本',
  number: '数字',
  date: '日期',
  datetime: '日期时间',
  select: '下拉选择',
  radio: '单选',
  checkbox: '多选',
  toggle: '开关',
  label: '标签',
  table: '表格',
}'''

new_labels = '''const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: '文本',
  textarea: '多行文本',
  number: '数字',
  date: '日期',
  datetime: '日期时间',
  select: '下拉选择',
  radio: '单选',
  checkbox: '多选',
  toggle: '开关',
  label: '标签',
  table: '表格',
  scale: '量表评分',
  numberRange: '数值范围',
}'''

if old_labels in content:
    content = content.replace(old_labels, new_labels)
    print('Updated FIELD_TYPE_LABELS.')
else:
    print('FIELD_TYPE_LABELS pattern not found!')

# Update FIELD_TYPE_ICONS
old_icons = '''const FIELD_TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <Type className="w-4 h-4" />,
  textarea: <AlignLeft className="w-4 h-4" />,
  number: <Hash className="w-4 h-4" />,
  date: <Calendar className="w-4 h-4" />,
  datetime: <Calendar className="w-4 h-4" />,
  select: <ListChecks className="w-4 h-4" />,
  radio: <ListChecks className="w-4 h-4" />,
  checkbox: <ListChecks className="w-4 h-4" />,
  toggle: <ToggleLeft className="w-4 h-4" />,
  label: <FileText className="w-4 h-4" />,
  table: <Table className="w-4 h-4" />,
}'''

new_icons = '''const FIELD_TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <Type className="w-4 h-4" />,
  textarea: <AlignLeft className="w-4 h-4" />,
  number: <Hash className="w-4 h-4" />,
  date: <Calendar className="w-4 h-4" />,
  datetime: <Calendar className="w-4 h-4" />,
  select: <ListChecks className="w-4 h-4" />,
  radio: <ListChecks className="w-4 h-4" />,
  checkbox: <ListChecks className="w-4 h-4" />,
  toggle: <ToggleLeft className="w-4 h-4" />,
  label: <FileText className="w-4 h-4" />,
  table: <Table className="w-4 h-4" />,
  scale: <SlidersHorizontal className="w-4 h-4" />,
  numberRange: <ArrowLeftRight className="w-4 h-4" />,
}'''

if old_icons in content:
    content = content.replace(old_icons, new_icons)
    print('Updated FIELD_TYPE_ICONS.')
else:
    print('FIELD_TYPE_ICONS pattern not found!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
