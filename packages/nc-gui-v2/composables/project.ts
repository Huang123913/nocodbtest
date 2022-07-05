import type { TableType } from 'nocodb-sdk'
import { useNuxtApp } from '#app'

export const useProject = () => {
  const { $api } = useNuxtApp()

  const project = useState<{ id?: string; title?: string }>('project')
  const tables = useState<TableType[]>('tables')

  const loadTables = async () => {
    if (project.value.id) {
      const tablesResponse = await $api.dbTable.list(project.value.id)

      if (tablesResponse.list) tables.value = tablesResponse.list
    }
  }

  const loadProject = async (projectId: string) => {
    project.value = await $api.project.read(projectId)
  }

  return { project, tables, loadProject, loadTables }
}
