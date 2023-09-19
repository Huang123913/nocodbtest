import { OrgUserRoles, ProjectRoles } from 'nocodb-sdk'

export const NOCO = 'noco'

export const SYSTEM_COLUMNS = ['id', 'title', 'created_at', 'updated_at']

export const EMPTY_TITLE_PLACEHOLDER_DOCS = 'Untitled'

export const BASE_FALLBACK_URL = process.env.NODE_ENV === 'production' ? '..' : 'http://localhost:8080'

export const GROUP_BY_VARS = {
  NULL: '__nc_null__',
  TRUE: '__nc_true__',
  FALSE: '__nc_false__',
  VAR_TITLES: {
    __nc_null__: 'Empty',
    __nc_true__: 'Checked',
    __nc_false__: 'Unchecked',
  } as Record<string, string>,
}

const roleScopes = {
  org: [OrgUserRoles.VIEWER, OrgUserRoles.CREATOR],
  project: [ProjectRoles.VIEWER, ProjectRoles.COMMENTER, ProjectRoles.EDITOR, ProjectRoles.CREATOR, ProjectRoles.OWNER],
}

interface Perm {
  include?: Record<string, boolean>
}

/**
 * Each permission value means the following
 * `*` - which is wildcard, means all permissions are allowed
 *  `include` - which is an object, means only the permissions listed in the object are allowed
 *  `undefined` or `{}` - which is the default value, means no permissions are allowed
 * */
const rolePermissions = {
  // org level role permissions
  [OrgUserRoles.SUPER_ADMIN]: '*',
  [OrgUserRoles.CREATOR]: {
    include: {
      projectCreate: true,
      projectMove: true,
      projectDelete: true,
      projectDuplicate: true,
      newUser: true,
    },
  },
  [OrgUserRoles.VIEWER]: {
    include: {
      importRequest: true,
    },
  },

  // Project role permissions
  [ProjectRoles.OWNER]: {
    include: {
      projectDelete: true,
    },
  },
  [ProjectRoles.CREATOR]: {
    include: {
      baseCreate: true,
      fieldUpdate: true,
      hookList: true,
      tableCreate: true,
      tableRename: true,
      tableDelete: true,
      tableDuplicate: true,
      tableSort: true,
      layoutRename: true,
      layoutDelete: true,
      airtableImport: true,
      jsonImport: true,
      excelImport: true,
      settingsPage: true,
      newUser: true,
      webhook: true,
      fieldEdit: true,
      fieldAdd: true,
      tableIconEdit: true,
      viewCreateOrEdit: true,
      viewShare: true,
      projectShare: true,
    },
  },
  [ProjectRoles.EDITOR]: {
    include: {
      dataInsert: true,
      dataEdit: true,
      sortSync: true,
      filterSync: true,
      filterChildrenRead: true,
      viewFieldEdit: true,
      csvImport: true,
      apiDocs: true,
    },
  },
  [ProjectRoles.COMMENTER]: {
    include: {
      commentEdit: true,
      commentList: true,
      commentCount: true,
    },
  },
  [ProjectRoles.VIEWER]: {
    include: {
      projectSettings: true,
      expandedForm: true,
    },
  },
  [ProjectRoles.NO_ACCESS]: {
    include: {},
  },
} as Record<OrgUserRoles | ProjectRoles, Perm | '*'>

/*
  We inherit include permissions from previous roles in the same scope (role order)
  To determine role order, we use `roleScopes` object

  So for example ProjectRoles.COMMENTER has `commentEdit` permission,
    which means ProjectRoles.EDITOR, ProjectRoles.CREATOR, ProjectRoles.OWNER will also have `commentEdit` permission
    where as ProjectRoles.VIEWER, ProjectRoles.NO_ACCESS will not have `commentEdit` permission.

  This is why we are validating that there are no duplicate permissions within the same scope
    even though it is not required for the code to work. It is to keep the code clean and easy to understand.
*/

// validate no duplicate permissions within same scope
Object.values(roleScopes).forEach((roles) => {
  const scopePermissions: Record<string, boolean> = {}
  const duplicates: string[] = []
  roles.forEach((role) => {
    const perms = (rolePermissions[role] as Perm).include || {}
    Object.keys(perms).forEach((perm) => {
      if (scopePermissions[perm]) {
        duplicates.push(perm)
      }
      scopePermissions[perm] = true
    })
  })
  if (duplicates.length) {
    throw new Error(
      `Duplicate permissions found in roles ${roles.join(', ')}. Please remove duplicate permissions: ${duplicates.join(', ')}`,
    )
  }
})

// inherit include permissions within scope (role order)
Object.values(roleScopes).forEach((roles) => {
  let roleIndex = 0
  for (const role of roles) {
    if (roleIndex === 0) {
      roleIndex++
      continue
    }

    if (rolePermissions[role] === '*') continue
    if ((rolePermissions[role] as Perm).include && (rolePermissions[roles[roleIndex - 1]] as Perm).include) {
      Object.assign((rolePermissions[role] as Perm).include!, (rolePermissions[roles[roleIndex - 1]] as Perm).include)
    }

    roleIndex++
  }
})

export { rolePermissions }
