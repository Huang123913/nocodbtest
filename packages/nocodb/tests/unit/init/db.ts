import { DbConfig } from "../../../src/interface/config";


const isSqlite = (context) =>{
  return (context.dbConfig as DbConfig).client === 'sqlite' || (context.dbConfig as DbConfig).client === 'sqlite3' || (context.dbConfig as DbConfig).client === 'better-sqlite3';
}

const isMysql = (context) =>
  (context.dbConfig as DbConfig).client === 'mysql' ||
  (context.dbConfig as DbConfig).client === 'mysql2';

export { isSqlite, isMysql };
