export type PackageInfo = {
    name: string;
    version: string;
    root: string;
};
export declare function findPkgRoot(startPath: string): string | null;
export declare function readPkg(pkgRoot: string): PackageInfo;
export declare function readPkgSafe(pkgRoot: string): PackageInfo;
//# sourceMappingURL=pkg.d.ts.map