import { useState } from 'react'
import type { User, UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { UserPlus, Trash2, ShieldCheck } from 'lucide-react'

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function now() {
  return new Date().toISOString()
}

export default function AdminAccount() {
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const raw = localStorage.getItem('clini_x_rdms_data')
      if (raw) return JSON.parse(raw).users || []
    } catch { /* ignore */ }
    return []
  })
  const [showDialog, setShowDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<Partial<User>>({ role: 'data_entry' })

  const saveUsers = (newUsers: User[]) => {
    setUsers(newUsers)
    const raw = localStorage.getItem('clini_x_rdms_data')
    const data = raw ? JSON.parse(raw) : {}
    data.users = newUsers
    localStorage.setItem('clini_x_rdms_data', JSON.stringify(data))
  }

  const handleSave = () => {
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
    saveUsers(next)
    setShowDialog(false)
    setEditingUser({ role: 'data_entry' })
  }

  const handleDelete = (id: string) => {
    if (!confirm('确定删除此用户？')) return
    saveUsers(users.filter((u) => u.id !== id))
  }

  const roleLabels: Record<UserRole, string> = {
    manager: '管理人员',
    admin: '后台管理',
    data_entry: '数据录入',
  }

  const roleColors: Record<UserRole, string> = {
    manager: 'bg-blue-50 text-blue-600 border-blue-200',
    admin: 'bg-teal-50 text-teal-600 border-teal-200',
    data_entry: 'bg-amber-50 text-amber-600 border-amber-200',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            账户管理
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">管理系统用户及权限分配</p>
        </div>
        <Button className="bg-teal-500 hover:bg-teal-600" onClick={() => { setEditingUser({ role: 'data_entry' }); setShowDialog(true) }}>
          <UserPlus className="w-4 h-4 mr-1" /> 新建用户
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">姓名</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">用户名</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">角色</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">部门</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">状态</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400">
                  暂无用户，点击上方按钮创建
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-700">{user.name}</td>
                <td className="px-4 py-3 text-slate-500">{user.username}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={roleColors[user.role]}>
                    {roleLabels[user.role]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">{user.department || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${user.isActive ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                    {user.isActive ? '正常' : '停用'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-red-500" onClick={() => handleDelete(user.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">姓名 <span className="text-red-500">*</span></Label>
              <Input placeholder="如：张三" value={editingUser.name || ''} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">用户名 <span className="text-red-500">*</span></Label>
              <Input placeholder="如：zhangsan" value={editingUser.username || ''} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} />
            </div>
            <div>
              <Label className="text-sm">角色 <span className="text-red-500">*</span></Label>
              <Select value={editingUser.role || 'data_entry'} onValueChange={(v) => setEditingUser({ ...editingUser, role: v as UserRole })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">管理人员</SelectItem>
                  <SelectItem value="admin">后台管理</SelectItem>
                  <SelectItem value="data_entry">数据录入</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">部门</Label>
              <Input placeholder="如：临床研究部" value={editingUser.department || ''} onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button className="bg-teal-500 hover:bg-teal-600" onClick={handleSave} disabled={!editingUser.name || !editingUser.username}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
