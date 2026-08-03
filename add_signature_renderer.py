path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/components/CRFFormRenderer.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add SignatureCanvas component before CRFFormRenderer function
old_component_start = '''export default function CRFFormRenderer({'''

new_component_start = '''function SignatureCanvas({
  value,
  onChange,
  readOnly,
}: {
  value: string
  onChange: (v: string) => void
  readOnly: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0]
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return
    e.preventDefault()
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#0f766e'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const endDraw = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(canvas.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  // 当有已保存的签名值时，绘制到 canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = value
  }, [])

  if (value && readOnly) {
    return (
      <div className="border border-slate-200 rounded-md p-2 bg-white">
        <img src={value} alt="签名" className="max-w-full h-auto" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          style={{ background: '#fafafa' }}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={clear} disabled={readOnly}>
          <Trash2 className="w-3 h-3 mr-1" /> 清除签名
        </Button>
        {value && <span className="text-[10px] text-green-600">✓ 已签名</span>}
      </div>
    </div>
  )
}

export default function CRFFormRenderer({'''

if old_component_start in content:
    content = content.replace(old_component_start, new_component_start)
    print('Step 1: Added SignatureCanvas component.')
else:
    print('Step 1: Pattern not found!')

# Add signature case to renderField
old_scale_case = '''      case 'scale': {'''

new_signature_before_scale = '''      case 'signature':
        return (
          <SignatureCanvas
            value={(value as string) || ''}
            onChange={(v) => updateField(field.name, v)}
            readOnly={readOnly}
          />
        )

      case 'scale': {'''

if old_scale_case in content:
    content = content.replace(old_scale_case, new_signature_before_scale)
    print('Step 2: Added signature render case.')
else:
    print('Step 2: Pattern not found!')

# Add useRef and useEffect imports
old_react_import = "import { useState } from 'react'"
new_react_import = "import { useState, useRef, useEffect } from 'react'"

if old_react_import in content:
    content = content.replace(old_react_import, new_react_import)
    print('Step 3: Updated React imports.')
else:
    print('Step 3: React import pattern not found!')

# Add Trash2 import if not present
if 'Trash2' not in content:
    content = content.replace(
        "import { CalendarIcon, Plus, Trash2 } from 'lucide-react'",
        "import { CalendarIcon, Plus, Trash2 } from 'lucide-react'"
    )
    # It's already there from table component

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done.')
