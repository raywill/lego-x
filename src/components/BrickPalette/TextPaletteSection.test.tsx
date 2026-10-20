import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { BrickPalette } from './BrickPalette';
import { TextTools } from '../Selection/TextTools';
import { useTextToolStore } from '../../store/textToolStore';
import type { TextDecoration } from '../../types/model';

const existing: TextDecoration = {
  id: 'label', hostBrickId: 'host', content: '我的小屋', size: 6,
  color: '#343746', position: [0, 5, 0], rotation: [-Math.PI / 2, 0, 0],
};

beforeEach(() => useTextToolStore.setState(useTextToolStore.getInitialState()));

describe('text palette entry and shared text form', () => {
  it('puts the creation entry in its own palette section, not the canvas tools', () => {
    const palette = renderToStaticMarkup(<MemoryRouter><BrickPalette /></MemoryRouter>);
    expect(palette).toMatch(/<aside[^>]*aria-label="积木篮"/);
    expect(palette).toContain('<section class="palette-category" aria-label="文字">');
    expect(palette).toContain('添加文字');
    expect(palette.indexOf('添加文字')).toBeLessThan(palette.indexOf('方块与板'));
    expect(palette).toContain('先放一块积木，再贴文字');
    expect(palette).toMatch(/class="palette-card palette-text-card" disabled=""/);
    const tools = renderToStaticMarkup(<MemoryRouter><TextTools /></MemoryRouter>);
    expect(tools).not.toContain('添加文字');
    expect(tools).not.toContain('add-text-button');
  });

  it('also labels the palette entry in English', () => {
    const palette = renderToStaticMarkup(<MemoryRouter initialEntries={['/en']}><BrickPalette /></MemoryRouter>);
    expect(palette).toContain('aria-label="Text"');
    expect(palette).toContain('Add text');
  });

  it('opens a fresh creation form without changing the model or starting placement', () => {
    const tools = useTextToolStore.getState();
    tools.openForm();
    const first = useTextToolStore.getState().form!;
    expect(first).toMatchObject({ content: '', size: 6, hostBrickId: '' });
    expect(useTextToolStore.getState().draft).toBeNull();
    tools.setForm(null);
    expect(useTextToolStore.getState().form).toBeNull();
    tools.openForm();
    expect(useTextToolStore.getState().form!.id).not.toBe(first.id);
  });

  it('edits a copy and preserves the attached text when the dialog is cancelled', () => {
    const tools = useTextToolStore.getState();
    tools.select(existing.id);
    tools.openForm(existing);
    const form = useTextToolStore.getState().form!;
    expect(form).toEqual(existing);
    expect(form).not.toBe(existing);
    form.position[0] = 20;
    tools.setForm({ ...form, content: '新名字' });
    tools.setForm(null);
    expect(existing.content).toBe('我的小屋');
    expect(existing.position[0]).toBe(0);
    expect(useTextToolStore.getState().selectedId).toBe(existing.id);
  });

  it('keeps reposition cancellation and selection behavior unchanged', () => {
    const tools = useTextToolStore.getState();
    tools.begin(existing);
    tools.showPreview({ ...existing, position: [10, 5, 0] }, false);
    tools.cancel();
    expect(useTextToolStore.getState()).toMatchObject({ selectedId: existing.id, draft: null, preview: null, valid: false });
  });
});
