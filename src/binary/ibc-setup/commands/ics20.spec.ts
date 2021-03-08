import fs from 'fs';
import path from 'path';

import { assert } from '@cosmjs/utils';
import test from 'ava';
import sinon from 'sinon';

import { appFile } from '../../constants';

import { createClient, Options, run } from './ics20';

const fsWriteFileSync = sinon.stub(fs, 'writeFileSync');
const fsReadFileSync = sinon.stub(fs, 'readFileSync');
const consoleLog = sinon.stub(console, 'log');

const mnemonic =
  'enlist hip relief stomach skate base shallow young switch frequent cry park';

const registryYaml = `
version: 1

chains:
  local_wasm:
    chain_id: testing
    prefix: wasm
    gas_price: 0.025ucosm
    rpc:
      - http://localhost:26659
  local_simapp:
    chain_id: simd-testing
    prefix: cosmos
    gas_price: 0.025ucosm
    rpc:
      - http://localhost:26658`;

const app = {
  src: 'local_wasm',
  dest: 'local_simapp',
};

test.beforeEach(() => {
  sinon.reset();
});

test.serial('ics20 create channels with new connection', async (t) => {
  const ibcClientWasm = await createClient(mnemonic, {
    prefix: 'wasm',
    rpc: ['http://localhost:26659'],
  });

  const ibcClientSimapp = await createClient(mnemonic, {
    prefix: 'cosmos',
    rpc: ['http://localhost:26658'],
  });

  const allConnectionsWasm = await ibcClientWasm.query.ibc.connection.allConnections();
  const allConnectionsSimapp = await ibcClientSimapp.query.ibc.connection.allConnections();

  const options: Options = {
    home: '/home/user',
    mnemonic,
    src: 'local_wasm',
    dest: 'local_simapp',
    srcPort: 'transfer',
    destPort: 'custom',
    connections: null,
  };

  fsReadFileSync.returns(registryYaml);
  fsWriteFileSync.returns();

  await run(options, app);

  const args = fsWriteFileSync.getCall(0).args as [string, string];
  const contentsRegexp = new RegExp(
    `src: local_wasm
dest: local_simapp
srcConnection: .+
destConnection: .+
`
  );
  t.assert(fsWriteFileSync.calledOnce);
  t.is(args[0], path.join(options.home, appFile));
  t.regex(args[1], contentsRegexp);
  t.assert(consoleLog.calledTwice);
  t.assert(consoleLog.calledWithMatch(/Created connections/));
  t.assert(consoleLog.calledWithMatch(/Created channels/));

  const nextAllConnectionsWasm = await ibcClientWasm.query.ibc.connection.allConnections();
  const srcConnectionIdMatch = /srcConnection: (?<connection>.+)/.exec(args[1]);
  const srcConnectionId = srcConnectionIdMatch?.groups?.connection;
  assert(srcConnectionId);
  const nextConnectionWasm = await ibcClientWasm.query.ibc.connection.connection(
    srcConnectionId
  );

  const nextAllConnectionsSimapp = await ibcClientSimapp.query.ibc.connection.allConnections();
  const destConnectionIdMatch = /destConnection: (?<connection>.+)/.exec(
    args[1]
  );
  const destConnectionId = destConnectionIdMatch?.groups?.connection;
  assert(destConnectionId);
  const nextConnectionSimapp = await ibcClientWasm.query.ibc.connection.connection(
    destConnectionId
  );

  t.is(
    nextAllConnectionsWasm.connections.length,
    allConnectionsWasm.connections.length + 1
  );
  t.is(
    nextAllConnectionsSimapp.connections.length,
    allConnectionsSimapp.connections.length + 1
  );
  t.assert(nextConnectionWasm.connection?.clientId);
  t.assert(nextConnectionSimapp.connection?.clientId);
});
