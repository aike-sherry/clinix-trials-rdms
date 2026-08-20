import VisitsPage from '@/components/VisitsPage'

export default function EntryVisits() {
  return (
    <VisitsPage
      actionLabel="去录入"
      actionLink={(r) => `/entry/patients/${r.patientId}`}
      variant="entry"
    />
  )
}
