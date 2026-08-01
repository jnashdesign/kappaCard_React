import type { FieldVisibility } from '../lib/privacy';
import './PrivacyToggle.css';

interface PrivacyToggleProps {
  value: FieldVisibility;
  onChange: (value: FieldVisibility) => void;
  disabled?: boolean;
}

export default function PrivacyToggle({ value, onChange, disabled }: PrivacyToggleProps) {
  const isPublic = value === 'public';

  return (
    <div className="privacy-toggle" role="group" aria-label="Visibility">
      <button
        type="button"
        className={`privacy-option${isPublic ? ' is-active' : ''}`}
        aria-pressed={isPublic}
        disabled={disabled}
        onClick={() => onChange('public')}
      >
        Public
      </button>
      <button
        type="button"
        className={`privacy-option${!isPublic ? ' is-active' : ''}`}
        aria-pressed={!isPublic}
        disabled={disabled}
        onClick={() => onChange('private')}
      >
        Private
      </button>
    </div>
  );
}
