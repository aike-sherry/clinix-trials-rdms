import { Routes, Route, Navigate } from 'react-router'
import LoginPage from './pages/Login'
import AuthGuard from './components/AuthGuard'
import ManagerLayout from './components/ManagerLayout'
import AdminLayout from './components/AdminLayout'
import EntryLayout from './components/EntryLayout'

// Manager pages
import ManagerHome from './pages/manager/Home'
import ManagerProjectList from './pages/manager/ProjectList'
import ManagerProjectDetailLayout from './pages/manager/ProjectDetailLayout'
import ManagerProjectOverview from './pages/manager/ProjectOverview'
import ManagerProjectProgress from './pages/manager/ProjectProgress'
import ManagerProjectPatients from './pages/manager/ProjectPatients'
import ManagerProjectDataMgmt from './pages/manager/ProjectDataMgmt'
import ManagerProjectStatistics from './pages/manager/ProjectStatistics'
import ManagerProjectAccount from './pages/manager/ProjectAccount'
import ManagerProgress from './pages/manager/Progress'

import ManagerPatients from './pages/manager/Patients'
import ManagerAccount from './pages/manager/Account'
import ManagerDataManagement from './pages/manager/DataManagement'

// Admin pages (reuse existing admin pages)
import AdminHome from './pages/admin/Home'
import ProjectList from './pages/admin/ProjectList'
import ProjectDetailLayout from './pages/admin/ProjectDetailLayout'
import ProjectOverview from './pages/admin/ProjectOverview'
import ProjectCRFView from './pages/admin/ProjectCRFView'
import ProjectPatients from './pages/admin/ProjectPatients'
import ProjectDataMgmt from './pages/admin/ProjectDataMgmt'
import ProjectStatistics from './pages/admin/ProjectStatistics'
import CRFDesignerPage from './pages/admin/CRFDesignerPage'
import ModuleLibraryPage from './pages/admin/ModuleLibraryPage'
import AdminAccount from './pages/admin/Account'

// Entry pages
import EntryHome from './pages/entry/Home'
import EntryPatients from './pages/entry/Patients'
import EntryDataEntry from './pages/entry/DataEntry'
import EntryMyData from './pages/entry/MyData'
import EntryProgress from './pages/entry/Progress'

function Placeholder({ title }: { title: string }) {
  return (
    <div className="text-center py-20">
      <h2 className="text-xl font-semibold text-slate-700">{title}</h2>
      <p className="text-slate-400 mt-2">功能开发中...</p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* 登录页 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* ========== 管理人员端 ========== */}
      <Route element={<AuthGuard allowedRole="manager" />}>
        <Route element={<ManagerLayout />}>
          <Route path="/manager" element={<ManagerHome />} />
          <Route path="/manager/projects" element={<ManagerProjectList />} />
          <Route path="/manager/projects/:projectId" element={<ManagerProjectDetailLayout />}>
            <Route path="overview" element={<ManagerProjectOverview />} />
            <Route path="progress" element={<ManagerProjectProgress />} />
            <Route path="patients" element={<ManagerProjectPatients />} />
            <Route path="data" element={<ManagerProjectDataMgmt />} />
            <Route path="stats" element={<ManagerProjectStatistics />} />
            <Route path="account" element={<ManagerProjectAccount />} />
          </Route>
          <Route path="/manager/progress" element={<ManagerProgress />} />
          <Route path="/manager/patients" element={<ManagerPatients />} />
          <Route path="/manager/data" element={<ManagerDataManagement />} />
          <Route path="/manager/statistics" element={<Placeholder title="统计分析" />} />
          <Route path="/manager/account" element={<ManagerAccount />} />
        </Route>
      </Route>

      {/* ========== 后台管理端 ========== */}
      <Route element={<AuthGuard allowedRole="admin" />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/projects" element={<ProjectList />} />
          <Route path="/admin/projects/:projectId" element={<ProjectDetailLayout />}>
            <Route path="overview" element={<ProjectOverview />} />
            <Route path="crf" element={<ProjectCRFView />} />
            <Route path="patients" element={<ProjectPatients />} />
            <Route path="data" element={<ProjectDataMgmt />} />
            <Route path="stats" element={<ProjectStatistics />} />
          </Route>
          <Route path="/admin/module-library" element={<ModuleLibraryPage />} />
          <Route path="/admin/crf-designer" element={<CRFDesignerPage />} />
          <Route path="/admin/data-mgmt" element={<ProjectDataMgmt />} />
          <Route path="/admin/account" element={<AdminAccount />} />
        </Route>
      </Route>

      {/* ========== 数据录入端 ========== */}
      <Route element={<AuthGuard allowedRole="data_entry" />}>
        <Route element={<EntryLayout />}>
          <Route path="/entry" element={<EntryHome />} />
          <Route path="/entry/patients" element={<EntryPatients />} />
          <Route path="/entry/data-entry" element={<EntryDataEntry />} />
          <Route path="/entry/my-data" element={<EntryMyData />} />
          <Route path="/entry/progress" element={<EntryProgress />} />
        </Route>
      </Route>
    </Routes>
  )
}
