module.exports = {
    content: ['./src/**/*.{js,jsx,ts,tsx}'],
    theme: {
    extend: {
        fontFamily: {
        mochiy: ["var(--font-mochiy)"],
        kosugi: ["var(--font-kosugi)"],
        },
    },
    },

    plugins: [require('@tailwindcss/forms')],
}
