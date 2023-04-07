import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import {
  ExtractProjectIdMiddleware,
  UseAclMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { FiltersService } from './filters.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class FiltersController {
  constructor(private readonly filtersService: FiltersService) {}

  @Get('/api/v1/db/meta/views/:viewId/filters')
  @UseAclMiddleware({
    permissionName: 'filterList',
  })
  async filterList(@Param('viewId') viewId: string) {
    return new PagedResponseImpl(
      await this.filtersService.filterList({
        viewId,
      }),
    );
  }
}

/*
export async function filterGet(req: Request, res: Response) {
  res.json(await filterService.filterGet({ filterId: req.params.filterId }));
}


export async function filterChildrenRead(req: Request, res: Response) {
  res.json(
    new PagedResponseImpl(
      await filterService.filterChildrenList({
        filterId: req.params.filterParentId,
      })
    )
  );
}

export async function filterCreate(req: Request<any, any, FilterReqType>, res) {
  const filter = await filterService.filterCreate({
    filter: req.body,
    viewId: req.params.viewId,
  });
  res.json(filter);
}

export async function filterUpdate(req, res) {
  const filter = await filterService.filterUpdate({
    filterId: req.params.filterId,
    filter: req.body,
  });
  res.json(filter);
}

export async function filterDelete(req: Request, res: Response) {
  const filter = await filterService.filterDelete({
    filterId: req.params.filterId,
  });
  res.json(filter);
}

export async function hookFilterList(req: Request, res: Response) {
  res.json(
    new PagedResponseImpl(
      await filterService.hookFilterList({
        hookId: req.params.hookId,
      })
    )
  );
}

export async function hookFilterCreate(
  req: Request<any, any, FilterReqType>,
  res
) {
  const filter = await filterService.hookFilterCreate({
    filter: req.body,
    hookId: req.params.hookId,
  });
  res.json(filter);
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/db/meta/views/:viewId/filters',
  metaApiMetrics,
  ncMetaAclMw(filterCreate, 'filterCreate')
);

router.get(
  '/api/v1/db/meta/hooks/:hookId/filters',
  ncMetaAclMw(hookFilterList, 'filterList')
);
router.post(
  '/api/v1/db/meta/hooks/:hookId/filters',
  metaApiMetrics,
  ncMetaAclMw(hookFilterCreate, 'filterCreate')
);

router.get(
  '/api/v1/db/meta/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterGet, 'filterGet')
);
router.patch(
  '/api/v1/db/meta/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterUpdate, 'filterUpdate')
);
router.delete(
  '/api/v1/db/meta/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterDelete, 'filterDelete')
);
router.get(
  '/api/v1/db/meta/filters/:filterParentId/children',
  metaApiMetrics,
  ncMetaAclMw(filterChildrenRead, 'filterChildrenRead')
);
export default router;
* */
