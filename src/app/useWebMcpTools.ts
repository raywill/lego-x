import { useEffect } from 'react';
import { BRICK_DEFINITIONS, getBrickDefinition } from '../bricks/catalog';
import { getBrickGroundY } from '../bricks/geometry';
import { useEditorStore } from '../store/editorStore';

export function useWebMcpTools(): void {
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: WebMcpTool) => {
      try {
        void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
      } catch {
        // WebMCP is optional and must never interrupt the editor.
      }
    };

    register({
      name: 'list_brick_types',
      title: '查看积木种类',
      description: 'List the generic construction brick types available in the Digital Bricks palette.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({
        bricks: BRICK_DEFINITIONS.map(({ id, name, category, size }) => ({ id, name, category, sizeMm: size })),
      }),
    });

    register({
      name: 'get_project_summary',
      title: '查看当前作品',
      description: 'Read the current Digital Bricks project summary without changing it.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => {
        const state = useEditorStore.getState();
        return { brickCount: state.bricks.length, connectionCount: state.connections.length };
      },
    });

    register({
      name: 'add_brick_to_project',
      title: '添加一个积木',
      description: 'Add one named generic brick to the visible Digital Bricks project, placed safely on the print bed.',
      inputSchema: {
        type: 'object',
        properties: { definitionId: { type: 'string', description: 'A brick id returned by list_brick_types.' } },
        required: ['definitionId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const definitionId = typeof input === 'object' && input !== null && 'definitionId' in input
          ? (input as { definitionId?: unknown }).definitionId
          : undefined;
        if (typeof definitionId !== 'string') throw new Error('definitionId must be a string.');
        const definition = getBrickDefinition(definitionId);
        if (!definition) throw new Error(`Unknown brick type: ${definitionId}`);
        const state = useEditorStore.getState();
        const offset = (state.bricks.length % 5) * 14 - 28;
        const id = state.addBrick(definition.id, [offset, getBrickGroundY(definition), 0]);
        if (!id) throw new Error('The brick could not be added.');
        return { id, definitionId: definition.id, brickCount: useEditorStore.getState().bricks.length };
      },
    });

    return () => lifecycle.abort();
  }, []);
}
