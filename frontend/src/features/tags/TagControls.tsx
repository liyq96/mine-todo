import { IconTag, IconX } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { parseTags } from '../../lib/productivity';

type TagInputProps = {
  label: string;
  placeholder: string;
  onAdd: (tags: string[]) => void;
};

export function TagInput({ label, placeholder, onAdd }: TagInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleCommit() {
    const tags = parseTags(value);
    if (tags.length) onAdd(tags);
    setValue('');
    setIsEditing(false);
  }

  return isEditing ? (
    <label className="todo-tag-input">
      <IconTag size={16} stroke={1.8} aria-hidden="true" />
      <input autoFocus value={value} aria-label={label} placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)} onBlur={handleCommit}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            handleCommit();
            requestAnimationFrame(() => buttonRef.current?.focus());
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setValue('');
            setIsEditing(false);
            requestAnimationFrame(() => buttonRef.current?.focus());
          }
        }} />
    </label>
  ) : (
    <button ref={buttonRef} type="button" className="todo-property-button" onClick={() => setIsEditing(true)}>
      <IconTag size={16} stroke={1.8} aria-hidden="true" /><span>{label}</span>
    </button>
  );
}

type TagListProps = {
  tags: string[];
  label: string;
  removeLabel: (tag: string) => string;
  onRemove: (tag: string) => void;
};

export function TagList({ tags, label, removeLabel, onRemove }: TagListProps) {
  return tags.length ? (
    <div className="todo-tags" aria-label={label}>
      {tags.map((tag) => (
        <span className="todo-tag" key={tag}>
          <span className="todo-tag__hash" aria-hidden="true">#</span><span className="todo-tag__text">{tag}</span>
          <button type="button" className="todo-tag__remove" aria-label={removeLabel(tag)} title={removeLabel(tag)} onClick={() => onRemove(tag)}>
            <IconX size={11} stroke={2} aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  ) : null;
}
