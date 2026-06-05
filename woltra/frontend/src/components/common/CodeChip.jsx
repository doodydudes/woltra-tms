import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';

export default function CodeChip({ value, copyable = false, size = 'md', color = 'blue' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async e => {
    e.stopPropagation();
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const sizes = {
    sm: { fontSize: '10.5px', padding: '2px 7px' },
    md: { fontSize: '12px',   padding: '3px 10px' },
    lg: { fontSize: '13.5px', padding: '5px 14px' },
  };
  const sz = sizes[size] || sizes.md;

  const colorStyle = color === 'orange'
    ? { color: 'var(--orange)', bg: 'rgba(240,140,46,0.08)', border: 'rgba(240,140,46,0.25)' }
    : { color: 'var(--blue)', bg: 'rgba(59,130,246,0.07)', border: 'rgba(59,130,246,0.2)' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: colorStyle.bg,
      border: `1px solid ${colorStyle.border}`,
      borderRadius: 6,
      ...sz,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontWeight: 700,
      color: colorStyle.color,
      letterSpacing: '0.08em',
    }}>
      {value}
      {copyable && (
        <button
          onClick={handleCopy}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'inherit', padding: 0, display: 'flex', flexShrink: 0,
            opacity: 0.7, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
        </button>
      )}
    </span>
  );
}
