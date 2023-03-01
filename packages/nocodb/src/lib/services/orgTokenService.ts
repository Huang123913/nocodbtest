import { ApiTokenReqType, OrgUserRoles } from 'nocodb-sdk';
import { User } from '../models';
import ApiToken from '../models/ApiToken';
import { Tele } from 'nc-help';
import { NcError } from '../meta/helpers/catchError';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';

export async function apiTokenList(param: { user: User; query: any }) {
  const fk_user_id = param.user.id;
  let includeUnmappedToken = false;
  if (param.user.roles.includes(OrgUserRoles.SUPER_ADMIN)) {
    includeUnmappedToken = true;
  }

  return new PagedResponseImpl(
    await ApiToken.listWithCreatedBy({
      ...param.query,
      fk_user_id,
      includeUnmappedToken,
    }),
    {
      ...param.query,
      count: await ApiToken.count({
        includeUnmappedToken,
        fk_user_id,
      }),
    }
  );
}

export async function apiTokenCreate(param: {
  user: User;
  apiToken: ApiTokenReqType;
}) {
  Tele.emit('evt', { evt_type: 'org:apiToken:created' });
  return await ApiToken.insert({
    ...param.apiToken,
    fk_user_id: param['user'].id,
  });
}

export async function apiTokenDelete(param: { user: User; token: string }) {
  const fk_user_id = param.user.id;
  const apiToken = await ApiToken.getByToken(param.token);
  if (
    !param.user.roles.includes(OrgUserRoles.SUPER_ADMIN) &&
    apiToken.fk_user_id !== fk_user_id
  ) {
    NcError.notFound('Token not found');
  }
  Tele.emit('evt', { evt_type: 'org:apiToken:deleted' });
  return await ApiToken.delete(param.token);
}
