import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { VisitData, VisitDataStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CRFFormRenderer from '@/components/CRFFormRenderer'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Save, CheckCircle, User, FlaskConical } from 'lucide-react'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function now() {
  return new Date().toISOString()
}

const STATUS_LABELS: Record<VisitDataStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  locked: '已锁定',
}

const STATUS_COLORS: Record<VisitDataStatus, string> = {
  not_started: 'bg-slate-100 text-slate-500',
  in_progress: 'bg-blue-50 text-blue-600',
  completed: 'bg-green-50 text-green-600',
  locked: 'bg-amber-50 text-amber-600',
}

export default function EntryDataEntry() {
  const { projects, patients, visitData, saveVisitData } = useAppStorage()
  const [searchParams] = useSearchParams()
  const initialPatientId = searchParams.get('patient') || ''

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId)
  const [selectedVisitId, setSelectedVisitId] = useState('')
  const [selectedModuleId, setSelectedModuleId] = useState('')
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  const publishedProjects = projects.filter((p) => p.crfPublished)

  const project = publishedProjects.find((p) => p.id === selectedProjectId)
  const patient = patients.find((p) => p.id === selectedPatientId)
  const visit = project?.visits.find((v) => v.id === selectedVisitId)
  const module = project?.crfModules.find((m) => m.id === selectedModuleId)

  // 加载已保存的数据
  const existingData = useMemo(() => {
    if (!selectedPatientId || !selectedVisitId || !selectedModuleId) return null
    return visitData.find(
      (v) => v.patientId === selectedPatientId && v.visitId === selectedVisitId && v.moduleId === selectedModuleId
    )
  }, [visitData, selectedPatientId, selectedVisitId, selectedModuleId])

  const projectPatients = useMemo(() => {
    return patients.filter((p) => p.projectId === selectedProjectId)
  }, [patients, selectedProjectId])

  const handleSave = (status: VisitDataStatus = 'in_progress') => {
    if (!selectedPatientId || !selectedVisitId || !selectedModuleId || !selectedProjectId) return
    const vd: VisitData = {
      id: existingData?.id || genId(),
      patientId: selectedPatientId,
      projectId: selectedProjectId,
      visitId: selectedVisitId,
      moduleId: selectedModuleId,
      data: formData,
      status,
      createdAt: existingData?.createdAt || now(),
      updatedAt: now(),
    }
    saveVisitData(vd)
    alert(status === 'completed' ? '数据已保存并标记为完成' : '数据已保存')
  }

  return (
    <div className="space-y-4 h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-amber-600" />
            数据录入
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">选择患者和访视模块进行数据录入</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave('in_progress')}>
            <Save className="w-4 h-4 mr-1" /> 暂存
          </Button>
          <Button className="bg-green-500 hover:bg-green-600" onClick={() => handleSave('completed')}>
            <CheckCircle className="w-4 h-4 mr-1" /> 完成录入
          </Button>
        </div>
      </div>

      {/* 选择栏 */}
      <div className="flex gap-3">
        <Select value={selectedProjectId} onValueChange={(v) => { setSelectedProjectId(v); setSelectedPatientId(''); setSelectedVisitId(''); setSelectedModuleId(''); setFormData({}) }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            {publishedProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.projectNo} · {p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedPatientId} onValueChange={(v) => { setSelectedPatientId(v); setSelectedVisitId(''); setSelectedModuleId(''); setFormData({}) }} disabled={!selectedProjectId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="选择患者" />
          </SelectTrigger>
          <SelectContent>
            {projectPatients.map((p) => <SelectItem key={p.id} value={p.id}>{p.screeningId} · {p.nameInitials}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={selectedVisitId} onValueChange={(v) => { setSelectedVisitId(v); setSelectedModuleId(''); setFormData({}) }} disabled={!selectedPatientId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="选择访视" />
          </SelectTrigger>
          <SelectContent>
            {project?.visits.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>) || []}
          </SelectContent>
        </Select>

        <Select value={selectedModuleId} onValueChange={(v) => { setSelectedModuleId(v); setFormData(existingData?.data || {}) }} disabled={!selectedVisitId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="选择模块" />
          </SelectTrigger>
          <SelectContent>
            {visit?.crfModuleIds.map((mid) => {
              const mod = project?.crfModules.find((m) => m.id === mid)
              return mod ? <SelectItem key={mid} value={mid}>{mod.name}</SelectItem> : null
            }) || []}
          </SelectContent>
        </Select>
      </div>

      {/* 录入表单 */}
      {module ? (
        <Card className="flex-1">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-slate-400" />
              <div>
                <CardTitle className="text-base">{patient?.screeningId} · {patient?.nameInitials}</CardTitle>
                <p className="text-xs text-slate-400">{visit?.name} · {module.name}</p>
              </div>
            </div>
            <Badge variant="outline" className={STATUS_COLORS[existingData?.status || 'not_started']}>
              {STATUS_LABELS[existingData?.status || 'not_started']}
            </Badge>
          </CardHeader>
          <CardContent>
            <CRFFormRenderer
              sections={[]}
              fields={module.fields}
              initialData={existingData?.data}
              onChange={(data) => setFormData(data)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-white rounded-lg border border-dashed border-slate-200">
          <div className="text-center">
            <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">请从上方选择项目、患者、访视和模块</p>
          </div>
        </div>
      )}
    </div>
  )
}
