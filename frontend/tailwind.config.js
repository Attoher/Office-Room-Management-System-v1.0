/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        // Bilah progres tak tentu di layar loading
        loading: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        loading: 'loading 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
