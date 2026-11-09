import * as RadioGroup from '@radix-ui/react-radio-group';

type RadioOptionsProps<Value extends string> = {
  label: string;
  value: Value;
  disabled: boolean;
  options: Array<{ value: Value; label: string; hint: string }>;
  onChange: (value: Value) => void;
};

export function RadioOptions<Value extends string>({ label, value, disabled, options, onChange }: RadioOptionsProps<Value>) {
  return (
    <RadioGroup.Root className="language-options" aria-label={label} value={value}
      onValueChange={(next) => onChange(next as Value)} disabled={disabled}>
      {options.map((option) => (
        <label key={option.value} className={`language-option ${value === option.value ? 'is-active' : ''}`}>
          <RadioGroup.Item value={option.value} className="language-option__radio" disabled={disabled}>
            <RadioGroup.Indicator className="language-option__indicator" />
          </RadioGroup.Item>
          <span className="language-option__copy"><strong>{option.label}</strong><span>{option.hint}</span></span>
        </label>
      ))}
    </RadioGroup.Root>
  );
}
