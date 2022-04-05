"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const promises_1 = require("fs/promises");
const path = __importStar(require("path"));
const mrs_commanderson_1 = require("@jfhbrook/mrs-commanderson");
class JsonFile {
    constructor(path) {
        this.path = path;
    }
    read() {
        return __awaiter(this, void 0, void 0, function* () {
            return JSON.parse((yield (0, promises_1.readFile)(this.path)).toString('utf8'));
        });
    }
    write(json) {
        return __awaiter(this, void 0, void 0, function* () {
            yield (0, promises_1.writeFile)(this.path, JSON.stringify(json, null, 2));
        });
    }
    transaction(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            let json = yield this.read();
            json = yield fn(json);
            yield this.write(json);
        });
    }
    with(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            let json = yield this.read();
            yield fn(json);
        });
    }
    flatMap(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            let json = yield this.read();
            return fn(json);
        });
    }
}
class Registry {
    constructor(registryHome) {
        this.file = new JsonFile(path.join(registryHome, 'registry.json'));
    }
    addPackage(pkg, channel, files) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.file.transaction((json) => __awaiter(this, void 0, void 0, function* () {
                const ch = channel ? channel : json.defaultChannel;
                json.definitions[pkg] = {
                    channel: ch,
                    files: [
                        'types/${pkg}/index.d.ts'
                    ]
                };
                return json;
            }));
        });
    }
    removePackage(pkg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.file.transaction((json) => __awaiter(this, void 0, void 0, function* () {
                delete json.definitions[pkg];
                return json;
            }));
        });
    }
    addChannel(channel, url) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.file.transaction((json) => __awaiter(this, void 0, void 0, function* () {
                json.channels[channel] = { url };
                return json;
            }));
        });
    }
    removeChannel(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.file.transaction((json) => __awaiter(this, void 0, void 0, function* () {
                delete json.channels[channel];
                return json;
            }));
        });
    }
    setDefaultChannel(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.file.transaction((json) => __awaiter(this, void 0, void 0, function* () {
                json.defaultChannel = channel;
                return json;
            }));
        });
    }
    findDefinitions(dependencies) {
        return __awaiter(this, void 0, void 0, function* () {
            const definitions = [];
            yield this.file.with((json) => __awaiter(this, void 0, void 0, function* () {
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
            }));
            return definitions;
        });
    }
}
class Package {
    constructor(projectHome) {
        this.file = new JsonFile(path.join(projectHome, 'package.json'));
    }
    dependencies() {
        return __awaiter(this, void 0, void 0, function* () {
            const json = yield this.file.read();
            return Object.entries(json.dependencies || {}).map(([name, version]) => {
                return {
                    name,
                    version,
                    type: 'production'
                };
            }).concat(Object.entries(json.devDependencies || {}).map(([name, version]) => {
                return {
                    name,
                    version,
                    type: 'development'
                };
            }));
        });
    }
}
const app = new mrs_commanderson_1.App({
    boolean: [
        'help',
    ],
    string: [
        'file'
    ],
    alias: {
        'help': ['h']
    },
    default: {},
    main(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            if (ctx.help) {
                console.error('USAGE: types-galore --install PACKAGE');
                // TODO: Throw an error and have mrs-commanderson show help
                // appropriately
                process.exit(0);
            }
            ctx.registry = new Registry(ctx['registry-path']);
        });
    }
});
/*
 * types-galore add PACKAGE <CHANNEL>
 */
app.command('add', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    throw new Error('USAGE: types-galore add PACKAGE <CHANNEL>');
}));
app.command('add :pkg', (ctx, pkg) => __awaiter(void 0, void 0, void 0, function* () {
    yield addPackage(ctx, pkg);
}));
app.command('add :pkg :channel', (ctx, pkg, channel) => __awaiter(void 0, void 0, void 0, function* () {
    yield addPackage(ctx, pkg, channel);
}));
function addPackage(ctx, pkg, channel) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ctx.registry) {
            throw new Error('assert: registry is initialized');
        }
        yield ctx.registry.addPackage(pkg, channel, ctx.file instanceof Array ? ctx.file : [ctx.file]);
    });
}
/*
 * types-galore remove PACKAGE
 */
app.command('remove', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    throw new Error('USAGE: types-galore remove PACKAGE');
}));
app.command('remove :pkg', (ctx, pkg) => __awaiter(void 0, void 0, void 0, function* () {
    if (!ctx.registry) {
        throw new Error('assert: registry is initialized');
    }
    yield ctx.registry.removePackage(pkg);
}));
/*
 * types-galore channel commands
 */
app.command('channel', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    throw new Error('available commands: add, remove, default');
}));
app.command('channel add', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    throw new Error('USAGE: types-galore channel add NAME URL');
}));
app.command('channel add :name', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    throw new Error('USAGE: types-galore channel add NAME URL');
}));
app.command('channel add :name :url', (ctx, name, url) => __awaiter(void 0, void 0, void 0, function* () {
    if (!ctx.registry) {
        throw new Error('assert: registry is initialized');
    }
    yield ctx.registry.addChannel(name, url);
}));
app.command('channel remove', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    throw new Error('USAGE: types-galore channel remove NAME');
}));
app.command('channel remove :name', (ctx, name) => __awaiter(void 0, void 0, void 0, function* () {
    if (!ctx.registry) {
        throw new Error('assert: registry is initialized');
    }
    yield ctx.registry.removeChannel(name);
}));
app.command('channel default', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    throw new Error('USAGE: types-galore channel default NAME');
}));
app.command('channel default :name', (ctx, name) => __awaiter(void 0, void 0, void 0, function* () {
    if (!ctx.registry) {
        throw new Error('assert: registry is initialized');
    }
    yield ctx.registry.setDefaultChannel(name);
}));
/*
 * Install stuff!
 */
app.command('install', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (!ctx.registry) {
        throw new Error('assert: registry is initialized');
    }
    const pkg = new Package(process.cwd());
    const dependencies = yield pkg.dependencies();
    const definitions = yield ctx.registry.findDefinitions(dependencies);
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
}));
function main(argv) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield app.run(argv))) {
            // TODO: plumb 404 behavior into mrs-commanderson
            throw new Error(`unknown command: ${argv.join(' ')}`);
        }
    });
}
exports.main = main;
