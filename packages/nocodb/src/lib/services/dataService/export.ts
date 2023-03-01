import { Request, Response, Router } from 'express';
import { isSystemColumn } from 'nocodb-sdk'
import * as XLSX from 'xlsx';
import getAst from '../../db/sql-data-mapper/lib/sql/helpers/getAst'
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import { extractXlsxData, serializeCellValue } from '../../meta/api/dataApis/helpers'
import {
  extractCsvData, getViewAndModelByAliasOrId,
  getViewAndModelFromRequestByAliasOrId, PathParams,
} from './helpers'
import apiMetrics from '../../helpers/apiMetrics';
import View from '../../../models/View';

async function excelDataExport(param:PathParams&{
  query: any;
}) {
  const { model, view } = await getViewAndModelByAliasOrId(param);
  let targetView = view;
  if (!targetView) {
    targetView = await View.getDefaultView(model.id);
  }
  const { offset, elapsed, data } = await extractXlsxData({view: targetView, query:req.query });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, data, targetView.title);
  const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  res.set({
    'Access-Control-Expose-Headers': 'nc-export-offset',
    'nc-export-offset': offset,
    'nc-export-elapsed-time': elapsed,
    'Content-Disposition': `attachment; filename="${encodeURI(
      targetView.title
    )}-export.xlsx"`,
  });
  res.end(buf);
}

async function csvDataExport(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  let targetView = view;
  if (!targetView) {
    targetView = await View.getDefaultView(model.id);
  }
  const { offset, elapsed, data } = await extractCsvData(targetView, req);

  res.set({
    'Access-Control-Expose-Headers': 'nc-export-offset',
    'nc-export-offset': offset,
    'nc-export-elapsed-time': elapsed,
    'Content-Disposition': `attachment; filename="${encodeURI(
      targetView.title
    )}-export.csv"`,
  });
  res.send(data);
}
