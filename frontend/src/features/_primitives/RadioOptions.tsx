import * as RadioGroup from '@radix-ui/react-radio-group';
import { IconCheck } from '@tabler/icons-react';
import { useId } from 'react';

type RadioOptionsProps<Value extends string> = {
  label: string;
  value: Value;
  disabled: boolean;
  options: Array<{ value: Value; label: string; hint: string }>;
  onChange: (value: Value) => void;
};

export function RadioOptions<Value extends string>({ label, value, disabled, options, onChange }: RadioOptionsProps<Value>) {
  const id = useId();
  return (
    <RadioGroup.Root className="language-options" aria-label={label} value={value} orientation="vertical"
      onValueChange={(next) => onChange(next as Value)} disabled={disabled}>
      {options.map((option) => (
        <RadioGroup.Item key={option.value} value={option.value} className="language-option" disabled={disabled}
          aria-labelledby={`${id}-${option.value}-label`} aria-describedby={`${id}-${option.value}-hint`}>
          <span className="language-option__copy">
            <strong id={`${id}-${option.value}-label`}>{option.label}</strong>
            <span id={`${id}-${option.value}-hint`}>{option.hint}</span>
          </span>
          <RadioGroup.Indicator className="language-option__indicator">
            <IconCheck size={18} stroke={2} aria-hidden="true" />
          </RadioGroup.Indicator>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
