import VisitsPage from '@/components/VisitsPage'

export default function ManagerVisits() {
  return (
    <VisitsPage
      actionLabel="查看患者"
      actionLink={(r) => `/manager/patients?projectNo=${r.projectNo}`}
    />
  )
}
