const InputError = ({ messages = [], className = '' }) => (
    <>
        {messages.length > 0 &&
            messages.map((message, index) => (
                <p
                    key={index}
                    className={`app-input-error ${className}`}>
                    {message}
                </p>
            ))}
    </>
)

export default InputError