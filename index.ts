import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';

import minimist from 'minimist';

interface AsyncMapFunction<T, U> {
  (t: T): Promise<U>
}

interface AsyncContextFunction<T> {
  (t: T): Promise<void>
}

class JsonFile<T> {
  constructor(private path: string) {
  }

  async read(): Promise<T> {
    return JSON.parse(
      (await readFile(this.path)).toString('utf8')
    );
  }

  async write(json: T): Promise<void> {
    await writeFile(this.path, JSON.stringify(json, null, 2));
  }

  async transaction(fn: AsyncMapFunction<T, T>): Promise<void> {
    let json = await this.read();
    json = await fn(json);
    await this.write(json);
  }

  async with(fn: AsyncContextFunction<T>): Promise<void> {
    let json = await this.read();
    await fn(json);
  }

  async flatMap<U>(fn: AsyncMapFunction<T, U>): Promise<U> {
    let json = await this.read();
    return fn(json);
  }
}

interface DefinitionsJson {
  [pkg: string]: string;
}

interface RegistryJson {
  registryUrl: string;
  definitions: DefinitionsJson;
}

interface Definition {
  name: string;
  url: string
}

class Registry {
  public file: JsonFile<RegistryJson>

  constructor(registryHome: string) {
    this.file = new JsonFile<RegistryJson>(path.join(registryHome, 'registry.json'));
  }

  async add(pkg: string, url?: string): Promise<void> {
    await this.file.transaction(async (json: RegistryJson) => {
      json.definitions[pkg] = url ? url : `${url || json.registryUrl}/types/${pkg}/index.d.ts`;
      return json
    });
  }

  async remove(pkg: string): Promise<void> {
    await this.file.transaction(async (json: RegistryJson) => {
      delete json.definitions[pkg];
      return json;
    });
  }

  async findDefinitions(dependencies: Dependency[]): Promise<Definition[]> {
    const definitions: Definition[] = [];

    await this.file.with(async (json) => {
      for (let { name } of dependencies) {
        if (json.definitions[name]) {
          definitions.push({
            name,
            url: json.definitions[name]
          });
        }
      }
    });

    return definitions;
  }
}

interface DependenciesJson {
  [p: string]: string
}

interface PackageJson {
  dependencies?: DependenciesJson
  devDependencies?: DependenciesJson
}

interface Dependency {
  name: string;
  version: string;
  type: 'production' | 'development'
}

class Package {
  private file: JsonFile<PackageJson>

  constructor(projectHome: string) {
    this.file = new JsonFile<PackageJson>(path.join(projectHome, 'package.json'))
  }

  async dependencies(): Promise<Dependency[]> {
    const json = await this.file.read();

    return Object.entries(
      json.dependencies || {}
    ).map(([name, version]): Dependency => {
      return {
        name,
        version,
        type: 'production'
      };
    }).concat(
      Object.entries(json.devDependencies || {}).map(([name, version]): Dependency => {
        return {
          name,
          version,
          type: 'development'
        }
      })
    );
  }
}

async function install(registry: Registry, pkg: Package) {
  const dependencies = await pkg.dependencies();
  const definitions = await registry.findDefinitions(dependencies);

  console.log(definitions);

  // mkdir -p ${pkg.path}/types
  // for each definition, use undici to download and save the file to
  // ${pkg.path}/types

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
    case 'install':
      await install(registry, new Package('.'));
      break;
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

