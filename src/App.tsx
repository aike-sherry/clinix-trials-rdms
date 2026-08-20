import { Routes, Route, Navigate } from 'react-router'
import LoginPage from './pages/Login'
import ChangePasswordPage from './pages/ChangePassword'
import AuthGuard from './components/AuthGuard'
import ManagerLayout from './components/ManagerLayout'
import AdminLayout from './components/AdminLayout'
import EntryLayout from './components/EntryLayout'

// Manager pages
import ManagerHome from './pages/manager/Home'
import ManagerProjectList from './pages/manager/ProjectList'
import ManagerProjectDetailLayout from './pages/manager/ProjectDetailLayout'
import ManagerProjectOverview from './pages/manager/ProjectOverview'
import ManagerProgress from './pages/manager/Progress'

import ManagerPatients from './pages/manager/Patients'
import ManagerVisits from './pages/manager/Visits'
import ManagerAccount from './pages/manager/Account'
import ManagerDataManagement from './pages/manager/DataManagement'
import ManagerDataReview from './pages/manager/DataReview'
import ManagerQueries from './pages/manager/Queries'
import ManagerPatientDataPrint from './pages/manager/PatientDataPrint'

// Admin pages (reuse existing admin pages)
import AdminHome from './pages/admin/Home'
import ProjectList from './pages/admin/ProjectList'
import ProjectDetailLayout from './pages/admin/ProjectDetailLayout'
import ProjectOverview from './pages/admin/ProjectOverview'
import ProjectCRFView from './pages/admin/ProjectCRFView'
import ProjectModules from './pages/admin/ProjectModules'
import AdminProjectAccount from './pages/admin/ProjectAccount'
import Customers from './pages/admin/Customers'
import CRFDesignerPage from './pages/admin/CRFDesignerPage'
import ModuleLibraryPage from './pages/admin/ModuleLibraryPage'
import DataIntegration from './pages/admin/DataIntegration'
import AdminAccount from './pages/admin/Account'
import AuditTrail from './pages/admin/AuditTrail'

// Entry pages
import EntryHome from './pages/entry/Home'
import EntryPatients from './pages/entry/Patients'
import EntryDataEntry from './pages/entry/DataEntry'
import EntryMyData from './pages/entry/MyData'
import EntryProjects from './pages/entry/Projects'
import EntryProjectDetailLayout from './pages/entry/ProjectDetailLayout'
import EntryProjectOverview from './pages/entry/ProjectOverview'
import EntrySubjectRegister from './pages/entry/SubjectRegister'
import EntryPatientDetail from './pages/entry/PatientDetail'
import EntryVisits from './pages/entry/Visits'
import EntryDataMgmt from './pages/entry/DataMgmt'
import EntryQueries from './pages/entry/Queries'
import ReviewList from './pages/review/ReviewList'
import ReviewDetail from './pages/review/ReviewDetail'

export default function App() {
  return (
    <Routes>
      {/* 统一登录页：一个账号+密码表单，系统按账号自动识别角色并跳转 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* ========== 管理人员端 ========== */}
      <Route element={<AuthGuard allowedRole="manager" />}>
        {/* 患者数据档案打印页（独立于管理端布局，用于导出 PDF） */}
        <Route path="/manager/patient-print/:patientId" element={<ManagerPatientDataPrint />} />
        <Route element={<ManagerLayout />}>
          <Route path="/manager" element={<ManagerHome />} />
          <Route path="/manager/projects" element={<ManagerProjectList />} />
          <Route path="/manager/projects/:projectId" element={<ManagerProjectDetailLayout />}>
            <Route index element={<ManagerProjectOverview />} />
            <Route path="overview" element={<ManagerProjectOverview />} />
            <Route path="progress" element={<ManagerProgress />} />
            <Route path="patients" element={<ManagerPatients />} />
            <Route path="visits" element={<ManagerVisits />} />
            <Route path="statistics" element={<ManagerDataReview />} />
            <Route path="review" element={<ReviewList />} />
            <Route path="queries" element={<ManagerQueries />} />
            <Route path="data" element={<ManagerDataManagement />} />
            <Route path="account" element={<ManagerAccount />} />
          </Route>
          <Route path="/manager/progress" element={<ManagerProgress />} />
          <Route path="/manager/patients" element={<ManagerPatients />} />
          <Route path="/manager/visits" element={<ManagerVisits />} />
          <Route path="/manager/data" element={<ManagerDataManagement />} />
          <Route path="/manager/statistics" element={<ManagerDataReview />} />
          <Route path="/manager/queries" element={<ManagerQueries />} />
          <Route path="/manager/review" element={<ReviewList />} />
          <Route path="/manager/review/:patientId" element={<ReviewDetail />} />
          <Route path="/manager/integration" element={<DataIntegration />} />
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
            <Route path="modules" element={<ProjectModules />} />
            <Route path="crf" element={<ProjectCRFView />} />
            <Route path="account" element={<AdminProjectAccount />} />
          </Route>
          <Route path="/admin/module-library" element={<ModuleLibraryPage />} />
          <Route path="/admin/crf-designer" element={<CRFDesignerPage />} />
          <Route path="/admin/customers" element={<Customers />} />
          <Route path="/admin/audit" element={<AuditTrail />} />
          <Route path="/admin/account" element={<AdminAccount />} />
        </Route>
      </Route>

      {/* ========== 数据录入端 ========== */}
      <Route element={<AuthGuard allowedRole="data_entry" />}>
        <Route element={<EntryLayout />}>
          <Route path="/entry" element={<EntryHome />} />
          <Route path="/entry/projects" element={<EntryProjects />} />
          <Route path="/entry/projects/:projectId" element={<EntryProjectDetailLayout />}>
            <Route index element={<EntryProjectOverview />} />
            <Route path="overview" element={<EntryProjectOverview />} />
            <Route path="subjects" element={<EntrySubjectRegister />} />
            <Route path="patients" element={<EntryPatients />} />
            <Route path="visits" element={<EntryVisits />} />
            <Route path="data-entry" element={<EntryDataEntry />} />
            <Route path="data-mgmt" element={<EntryDataMgmt />} />
            <Route path="queries" element={<EntryQueries />} />
            <Route path="my-data" element={<EntryMyData />} />
          </Route>
          <Route path="/entry/subjects" element={<EntrySubjectRegister />} />
          <Route path="/entry/patients" element={<EntryPatients />} />
          <Route path="/entry/patients/:patientId" element={<EntryPatientDetail />} />
          <Route path="/entry/data-entry" element={<EntryDataEntry />} />
          <Route path="/entry/visits" element={<EntryVisits />} />
          <Route path="/entry/my-data" element={<EntryMyData />} />
          <Route path="/entry/data-mgmt" element={<EntryDataMgmt />} />
          <Route path="/entry/queries" element={<EntryQueries />} />
        </Route>
      </Route>
    </Routes>
  )
}
