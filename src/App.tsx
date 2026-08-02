import { Routes, Route } from 'react-router'
import AdminLayout from './components/AdminLayout'
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

// 占位页面
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
      <Route element={<AdminLayout />}>
        <Route path="/" element={<AdminHome />} />
        <Route path="/projects" element={<ProjectList />} />
        <Route path="/projects/:projectId" element={<ProjectDetailLayout />}>
          <Route path="overview" element={<ProjectOverview />} />
          <Route path="crf" element={<ProjectCRFView />} />
          <Route path="patients" element={<ProjectPatients />} />
          <Route path="data" element={<ProjectDataMgmt />} />
          <Route path="stats" element={<ProjectStatistics />} />
        </Route>
        <Route path="/module-library" element={<ModuleLibraryPage />} />
        <Route path="/crf-designer" element={<CRFDesignerPage />} />
        <Route path="/progress" element={<Placeholder title="进度管理" />} />
        <Route path="/patients" element={<Placeholder title="患者管理" />} />
        <Route path="/data-mgmt" element={<Placeholder title="数据管理" />} />
        <Route path="/statistics" element={<Placeholder title="统计分析" />} />
        <Route path="/account" element={<Placeholder title="账户管理" />} />
      </Route>
    </Routes>
  )
}
