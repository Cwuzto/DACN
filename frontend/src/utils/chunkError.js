export function isChunkLoadError(error) {
    if (!error) return false;
    return error.name === 'ChunkLoadError'
        || /Loading (?:CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(error.message || '');
}
