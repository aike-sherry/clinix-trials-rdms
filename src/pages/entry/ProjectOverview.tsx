import ProjectOverview from '../manager/ProjectOverview'

/**
 * 录入端项目概况：复用管理端同一页面，保持两端完全一致；
 * 录入人员仅查看（readOnly），不显示基本信息更新与研究中心编辑入口。
 */
export default function EntryProjectOverview() {
  return <ProjectOverview readOnly />
}
