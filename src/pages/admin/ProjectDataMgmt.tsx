import { useParams } from 'react-router'
import { useAppStorage } from '@/hooks/useAppStorage'

export default function ProjectDataMgmt() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects, patients, visitData } = useAppStorage()

  const project = projects.find((p) => p.id === projectId)
  if (!project) return <div>项目不存在</div>

  const projectPatients = patients.filter((p) => p.projectId === projectId)
  const sortedVisits = [...project.visits].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-700">数据管理</h3>
      <div className="bg-white rounded-lg border border-slate-200 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-medium sticky left-0 bg-slate-50 z-10">患者编号</th>
              {sortedVisits.map((v) => (
                <th key={v.id} className="text-center px-3 py-3 font-medium border-l border-slate-100" colSpan={v.crfModuleIds.length || 1}>
                  {v.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projectPatients.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium sticky left-0 bg-white z-10">{p.screeningId}</td>
                {sortedVisits.map((v) =>
                  v.crfModuleIds.length === 0 ? (
                    <td key={v.id} className="px-3 py-3 text-center border-l border-slate-100 text-slate-300">-</td>
                  ) : (
                    v.crfModuleIds.map((mid) => {
                      const mod = project.crfModules.find((m) => m.id === mid)
                      const vd = visitData.find((d) => d.patientId === p.id && d.visitId === v.id && d.moduleId === mid)
                      return (
                        <td key={`${v.id}-${mid}`} className="px-3 py-3 text-center border-l border-slate-100">
                          <div className="flex items-center gap-1 justify-center">
                            <div className={`w-3 h-3 rounded-sm ${vd?.status === 'completed' ? 'bg-teal-500' : vd?.status === 'in_progress' ? 'bg-amber-400' : 'bg-slate-200'}`} />
                            <span className="text-xs text-slate-500">{mod?.name?.slice(0, 4)}</span>
                          </div>
                        </td>
                      )
                    })
                  )
                )}
              </tr>
            ))}
            {projectPatients.length === 0 && (
              <tr><td colSpan={sortedVisits.length + 1} className="text-center py-10 text-slate-400">暂无患者数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
