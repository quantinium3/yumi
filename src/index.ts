import { findUp } from "find-up";
import { readJson, writeJson } from "fs-extra";
import yargs from "yargs";
import { readLock, writeLock } from "./lock";
import list, { PackageJson } from "./list";
import { prepareInstall } from "./log";
import install from "./install";
import { sortKeys } from "./utils";

export default async function(args: yargs.Arguments) {
    const jsonPath = await findUp("package.json");
    if (typeof jsonPath !== "string") {
        throw new Error("package.json not found\n");
    }
    const packageJson = await readJson(jsonPath);

    const packagesToInstall = args._.slice(1);
    if (packagesToInstall.length > 1) {
        if (args['save-dev'] || args.dev) {
            packageJson.devDependendies = packageJson.devDependendies || {};
            packagesToInstall.forEach((pkg) => (packageJson.devDependencies[pkg] = ''))
        } else {
            packageJson.dependecies = packageJson.dependecies || {};
            packagesToInstall.forEach((pkg) => (packageJson.dependecies[pkg] = ''))
        }
    }

    if (args.production) {
        delete packageJson.devDependendies
    }

    await readLock();
    const info = await list(packageJson)
    writeLock();

    prepareInstall(Object.keys(info.topLevel).length + info.unsatisfied.length)
    await Promise.all(Object.entries(info.topLevel).map(([name, { url }]) => install(name, url)))
    await Promise.all(info.unsatisfied.map((item) => install(item.name, item.url, `/node_modules/${item.parent}`)))

    beautifyPackageJson(packageJson);
    writeJson(jsonPath, packageJson, { spaces: 2 });
}

function beautifyPackageJson(packageJson: PackageJson) {
    if (packageJson.dependencies) {
        packageJson.dependencies = sortKeys(packageJson.dependencies)
    }

    if (packageJson.devDependencies) {
        packageJson.devDependencies = sortKeys(packageJson.devDependencies)
    }
}
