import FetchAT from './fetchAT';
import { UITypes } from 'nocodb-sdk';
// import * as sMap from './syncMap';
import FormData from 'form-data';

import { Api } from 'nocodb-sdk';

import axios from 'axios';
import Airtable from 'airtable';
import jsonfile from 'jsonfile';
import hash from 'object-hash';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

export default async (
  syncDB: AirtableSyncConfig,
  progress: (data: { msg?: string; level?: any }) => void
) => {
  const sMap = {
    mapTbl: {},

    // static mapping records between aTblId && ncId
    addToMappingTbl(aTblId, ncId, ncName, parent?) {
      this.mapTbl[aTblId] = {
        ncId: ncId,
        ncParent: parent,
        // name added to assist in quick debug
        ncName: ncName
      };
    },

    // get NcID from airtable ID
    getNcIdFromAtId(aId) {
      return this.mapTbl[aId]?.ncId;
    },

    // get nc Parent from airtable ID
    getNcParentFromAtId(aId) {
      return this.mapTbl[aId]?.ncParent;
    },

    // get nc-title from airtable ID
    getNcNameFromAtId(aId) {
      return this.mapTbl[aId]?.ncName;
    }
  };

  function logBasic(log) {
    progress({ level: 0, msg: log });
  }
  function logDetailed(log) {
    if (debugMode) progress({ level: 1, msg: log });
  }

  let base, baseId;
  const start = Date.now();
  const enableErrorLogs = false;
  const process_aTblData = true;
  const generate_migrationStats = true;
  const debugMode = false;
  let api: Api<any>;
  let g_aTblSchema = [];
  let ncCreatedProjectSchema: any = {};
  const ncLinkMappingTable: any[] = [];
  const nestedLookupTbl: any[] = [];
  const nestedRollupTbl: any[] = [];
  // run time counter (statistics)
  const rtc = {
    sort: 0,
    filter: 0,
    view: {
      total: 0,
      grid: 0,
      gallery: 0,
      form: 0
    },
    fetchAt: {
      count: 0,
      time: 0
    },
    migrationSkipLog: {
      count: 0,
      log: []
    }
  };

  function updateMigrationSkipLog(tbl, col, type, reason?) {
    rtc.migrationSkipLog.count++;
    rtc.migrationSkipLog.log.push(
      `tn[${tbl}] cn[${col}] type[${type}] :: ${reason}`
    );
  }

  // mapping table
  //

  async function getAirtableSchema(sDB) {
    const start = Date.now();
    if (sDB.shareId.startsWith('exp')) {
      const template = await FetchAT.readTemplate(sDB.shareId);
      await FetchAT.initialize(template.template.exploreApplication.shareId);
    } else {
      await FetchAT.initialize(sDB.shareId);
    }
    const ft = await FetchAT.read();
    const duration = Date.now() - start;
    rtc.fetchAt.count++;
    rtc.fetchAt.time += duration;

    const file = ft.schema;
    baseId = ft.baseId;
    base = new Airtable({ apiKey: sDB.apiKey }).base(baseId);
    // store copy of airtable schema globally
    g_aTblSchema = file.tableSchemas;

    if (debugMode) jsonfile.writeFileSync('aTblSchema.json', ft, { spaces: 2 });

    return file;
  }

  async function getViewData(viewId) {
    const start = Date.now();
    const ft = await FetchAT.readView(viewId);
    const duration = Date.now() - start;
    rtc.fetchAt.count++;
    rtc.fetchAt.time += duration;

    if (debugMode) jsonfile.writeFileSync(`${viewId}.json`, ft, { spaces: 2 });
    return ft.view;
  }

  // base mapping table
  const aTblNcTypeMap = {
    foreignKey: UITypes.LinkToAnotherRecord,
    text: UITypes.SingleLineText,
    multilineText: UITypes.LongText,
    richText: UITypes.LongText,
    multipleAttachment: UITypes.Attachment,
    checkbox: UITypes.Checkbox,
    multiSelect: UITypes.MultiSelect,
    select: UITypes.SingleSelect,
    collaborator: UITypes.Collaborator,
    multiCollaborator: UITypes.Collaborator,
    date: UITypes.Date,
    // kludge: phone: UITypes.PhoneNumber,
    phone: UITypes.SingleLineText,
    number: UITypes.Number,
    rating: UITypes.Rating,
    formula: UITypes.Formula,
    rollup: UITypes.Rollup,
    count: UITypes.Count,
    lookup: UITypes.Lookup,
    autoNumber: UITypes.AutoNumber,
    barcode: UITypes.Barcode,
    button: UITypes.Button
  };

  //-----------------------------------------------------------------------------
  // aTbl helper routines
  //

  function nc_sanitizeName(name) {
    // replace all special characters by _
    return name.replace(/\W+/g, '_').trim();
  }

  function nc_getSanitizedColumnName(table, name) {
    const col_name = nc_sanitizeName(name);

    // check if already a column exists with same name?
    const duplicateColumn = table.columns.find(x => x.title === name.trim());
    if (duplicateColumn) {
      if (enableErrorLogs) console.log(`## Duplicate ${name.trim()}`);
    }

    return {
      // kludge: error observed in Nc with space around column-name
      title: name.trim() + (duplicateColumn ? '_2' : ''),
      column_name: col_name + (duplicateColumn ? '_2' : '')
    };
  }

  // aTbl: retrieve table name from table ID
  //
  function aTbl_getTableName(tblId) {
    const sheetObj = g_aTblSchema.find(tbl => tbl.id === tblId);
    return {
      tn: sheetObj.name
    };
  }

  const ncSchema = {
    tables: [],
    tablesById: {}
  };

  // aTbl: retrieve column name from column ID
  //
  function aTbl_getColumnName(colId): any {
    for (let i = 0; i < g_aTblSchema.length; i++) {
      const sheetObj = g_aTblSchema[i];
      const column = sheetObj.columns.find(col => col.id === colId);
      if (column !== undefined)
        return {
          tn: sheetObj.name,
          cn: column.name
        };
    }
  }

  // nc dump schema
  //
  // @ts-ignore
  async function nc_DumpTableSchema() {
    console.log('[');
    const ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id);
    for (let i = 0; i < ncTblList.list.length; i++) {
      const ncTbl = await api.dbTable.read(ncTblList.list[i].id);
      console.log(JSON.stringify(ncTbl, null, 2));
      console.log(',');
    }
    console.log(']');
  }

  // retrieve nc column schema from using aTbl field ID as reference
  //
  async function nc_getColumnSchema(aTblFieldId) {
    // let ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id);
    // let aTblField = aTbl_getColumnName(aTblFieldId);
    // let ncTblId = ncTblList.list.filter(x => x.title === aTblField.tn)[0].id;
    // let ncTbl = await api.dbTable.read(ncTblId);
    // let ncCol = ncTbl.columns.find(x => x.title === aTblField.cn);
    // return ncCol;

    const ncTblId = sMap.getNcParentFromAtId(aTblFieldId);
    const ncColId = sMap.getNcIdFromAtId(aTblFieldId);

    // not migrated column, skip
    if (ncColId === undefined || ncTblId === undefined) return 0;

    return ncSchema.tablesById[ncTblId].columns.find(x => x.id === ncColId);
  }

  // retrieve nc table schema using table name
  // optimize: create a look-up table & re-use information
  //
  async function nc_getTableSchema(tableName) {
    // let ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id);
    // let ncTblId = ncTblList.list.filter(x => x.title === tableName)[0].id;
    // let ncTbl = await api.dbTable.read(ncTblId);
    // return ncTbl;

    return ncSchema.tables.find(x => x.title === tableName);
  }

  // delete project if already exists
  async function init({
    projectName
  }: {
    projectName?: string;
    projectId?: string;
  }) {
    // delete 'sample' project if already exists
    const x = await api.project.list();

    const sampleProj = x.list.find(a => a.title === projectName);
    if (sampleProj) {
      await api.project.delete(sampleProj.id);
    }
    logDetailed('Init');
  }

  // map UIDT
  //
  function getNocoType(col) {
    // start with default map
    let ncType = aTblNcTypeMap[col.type];

    // types email & url are marked as text
    // types currency & percent, duration are marked as number
    // types createTime & modifiedTime are marked as formula

    switch (col.type) {
      case 'text':
        if (col.typeOptions?.validatorName === 'email') ncType = UITypes.Email;
        else if (col.typeOptions?.validatorName === 'url') ncType = UITypes.URL;
        break;

      case 'number':
        // kludge: currency validation error with decimal places
        if (col.typeOptions?.format === 'percentV2') ncType = UITypes.Percent;
        else if (col.typeOptions?.format === 'duration')
          ncType = UITypes.Duration;
        else if (col.typeOptions?.format === 'currency')
          ncType = UITypes.Currency;
        else if (col.typeOptions?.precision > 0) ncType = UITypes.Decimal;
        break;

      case 'formula':
        if (col.typeOptions?.formulaTextParsed === 'CREATED_TIME()')
          ncType = UITypes.DateTime;
        else if (col.typeOptions?.formulaTextParsed === 'LAST_MODIFIED_TIME()')
          ncType = UITypes.DateTime;
        break;

      case 'computation':
        if (col.typeOptions?.resultType === 'collaborator')
          ncType = UITypes.Collaborator;
        break;

      case 'date':
        if (col.typeOptions?.isDateTime) ncType = UITypes.DateTime;
        break;

      // case 'barcode':
      // case 'button':
      //   ncType = UITypes.SingleLineText;
      //   break;
    }

    return ncType;
  }

  // retrieve additional options associated with selected data types
  //
  function getNocoTypeOptions(col: any): any {
    switch (col.type) {
      case 'select':
      case 'multiSelect': {
        // prepare options list in CSV format
        // note: NC doesn't allow comma's in options
        //
        const opt = [];
        for (const [, value] of Object.entries(col.typeOptions.choices)) {
          opt.push((value as any).name);
          sMap.addToMappingTbl(
            (value as any).id,
            undefined,
            (value as any).name
          );
        }
        // const csvOpt = "'" + opt.join("','") + "'";
        const csvOpt = opt
          .map(v => `'${v.replace(/'/g, "\\'").replace(/,/g, '.')}'`)
          .join(',');
        return { type: 'select', data: csvOpt };
      }
      default:
        return { type: undefined };
    }
  }

  const tableNamesRef = {};

  function getUniqueTableName(initialTablename = 'sheet') {
    let tableName = initialTablename === '_' ? 'sheet' : initialTablename;
    let c = 0;
    while (tableName in tableNamesRef) {
      tableName = `${initialTablename}_${c++}`;
    }
    tableNamesRef[tableName] = true;
    return tableName;
  }
  // convert to Nc schema (basic, excluding relations)
  //
  function tablesPrepare(tblSchema: any[]) {
    const tables: any[] = [];

    for (let i = 0; i < tblSchema.length; ++i) {
      const table: any = {};

      if (syncDB.syncViews) {
        rtc.view.total += tblSchema[i].views.reduce(
          (acc, cur) =>
            ['grid', 'form', 'gallery'].includes(cur.type) ? ++acc : acc,
          0
        );
      } else {
        rtc.view.total = tblSchema.length;
      }

      // Enable to use aTbl identifiers as is: table.id = tblSchema[i].id;
      table.title = tblSchema[i].name;
      table.table_name = getUniqueTableName(nc_sanitizeName(tblSchema[i].name));

      const columnNamesRef = {};

      const getUniqueColumnName = (initialColumnName = 'field') => {
        let columnName =
          initialColumnName === '_' ? 'field' : initialColumnName;
        let c = 0;
        while (columnName in columnNamesRef) {
          columnName = `${initialColumnName}_${c++}`;
        }
        columnNamesRef[columnName] = true;
        return columnName;
      };
      // insert _aTbl_nc_rec_id of type ID by default
      table.columns = [
        {
          title: '_aTbl_nc_rec_id',
          column_name: '_aTbl_nc_rec_id',
          uidt: UITypes.ID,
          // idType: 'AG'
          // uidt: UITypes.SingleLineText,
          // pk: true,
          // // mysql additionally requires NOT-NULL to be explicitly set
          // rqd: true,
          // system: true,
          meta: {
            ag: 'nc'
          }
        },
        {
          title: '_aTbl_nc_rec_hash',
          column_name: '_aTbl_nc_rec_hash',
          uidt: UITypes.SingleLineText,
          system: true
        }
      ];

      for (let j = 0; j < tblSchema[i].columns.length; j++) {
        const col = tblSchema[i].columns[j];

        // skip link, lookup, rollup fields in this iteration
        if (['foreignKey', 'lookup', 'rollup'].includes(col.type)) {
          continue;
        }

        // base column schema
        const ncName: any = nc_getSanitizedColumnName(table, col.name);
        const ncCol: any = {
          // Enable to use aTbl identifiers as is: id: col.id,
          title: ncName.title,
          column_name: getUniqueColumnName(ncName.column_name),
          uidt: getNocoType(col)
        };

        // not supported datatype: pure formula field
        // allow formula based computed fields (created time/ modified time to go through)
        if (ncCol.uidt === UITypes.Formula) {
          updateMigrationSkipLog(
            tblSchema[i].name,
            ncName.title,
            col.type,
            'column type not supported'
          );
          continue;
        }

        // populate cdf (column default value) if configured
        if (col?.default) {
          ncCol.cdf = col.default;
        }

        // change from default 'tinytext' as airtable allows more than 255 characters
        // for single line text column type
        if (col.type === 'text') ncCol.dt = 'text';

        // additional column parameters when applicable
        const colOptions = getNocoTypeOptions(col);

        switch (colOptions.type) {
          case 'select':
            ncCol.dtxp = colOptions.data;
            break;

          case undefined:
            break;
        }
        table.columns.push(ncCol);
      }
      tables.push(table);
    }
    return tables;
  }

  async function nocoCreateBaseSchema(aTblSchema) {
    // base schema preparation: exclude
    const tables: any[] = tablesPrepare(aTblSchema);

    // for each table schema, create nc table
    for (let idx = 0; idx < tables.length; idx++) {
      logBasic(`:: [${idx + 1}/${tables.length}] ${tables[idx].title}`);

      logDetailed(`NC API: dbTable.create ${tables[idx].title}`);
      const table: any = await api.dbTable.create(
        ncCreatedProjectSchema.id,
        tables[idx]
      );
      updateNcTblSchema(table);

      // update mapping table
      await sMap.addToMappingTbl(aTblSchema[idx].id, table.id, table.title);
      for (let colIdx = 0; colIdx < table.columns.length; colIdx++) {
        const aId = aTblSchema[idx].columns.find(
          x => x.name.trim() === table.columns[colIdx].title
        )?.id;
        if (aId)
          await sMap.addToMappingTbl(
            aId,
            table.columns[colIdx].id,
            table.columns[colIdx].title,
            table.id
          );
      }

      // update default view name- to match it to airtable view name
      logDetailed(`NC API: dbView.list ${table.id}`);
      const view = await api.dbView.list(table.id);

      const aTbl_grid = aTblSchema[idx].views.find(x => x.type === 'grid');
      logDetailed(`NC API: dbView.update ${view.list[0].id} ${aTbl_grid.name}`);
      await api.dbView.update(view.list[0].id, {
        title: aTbl_grid.name
      });
      await updateNcTblSchemaById(table.id);

      await sMap.addToMappingTbl(
        aTbl_grid.id,
        table.views[0].id,
        aTbl_grid.name,
        table.id
      );
    }

    // debug
    // console.log(JSON.stringify(tables, null, 2));
    return tables;
  }

  async function nocoCreateLinkToAnotherRecord(aTblSchema) {
    // Link to another RECORD
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const aTblLinkColumns = aTblSchema[idx].columns.filter(
        x => x.type === 'foreignKey'
      );

      // Link columns exist
      //
      if (aTblLinkColumns.length) {
        for (let i = 0; i < aTblLinkColumns.length; i++) {
          logDetailed(
            `[${idx + 1}/${aTblSchema.length}] Configuring Links :: [${i + 1}/${
              aTblLinkColumns.length
            }] ${aTblSchema[idx].name}`
          );

          // for self links, there is no symmetric column
          {
            const src = aTbl_getColumnName(aTblLinkColumns[i].id);
            const dst = aTbl_getColumnName(
              aTblLinkColumns[i].typeOptions?.symmetricColumnId
            );
            logDetailed(
              `LTAR ${src.tn}:${src.cn} <${aTblLinkColumns[i].typeOptions.relationship}> ${dst?.tn}:${dst?.cn}`
            );
          }

          // check if link already established?
          if (!nc_isLinkExists(aTblLinkColumns[i].id)) {
            // parent table ID
            // let srcTableId = (await nc_getTableSchema(aTblSchema[idx].name)).id;
            const srcTableId = sMap.getNcIdFromAtId(aTblSchema[idx].id);

            // find child table name from symmetric column ID specified
            // self link, symmetricColumnId field will be undefined
            const childTable = aTbl_getColumnName(
              aTblLinkColumns[i].typeOptions?.symmetricColumnId
            );

            // retrieve child table ID (nc) from table name
            let childTableId = srcTableId;
            if (childTable) {
              childTableId = (await nc_getTableSchema(childTable.tn)).id;
            }

            // check if already a column exists with this name?
            const srcTbl: any = await api.dbTable.read(srcTableId);

            // create link
            const ncName = nc_getSanitizedColumnName(
              srcTbl,
              aTblLinkColumns[i].name
            );

            logDetailed(
              `NC API: dbTableColumn.create LinkToAnotherRecord ${ncName.title}`
            );
            const ncTbl: any = await api.dbTableColumn.create(srcTableId, {
              uidt: UITypes.LinkToAnotherRecord,
              title: ncName.title,
              column_name: ncName.column_name,
              parentId: srcTableId,
              childId: childTableId,
              type: 'mm'
              // aTblLinkColumns[i].typeOptions.relationship === 'many'
              //   ? 'mm'
              //   : 'hm'
            });
            updateNcTblSchema(ncTbl);

            const ncId = ncTbl.columns.find(x => x.title === ncName.title)?.id;
            await sMap.addToMappingTbl(
              aTblLinkColumns[i].id,
              ncId,
              ncName.title,
              ncTbl.id
            );

            // store link information in separate table
            // this information will be helpful in identifying relation pair
            const link = {
              nc: {
                title: aTblLinkColumns[i].name,
                parentId: srcTableId,
                childId: childTableId,
                type: 'mm'
              },
              aTbl: {
                tblId: aTblSchema[idx].id,
                ...aTblLinkColumns[i]
              }
            };

            ncLinkMappingTable.push(link);
          } else {
            // if link already exists, we need to change name of linked column
            // to what is represented in airtable

            // 1. extract associated link information from link table
            // 2. retrieve parent table information (source)
            // 3. using foreign parent & child column ID, find associated mapping in child table
            // 4. update column name
            const x = ncLinkMappingTable.findIndex(
              x =>
                x.aTbl.tblId ===
                  aTblLinkColumns[i].typeOptions.foreignTableId &&
                x.aTbl.id === aTblLinkColumns[i].typeOptions.symmetricColumnId
            );

            const childTblSchema: any = await api.dbTable.read(
              ncLinkMappingTable[x].nc.childId
            );
            const parentTblSchema: any = await api.dbTable.read(
              ncLinkMappingTable[x].nc.parentId
            );

            // fix me
            // let childTblSchema = ncSchema.tablesById[ncLinkMappingTable[x].nc.childId]
            // let parentTblSchema = ncSchema.tablesById[ncLinkMappingTable[x].nc.parentId]

            let parentLinkColumn = parentTblSchema.columns.find(
              col => col.title === ncLinkMappingTable[x].nc.title
            );

            // hack // fix me
            if (parentLinkColumn.uidt !== 'LinkToAnotherRecord') {
              parentLinkColumn = parentTblSchema.columns.find(
                col => col.title === ncLinkMappingTable[x].nc.title + '_2'
              );
            }

            let childLinkColumn: any = {};

            if (parentLinkColumn.colOptions.type == 'hm') {
              // for hm:
              // mapping between child & parent column id is direct
              //
              childLinkColumn = childTblSchema.columns.find(
                col =>
                  col.uidt === UITypes.LinkToAnotherRecord &&
                  col.colOptions.fk_child_column_id ===
                    parentLinkColumn.colOptions.fk_child_column_id &&
                  col.colOptions.fk_parent_column_id ===
                    parentLinkColumn.colOptions.fk_parent_column_id
              );
            } else {
              // for mm:
              // mapping between child & parent column id is inverted
              //
              childLinkColumn = childTblSchema.columns.find(
                col =>
                  col.uidt === UITypes.LinkToAnotherRecord &&
                  col.colOptions.fk_child_column_id ===
                    parentLinkColumn.colOptions.fk_parent_column_id &&
                  col.colOptions.fk_parent_column_id ===
                    parentLinkColumn.colOptions.fk_child_column_id &&
                  col.colOptions.fk_mm_model_id ===
                    parentLinkColumn.colOptions.fk_mm_model_id
              );
            }

            // check if already a column exists with this name?
            const duplicate = childTblSchema.columns.find(
              x => x.title === aTblLinkColumns[i].name
            );
            const suffix = duplicate ? '_2' : '';
            if (duplicate)
              if (enableErrorLogs)
                console.log(`## Duplicate ${aTblLinkColumns[i].name}`);

            // rename
            // note that: current rename API requires us to send all parameters,
            // not just title being renamed
            const ncName = nc_getSanitizedColumnName(
              childTblSchema,
              aTblLinkColumns[i].name
            );

            logDetailed(
              `NC API: dbTableColumn.update rename symmetric column ${ncName.title}`
            );
            const ncTbl: any = await api.dbTableColumn.update(
              childLinkColumn.id,
              {
                ...childLinkColumn,
                title: ncName.title,
                column_name: ncName.column_name
              }
            );
            updateNcTblSchema(ncTbl);

            const ncId = ncTbl.columns.find(
              x => x.title === aTblLinkColumns[i].name + suffix
            )?.id;
            await sMap.addToMappingTbl(
              aTblLinkColumns[i].id,
              ncId,
              aTblLinkColumns[i].name + suffix,
              ncTbl.id
            );

            // console.log(res.columns.find(x => x.title === aTblLinkColumns[i].name))
          }
        }
      }
    }
  }

  async function nocoCreateLookups(aTblSchema) {
    // LookUps
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const aTblColumns = aTblSchema[idx].columns.filter(
        x => x.type === 'lookup'
      );

      // parent table ID
      // let srcTableId = (await nc_getTableSchema(aTblSchema[idx].name)).id;
      const srcTableId = sMap.getNcIdFromAtId(aTblSchema[idx].id);
      const srcTableSchema = ncSchema.tablesById[srcTableId];

      if (aTblColumns.length) {
        // Lookup
        for (let i = 0; i < aTblColumns.length; i++) {
          logDetailed(
            `[${idx + 1}/${aTblSchema.length}] Configuring Lookup :: [${i +
              1}/${aTblColumns.length}] ${aTblSchema[idx].name}`
          );

          // something is not right, skip
          if (
            aTblColumns[i]?.typeOptions?.dependencies?.invalidColumnIds?.length
          ) {
            if (enableErrorLogs)
              console.log(`## Invalid column IDs mapped; skip`);

            updateMigrationSkipLog(
              srcTableSchema.title,
              aTblColumns[i].name,
              aTblColumns[i].type,
              'invalid column ID in dependency list'
            );
            continue;
          }

          const ncRelationColumnId = sMap.getNcIdFromAtId(
            aTblColumns[i].typeOptions.relationColumnId
          );
          const ncLookupColumnId = sMap.getNcIdFromAtId(
            aTblColumns[i].typeOptions.foreignTableRollupColumnId
          );

          if (ncLookupColumnId === undefined) {
            aTblColumns[i]['srcTableId'] = srcTableId;
            nestedLookupTbl.push(aTblColumns[i]);
            continue;
          }

          const ncName = nc_getSanitizedColumnName(
            srcTableSchema,
            aTblColumns[i].name
          );

          logDetailed(`NC API: dbTableColumn.create LOOKUP ${ncName.title}`);
          const ncTbl: any = await api.dbTableColumn.create(srcTableId, {
            uidt: UITypes.Lookup,
            title: ncName.title,
            column_name: ncName.column_name,
            fk_relation_column_id: ncRelationColumnId,
            fk_lookup_column_id: ncLookupColumnId
          });
          updateNcTblSchema(ncTbl);

          const ncId = ncTbl.columns.find(x => x.title === aTblColumns[i].name)
            ?.id;
          await sMap.addToMappingTbl(
            aTblColumns[i].id,
            ncId,
            aTblColumns[i].name,
            ncTbl.id
          );
        }
      }
    }

    let level = 2;
    let nestedCnt = 0;
    while (nestedLookupTbl.length) {
      // if nothing has changed from previous iteration, skip rest
      if (nestedCnt === nestedLookupTbl.length) {
        for (let i = 0; i < nestedLookupTbl.length; i++) {
          const fTblField =
            nestedLookupTbl[i].typeOptions.foreignTableRollupColumnId;
          const name = aTbl_getColumnName(fTblField);
          updateMigrationSkipLog(
            ncSchema.tablesById[nestedLookupTbl[i].srcTableId]?.title,
            nestedLookupTbl[i].name,
            nestedLookupTbl[i].type,
            `foreign table field not found [${name.tn}/${name.cn}]`
          );
        }
        if (enableErrorLogs)
          console.log(
            `## Failed to configure ${nestedLookupTbl.length} lookups`
          );
        break;
      }

      // Nested lookup
      nestedCnt = nestedLookupTbl.length;
      for (let i = 0; i < nestedLookupTbl.length; i++) {
        const srcTableId = nestedLookupTbl[0].srcTableId;
        const srcTableSchema = ncSchema.tablesById[srcTableId];

        const ncRelationColumnId = sMap.getNcIdFromAtId(
          nestedLookupTbl[0].typeOptions.relationColumnId
        );
        const ncLookupColumnId = sMap.getNcIdFromAtId(
          nestedLookupTbl[0].typeOptions.foreignTableRollupColumnId
        );

        if (ncLookupColumnId === undefined) {
          continue;
        }

        const ncName = nc_getSanitizedColumnName(
          srcTableSchema,
          nestedLookupTbl[0].name
        );

        logDetailed(
          `Configuring Nested Lookup: Level-${level} [${i + 1}/${nestedCnt} ${
            ncName.title
          }]`
        );

        logDetailed(`NC API: dbTableColumn.create LOOKUP ${ncName.title}`);
        const ncTbl: any = await api.dbTableColumn.create(srcTableId, {
          uidt: UITypes.Lookup,
          title: ncName.title,
          column_name: ncName.column_name,
          fk_relation_column_id: ncRelationColumnId,
          fk_lookup_column_id: ncLookupColumnId
        });
        updateNcTblSchema(ncTbl);

        const ncId = ncTbl.columns.find(
          x => x.title === nestedLookupTbl[0].name
        )?.id;
        await sMap.addToMappingTbl(
          nestedLookupTbl[0].id,
          ncId,
          nestedLookupTbl[0].name,
          ncTbl.id
        );

        // remove entry
        nestedLookupTbl.splice(0, 1);
      }
      level++;
    }
  }

  function getRollupNcFunction(aTblFunction) {
    const fn = aTblFunction.split('(')[0];
    const aTbl_ncRollUp = {
      AND: '',
      ARRAYCOMPACT: '',
      ARRAYJOIN: '',
      ARRAYUNIQUE: '',
      AVERAGE: 'average',
      CONCATENATE: '',
      COUNT: 'count',
      COUNTA: '',
      COUNTALL: '',
      MAX: 'max',
      MIN: 'min',
      OR: '',
      SUM: 'sum',
      XOR: ''
    };
    return aTbl_ncRollUp[fn];
  }

  async function nocoCreateRollup(aTblSchema) {
    // Rollup
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const aTblColumns = aTblSchema[idx].columns.filter(
        x => x.type === 'rollup'
      );

      // parent table ID
      // let srcTableId = (await nc_getTableSchema(aTblSchema[idx].name)).id;
      const srcTableId = sMap.getNcIdFromAtId(aTblSchema[idx].id);
      const srcTableSchema = ncSchema.tablesById[srcTableId];

      if (aTblColumns.length) {
        // rollup exist
        for (let i = 0; i < aTblColumns.length; i++) {
          logDetailed(
            `[${idx + 1}/${aTblSchema.length}] Configuring Rollup :: [${i +
              1}/${aTblColumns.length}] ${aTblSchema[idx].name}`
          );

          // fetch associated rollup function
          // skip column creation if supported rollup function does not exist
          const ncRollupFn = getRollupNcFunction(
            aTblColumns[i].typeOptions.formulaTextParsed
          );

          if (ncRollupFn === '') {
            updateMigrationSkipLog(
              srcTableSchema.title,
              aTblColumns[i].name,
              aTblColumns[i].type,
              `rollup function ${aTblColumns[i].typeOptions.formulaTextParsed} not supported`
            );
            continue;
          }

          // something is not right, skip
          if (
            aTblColumns[i]?.typeOptions?.dependencies?.invalidColumnIds?.length
          ) {
            if (enableErrorLogs)
              console.log(`## Invalid column IDs mapped; skip`);

            updateMigrationSkipLog(
              srcTableSchema.title,
              aTblColumns[i].name,
              aTblColumns[i].type,
              'invalid column ID in dependency list'
            );
            continue;
          }

          const ncRelationColumnId = sMap.getNcIdFromAtId(
            aTblColumns[i].typeOptions.relationColumnId
          );
          const ncRollupColumnId = sMap.getNcIdFromAtId(
            aTblColumns[i].typeOptions.foreignTableRollupColumnId
          );

          if (ncRollupColumnId === undefined) {
            aTblColumns[i]['srcTableId'] = srcTableId;
            nestedRollupTbl.push(aTblColumns[i]);
            continue;
          }

          // skip, if rollup column was pointing to another virtual column
          const ncColSchema = await nc_getColumnSchema(
            aTblColumns[i].typeOptions.foreignTableRollupColumnId
          );
          if (
            ncColSchema?.uidt === UITypes.Formula ||
            ncColSchema?.uidt === UITypes.Lookup ||
            ncColSchema?.uidt === UITypes.Rollup
          ) {
            updateMigrationSkipLog(
              srcTableSchema.title,
              aTblColumns[i].name,
              aTblColumns[i].type,
              'rollup referring to a lookup column'
            );
            continue;
          }

          const ncName = nc_getSanitizedColumnName(
            srcTableSchema,
            aTblColumns[i].name
          );

          logDetailed(`NC API: dbTableColumn.create ROLLUP ${ncName.title}`);
          const ncTbl: any = await api.dbTableColumn.create(srcTableId, {
            uidt: UITypes.Rollup,
            title: ncName.title,
            column_name: ncName.column_name,
            fk_relation_column_id: ncRelationColumnId,
            fk_rollup_column_id: ncRollupColumnId,
            rollup_function: ncRollupFn
          });
          updateNcTblSchema(ncTbl);

          const ncId = ncTbl.columns.find(x => x.title === aTblColumns[i].name)
            ?.id;
          await sMap.addToMappingTbl(
            aTblColumns[i].id,
            ncId,
            aTblColumns[i].name,
            ncTbl.id
          );
        }
      }
    }
    logDetailed(`Nested rollup: ${nestedRollupTbl.length}`);
  }

  async function nocoLookupForRollup() {
    const nestedCnt = nestedLookupTbl.length;
    for (let i = 0; i < nestedLookupTbl.length; i++) {
      const srcTableId = nestedLookupTbl[0].srcTableId;
      const srcTableSchema = ncSchema.tablesById[srcTableId];

      const ncRelationColumnId = sMap.getNcIdFromAtId(
        nestedLookupTbl[0].typeOptions.relationColumnId
      );
      const ncLookupColumnId = sMap.getNcIdFromAtId(
        nestedLookupTbl[0].typeOptions.foreignTableRollupColumnId
      );

      if (ncLookupColumnId === undefined) {
        continue;
      }

      const ncName = nc_getSanitizedColumnName(
        srcTableSchema,
        nestedLookupTbl[0].name
      );

      logDetailed(
        `Configuring Lookup over Rollup :: [${i + 1}/${nestedCnt}] ${
          ncName.title
        }`
      );

      logDetailed(`NC API: dbTableColumn.create LOOKUP ${ncName.title}`);
      const ncTbl: any = await api.dbTableColumn.create(srcTableId, {
        uidt: UITypes.Lookup,
        title: ncName.title,
        column_name: ncName.column_name,
        fk_relation_column_id: ncRelationColumnId,
        fk_lookup_column_id: ncLookupColumnId
      });
      updateNcTblSchema(ncTbl);

      const ncId = ncTbl.columns.find(x => x.title === nestedLookupTbl[0].name)
        ?.id;
      await sMap.addToMappingTbl(
        nestedLookupTbl[0].id,
        ncId,
        nestedLookupTbl[0].name,
        ncTbl.id
      );

      // remove entry
      nestedLookupTbl.splice(0, 1);
    }
  }

  async function nocoSetPrimary(aTblSchema) {
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      logDetailed(
        `[${idx + 1}/${aTblSchema.length}] Configuring Primary value : ${
          aTblSchema[idx].name
        }`
      );

      const pColId = aTblSchema[idx].primaryColumnId;
      const ncColId = sMap.getNcIdFromAtId(pColId);

      // skip primary column configuration if we field not migrated
      if (ncColId) {
        logDetailed(`NC API: dbTableColumn.primaryColumnSet`);
        await api.dbTableColumn.primaryColumnSet(ncColId);

        // update schema
        const ncTblId = sMap.getNcIdFromAtId(aTblSchema[idx].id);
        await updateNcTblSchemaById(ncTblId);
      }
    }
  }

  // retrieve nc-view column ID from corresponding nc-column ID
  async function nc_getViewColumnId(viewId, viewType, ncColumnId) {
    // retrieve view Info
    let viewDetails;

    if (viewType === 'form')
      viewDetails = (await api.dbView.formRead(viewId)).columns;
    else if (viewType === 'gallery')
      viewDetails = (await api.dbView.galleryRead(viewId)).columns;
    else viewDetails = await api.dbView.gridColumnsList(viewId);

    return viewDetails.find(x => x.fk_column_id === ncColumnId)?.id;
  }

  //////////  Data processing

  async function nocoLinkProcessing(projName, table, record, _field) {
    const rec = record.fields;
    const refRowIdList: any = Object.values(rec);
    const referenceColumnName = Object.keys(rec)[0];

    if (refRowIdList.length) {
      for (let i = 0; i < refRowIdList[0].length; i++) {
        logDetailed(
          `NC API: dbTableRow.nestedAdd ${record.id}/mm/${referenceColumnName}/${refRowIdList[0][i]}`
        );

        await api.dbTableRow.nestedAdd(
          'noco',
          projName,
          table.id,
          `${record.id}`,
          'mm', // fix me
          encodeURIComponent(referenceColumnName),
          `${refRowIdList[0][i]}`
        );
      }
    }
  }

  async function nocoBaseDataProcessing(sDB, table, record) {
    const recordHash = hash(record);
    const rec = record.fields;

    // kludge -
    // trim spaces on either side of column name
    // leads to error in NocoDB
    Object.keys(rec).forEach(key => {
      const replacedKey = key.trim();
      if (key !== replacedKey) {
        rec[replacedKey] = rec[key];
        delete rec[key];
      }
    });

    // post-processing on the record
    for (const [key, value] of Object.entries(rec as { [key: string]: any })) {
      // retrieve datatype
      const dt = table.columns.find(x => x.title === key)?.uidt;

      // https://www.npmjs.com/package/validator
      // default value: digits_after_decimal: [2]
      // if currency, set decimal place to 2
      //
      if (dt === UITypes.Currency) rec[key] = (+value).toFixed(2);

      // we will pick up LTAR once all table data's are in place
      if (dt === UITypes.LinkToAnotherRecord) {
        delete rec[key];
      }

      // these will be automatically populated depending on schema configuration
      if (dt === UITypes.Lookup) delete rec[key];
      if (dt === UITypes.Rollup) delete rec[key];

      if (dt === UITypes.Collaborator) {
        // in case of multi-collaborator, this will be an array
        if (Array.isArray(value)) {
          let collaborators = '';
          for (let i = 0; i < value.length; i++) {
            collaborators += `${value[i]?.name} <${value[i]?.email}>, `;
            rec[key] = collaborators;
          }
        } else rec[key] = `${value?.name} <${value?.email}>`;
      }

      if (dt === UITypes.Barcode) rec[key] = value.text;
      if (dt === UITypes.Button) rec[key] = `${value?.label} <${value?.url}>`;

      if (
        dt === UITypes.DateTime ||
        dt === UITypes.CreateTime ||
        dt === UITypes.LastModifiedTime
      ) {
        const atDateField = dayjs(value);
        rec[key] = atDateField.utc().format('YYYY-MM-DD HH:mm');
      }

      if (dt === UITypes.SingleSelect) rec[key] = value.replace(/,/g, '.');

      if (dt === UITypes.MultiSelect)
        rec[key] = value.map(v => `${v.replace(/,/g, '.')}`).join(',');

      if (dt === UITypes.Attachment) {
        const tempArr = [];
        for (const v of value) {
          const binaryImage = await axios
            .get(v.url, {
              responseType: 'stream',
              headers: {
                'Content-Type': v.type
              }
            })
            .then(response => {
              return response.data;
            })
            .catch(error => {
              console.log(error);
              return false;
            });

          const imageFile: any = new FormData();
          imageFile.append('files', binaryImage, {
            filename: v.filename.includes('?')
              ? v.filename.split('?')[0]
              : v.filename
          });

          const rs = await axios
            .post(sDB.baseURL + '/api/v1/db/storage/upload', imageFile, {
              params: {
                path: `noco/${sDB.projectName}/${table.title}/${key}`
              },
              headers: {
                'Content-Type': `multipart/form-data; boundary=${imageFile._boundary}`,
                'xc-auth': sDB.authToken
              }
            })
            .then(response => {
              return response.data;
            })
            .catch(e => {
              console.log(e);
            });

          tempArr.push(...rs);
        }
        rec[key] = JSON.stringify(tempArr);
      }
    }

    // insert airtable record ID explicitly into each records
    rec['_aTbl_nc_rec_id'] = record.id;
    rec['_aTbl_nc_rec_hash'] = recordHash;

    // bulk Insert
    logDetailed(`NC API: dbTableRow.bulkCreate ${table.title} [${rec}]`);
    await api.dbTableRow.bulkCreate(
      'nc',
      sDB.projectName,
      table.id, // encodeURIComponent(table.title),
      [rec]
    );
  }

  async function nocoReadData(sDB, table, callback) {
    return new Promise((resolve, reject) => {
      base(table.title)
        .select({
          pageSize: 100
          // maxRecords: 1,
        })
        .eachPage(
          async function page(records, fetchNextPage) {
            // console.log(JSON.stringify(records, null, 2));

            // This function (`page`) will get called for each page of records.
            logBasic(
              `:: ${table.title} : ${recordCnt + 1} ~ ${(recordCnt += 100)}`
            );

            await Promise.all(
              records.map(record => callback(sDB, table, record))
            );

            // To fetch the next page of records, call `fetchNextPage`.
            // If there are more records, `page` will get called again.
            // If there are no more records, `done` will get called.
            fetchNextPage();
          },
          function done(err) {
            if (err) {
              console.error(err);
              reject(err);
            }
            resolve(null);
          }
        );
    });
  }

  async function nocoReadDataSelected(projName, table, callback, fields) {
    return new Promise((resolve, reject) => {
      base(table.title)
        .select({
          pageSize: 100,
          // maxRecords: 100,
          fields: [fields]
        })
        .eachPage(
          async function page(records, fetchNextPage) {
            // console.log(JSON.stringify(records, null, 2));

            // This function (`page`) will get called for each page of records.
            // records.forEach(record => callback(table, record));
            logBasic(
              `:: ${table.title} / ${fields} : ${recordCnt +
                1} ~ ${(recordCnt += 100)}`
            );
            await Promise.all(
              records.map(r => callback(projName, table, r, fields))
            );

            // To fetch the next page of records, call `fetchNextPage`.
            // If there are more records, `page` will get called again.
            // If there are no more records, `done` will get called.
            fetchNextPage();
          },
          function done(err) {
            if (err) {
              console.error(err);
              reject(err);
            }
            resolve(null);
          }
        );
    });
  }

  //////////

  function nc_isLinkExists(airtableFieldId) {
    return !!ncLinkMappingTable.find(
      x => x.aTbl.typeOptions.symmetricColumnId === airtableFieldId
    );
  }

  async function nocoCreateProject(projName) {
    // create empty project (XC-DB)
    logDetailed(`Create Project: ${projName}`);
    ncCreatedProjectSchema = await api.project.create({
      title: projName
    });
  }

  async function nocoGetProject(projId) {
    // create empty project (XC-DB)
    logDetailed(`Getting project meta: ${projId}`);
    ncCreatedProjectSchema = await api.project.read(projId);
  }

  async function nocoConfigureGalleryView(sDB, aTblSchema) {
    if (!sDB.syncViews) return;
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const tblId = (await nc_getTableSchema(aTblSchema[idx].name)).id;
      const galleryViews = aTblSchema[idx].views.filter(
        x => x.type === 'gallery'
      );

      const configuredViews = rtc.view.grid + rtc.view.gallery + rtc.view.form;
      rtc.view.gallery += galleryViews.length;

      for (let i = 0; i < galleryViews.length; i++) {
        logDetailed(`   Axios fetch view-data`);

        // create view
        await getViewData(galleryViews[i].id);
        const viewName = aTblSchema[idx].views.find(
          x => x.id === galleryViews[i].id
        )?.name;

        logBasic(
          `:: [${configuredViews + i + 1}/${rtc.view.total}] Gallery : ${
            aTblSchema[idx].name
          } / ${viewName}`
        );

        logDetailed(`NC API dbView.galleryCreate :: ${viewName}`);
        await api.dbView.galleryCreate(tblId, { title: viewName });
        await updateNcTblSchemaById(tblId);
        // syncLog(`[${idx+1}/${aTblSchema.length}][Gallery View][${i+1}/${galleryViews.length}] Create ${viewName}`)

        // await nc_configureFields(g.id, vData.columnOrder, aTblSchema[idx].name, viewName, 'gallery');
      }
    }
  }

  async function nocoConfigureFormView(sDB, aTblSchema) {
    if (!sDB.syncViews) return;
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const tblId = sMap.getNcIdFromAtId(aTblSchema[idx].id);
      const formViews = aTblSchema[idx].views.filter(x => x.type === 'form');

      const configuredViews = rtc.view.grid + rtc.view.gallery + rtc.view.form;
      rtc.view.form += formViews.length;
      for (let i = 0; i < formViews.length; i++) {
        logDetailed(`   Axios fetch view-data`);

        // create view
        const vData = await getViewData(formViews[i].id);
        const viewName = aTblSchema[idx].views.find(
          x => x.id === formViews[i].id
        )?.name;

        logBasic(
          `:: [${configuredViews + i + 1}/${rtc.view.total}] Form : ${
            aTblSchema[idx].name
          } / ${viewName}`
        );

        // everything is default
        let refreshMode = 'NO_REFRESH';
        let msg = 'Thank you for submitting the form!';
        let desc = '';

        // response will not include form object if everything is default
        //
        if (vData.metadata?.form) {
          if (vData.metadata.form?.refreshAfterSubmit)
            refreshMode = vData.metadata.form.refreshAfterSubmit;
          if (vData.metadata.form?.afterSubmitMessage)
            msg = vData.metadata.form.afterSubmitMessage;
          if (vData.metadata.form?.description)
            desc = vData.metadata.form.description;
        }

        const formData = {
          title: viewName,
          heading: viewName,
          subheading: desc,
          success_msg: msg,
          submit_another_form: refreshMode.includes('REFRESH_BUTTON'),
          show_blank_form: refreshMode.includes('AUTO_REFRESH')
        };

        logDetailed(`NC API dbView.formCreate :: ${viewName}`);
        const f = await api.dbView.formCreate(tblId, formData);
        logDetailed(
          `[${idx + 1}/${aTblSchema.length}][Form View][${i + 1}/${
            formViews.length
          }] Create ${viewName}`
        );

        await updateNcTblSchemaById(tblId);

        logDetailed(`   Configure show/hide columns`);
        await nc_configureFields(
          f.id,
          vData.columnOrder,
          aTblSchema[idx].name,
          viewName,
          'form'
        );
      }
    }
  }

  async function nocoConfigureGridView(sDB, aTblSchema) {
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      const tblId = sMap.getNcIdFromAtId(aTblSchema[idx].id);
      const gridViews = aTblSchema[idx].views.filter(x => x.type === 'grid');

      let viewCnt = idx;
      if (syncDB.syncViews)
        viewCnt = rtc.view.grid + rtc.view.gallery + rtc.view.form;
      rtc.view.grid += gridViews.length;

      for (let i = 0; i < (sDB.syncViews ? gridViews.length : 1); i++) {
        logDetailed(`   Axios fetch view-data`);
        // fetch viewData JSON
        const vData = await getViewData(gridViews[i].id);

        // retrieve view name & associated NC-ID
        const viewName = aTblSchema[idx].views.find(
          x => x.id === gridViews[i].id
        )?.name;
        const viewList: any = await api.dbView.list(tblId);
        let ncViewId = viewList?.list?.find(x => x.tn === viewName)?.id;

        logBasic(
          `:: [${viewCnt + i + 1}/${rtc.view.total}] Grid : ${
            aTblSchema[idx].name
          } / ${viewName}`
        );

        // create view (default already created)
        if (i > 0) {
          logDetailed(`NC API dbView.gridCreate :: ${viewName}`);
          const viewCreated = await api.dbView.gridCreate(tblId, {
            title: viewName
          });
          await updateNcTblSchemaById(tblId);
          await sMap.addToMappingTbl(
            gridViews[i].id,
            viewCreated.id,
            viewName,
            tblId
          );
          // syncLog(`[${idx+1}/${aTblSchema.length}][Grid View][${i+1}/${gridViews.length}] Create ${viewName}`)
          ncViewId = viewCreated.id;
        }

        // syncLog(`[${idx+1}/${aTblSchema.length}][Grid View][${i+1}/${gridViews.length}] Hide columns ${viewName}`)
        logDetailed(`   Configure show/hide columns`);
        await nc_configureFields(
          ncViewId,
          vData.columnOrder,
          aTblSchema[idx].name,
          viewName,
          'grid'
        );

        // configure filters
        if (vData?.filters) {
          // syncLog(`[${idx+1}/${aTblSchema.length}][Grid View][${i+1}/${gridViews.length}] Configure filters ${viewName}`)
          logDetailed(`   Configure filter set`);

          // skip filters if nested
          if (!vData.filters.filterSet.find(x => x?.type === 'nested')) {
            await nc_configureFilters(ncViewId, vData.filters);
          }
        }

        // configure sort
        if (vData?.lastSortsApplied?.sortSet.length) {
          // syncLog(`[${idx+1}/${aTblSchema.length}][Grid View][${i+1}/${gridViews.length}] Configure sort ${viewName}`)
          logDetailed(`   Configure sort set`);
          await nc_configureSort(ncViewId, vData.lastSortsApplied);
        }
      }
    }
  }

  async function nocoAddUsers(aTblSchema) {
    const userRoles = {
      owner: 'owner',
      create: 'creator',
      edit: 'editor',
      comment: 'commenter',
      read: 'viewer',
      none: 'viewer'
    };
    const userList = aTblSchema.appBlanket.userInfoById;
    const totalUsers = Object.keys(userList).length;
    let cnt = 0;

    for (const [, value] of Object.entries(
      userList as { [key: string]: any }
    )) {
      logDetailed(
        `[${++cnt}/${totalUsers}] NC API auth.projectUserAdd :: ${value.email}`
      );
      await api.auth.projectUserAdd(ncCreatedProjectSchema.id, {
        email: value.email,
        roles: userRoles[value.permissionLevel]
      });
    }
  }

  function updateNcTblSchema(tblSchema) {
    const tblId = tblSchema.id;

    // replace entry from array if already exists
    const idx = ncSchema.tables.findIndex(x => x.id === tblId);
    if (idx !== -1) ncSchema.tables.splice(idx, 1);
    ncSchema.tables.push(tblSchema);

    // overwrite object if it exists
    ncSchema.tablesById[tblId] = tblSchema;
  }

  async function updateNcTblSchemaById(tblId) {
    const ncTbl = await api.dbTable.read(tblId);
    updateNcTblSchema(ncTbl);
  }

  ///////////////////////

  // statistics
  //
  const migrationStats = [];

  async function generateMigrationStats(aTblSchema) {
    const migrationStatsObj = {
      table_name: '',
      aTbl: {
        columns: 0,
        links: 0,
        lookup: 0,
        rollup: 0
      },
      nc: {
        columns: 0,
        links: 0,
        lookup: 0,
        rollup: 0,
        invalidColumn: 0
      }
    };
    for (let idx = 0; idx < aTblSchema.length; idx++) {
      migrationStatsObj.table_name = aTblSchema[idx].name;

      const aTblLinkColumns = aTblSchema[idx].columns.filter(
        x => x.type === 'foreignKey'
      );
      const aTblLookup = aTblSchema[idx].columns.filter(
        x => x.type === 'lookup'
      );
      const aTblRollup = aTblSchema[idx].columns.filter(
        x => x.type === 'rollup'
      );

      let invalidColumnId = 0;
      for (let i = 0; i < aTblLookup.length; i++) {
        if (
          aTblLookup[i]?.typeOptions?.dependencies?.invalidColumnIds?.length
        ) {
          invalidColumnId++;
        }
      }
      for (let i = 0; i < aTblRollup.length; i++) {
        if (
          aTblRollup[i]?.typeOptions?.dependencies?.invalidColumnIds?.length
        ) {
          invalidColumnId++;
        }
      }

      migrationStatsObj.aTbl.columns = aTblSchema[idx].columns.length;
      migrationStatsObj.aTbl.links = aTblLinkColumns.length;
      migrationStatsObj.aTbl.lookup = aTblLookup.length;
      migrationStatsObj.aTbl.rollup = aTblRollup.length;

      const ncTbl = await nc_getTableSchema(aTblSchema[idx].name);
      const linkColumn = ncTbl.columns.filter(
        x => x.uidt === UITypes.LinkToAnotherRecord
      );
      const lookup = ncTbl.columns.filter(x => x.uidt === UITypes.Lookup);
      const rollup = ncTbl.columns.filter(x => x.uidt === UITypes.Rollup);

      // all links hardwired as m2m. m2m generates additional tables per link
      // hence link/2
      migrationStatsObj.nc.columns =
        ncTbl.columns.length - linkColumn.length / 2;
      migrationStatsObj.nc.links = linkColumn.length / 2;
      migrationStatsObj.nc.lookup = lookup.length;
      migrationStatsObj.nc.rollup = rollup.length;
      migrationStatsObj.nc.invalidColumn = invalidColumnId;

      const temp = JSON.parse(JSON.stringify(migrationStatsObj));
      migrationStats.push(temp);
    }

    const columnSum = migrationStats.reduce((accumulator, object) => {
      return accumulator + object.nc.columns;
    }, 0);
    const linkSum = migrationStats.reduce((accumulator, object) => {
      return accumulator + object.nc.links;
    }, 0);
    const lookupSum = migrationStats.reduce((accumulator, object) => {
      return accumulator + object.nc.lookup;
    }, 0);
    const rollupSum = migrationStats.reduce((accumulator, object) => {
      return accumulator + object.nc.rollup;
    }, 0);

    logDetailed(`Quick Summary:`);
    logDetailed(`:: Total Tables:   ${aTblSchema.length}`);
    logDetailed(`:: Total Columns:  ${columnSum}`);
    logDetailed(`::   Links:        ${linkSum}`);
    logDetailed(`::   Lookup:       ${lookupSum}`);
    logDetailed(`::   Rollup:       ${rollupSum}`);
    logDetailed(`:: Total Filters:  ${rtc.filter}`);
    logDetailed(`:: Total Sort:     ${rtc.sort}`);
    logDetailed(`:: Total Views:    ${rtc.view.total}`);
    logDetailed(`::   Grid:         ${rtc.view.grid}`);
    logDetailed(`::   Gallery:      ${rtc.view.gallery}`);
    logDetailed(`::   Form:         ${rtc.view.form}`);

    const duration = Date.now() - start;
    logDetailed(`:: Migration time:      ${duration}`);
    logDetailed(`:: Axios fetch count:   ${rtc.fetchAt.count}`);
    logDetailed(`:: Axios fetch time:    ${rtc.fetchAt.time}`);
  }

  //////////////////////////////
  // filters

  const filterMap = {
    '=': 'eq',
    '!=': 'neq',
    '<': 'lt',
    '<=': 'lte',
    '>': 'gt',
    '>=': 'gte',
    isEmpty: 'empty',
    isNotEmpty: 'notempty',
    contains: 'like',
    doesNotContain: 'nlike',
    isAnyOf: 'eq',
    isNoneOf: 'neq'
  };

  async function nc_configureFilters(viewId, f) {
    for (let i = 0; i < f.filterSet.length; i++) {
      const filter = f.filterSet[i];
      const colSchema = await nc_getColumnSchema(filter.columnId);

      // column not available;
      // one of not migrated column;
      if (!colSchema) {
        updateMigrationSkipLog(
          sMap.getNcNameFromAtId(viewId),
          colSchema.title,
          colSchema.uidt,
          `filter config skipped; column not migrated`
        );
        continue;
      }
      const columnId = colSchema.id;
      const datatype = colSchema.uidt;
      const ncFilters = [];

      // console.log(filter)
      if (datatype === UITypes.Date || datatype === UITypes.DateTime) {
        // skip filters over data datatype
        updateMigrationSkipLog(
          sMap.getNcNameFromAtId(viewId),
          colSchema.title,
          colSchema.uidt,
          `filter config skipped; filter over date datatype not supported`
        );
        continue;
      }

      // single-select & multi-select
      else if (
        datatype === UITypes.SingleSelect ||
        datatype === UITypes.MultiSelect
      ) {
        // if array, break it down to multiple filters
        if (Array.isArray(filter.value)) {
          for (let i = 0; i < filter.value.length; i++) {
            const fx = {
              fk_column_id: columnId,
              logical_op: f.conjunction,
              comparison_op: filterMap[filter.operator],
              value: sMap.getNcNameFromAtId(filter.value[i])
            };
            ncFilters.push(fx);
          }
        }
        // not array - add as is
        else if (filter.value) {
          const fx = {
            fk_column_id: columnId,
            logical_op: f.conjunction,
            comparison_op: filterMap[filter.operator],
            value: sMap.getNcNameFromAtId(filter.value)
          };
          ncFilters.push(fx);
        }
      }

      // other data types (number/ text/ long text/ ..)
      else if (filter.value) {
        const fx = {
          fk_column_id: columnId,
          logical_op: f.conjunction,
          comparison_op: filterMap[filter.operator],
          value: filter.value
        };
        ncFilters.push(fx);
      }

      // insert filters
      for (let i = 0; i < ncFilters.length; i++) {
        await api.dbTableFilter.create(viewId, {
          ...ncFilters[i]
        });
        rtc.filter++;
      }
    }
  }

  async function nc_configureSort(viewId, s) {
    for (let i = 0; i < s.sortSet.length; i++) {
      const columnId = (await nc_getColumnSchema(s.sortSet[i].columnId))?.id;

      if (columnId)
        await api.dbTableSort.create(viewId, {
          fk_column_id: columnId,
          direction: s.sortSet[i].ascending ? 'asc' : 'dsc'
        });
      rtc.sort++;
    }
  }

  async function nc_configureFields(_viewId, c, tblName, viewName, viewType?) {
    // force hide PK column
    const hiddenColumns = ['_aTbl_nc_rec_id', '_aTbl_nc_rec_hash'];

    // column order corrections
    // retrieve table schema
    const ncTbl = await nc_getTableSchema(tblName);
    // retrieve view ID
    const viewId = ncTbl.views.find(x => x.title === viewName).id;

    // nc-specific columns; default hide.
    for (let j = 0; j < hiddenColumns.length; j++) {
      const ncColumnId = ncTbl.columns.find(x => x.title === hiddenColumns[j])
        .id;
      const ncViewColumnId = await nc_getViewColumnId(
        viewId,
        viewType,
        ncColumnId
      );
      if (ncViewColumnId === undefined) continue;

      // first two positions held by record id & record hash
      await api.dbViewColumn.update(viewId, ncViewColumnId, {
        show: false,
        order: j + 1 + c.length
      });
    }

    // rest of the columns from airtable- retain order & visibility property
    for (let j = 0; j < c.length; j++) {
      const ncColumnId = sMap.getNcIdFromAtId(c[j].columnId);
      const ncViewColumnId = await nc_getViewColumnId(
        viewId,
        viewType,
        ncColumnId
      );
      if (ncViewColumnId === undefined) continue;

      // first two positions held by record id & record hash
      await api.dbViewColumn.update(viewId, ncViewColumnId, {
        show: c[j].visibility,
        order: j + 1
      });
    }
  }

  ///////////////////////////////////////////////////////////////////////////////
  let recordCnt = 0;
  try {
    logBasic('SDK initialized');
    api = new Api({
      baseURL: syncDB.baseURL,
      headers: {
        'xc-auth': syncDB.authToken
      }
    });

    logDetailed('Project initialization started');
    // delete project if already exists
    if (debugMode) await init(syncDB);

    logDetailed('Project initialized');

    logBasic('Retrieving Airtable schema');
    // read schema file
    const schema = await getAirtableSchema(syncDB);
    const aTblSchema = schema.tableSchemas;
    logDetailed('Project schema extraction completed');

    if (!syncDB.projectId) {
      if (!syncDB.projectName)
        throw new Error('Project name or id not provided');
      // create empty project
      await nocoCreateProject(syncDB.projectName);
      logDetailed('Project created');
    } else {
      await nocoGetProject(syncDB.projectId);
      syncDB.projectName = ncCreatedProjectSchema?.title;
      logDetailed('Getting existing project meta');
    }

    logBasic('Importing Tables...');
    // prepare table schema (base)
    await nocoCreateBaseSchema(aTblSchema);
    logDetailed('Table creation completed');

    logDetailed('Configuring Links');
    // add LTAR
    await nocoCreateLinkToAnotherRecord(aTblSchema);
    logDetailed('Migrating LTAR columns completed');

    logDetailed(`Configuring Lookup`);
    // add look-ups
    await nocoCreateLookups(aTblSchema);
    logDetailed('Migrating Lookup columns completed');

    logDetailed('Configuring Rollup');
    // add roll-ups
    await nocoCreateRollup(aTblSchema);
    logDetailed('Migrating Rollup columns completed');

    logDetailed('Migrating Lookup form Rollup columns');
    // lookups for rollup
    await nocoLookupForRollup();
    logDetailed('Migrating Lookup form Rollup columns completed');

    logDetailed('Configuring Primary value column');
    // configure primary values
    await nocoSetPrimary(aTblSchema);
    logDetailed('Configuring primary value column completed');

    logBasic('Configuring User(s)');
    // add users
    await nocoAddUsers(schema);
    logDetailed('Adding users completed');

    // hide-fields
    // await nocoReconfigureFields(aTblSchema);

    logBasic('Syncing views');
    // configure views
    await nocoConfigureGridView(syncDB, aTblSchema);
    await nocoConfigureFormView(syncDB, aTblSchema);
    await nocoConfigureGalleryView(syncDB, aTblSchema);
    logDetailed('Syncing views completed');

    if (process_aTblData) {
      try {
        // await nc_DumpTableSchema();
        const ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id);
        logBasic('Reading Records...');

        for (let i = 0; i < ncTblList.list.length; i++) {
          const ncTbl = await api.dbTable.read(ncTblList.list[i].id);
          recordCnt = 0;
          await nocoReadData(syncDB, ncTbl, async (sDB, table, record) => {
            await nocoBaseDataProcessing(sDB, table, record);
          });
          logDetailed(`Data inserted from ${ncTbl.title}`);
        }

        logBasic('Configuring Record Links...');
        // Configure link @ Data row's
        for (let idx = 0; idx < ncLinkMappingTable.length; idx++) {
          const x = ncLinkMappingTable[idx];
          const ncTbl = await nc_getTableSchema(
            aTbl_getTableName(x.aTbl.tblId).tn
          );

          recordCnt = 0;
          await nocoReadDataSelected(
            syncDB.projectName,
            ncTbl,
            async (projName, table, record, _field) => {
              await nocoLinkProcessing(projName, table, record, _field);
            },
            x.aTbl.name
          );
          logDetailed(`Linked data to ${ncTbl.title}`);
        }
      } catch (error) {
        logDetailed(
          `There was an error while migrating data! Please make sure your API key (${syncDB.apiKey}) is correct.`
        );
        logDetailed(`Error: ${error}`);
      }
    }
    if (generate_migrationStats) {
      await generateMigrationStats(aTblSchema);
    }
  } catch (e) {
    if (e.response?.data?.msg) {
      throw new Error(e.response.data.msg);
    }
    throw e;
  }
};

export interface AirtableSyncConfig {
  id: string;
  baseURL: string;
  authToken: string;
  projectName?: string;
  projectId?: string;
  apiKey: string;
  shareId: string;
  syncViews: boolean;
}
