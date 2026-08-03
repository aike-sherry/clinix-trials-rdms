import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  UserCog, ShieldCheck, ClipboardList, FlaskConical
} from 'lucide-react'
import type { UserRole } from '@/types'

const ROLES: { role: UserRole; label: string; desc: string; icon: React.ReactNode; color: string; path: string }[] = [
  {
    role: 'manager',
    label: '管理人员',
    desc: '创建项目、分配权限、查看进度',
    icon: <UserCog className="w-8 h-8" />,
    color: 'from-blue-500 to-blue-600',
    path: '/manager',
  },
  {
    role: 'admin',
    label: '后台管理',
    desc: 'CRF设计、模块库管理、数据发布',
    icon: <ShieldCheck className="w-8 h-8" />,
    color: 'from-teal-500 to-teal-600',
    path: '/admin',
  },
  {
    role: 'data_entry',
    label: '数据录入',
    desc: '患者登记、访视数据录入',
    icon: <ClipboardList className="w-8 h-8" />,
    color: 'from-amber-500 to-amber-600',
    path: '/entry',
  },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)

  const handleLogin = (role: UserRole, path: string) => {
    // 模拟登录：存储当前用户到 localStorage
    const user = {
      id: `user_${role}_${Date.now()}`,
      username: role,
      name: role === 'manager' ? '管理用户' : role === 'admin' ? '后台管理员' : '录入员',
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    }
    const storageKey = 'clini_x_rdms_data'
    const raw = localStorage.getItem(storageKey)
    const data = raw ? JSON.parse(raw) : {}
    data.currentUser = user
    localStorage.setItem(storageKey, JSON.stringify(data))
    navigate(path)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <FlaskConical className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">科研数据管理平台</h1>
          <p className="text-slate-400 mt-1">CLINI X TRIALS - RDMS</p>
        </div>

        {/* 角色选择 */}
        <div className="grid grid-cols-3 gap-4">
          {ROLES.map((r) => (
            <Card
              key={r.role}
              className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
                selectedRole === r.role ? 'border-teal-500 ring-2 ring-teal-100' : 'border-transparent hover:border-slate-200'
              }`}
              onClick={() => setSelectedRole(r.role)}
            >
              <CardContent className="p-6 text-center">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${r.color} flex items-center justify-center text-white mx-auto mb-3`}>
                  {r.icon}
                </div>
                <h3 className="font-semibold text-slate-800 mb-1">{r.label}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{r.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 登录按钮 */}
        <div className="mt-6 text-center">
          <Button
            size="lg"
            className="bg-teal-500 hover:bg-teal-600 px-12"
            disabled={!selectedRole}
            onClick={() => {
              const role = ROLES.find((r) => r.role === selectedRole)
              if (role) handleLogin(role.role, role.path)
            }}
          >
            进入系统
          </Button>
        </div>

        <p className="text-center text-xs text-slate-300 mt-6">
          演示环境 · 点击角色即可进入对应系统
        </p>
      </div>
    </div>
  )
}
