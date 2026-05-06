const Input = ({ disabled = false, className = '', ...props }) => (
    <input
        disabled={disabled}
        className={className}
        style={{
            width: '100%',
            minWidth: 0,
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
            border: '1px solid var(--input-border)',
            background: disabled
                ? 'var(--input-disabled-bg)'
                : 'var(--input-bg)',
            color: 'var(--input-text)',
            padding: '10px 12px',
            outline: 'none',
            boxSizing: 'border-box',
        }}
        {...props}
    />
)

export default Input