const Label = ({ className = '', children, ...props }) => (
    <label
        className={`app-label ${className}`}
        {...props}>
        {children}
    </label>
)

export default Label