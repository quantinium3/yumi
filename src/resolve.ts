export interface Manifest {
    [version: string]: {
        dependencies?: { [dep: string]: string };
        dist: { shasum: string, tarball: string };
    };
}

const REGISTRY = process.env.REGISTRY || 'https://registry.npmjs.org/';

const cache: { [dep: string]: Manifest } = Object.create(null);

export default async function(name: string): Promise<Manifest> {
    if (cache[name]) {
        return cache[name];
    }

    const url = `${REGISTRY}${name}`;

    try {
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`Failed to fetch package: ${name}. HTTP status: ${res.status}`);
        }

        const data = await res.json();

        if ('error' in data) {
            throw new ReferenceError(`No such package: ${name}`);
        }

        cache[name] = data.version;
        return data.version;
    } catch (err) {
        console.error(`Error fetching package data for ${name}:`, err);
        throw err;
    }
}
