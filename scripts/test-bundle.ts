import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/** 実際のモジュールを、ネットワーク・DB・子プロセスだけ差し替えて検証する。 */
export async function loadTestBundle<T>(entry: URL, mocks: Record<string, Record<string, unknown>>): Promise<T> {
  const result = await build({
    entryPoints: [fileURLToPath(entry)],
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    write: false,
    plugins: [{
      name: "test-dependencies",
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) =>
          Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: "test-mock" } : undefined);
        build.onLoad({ filter: /.*/, namespace: "test-mock" }, (args) => ({
          contents: Object.keys(mocks[args.path]).map((key) =>
            `export const ${key} = __mocks[${JSON.stringify(args.path)}][${JSON.stringify(key)}];`).join("\n"),
        }));
      },
    }],
  });
  const module = { exports: {} };
  new Function("__mocks", "require", "module", "exports", result.outputFiles[0].text)(
    mocks, createRequire(import.meta.url), module, module.exports,
  );
  return module.exports as T;
}
