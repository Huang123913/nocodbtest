import { Request, Response, Router } from 'express';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import getHandler from '../meta/helpers/getHandler';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { apiTokenListEE } from '../meta/api/ee/orgTokenApis';
import { getAjvValidatorMw } from '../meta/api/helpers';
import { orgTokenService } from '../services';

async function apiTokenList(req, res) {
  res.json(
    await orgTokenService.apiTokenList({
      query: req.query,
      user: req['user'],
    })
  );
}

export async function apiTokenCreate(req: Request, res: Response) {
  res.json(
    await orgTokenService.apiTokenCreate({
      apiToken: req.body,
      user: req['user'],
    })
  );
}

export async function apiTokenDelete(req: Request, res: Response) {
  res.json(
    await orgTokenService.apiTokenDelete({
      token: req.params.token,
      user: req['user'],
    })
  );
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/tokens',
  metaApiMetrics,
  ncMetaAclMw(getHandler(apiTokenList, apiTokenListEE), 'apiTokenList', {
    // allowedRoles: [OrgUserRoles.SUPER],
    blockApiTokenAccess: true,
  })
);
router.post(
  '/api/v1/tokens',
  metaApiMetrics,
  getAjvValidatorMw('swagger.json#/components/schemas/ApiTokenReq'),
  ncMetaAclMw(apiTokenCreate, 'apiTokenCreate', {
    // allowedRoles: [OrgUserRoles.SUPER],
    blockApiTokenAccess: true,
  })
);
router.delete(
  '/api/v1/tokens/:token',
  metaApiMetrics,
  ncMetaAclMw(apiTokenDelete, 'apiTokenDelete', {
    // allowedRoles: [OrgUserRoles.SUPER],
    blockApiTokenAccess: true,
  })
);
export default router;
