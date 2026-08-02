import { useParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Patient } from '@/types'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  screening: { label: '筛选', color: 'bg-purple-50 text-purple-600' },
  enrolled: { label: '入组', color: 'bg-blue-50 text-blue-600' },
  treatment: { label: '治疗', color: 'bg-teal-50 text-teal-600' },
  completed: { label: '完成', color: 'bg-amber-50 text-amber-600' },
  withdrawn: { label: '退出', color: 'bg-red-50 text-red-600' },
  lost: { label: '失访', color: 'bg-slate-50 text-slate-600' },
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function ProjectPatients() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, patients, savePatient, deletePatient } = useAppStorage()
  const [showDialog, setShowDialog] = useState(false)
  const [newPatient, setNewPatient] = useState<Partial<Patient>>({ gender: 'male', status: 'screening' })

  const project = projects.find((p) => p.id === projectId)
  if (!project) return <div>项目不存在</div>

  const projectPatients = patients.filter((p) => p.projectId === projectId)

  const handleAdd = () => {
    if (!newPatient.nameInitials || !newPatient.screeningNo) return
    const idx = projectPatients.length + 1
    const patient: Patient = {
      id: genId(),
      projectId: projectId!,
      screeningNo: newPatient.screeningNo,
      screeningId: newPatient.screeningId || String(idx).padStart(3, '0'),
      randomizationId: newPatient.randomizationId,
      nameInitials: newPatient.nameInitials,
      gender: newPatient.gender || 'male',
      birthDate: newPatient.birthDate,
      consentDate: newPatient.consentDate,
      enrollmentDate: newPatient.enrollmentDate,
      status: (newPatient.status as Patient['status']) || 'screening',
      currentVisit: newPatient.currentVisit,
      nextVisit: newPatient.nextVisit,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    savePatient(patient)
    setShowDialog(false)
    setNewPatient({ gender: 'male', status: 'screening' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">受试者列表</h3>
        <Button size="sm" className="bg-teal-500 hover:bg-teal-600" onClick={() => setShowDialog(true)}>
          <Plus className="w-4 h-4 mr-1" /> 添加受试者
        </Button>
      </div>

      {projectPatients.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg border border-dashed border-slate-300">
          <p className="text-slate-400">暂无受试者</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                <th className="text-left px-4 py-3 font-medium">筛选序号</th>
                <th className="text-left px-4 py-3 font-medium">筛选编号</th>
                <th className="text-left px-4 py-3 font-medium">随机编号</th>
                <th className="text-left px-4 py-3 font-medium">姓名缩写</th>
                <th className="text-left px-4 py-3 font-medium">性别</th>
                <th className="text-left px-4 py-3 font-medium">知情日期</th>
                <th className="text-left px-4 py-3 font-medium">入组日期</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-left px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {projectPatients.map((p) => {
                const status = STATUS_MAP[p.status] || STATUS_MAP.screening
                return (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">{p.screeningNo}</td>
                    <td className="px-4 py-3">{p.screeningId}</td>
                    <td className="px-4 py-3">{p.randomizationId || '-'}</td>
                    <td className="px-4 py-3 font-medium">{p.nameInitials}</td>
                    <td className="px-4 py-3">{p.gender === 'male' ? '♂ 男' : '♀ 女'}</td>
                    <td className="px-4 py-3">{p.consentDate || '-'}</td>
                    <td className="px-4 py-3">{p.enrollmentDate || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500" onClick={() => deletePatient(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>添加受试者</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">筛选序号</Label><Input value={newPatient.screeningNo || ''} onChange={(e) => setNewPatient({ ...newPatient, screeningNo: e.target.value })} /></div>
              <div><Label className="text-sm">筛选编号</Label><Input value={newPatient.screeningId || ''} onChange={(e) => setNewPatient({ ...newPatient, screeningId: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">随机编号</Label><Input value={newPatient.randomizationId || ''} onChange={(e) => setNewPatient({ ...newPatient, randomizationId: e.target.value })} /></div>
              <div><Label className="text-sm">姓名缩写</Label><Input value={newPatient.nameInitials || ''} onChange={(e) => setNewPatient({ ...newPatient, nameInitials: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">性别</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newPatient.gender} onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value as any })}>
                  <option value="male">男</option><option value="female">女</option>
                </select>
              </div>
              <div>
                <Label className="text-sm">状态</Label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newPatient.status} onChange={(e) => setNewPatient({ ...newPatient, status: e.target.value as any })}>
                  <option value="screening">筛选</option><option value="enrolled">入组</option>
                  <option value="treatment">治疗</option><option value="completed">完成</option>
                  <option value="withdrawn">退出</option><option value="lost">失访</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">知情日期</Label><Input type="date" value={newPatient.consentDate || ''} onChange={(e) => setNewPatient({ ...newPatient, consentDate: e.target.value })} /></div>
              <div><Label className="text-sm">入组日期</Label><Input type="date" value={newPatient.enrollmentDate || ''} onChange={(e) => setNewPatient({ ...newPatient, enrollmentDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button className="bg-teal-500 hover:bg-teal-600" onClick={handleAdd} disabled={!newPatient.nameInitials || !newPatient.screeningNo}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
