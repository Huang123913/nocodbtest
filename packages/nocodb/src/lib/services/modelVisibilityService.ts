import { VisibilityRuleReqType } from 'nocodb-sdk';
import { NcError } from '../meta/helpers/catchError';
import Model from '../models/Model';
import ModelRoleVisibility from '../models/ModelRoleVisibility';
import { Tele } from 'nc-help';

export async function xcVisibilityMetaSetAll(param: {
  visibilityRule: VisibilityRuleReqType;
  projectId: string;
}) {
  Tele.emit('evt', { evt_type: 'uiAcl:updated' });
  for (const d of param.visibilityRule) {
    for (const role of Object.keys(d.disabled)) {
      const view = await Model.get(d.id);

      if (view.project_id !== param.projectId) {
        NcError.badRequest('View does not belong to the project');
      }

      const dataInDb = await ModelRoleVisibility.get({
        role,
        fk_view_id: d.id,
      });
      if (dataInDb) {
        if (d.disabled[role]) {
          if (!dataInDb.disabled) {
            await ModelRoleVisibility.update(d.id, role, {
              disabled: d.disabled[role],
            });
          }
        } else {
          await dataInDb.delete();
        }
      } else if (d.disabled[role]) {
        await ModelRoleVisibility.insert({
          fk_view_id: d.id,
          disabled: d.disabled[role],
          role,
        });
      }
    }
  }
  Tele.emit('evt', { evt_type: 'uiAcl:updated' });

  return true;
}

export async function xcVisibilityMetaGet(param: {
  projectId: string;
  includeM2M?: boolean;
  models?: Model[];
}) {
  const { includeM2M = true, projectId, models: _models } = param ?? {};

  // todo: move to
  const roles = ['owner', 'creator', 'viewer', 'editor', 'commenter', 'guest'];

  const defaultDisabled = roles.reduce((o, r) => ({ ...o, [r]: false }), {});

  let models =
    _models ||
    (await Model.list({
      project_id: projectId,
      base_id: undefined,
    }));

  models = includeM2M ? models : (models.filter((t) => !t.mm) as Model[]);

  const result = await models.reduce(async (_obj, model) => {
    const obj = await _obj;

    const views = await model.getViews();
    for (const view of views) {
      obj[view.id] = {
        ptn: model.table_name,
        _ptn: model.title,
        ptype: model.type,
        tn: view.title,
        _tn: view.title,
        table_meta: model.meta,
        ...view,
        disabled: { ...defaultDisabled },
      };
    }

    return obj;
  }, Promise.resolve({}));

  const disabledList = await ModelRoleVisibility.list(projectId);

  for (const d of disabledList) {
    if (result[d.fk_view_id])
      result[d.fk_view_id].disabled[d.role] = !!d.disabled;
  }

  return Object.values(result);
}
