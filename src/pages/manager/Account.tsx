import { useState } from 'react'
import { useAppStorage } from '@/hooks/useAppStorage'
import type { User, UserRole, ProjectPermission } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { UserPlus, Trash2, ShieldCheck, UserCheck } from 'lucide-react'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function now() {
  return new Date().toISOString()
}

export default function ManagerAccount() {
  const { projects } = useAppStorage()
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const raw = localStorage.getItem('clini_x_rdms_data')
      if (raw) return JSON.parse(raw).users || []
    } catch { /* ignore */ }
    return []
  })
  const [permissions, setPermissions] = useState<ProjectPermission[]>(() => {
    try {
      const raw = localStorage.getItem('clini_x_rdms_data')
      if (raw) return JSON.parse(raw).projectPermissions || []
    } catch { /* ignore */ }
    return []
  })

  const [showUserDialog, setShowUserDialog] = useState(false)
  const [showPermDialog, setShowPermDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<Partial<User>>({ role: 'data_entry' })
  const [editingPerm, setEditingPerm] = useState<Partial<ProjectPermission>>({ canCreatePatient: true, canEditData: true, canViewData: true })

  const saveAll = (newUsers?: User[], newPerms?: ProjectPermission[]) => {
    const raw = localStorage.getItem('clini_x_rdms_data')
    const data = raw ? JSON.parse(raw) : {}
    if (newUsers) {
      setUsers(newUsers)
      data.users = newUsers
    }
    if (newPerms) {
      setPermissions(newPerms)
      data.projectPermissions = newPerms
    }
    localStorage.setItem('clini_x_rdms_data', JSON.stringify(data))
  }

  const handleSaveUser = () => {
    if (!editingUser.name || !editingUser.username) return
    const newUser: User = {
      id: editingUser.id || genId(),
      username: editingUser.username,
      name: editingUser.name,
      role: (editingUser.role as UserRole) || 'data_entry',
      email: editingUser.email,
      phone: editingUser.phone,
      department: editingUser.department,
      createdAt: editingUser.createdAt || now(),
      updatedAt: now(),
      isActive: true,
    }
    const exists = users.find((u) => u.id === newUser.id)
    const next = exists ? users.map((u) => (u.id === newUser.id ? newUser : u)) : [...users, newUser]
    saveAll(next)
    setShowUserDialog(false)
    setEditingUser({ role: 'data_entry' })
  }

  const handleDeleteUser = (id: string) => {
    if (!confirm('确定删除此用户？')) return
    saveAll(users.filter((u) => u.id !== id))
  }

  const handleSavePermission = () => {
    if (!editingPerm.projectId || !editingPerm.userId) return
    const newPerm: ProjectPermission = {
      id: editingPerm.id || genId(),
      projectId: editingPerm.projectId,
      userId: editingPerm.userId,
      grantedBy: 'manager',
      grantedAt: now(),
      canCreatePatient: editingPerm.canCreatePatient ?? true,
      canEditData: editingPerm.canEditData ?? true,
      canViewData: editingPerm.canViewData ?? true,
    }
    const exists = permissions.find((p) => p.id === newPerm.id)
    const next = exists ? permissions.map((p) => (p.id === newPerm.id ? newPerm : p)) : [...permissions, newPerm]
    saveAll(undefined, next)
    setShowPermDialog(false)
    setEditingPerm({ canCreatePatient: true, canEditData: true, canViewData: true })
  }

  const handleDeletePermission = (id: string) => {
    if (!confirm('确定取消此授权？')) return
    saveAll(undefined, permissions.filter((p) => p.id !== id))
  }

  const dataEntryUsers = users.filter((u) => u.role === 'data_entry')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            账户管理
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">管理数据录入人员并分配项目权限</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditingPerm({ canCreatePatient: true, canEditData: true, canViewData: true }); setShowPermDialog(true) }}>
            <UserCheck className="w-4 h-4 mr-1" /> 分配权限
          </Button>
          <Button className="bg-blue-500 hover:bg-blue-600" onClick={() => { setEditingUser({ role: 'data_entry' }); setShowUserDialog(true) }}>
            <UserPlus className="w-4 h-4 mr-1" /> 新建用户
          </Button>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-medium text-sm text-slate-700">系统用户</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-slate-500">姓名</th>
              <th className="text-left px-4 py-2 font-medium text-slate-500">用户名</th>
              <th className="text-left px-4 py-2 font-medium text-slate-500">角色</th>
              <th className="text-left px-4 py-2 font-medium text-slate-500">部门</th>
              <th className="text-right px-4 py-2 font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">暂无用户</td></tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-2 font-medium text-slate-700">{user.name}</td>
                <td className="px-4 py-2 text-slate-500">{user.username}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline" className={user.role === 'manager' ? 'bg-blue-50 text-blue-600' : user.role === 'admin' ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'}>
                    {user.role === 'manager' ? '管理人员' : user.role === 'admin' ? '后台管理' : '数据录入'}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-slate-500">{user.department || '-'}</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-red-500" onClick={() => handleDeleteUser(user.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 权限分配列表 */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-medium text-sm text-slate-700">项目权限分配</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-slate-500">项目</th>
              <th className="text-left px-4 py-2 font-medium text-slate-500">授权用户</th>
              <th className="text-left px-4 py-2 font-medium text-slate-500">权限</th>
              <th className="text-right px-4 py-2 font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {permissions.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">暂无权限分配</td></tr>
            )}
            {permissions.map((perm) => {
              const project = projects.find((p) => p.id === perm.projectId)
              const user = users.find((u) => u.id === perm.userId)
              return (
                <tr key={perm.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-2 font-medium text-slate-700">{project?.name || '未知项目'}</td>
                  <td className="px-4 py-2 text-slate-500">{user?.name || '未知用户'}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {perm.canCreatePatient && <Badge variant="outline" className="text-[10px] h-5">创建患者</Badge>}
                      {perm.canEditData && <Badge variant="outline" className="text-[10px] h-5">编辑数据</Badge>}
                      {perm.canViewData && <Badge variant="outline" className="text-[10px] h-5">查看数据</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-red-500" onClick={() => handleDeletePermission(perm.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 新建用户弹窗 */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新建用户</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="text-sm">姓名 <span className="text-red-500">*</span></Label><Input placeholder="如：张三" value={editingUser.name || ''} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} /></div>
            <div><Label className="text-sm">用户名 <span className="text-red-500">*</span></Label><Input placeholder="如：zhangsan" value={editingUser.username || ''} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} /></div>
            <div><Label className="text-sm">角色 <span className="text-red-500">*</span></Label>
              <Select value={editingUser.role || 'data_entry'} onValueChange={(v) => setEditingUser({ ...editingUser, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">管理人员</SelectItem>
                  <SelectItem value="admin">后台管理</SelectItem>
                  <SelectItem value="data_entry">数据录入</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-sm">部门</Label><Input placeholder="如：临床研究部" value={editingUser.department || ''} onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>取消</Button>
            <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleSaveUser} disabled={!editingUser.name || !editingUser.username}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分配权限弹窗 */}
      <Dialog open={showPermDialog} onOpenChange={setShowPermDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>分配项目权限</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="text-sm">选择项目 <span className="text-red-500">*</span></Label>
              <Select value={editingPerm.projectId || ''} onValueChange={(v) => setEditingPerm({ ...editingPerm, projectId: v })}>
                <SelectTrigger><SelectValue placeholder="选择项目" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.projectNo} · {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-sm">选择用户 <span className="text-red-500">*</span></Label>
              <Select value={editingPerm.userId || ''} onValueChange={(v) => setEditingPerm({ ...editingPerm, userId: v })}>
                <SelectTrigger><SelectValue placeholder="选择用户" /></SelectTrigger>
                <SelectContent>
                  {dataEntryUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.username})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">权限设置</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="perm1" checked={editingPerm.canCreatePatient} onCheckedChange={(v) => setEditingPerm({ ...editingPerm, canCreatePatient: !!v })} />
                <label htmlFor="perm1" className="text-sm">创建患者</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="perm2" checked={editingPerm.canEditData} onCheckedChange={(v) => setEditingPerm({ ...editingPerm, canEditData: !!v })} />
                <label htmlFor="perm2" className="text-sm">编辑数据</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="perm3" checked={editingPerm.canViewData} onCheckedChange={(v) => setEditingPerm({ ...editingPerm, canViewData: !!v })} />
                <label htmlFor="perm3" className="text-sm">查看数据</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermDialog(false)}>取消</Button>
            <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleSavePermission} disabled={!editingPerm.projectId || !editingPerm.userId}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
