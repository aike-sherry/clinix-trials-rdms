import { useState } from 'react'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { Patient, Gender, PatientStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Search, UserPlus, ClipboardList } from 'lucide-react'
import { Link } from 'react-router'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function now() {
  return new Date().toISOString()
}

const STATUS_LABELS: Record<PatientStatus, string> = {
  screening: '筛选中',
  enrolled: '已入组',
  treatment: '治疗中',
  completed: '已完成',
  withdrawn: '已退出',
  lost: '失访',
}

const STATUS_COLORS: Record<PatientStatus, string> = {
  screening: 'bg-amber-50 text-amber-600',
  enrolled: 'bg-blue-50 text-blue-600',
  treatment: 'bg-teal-50 text-teal-600',
  completed: 'bg-green-50 text-green-600',
  withdrawn: 'bg-red-50 text-red-600',
  lost: 'bg-slate-100 text-slate-500',
}

export default function EntryPatients() {
  const { projects, patients, savePatient } = useAppStorage()
  const [search, setSearch] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Partial<Patient>>({
    gender: 'male',
    status: 'screening',
  })

  const publishedProjects = projects.filter((p) => p.crfPublished)

  const filteredPatients = patients.filter((p) => {
    const matchSearch =
      p.screeningNo.includes(search) ||
      p.screeningId.includes(search) ||
      p.nameInitials.includes(search)
    const matchProject = publishedProjects.some((proj) => proj.id === p.projectId)
    return matchSearch && matchProject
  })

  const handleSave = () => {
    if (!editingPatient.projectId || !editingPatient.screeningNo || !editingPatient.nameInitials) return
    const patient: Patient = {
      id: editingPatient.id || genId(),
      projectId: editingPatient.projectId,
      screeningNo: editingPatient.screeningNo,
      screeningId: editingPatient.screeningId || editingPatient.screeningNo,
      randomizationId: editingPatient.randomizationId,
      nameInitials: editingPatient.nameInitials,
      gender: (editingPatient.gender as Gender) || 'male',
      birthDate: editingPatient.birthDate,
      consentDate: editingPatient.consentDate,
      enrollmentDate: editingPatient.enrollmentDate,
      status: (editingPatient.status as PatientStatus) || 'screening',
      createdAt: editingPatient.createdAt || now(),
      updatedAt: now(),
    }
    savePatient(patient)
    setShowDialog(false)
    setEditingPatient({ gender: 'male', status: 'screening' })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-600" />
            患者登记
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">登记新患者并管理受试者信息</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600" onClick={() => { setEditingPatient({ gender: 'male', status: 'screening' }); setShowDialog(true) }}>
          <Plus className="w-4 h-4 mr-1" /> 登记患者
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="搜索筛选号/姓名缩写..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">筛选号</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">姓名缩写</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">性别</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">项目</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">状态</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400">暂无患者，点击上方按钮登记</td></tr>
            )}
            {filteredPatients.map((p) => {
              const project = projects.find((proj) => proj.id === p.projectId)
              return (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-slate-700">{p.screeningId}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{p.nameInitials}</td>
                  <td className="px-4 py-3 text-slate-500">{p.gender === 'male' ? '男' : '女'}</td>
                  <td className="px-4 py-3 text-slate-500">{project?.projectNo || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/entry/data-entry?patient=${p.id}`}>
                        <ClipboardList className="w-3 h-3 mr-1" /> 录入数据
                      </Link>
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>登记新患者</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">所属项目 <span className="text-red-500">*</span></Label>
              <Select value={editingPatient.projectId || ''} onValueChange={(v) => setEditingPatient({ ...editingPatient, projectId: v })}>
                <SelectTrigger><SelectValue placeholder="选择项目" /></SelectTrigger>
                <SelectContent>
                  {publishedProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.projectNo} · {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">筛选号 <span className="text-red-500">*</span></Label><Input placeholder="如：001" value={editingPatient.screeningNo || ''} onChange={(e) => setEditingPatient({ ...editingPatient, screeningNo: e.target.value })} /></div>
              <div><Label className="text-sm">筛选编号</Label><Input placeholder="如：001" value={editingPatient.screeningId || ''} onChange={(e) => setEditingPatient({ ...editingPatient, screeningId: e.target.value })} /></div>
            </div>
            <div><Label className="text-sm">姓名缩写 <span className="text-red-500">*</span></Label><Input placeholder="如：ZS" value={editingPatient.nameInitials || ''} onChange={(e) => setEditingPatient({ ...editingPatient, nameInitials: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">性别</Label>
                <Select value={editingPatient.gender || 'male'} onValueChange={(v) => setEditingPatient({ ...editingPatient, gender: v as Gender })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">男</SelectItem>
                    <SelectItem value="female">女</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-sm">出生日期</Label><Input type="date" value={editingPatient.birthDate || ''} onChange={(e) => setEditingPatient({ ...editingPatient, birthDate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">知情同意日期</Label><Input type="date" value={editingPatient.consentDate || ''} onChange={(e) => setEditingPatient({ ...editingPatient, consentDate: e.target.value })} /></div>
              <div><Label className="text-sm">入组日期</Label><Input type="date" value={editingPatient.enrollmentDate || ''} onChange={(e) => setEditingPatient({ ...editingPatient, enrollmentDate: e.target.value })} /></div>
            </div>
            <div>
              <Label className="text-sm">随机编号</Label>
              <Input placeholder="如：CP101" value={editingPatient.randomizationId || ''} onChange={(e) => setEditingPatient({ ...editingPatient, randomizationId: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button className="bg-amber-500 hover:bg-amber-600" onClick={handleSave} disabled={!editingPatient.projectId || !editingPatient.screeningNo || !editingPatient.nameInitials}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
