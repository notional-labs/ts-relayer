import fs from 'fs';
import os from 'os';
import path from 'path';

import Ajv, { JSONSchemaType } from 'ajv';
import yaml from 'js-yaml';

import { appFile } from '../constants';
import { AppConfig } from '../types';

import ErrnoException = NodeJS.ErrnoException;

function readAppYaml(filepath: string) {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch (error) {
    const nodeErr = error as ErrnoException;
    if (nodeErr.code !== 'ENOENT') {
      throw error;
    }

    return null;
  }
}

export function loadAndValidateApp(home: string) {
  const appContents = readAppYaml(path.join(home, appFile));

  if (!appContents) {
    return null;
  }

  const app = yaml.load(appContents);

  const ajv = new Ajv({ allErrors: true });
  const schema: JSONSchemaType<AppConfig> = {
    type: 'object',
    additionalProperties: false,
    required: [],
    properties: {
      src: { type: 'string', nullable: true, default: null },
      srcConnection: { type: 'string', nullable: true, default: null },
      dest: { type: 'string', nullable: true },
      destConnection: { type: 'string', nullable: true },
      mnemonic: { type: 'string', nullable: true },
      keyFile: { type: 'string', nullable: true },
      enableMetrics: { type: 'boolean', nullable: true },
      metricsPort: { type: 'number', nullable: true },
    },
  };
  const validate = ajv.compile(schema);

  if (!validate(app)) {
    const errors = (validate.errors ?? []).map(
      ({ dataPath, message }) => `"${dataPath}" ${message}`
    );
    throw new Error([`${appFile} validation failed.`, ...errors].join(os.EOL));
  }

  return app;
}
