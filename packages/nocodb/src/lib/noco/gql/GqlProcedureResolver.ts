import autoBind from 'auto-bind';

import BaseProcedure from "../common/BaseProcedure";
import XcProcedure from "../common/XcProcedure";

import {GqlApiBuilder} from "./GqlApiBuilder";
import GqlBaseResolver from "./GqlBaseResolver";

export class GqlProcedureResolver
  extends BaseProcedure {

  private acls: { [aclName: string]: { [role: string]: boolean } };

  constructor(builder: GqlApiBuilder, functions: any[], procedures: any[], acls) {
    super();
    autoBind(this);
    this.builder = builder;
    this.functions = functions;
    this.procedures = procedures;
    this.acls = acls;
    this.xcProcedure = new XcProcedure(builder);
  }

  public fnHandler(name) {
    return (async (args) => {
      let body = [];
      try {
        body = JSON.parse(args.body);
      } catch (_e) {
      }
      const result = await this.xcProcedure.callFunction(name, body);
      return JSON.stringify(result, null, 2);
    }).bind(this)
  }

  private procHandler(name) {
    // @ts-ignore
    return (async (args) => {
      let body = [];
      try {
        body = JSON.parse(args.body);
      } catch (_e) {
      }
      const result = await this.xcProcedure.callProcedure(name, body);
      return JSON.stringify(result, null, 2);
    }).bind(this)
  }

  public mapResolvers(): any {
    const resolvers = {};

    if (this.functions) {
      for (const {function_name} of this.functions) {
        resolvers[`_${function_name}`] = this.fnHandler(function_name);
      }
    }
    if (this.procedures) {
      for (const {procedure_name} of this.procedures) {
        resolvers[`_${procedure_name}`] = this.procHandler(procedure_name);
      }
    }
    return GqlBaseResolver.applyMiddlewares([this.middleware], resolvers);

  }

  public getSchema() {
    if (!this.functions?.length && !this.procedures?.length) {
      return ''
    }
    let resolvers = `
type Mutation {
 `;
    if (this.functions) {
      for (const {function_name} of this.functions) {
        resolvers += `_${function_name}(body:String):String\r\n`;
      }
    }
    if (this.procedures) {
      for (const {procedure_name} of this.procedures) {
        resolvers += `_${procedure_name}(body:String):String\r\n`;
      }
    }
    return resolvers + `}\r\n`;
  }

  updateMiddlewareBody(_body: string) { }

  private async middleware(_args, {req}, info: any) {
    const roles = (req as any)?.session?.passport?.user?.roles ?? {
      guest: true
    };

    try {
      const allowed = Object.keys(roles).some(role => roles[role] && this.acls?.[info.fieldName.slice(1)]?.[role]);
      if (allowed) {
        // any additional rules can be made here
        return;
      } else {
        const msg = roles.guest ? `Access Denied : Please Login or Signup for a new account` : `Access Denied for this account`;
        throw new Error(msg);
      }
    } catch (e) {
      throw e
    }
  }
}


/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
