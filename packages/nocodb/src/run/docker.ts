import cors from 'cors';
import express from 'express';
import { getConnectionManager } from 'typeorm';
import Noco from '../lib/Noco';
import { createDatabaseConnection } from '../databaseConnection';
import { setupReusablesAndRoutes } from '../reusables';

const server = express();
server.enable('trust proxy');
server.disable('etag');
server.disable('x-powered-by');
server.use(
  cors({
    exposedHeaders: 'xc-db-response',
  })
);

server.set('view engine', 'ejs');

process.env[`DEBUG`] = 'xc*';

(async () => {
  let connection;
  if (!getConnectionManager().has('default')) {
    connection = await createDatabaseConnection();
  } else {
    connection = getConnectionManager().get('default');
  }
  await setupReusablesAndRoutes(server, connection);

  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
