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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const promises_1 = require("fs/promises");
const path = __importStar(require("path"));
const minimist_1 = __importDefault(require("minimist"));
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
    add(pkg, url) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.file.transaction((json) => __awaiter(this, void 0, void 0, function* () {
                json.definitions[pkg] = url ? url : `${url || json.registryUrl}/types/${pkg}/index.d.ts`;
                return json;
            }));
        });
    }
    remove(pkg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.file.transaction((json) => __awaiter(this, void 0, void 0, function* () {
                delete json.definitions[pkg];
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
                        definitions.push({
                            name,
                            url: json.definitions[name]
                        });
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
function install(registry, pkg) {
    return __awaiter(this, void 0, void 0, function* () {
        const dependencies = yield pkg.dependencies();
        const definitions = yield registry.findDefinitions(dependencies);
        console.log(definitions);
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
}
function main(argv) {
    return __awaiter(this, void 0, void 0, function* () {
        const opts = (0, minimist_1.default)(argv, {
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
        let pkg;
        let url;
        switch (command) {
            case 'add':
                pkg = opts._.shift();
                url = opts._.shift();
                if (!pkg) {
                    throw new Error('must specify a package');
                }
                yield registry.add(pkg, url);
                break;
            case 'remove':
                pkg = opts._.shift();
                if (!pkg) {
                    throw new Error('must specify a package');
                }
                yield registry.remove(pkg);
                break;
            case 'install':
                yield install(registry, new Package('.'));
                break;
            default:
                throw new Error(`unknown command: ${command}`);
        }
    });
}
exports.main = main;
