import { useEffect, useLayoutEffect, useRef } from 'react';

// A textarea does not expose caret geometry. Mirror its typography and wrapping
// so soft-wrapped lines, Chinese text and blank lines share the same positions.
function getCaretCenter(input: HTMLTextAreaElement) {
  const style = window.getComputedStyle(input);
  const mirror = document.createElement('div');
  mirror.className = 'note-caret-mirror';
  mirror.setAttribute('aria-hidden', 'true');
  for (const property of [
    'box-sizing', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-style', 'font-family', 'font-size', 'font-weight', 'font-style',
    'font-variant', 'font-stretch', 'font-kerning', 'font-feature-settings',
    'font-variation-settings', 'line-height', 'letter-spacing', 'word-spacing',
    'text-indent', 'text-transform', 'tab-size', 'word-break', 'overflow-wrap',
  ]) {
    mirror.style.setProperty(property, style.getPropertyValue(property));
  }
  mirror.style.width = `${input.getBoundingClientRect().width}px`;
  mirror.textContent = input.value.slice(0, input.selectionStart);
  const marker = document.createElement('span');
  marker.textContent = input.value.slice(input.selectionStart) || '\u200b';
  mirror.append(marker);
  document.body.append(mirror);

  try {
    const caret = marker.getClientRects()[0];
    return input.getBoundingClientRect().top - input.scrollTop
      + caret.top - mirror.getBoundingClientRect().top + caret.height / 2;
  } finally {
    mirror.remove();
  }
}

export function useNoteEditorLayout(content: string, isPreview: boolean) {
  const editorRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const frameRef = useRef<number | null>(null);

  function followCaret() {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const input = contentInputRef.current;
      const editor = editorRef.current;
      if (!input || !editor || document.activeElement !== input
        || input.selectionStart !== input.selectionEnd) return;

      const toolbarHeight = toolbarRef.current?.offsetHeight ?? 0;
      const target = editor.getBoundingClientRect().top + toolbarHeight
        + (editor.clientHeight - toolbarHeight) / 2;
      const delta = getCaretCenter(input) - target;
      // Keep a small central band to avoid adjusting scroll for tiny changes.
      const lineHeight = parseFloat(window.getComputedStyle(input).lineHeight);
      if (Math.abs(delta) > lineHeight / 2) editor.scrollTop += delta;
    });
  }

  useLayoutEffect(() => {
    const input = contentInputRef.current;
    if (!input || isPreview) return;
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
    input.scrollTop = 0;
  }, [content, isPreview]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || isPreview) return;
    let previousWidth = editor.clientWidth;
    let previousHeight = editor.clientHeight;
    const resize = new ResizeObserver(() => {
      const toolbarHeight = toolbarRef.current?.offsetHeight ?? 0;
      editor.style.setProperty('--note-writing-space', `${(editor.clientHeight - toolbarHeight) / 2}px`);
      const input = contentInputRef.current;
      const hasResized = editor.clientWidth !== previousWidth || editor.clientHeight !== previousHeight;
      if (input && editor.clientWidth !== previousWidth) {
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
        input.scrollTop = 0;
      }
      previousWidth = editor.clientWidth;
      previousHeight = editor.clientHeight;
      if (hasResized) followCaret();
    });
    resize.observe(editor);
    return () => resize.disconnect();
  }, [isPreview]);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
  }, []);

  return { editorRef, toolbarRef, contentInputRef, followCaret };
}
