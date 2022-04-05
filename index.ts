import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';

import { App } from '@jfhbrook/mrs-commanderson';
import type { ParsedArgs } from 'minimist';

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

interface ChannelJson {
  url: string;
}

interface DefinitionJson {
  channel: string;
  files: string[];
}

interface RegistryJson {
  defaultChannel: string,
  channels: Record<string, ChannelJson>;
  definitions: Record<string, DefinitionJson>;
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

  async addPackage(pkg: string, channel?: string, files?: string[]): Promise<void> {
    await this.file.transaction(async (json: RegistryJson) => {
      const ch = channel ? channel : json.defaultChannel;

      json.definitions[pkg] = {
        channel: ch,
        files: [
          'types/${pkg}/index.d.ts'
        ]
      };

      return json;
    });
  }

  async removePackage(pkg: string): Promise<void> {
    await this.file.transaction(async (json: RegistryJson) => {
      delete json.definitions[pkg];
      return json;
    });
  }

  async addChannel(channel: string, url: string): Promise<void> {
    await this.file.transaction(async (json: RegistryJson) => {
      json.channels[channel] = { url };
      return json;
    });
  }

  async removeChannel(channel: string): Promise<void> {
    await this.file.transaction(async (json: RegistryJson) => {
      delete json.channels[channel];
      return json;
    });
  }

  async setDefaultChannel(channel: string): Promise<void> {
    await this.file.transaction(async (json: RegistryJson) => {
      json.defaultChannel = channel;
      return json;
    });
  }

  async findDefinitions(dependencies: Dependency[]): Promise<Definition[]> {
    const definitions: Definition[] = [];

    await this.file.with(async (json) => {
      for (let { name } of dependencies) {
        if (json.definitions[name]) {
          for (let file of json.definitions[name].files) {
            definitions.push({
              name,
              url: `${json.channels[name]}/${file}`
            });
          }
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

interface Context {
  registry?: Registry
}

const app = new App<Context>({
  boolean: [
    'help',
  ],
  string: [
    'file'
  ],
  alias: {
    'help': ['h']
  },
  default: {
  },
  async main(ctx) {
    if (ctx.help) {
      console.error('USAGE: types-galore --install PACKAGE');
      // TODO: Throw an error and have mrs-commanderson show help
      // appropriately
      process.exit(0);
    }

    ctx.registry = new Registry(ctx['registry-path']);
  }
});

/*
 * types-galore add PACKAGE <CHANNEL>
 */
app.command('add', async (ctx: ParsedArgs & Context) => {
  throw new Error('USAGE: types-galore add PACKAGE <CHANNEL>');
});

app.command('add :pkg', async (ctx, pkg) => {
  await addPackage(ctx, pkg);
});

app.command('add :pkg :channel', async (ctx, pkg, channel) => {
  await addPackage(ctx, pkg, channel);
});

async function addPackage(ctx: ParsedArgs & Context, pkg: string, channel?: string) {
  if (!ctx.registry) {
    throw new Error('assert: registry is initialized');
  }
  await ctx.registry.addPackage(pkg, channel, ctx.file instanceof Array ? ctx.file : [ctx.file]);
}

/*
 * types-galore remove PACKAGE
 */

app.command('remove', async (ctx: ParsedArgs & Context) => {
  throw new Error('USAGE: types-galore remove PACKAGE');
});

app.command('remove :pkg', async (ctx: ParsedArgs & Context, pkg: string) => {
  if (!ctx.registry) {
    throw new Error('assert: registry is initialized');
  }
  await ctx.registry.removePackage(pkg);
});

/*
 * types-galore channel commands
 */

app.command('channel', async (ctx: ParsedArgs & Context) => {
  throw new Error('available commands: add, remove, default');
});

app.command('channel add', async (ctx: ParsedArgs & Context) => {
  throw new Error('USAGE: types-galore channel add NAME URL');
});

app.command('channel add :name', async (ctx: ParsedArgs & Context) => {
  throw new Error('USAGE: types-galore channel add NAME URL');
});

app.command('channel add :name :url', async (ctx: ParsedArgs & Context, name: string, url: string) => {
  if (!ctx.registry) {
    throw new Error('assert: registry is initialized');
  }
  await ctx.registry.addChannel(name, url);
});

app.command('channel remove', async (ctx: ParsedArgs & Context) => {
  throw new Error('USAGE: types-galore channel remove NAME');
});

app.command('channel remove :name', async (ctx: ParsedArgs & Context, name: string) => {
  if (!ctx.registry) {
    throw new Error('assert: registry is initialized');
  }
  await ctx.registry.removeChannel(name);
});

app.command('channel default', async (ctx: ParsedArgs & Context) => {
  throw new Error('USAGE: types-galore channel default NAME');
});

app.command('channel default :name', async (ctx: ParsedArgs & Context, name: string) => {
  if (!ctx.registry) {
    throw new Error('assert: registry is initialized');
  }
  await ctx.registry.setDefaultChannel(name);
});

/*
 * Install stuff!
 */
app.command('install', async (ctx: ParsedArgs & Context) => {
  if (!ctx.registry) {
    throw new Error('assert: registry is initialized');
  }
  const pkg = new Package(process.cwd());
  const dependencies = await pkg.dependencies();
  const definitions = await ctx.registry.findDefinitions(dependencies);

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

});

export async function main(argv: typeof process.argv) {
  if (!await app.run(argv)) {
    // TODO: plumb 404 behavior into mrs-commanderson
    throw new Error(`unknown command: ${argv.join(' ')}`);
  }
}
