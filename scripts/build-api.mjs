import { build } from 'esbuild';
import { builtinModules } from 'node:module';

// ECS runs this bundle directly, without installing dependencies or compiling.
const result = await build({
  entryPoints: ['server/ecs.ts'],
  outfile: 'server-dist/api.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  metafile: true,
  logLevel: 'info',
});

const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
for (const output of Object.values(result.metafile.outputs)) {
  for (const dependency of output.imports) {
    if (dependency.external && !builtins.has(dependency.path)) {
      throw new Error(`The ECS API must be self-contained: ${dependency.path}`);
    }
  }
}
