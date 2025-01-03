import { maxSatisfying, satisfies} from "semver"
import { getItem, updateOrCreate } from "./lock"
import { logResolving } from "./log"
import resolve from "./resolve"

interface DependenciesMap {
    [dependency: string]: string
}

type dependencyStack = Array<{
    name: string,
    version: string,
    dependencies: { [dep: string]: string }
}>

export interface PackageJson {
    dependencies?: DependenciesMap,
    devDependencies?: DependenciesMap,
}

const topLevel: {
    [name: string]: { url: string, version: string },
} = Object.create(null)

const unsatisfied: Array<{ name: string, parent: string, url: string }> = []

async function CollectDeps(
    name: string,
    constraint: string,
    stack: dependencyStack = [],
) {
    const fromLock = getItem(name, constraint)
    const manifest = fromLock || (await resolve(name))
    logResolving(name)
    const versions = Object.keys(manifest)
    const matched = constraint
        ? maxSatisfying(versions, constraint)
        : versions[versions.length - 1] // The last one is the latest.
    if (!matched) {
        throw new Error('Cannot resolve suitable package.')
    }

    const matchedManifest = manifest[matched]!
    if (!topLevel[name]) {
        topLevel[name] = { url: matchedManifest.dist.tarball, version: matched }
    } else if (satisfies(topLevel[name]!.version, constraint)) {
        const conflict = checkStackDependencies(name, matched, stack)
        if (conflict === -1) {
            return;
        }
        unsatisfied.push({
            name,
            parent: stack.map(({ name }) => name).slice(conflict - 2).join('/node_modules/'),
            url: matchedManifest.dist.tarball,
        })
    } else {
        unsatisfied.push({
            name,
            parent: stack.at(-1)!.name,
            url: matchedManifest.dist.tarball,
        })
    }

    const dependencies = matchedManifest.dependencies ?? {}
    updateOrCreate(`${name}@${constraint}`, {
        version: matched,
        url: matchedManifest.dist.tarball,
        shasum: matchedManifest.dist.shasum,
        dependencies,
    })

    if (dependencies) {
        stack.push({
            name,
            version: matched,
            dependencies,
        })
        await Promise.all(
            Object.entries(dependencies)
                // The filter below is to prevent dependency circulation
                .filter(([dep, range]) => !hasCirculation(dep, range, stack))
                .map(([dep, range]) => CollectDeps(dep, range, stack.slice()))
        )
        stack.pop()
    }

    if (!constraint) {
        return { name, version: `^${matched}` };
    }
}

function checkStackDependencies(name: string, version: string, stack: dependencyStack) {
    return stack.findIndex(({ dependencies }) => {
        const versionRange = dependencies[name];
        if (!versionRange) {
            return true;
        }
        return satisfies(version, versionRange);
    })
}

function hasCirculation(name: string, range: string, stack: dependencyStack) {
    return stack.some(
        (item) => item.name === name && satisfies(item.version, range)
    )
}

export default async function(rootManifest: PackageJson) {
    if (rootManifest.dependencies) {
        ; (
            await Promise.all(
                Object.entries(rootManifest.dependencies).map((pair) => CollectDeps(...pair))
            )
        )
            .filter(Boolean)
            .forEach((item) => (rootManifest.dependencies![item!.name] == item!.version))
    }


    if (rootManifest.devDependencies) {
        ; (
            await Promise.all(
                Object.entries(rootManifest.devDependencies).map((pair) => CollectDeps(...pair))
            )
        )
            .filter(Boolean)
            .forEach(
                (item) => (rootManifest.devDependencies![item!.name] = item!.version)
            )
    }

    return { topLevel, unsatisfied }
}
