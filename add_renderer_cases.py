path = r'C:/Users/huawe/Documents/Kimi/Workspaces/CRF设计/crf-designer/src/components/CRFFormRenderer.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_default = '''      default:
        return <Input {...commonProps} disabled placeholder="未知字段类型" />
    }
  }'''

new_cases = '''      case 'scale': {
        const sc = field.scaleConfig || { min: 0, max: 10, step: 1 }
        const labels = sc.labels || []
        const numValue = value !== undefined ? Number(value) : sc.min
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={sc.min}
                max={sc.max}
                step={sc.step}
                value={numValue}
                onChange={(e) => updateField(field.name, Number(e.target.value))}
                disabled={readOnly}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
              <span className="text-sm font-semibold text-teal-600 w-10 text-center">
                {numValue}
              </span>
            </div>
            {labels.length > 0 && (
              <div className="flex justify-between text-[10px] text-slate-400 px-1">
                {labels.map((l) => (
                  <span key={l.value} className={numValue === l.value ? 'text-teal-600 font-medium' : ''}>
                    {l.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      }

      case 'numberRange': {
        const rangeVal = Array.isArray(value) ? (value as number[]) : [undefined, undefined]
        const rv = field.validation || {}
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder={field.placeholder || '最小值'}
              value={rangeVal[0] !== undefined ? String(rangeVal[0]) : ''}
              min={rv.min}
              max={rv.max}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : Number(e.target.value)
                updateField(field.name, [v, rangeVal[1]])
              }}
              disabled={readOnly}
              className="text-sm"
            />
            <span className="text-slate-400 text-sm">~</span>
            <Input
              type="number"
              placeholder={field.placeholder || '最大值'}
              value={rangeVal[1] !== undefined ? String(rangeVal[1]) : ''}
              min={rv.min}
              max={rv.max}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : Number(e.target.value)
                updateField(field.name, [rangeVal[0], v])
              }}
              disabled={readOnly}
              className="text-sm"
            />
          </div>
        )
      }

      default:
        return <Input {...commonProps} disabled placeholder="未知字段类型" />
    }
  }'''

if old_default in content:
    content = content.replace(old_default, new_cases)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Added scale and numberRange render cases.')
else:
    print('Pattern not found!')
