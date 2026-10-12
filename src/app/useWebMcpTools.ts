import { useEffect } from 'react';
import { BRICK_DEFINITIONS, getBrickDefinition } from '../bricks/catalog';
import { getBrickGroundY } from '../bricks/geometry';
import { getBrickDisplayName } from '../i18n/brickNames';
import { tr, useLocale } from '../i18n/locale';
import { useEditorStore } from '../store/editorStore';
import type { BrickCategory } from '../types/model';

const englishCategories: Record<BrickCategory, string> = {
  blocks: 'Blocks & plates',
  round: 'Round',
  slopes: 'Slopes & triangles',
  curves: 'Curves',
  frames: 'Frames & corners',
  mechanical: 'Moving parts',
};

export function useWebMcpTools(): void {
  const locale = useLocale();
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
      title: tr(locale, '查看积木种类', 'List brick types'),
      description: 'List the generic construction brick types available in the Digital Bricks palette.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({
        bricks: BRICK_DEFINITIONS.map((definition) => ({
          id: definition.id,
          name: getBrickDisplayName(definition, locale),
          category: locale === 'en' ? englishCategories[definition.category] : definition.category,
          sizeMm: definition.size,
        })),
      }),
    });

    register({
      name: 'get_project_summary',
      title: tr(locale, '查看当前作品', 'Inspect current build'),
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
      title: tr(locale, '添加一个积木', 'Add a brick'),
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
  }, [locale]);
}
