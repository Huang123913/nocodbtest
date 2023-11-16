import { RelationTypes, UITypes } from 'nocodb-sdk';
import type LookupColumn from '../models/LookupColumn';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type {
  Column,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  Model,
  RollupColumn,
} from '~/models';
import type { LinksColumn } from '~/models';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { getAliasGenerator } from '~/utils';
import { NcError } from '~/helpers/catchError';

const LOOKUP_VAL_SEPARATOR = '___';

export default async function generateLookupSelectQuery({
  column,
  baseModelSqlv2,
  alias,
  model,
  getAlias = getAliasGenerator('__lk_slt_'),
}: {
  column: Column;
  baseModelSqlv2: BaseModelSqlv2;
  alias: string;
  model: Model;
  getAlias?: ReturnType<typeof getAliasGenerator>;
}): Promise<any> {
  const knex = baseModelSqlv2.dbDriver;

  const rootAlias = alias;

  {
    let selectQb;
    const alias = getAlias();
    const lookup = await column.getColOptions<LookupColumn>();
    {
      const relationCol = await lookup.getRelationColumn();
      const relation =
        await relationCol.getColOptions<LinkToAnotherRecordColumn>();

      // if not belongs to then throw error as we don't support
      if (relation.type === RelationTypes.BELONGS_TO) {
        const childColumn = await relation.getChildColumn();
        const parentColumn = await relation.getParentColumn();
        const childModel = await childColumn.getModel();
        await childModel.getColumns();
        const parentModel = await parentColumn.getModel();
        await parentModel.getColumns();

        selectQb = knex(
          `${baseModelSqlv2.getTnPath(parentModel.table_name)} as ${alias}`,
        ).where(
          `${alias}.${parentColumn.column_name}`,
          knex.raw(`??`, [
            `${rootAlias || baseModelSqlv2.getTnPath(childModel.table_name)}.${
              childColumn.column_name
            }`,
          ]),
        );
      }

      // if not belongs to then throw error as we don't support
      else if (relation.type === RelationTypes.HAS_MANY) {
        const childColumn = await relation.getChildColumn();
        const parentColumn = await relation.getParentColumn();
        const childModel = await childColumn.getModel();
        await childModel.getColumns();
        const parentModel = await parentColumn.getModel();
        await parentModel.getColumns();

        selectQb = knex(
          `${baseModelSqlv2.getTnPath(childModel.table_name)} as ${alias}`,
        ).where(
          `${alias}.${childColumn.column_name}`,
          knex.raw(`??`, [
            `${rootAlias || baseModelSqlv2.getTnPath(parentModel.table_name)}.${
              parentColumn.column_name
            }`,
          ]),
        );
      }

      // if not belongs to then throw error as we don't support
      else if (relation.type === RelationTypes.MANY_TO_MANY) {
        const childColumn = await relation.getChildColumn();
        const parentColumn = await relation.getParentColumn();
        const childModel = await childColumn.getModel();
        await childModel.getColumns();
        const parentModel = await parentColumn.getModel();
        await parentModel.getColumns();

        selectQb = knex(
          `${baseModelSqlv2.getTnPath(parentModel.table_name)} as ${alias}`,
        );

        const mmTableAlias = getAlias();

        const mmModel = await relation.getMMModel();
        const mmChildCol = await relation.getMMChildColumn();
        const mmParentCol = await relation.getMMParentColumn();

        selectQb
          .innerJoin(
            baseModelSqlv2.getTnPath(mmModel.table_name, mmTableAlias),
            knex.ref(`${mmTableAlias}.${mmParentCol.column_name}`),
            '=',
            knex.ref(`${alias}.${parentColumn.column_name}`),
          )
          .where(
            knex.ref(`${mmTableAlias}.${mmChildCol.column_name}`),
            '=',
            knex.ref(
              `${
                rootAlias || baseModelSqlv2.getTnPath(childModel.table_name)
              }.${childColumn.column_name}`,
            ),
          );
      }
    }
    let lookupColumn = await lookup.getLookupColumn();
    let prevAlias = alias;
    while (
      lookupColumn.uidt === UITypes.Lookup ||
      lookupColumn.uidt === UITypes.LinkToAnotherRecord
    ) {
      const nestedAlias = getAlias();

      let relationCol: Column<LinkToAnotherRecordColumn | LinksColumn>;
      let nestedLookupColOpt: LookupColumn;

      if (lookupColumn.uidt === UITypes.Lookup) {
        nestedLookupColOpt = await lookupColumn.getColOptions<LookupColumn>();
        relationCol = await nestedLookupColOpt.getRelationColumn();
      } else {
        relationCol = lookupColumn;
      }

      const relation =
        await relationCol.getColOptions<LinkToAnotherRecordColumn>();

      // if any of the relation in nested lookup is
      // not belongs to then throw error as we don't support
      if (relation.type === RelationTypes.BELONGS_TO) {
        const childColumn = await relation.getChildColumn();
        const parentColumn = await relation.getParentColumn();
        const childModel = await childColumn.getModel();
        await childModel.getColumns();
        const parentModel = await parentColumn.getModel();
        await parentModel.getColumns();

        selectQb.join(
          `${baseModelSqlv2.getTnPath(
            parentModel.table_name,
          )} as ${nestedAlias}`,
          `${nestedAlias}.${parentColumn.column_name}`,
          `${prevAlias}.${childColumn.column_name}`,
        );
      } else if (relation.type === RelationTypes.HAS_MANY) {
        const childColumn = await relation.getChildColumn();
        const parentColumn = await relation.getParentColumn();
        const childModel = await childColumn.getModel();
        await childModel.getColumns();
        const parentModel = await parentColumn.getModel();
        await parentModel.getColumns();

        selectQb.join(
          `${baseModelSqlv2.getTnPath(
            childModel.table_name,
          )} as ${nestedAlias}`,
          `${nestedAlias}.${childColumn.column_name}`,
          `${prevAlias}.${parentColumn.column_name}`,
        );
      } else if (relation.type === RelationTypes.MANY_TO_MANY) {
        const childColumn = await relation.getChildColumn();
        const parentColumn = await relation.getParentColumn();
        const childModel = await childColumn.getModel();
        await childModel.getColumns();
        const parentModel = await parentColumn.getModel();
        await parentModel.getColumns();

        const mmTableAlias = getAlias();

        const mmModel = await relation.getMMModel();
        const mmChildCol = await relation.getMMChildColumn();
        const mmParentCol = await relation.getMMParentColumn();

        // knex(
        //   `${baseModelSqlv2.getTnPath(
        //     parentModel?.table_name,
        //   )} as ${nestedAlias}`,
        // )
        selectQb
          .innerJoin(
            baseModelSqlv2.getTnPath(mmModel.table_name, mmTableAlias),
            knex.ref(`${mmTableAlias}.${mmChildCol.column_name}`),
            '=',
            knex.ref(`${prevAlias}.${childColumn.column_name}`),
          )
          .innerJoin(
            knex.raw('?? as ??', [
              baseModelSqlv2.getTnPath(parentModel.table_name),
              nestedAlias,
            ]),
            knex.ref(`${mmTableAlias}.${mmParentCol.column_name}`),
            '=',
            knex.ref(`${nestedAlias}.${parentColumn.column_name}`),
          )
          .where(
            knex.ref(`${mmTableAlias}.${mmChildCol.column_name}`),
            '=',
            knex.ref(
              `${alias || baseModelSqlv2.getTnPath(childModel.table_name)}.${
                childColumn.column_name
              }`,
            ),
          );
      }

      if (lookupColumn.uidt === UITypes.Lookup)
        lookupColumn = await nestedLookupColOpt.getLookupColumn();
      else
        lookupColumn = await relationCol
          .getColOptions()
          .then((colOpt) => colOpt.getRelatedTable())
          .then((model) => model.getColumns())
          .then((cols) => cols.find((col) => col.pv));
      prevAlias = nestedAlias;
    }

    switch (lookupColumn.uidt) {
      case UITypes.Links:
      case UITypes.Rollup:
        {
          const builder = (
            await genRollupSelectv2({
              baseModelSqlv2,
              knex,
              columnOptions:
                (await lookupColumn.getColOptions()) as RollupColumn,
              alias: prevAlias,
            })
          ).builder;
          selectQb.select(builder);
        }
        break; /*
      case UITypes.LinkToAnotherRecord:
        {
          const nestedAlias = getAlias();
          const relation =
            await lookupColumn.getColOptions<LinkToAnotherRecordColumn>();
          if (relation.type !== 'bt') return;

          const colOptions =
            (await column.getColOptions()) as LinkToAnotherRecordColumn;
          const childColumn = await colOptions.getChildColumn();
          const parentColumn = await colOptions.getParentColumn();
          const childModel = await childColumn.getModel();
          await childModel.getColumns();
          const parentModel = await parentColumn.getModel();
          await parentModel.getColumns();

          selectQb
            .join(
              `${baseModelSqlv2.getTnPath(
                parentModel.table_name,
              )} as ${nestedAlias}`,
              `${nestedAlias}.${parentColumn.column_name}`,
              `${prevAlias}.${childColumn.column_name}`,
            )
            .select(parentModel?.displayValue?.column_name);
        }
        break;*/
      case UITypes.Formula:
        {
          const builder = (
            await formulaQueryBuilderv2(
              baseModelSqlv2,
              (
                await column.getColOptions<FormulaColumn>()
              ).formula,
              null,
              model,
              column,
            )
          ).builder;

          selectQb.select(builder);
        }
        break;
      default:
        {
          selectQb.select(
            `${prevAlias}.${lookupColumn.column_name} as ${lookupColumn.title}`,
          );
        }

        break;
    }

    const subQueryAlias = getAlias();

    if (baseModelSqlv2.isPg) {
      selectQb.orderBy(`${lookupColumn.title}`, 'asc');
      // alternate approach with array_agg
      return {
        builder: knex
          .select(knex.raw('json_agg(??)::text', [lookupColumn.title]))
          .from(selectQb.as(subQueryAlias)),
      };
      /*
      // alternate approach with array_agg
      return {
        builder: knex
          .select(knex.raw('array_agg(??)', [lookupColumn.title]))
          .from(selectQb),
      };*/
      // alternate approach with string aggregation
      // return {
      //   builder: knex
      //     .select(
      //       knex.raw('STRING_AGG(??::text, ?)', [
      //         lookupColumn.title,
      //         LOOKUP_VAL_SEPARATOR,
      //       ]),
      //     )
      //     .from(selectQb.as(subQueryAlias)),
      // };
    } else if (baseModelSqlv2.isMySQL) {
      // alternate approach with JSON_ARRAYAGG
      return {
        builder: knex
          .select(
            knex.raw('cast(JSON_ARRAYAGG(??) as NCHAR)', [lookupColumn.title]),
          )
          .from(selectQb.as(subQueryAlias)),
      };

      // return {
      //   builder: knex
      //     .select(
      //       knex.raw('GROUP_CONCAT(?? ORDER BY ?? ASC SEPARATOR ?)', [
      //         lookupColumn.title,
      //         lookupColumn.title,
      //         LOOKUP_VAL_SEPARATOR,
      //       ]),
      //     )
      //     .from(selectQb.as(subQueryAlias)),
      // };
    } else if (baseModelSqlv2.isSqlite) {
      // ref: https://stackoverflow.com/questions/13382856/sqlite3-join-group-concat-using-distinct-with-custom-separator
      // selectQb.orderBy(`${lookupColumn.title}`, 'asc');
      return {
        builder: knex
          .select(
            knex.raw(`group_concat(??, ?)`, [
              lookupColumn.title,
              LOOKUP_VAL_SEPARATOR,
            ]),
          )
          .from(selectQb.as(subQueryAlias)),
      };
    }

    NcError.notImplemented('Database not supported Group by on Lookup');
  }
}