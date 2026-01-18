export type CachePaths = {
    codePath: string;
    mapPath?: string;
    irPath: string;
};
export declare function ensureDir(dirPath: string): Promise<void>;
export declare function writeFileAtomic(filePath: string, content: string): Promise<void>;
export declare function readFileIfExists(filePath: string): Promise<string | null>;
//# sourceMappingURL=cache.d.ts.map