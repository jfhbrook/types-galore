import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';

import minimist from 'minimist';

function typeDefinitionsPath(packageName: string): string {
  return path.join(__dirname, 'types', packageName);
}

interface DefinitionsJson {
  [pkg: string]: string
}

interface RegistryJson {
  registryUrl: string,
  definitions: DefinitionsJson
}

interface AsyncMapFunction<T> {
  (t: T): Promise<T>
}

interface AsyncContextFunction<T> {
  (t: T): Promise<void>
}

class Registry {
  public registryJsonPath: string;

  constructor(public home: string) {
    this.registryJsonPath = path.join(home, 'registry.json');
  }

  private async readRegistryJson(): Promise<RegistryJson> {
    return JSON.parse(
      (await readFile(this.registryJsonPath)).toString('utf8')
    );
  }

  private async writeRegistryJson(json: RegistryJson): Promise<void> {
    await writeFile(this.registryJsonPath, JSON.stringify(json, null, 2));
  }

  async transaction(fn: AsyncMapFunction<RegistryJson>): Promise<void> {
    let json = await this.readRegistryJson();
    json = await fn(json);
    await this.writeRegistryJson(json);
  }

  async with(fn: AsyncContextFunction<RegistryJson>): Promise<void> {
    let json = await this.readRegistryJson();
    await fn(json);
  }

  async add(pkg: string, url?: string): Promise<void> {
    await this.transaction(async (json: RegistryJson) => {
      json.definitions[pkg] = url ? url : `${url || json.registryUrl}/types/${pkg}/index.d.ts`;
      return json
    });
  }

  async remove(pkg: string): Promise<void> {
    await this.transaction(async (json: RegistryJson) => {
      delete json.definitions[pkg];
      return json;
    });
  }
}

export async function main(argv: typeof process.argv) {
  const opts = minimist(argv, {
    boolean: [
      "help"
    ],
    string: [
      "registry-path"
    ],
    alias: {
      'help': ['h']
    },
    default: {
      'registry-path': '.'
    }
  });

  if (opts.help) {
    console.error('USAGE: types-galore --install PACKAGE');
    return;
  }

  const registry = new Registry(opts['registry-path']);

  const command = opts._.shift();

  let pkg: string | undefined;
  let url: string | undefined;

  switch (command) {
    case 'add':
      pkg = opts._.shift();
      url = opts._.shift();
      if (!pkg) {
        throw new Error('must specify a package');
      }
      await registry.add(pkg, url);
      break;
    case 'remove':
      pkg = opts._.shift();
      if (!pkg) {
        throw new Error('must specify a package');
      }
      await registry.remove(pkg);
      break;
    default:
      throw new Error(`unknown command: ${command}`);
  }

  const install: string[] = opts.install ? (Array.isArray(opts.install) ? opts.install : [opts.install]) : [];

  console.log(install);
}

/*
types-galore install (as a post-install hook):

1. look at what packages npm says are dependencies
2. look for definitions which match the package name on github
3. downloads/unpacks the files with undici

types-galore init
1. ensures that the types path is specified in tsc config and in typesGalore
   section of package.json

for github stuff: can I generally just copy the index.ts into pkg.ts ? I think
so, right? if not, fuck it, bundle all of them
*/
