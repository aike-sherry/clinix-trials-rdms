import { useParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { ProjectPermission } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Trash2, ShieldCheck, UserCheck } from 'lucide-react'
import { useState } from 'react'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function now() {
  return new Date().toISOString()
}

export default function ProjectAccount() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, users } = useAppStorage()

  const project = projects.find((p) => p.id === projectId)
  if (!project) return <div>项目不存在</div>

  // 从 localStorage 读取权限数据
  const [permissions, setPermissions] = useState<ProjectPermission[]>(() => {
    try {
      const raw = localStorage.getItem('clini_x_rdms_data')
      if (raw) return JSON.parse(raw).projectPermissions || []
    } catch { /* ignore */ }
    return []
  })

  const [showPermDialog, setShowPermDialog] = useState(false)
  const [editingPerm, setEditingPerm] = useState<Partial<ProjectPermission>>({
    canCreatePatient: true,
    canEditData: true,
    canViewData: true,
  })

  // 当前项目的权限
  const projectPermissions = permissions.filter((p) => p.projectId === projectId)
  const dataEntryUsers = users.filter((u) => u.role === 'data_entry')

  const saveAllPerms = (newPerms: ProjectPermission[]) => {
    const raw = localStorage.getItem('clini_x_rdms_data')
    const data = raw ? JSON.parse(raw) : {}
    setPermissions(newPerms)
    data.projectPermissions = newPerms
    localStorage.setItem('clini_x_rdms_data', JSON.stringify(data))
  }

  const handleSavePermission = () => {
    if (!editingPerm.userId) return
    const newPerm: ProjectPermission = {
      id: editingPerm.id || genId(),
      projectId: projectId!,
      userId: editingPerm.userId,
      grantedBy: 'manager',
      grantedAt: now(),
      canCreatePatient: editingPerm.canCreatePatient ?? true,
      canEditData: editingPerm.canEditData ?? true,
      canViewData: editingPerm.canViewData ?? true,
    }
    const exists = permissions.find((p) => p.id === newPerm.id)
    const next = exists
      ? permissions.map((p) => (p.id === newPerm.id ? newPerm : p))
      : [...permissions, newPerm]
    saveAllPerms(next)
    setShowPermDialog(false)
    setEditingPerm({ canCreatePatient: true, canEditData: true, canViewData: true })
  }

  const handleDeletePermission = (id: string) => {
    if (!confirm('确定取消此授权？')) return
    saveAllPerms(permissions.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            项目权限管理
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">管理该项目的录入人员权限</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setEditingPerm({ canCreatePatient: true, canEditData: true, canViewData: true })
            setShowPermDialog(true)
          }}
        >
          <UserCheck className="w-4 h-4 mr-1" /> 分配权限
        </Button>
      </div>

      {/* 已授权用户列表 */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-medium text-sm text-slate-700">
          已授权录入人员
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-slate-500">姓名</th>
              <th className="text-left px-4 py-2 font-medium text-slate-500">用户名</th>
              <th className="text-left px-4 py-2 font-medium text-slate-500">权限</th>
              <th className="text-left px-4 py-2 font-medium text-slate-500">授权时间</th>
              <th className="text-right px-4 py-2 font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {projectPermissions.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400">
                  暂无授权记录，点击上方按钮分配权限
                </td>
              </tr>
            )}
            {projectPermissions.map((perm) => {
              const user = users.find((u) => u.id === perm.userId)
              return (
                <tr key={perm.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-2 font-medium text-slate-700">{user?.name || '未知用户'}</td>
                  <td className="px-4 py-2 text-slate-500">{user?.username || '-'}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {perm.canCreatePatient && (
                        <Badge variant="outline" className="text-[10px] h-5">创建患者</Badge>
                      )}
                      {perm.canEditData && (
                        <Badge variant="outline" className="text-[10px] h-5">编辑数据</Badge>
                      )}
                      {perm.canViewData && (
                        <Badge variant="outline" className="text-[10px] h-5">查看数据</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs">
                    {new Date(perm.grantedAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-slate-400 hover:text-red-500"
                      onClick={() => handleDeletePermission(perm.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 分配权限弹窗 */}
      <Dialog open={showPermDialog} onOpenChange={setShowPermDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>分配项目权限</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">选择用户 <span className="text-red-500">*</span></Label>
              <Select
                value={editingPerm.userId || ''}
                onValueChange={(v) => setEditingPerm({ ...editingPerm, userId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择数据录入人员" />
                </SelectTrigger>
                <SelectContent>
                  {dataEntryUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">权限设置</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="perm1"
                  checked={editingPerm.canCreatePatient}
                  onCheckedChange={(v) =>
                    setEditingPerm({ ...editingPerm, canCreatePatient: !!v })
                  }
                />
                <label htmlFor="perm1" className="text-sm">创建患者</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="perm2"
                  checked={editingPerm.canEditData}
                  onCheckedChange={(v) =>
                    setEditingPerm({ ...editingPerm, canEditData: !!v })
                  }
                />
                <label htmlFor="perm2" className="text-sm">编辑数据</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="perm3"
                  checked={editingPerm.canViewData}
                  onCheckedChange={(v) =>
                    setEditingPerm({ ...editingPerm, canViewData: !!v })
                  }
                />
                <label htmlFor="perm3" className="text-sm">查看数据</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermDialog(false)}>
              取消
            </Button>
            <Button
              className="bg-blue-500 hover:bg-blue-600"
              onClick={handleSavePermission}
              disabled={!editingPerm.userId}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
