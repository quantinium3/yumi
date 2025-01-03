import { pathExists } from "find-up";
import { readFile, writeFile } from "fs-extra";
import { dump, load } from "js-yaml";
import { sortKeys } from "./utils";
import { Manifest } from "./resolve";

interface Lock {
    [index: string]: {
        version: string,
        url: string,
        shasum: string,
        dependencies: { [dependencies: string]: string },
    }
}

const oldLock: Lock = Object.create(null);
const newLock: Lock = Object.create(null);

export function updateOrCreate(name: string, info: Lock[string]) {
    if (!newLock[name]) {
        newLock[name] = Object.create(null);
    }

    Object.assign(newLock[name]!, info);
}

export async function readLock() {
    if (await pathExists('./yumi.yml')) {
        Object.assign(oldLock, load(await readFile('./yumi.yml', 'utf-8')))
    }
}

export async function writeLock() {
    writeFile('./yumi.yml', dump(sortKeys(newLock), { noRefs: true }))
}

export function getItem(name: string, constraint: string): Manifest | null {
    const item = oldLock[`${name}@${constraint}`]
    if (!item) {
        return null;
    }
    return {
        [item.version]: {
            dependencies: item.dependencies,
            dist: { shasum: item.shasum, tarball: item.url },
        }
    }
}
