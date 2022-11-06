import path from 'path';

const { DOCKER_DB_FILE } = process.env;

module.exports = {
  title: 'default',
  envs: {
    _noco: {
      db: [
        {
          client: 'better-sqlite3',
          connection: {
            client: 'better-sqlite3',
            connection: {
              filename:
                DOCKER_DB_FILE ||
                `${path.join(process.cwd(), 'xmigrator', 'default_dev.db')}`,
            },
            useNullAsDefault: true,
          },
          meta: {
            tn: 'nc_evolutions',
            dbAlias: 'primary',
          },
        },
      ],
    },
    test: {
      api: {},
      db: [
        {
          client: 'better-sqlite3',
          connection: {
            client: 'better-sqlite3',
            connection: {
              filename:
                DOCKER_DB_FILE ||
                `${path.join(process.cwd(), 'xmigrator', 'default_test.db')}`,
            },
            useNullAsDefault: true,
          },
          meta: {
            tn: 'nc_evolutions',
            dbAlias: 'primary',
          },
        },
      ],
    },
  },
  workingEnv: '_noco',
  meta: {
    version: '0.5',
    seedsFolder: 'seeds',
    queriesFolder: 'queries',
    apisFolder: 'apis',
    orm: 'sequelize',
    router: 'express',
  },
};
