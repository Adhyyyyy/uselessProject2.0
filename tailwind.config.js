/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'bubbleIn': 'bubbleIn 0.4s ease-out',
        'breathe': 'breathe 3s ease-in-out infinite',
      },
      keyframes: {
        bubbleIn: {
          '0%': { 
            opacity: '0', 
            transform: 'scale(0.3) translateY(20px)' 
          },
          '50%': { 
            opacity: '0.8', 
            transform: 'scale(1.1)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'scale(1)' 
          },
        },
        breathe: {
          '0%, 100%': { 
            transform: 'scale(1)' 
          },
          '50%': { 
            transform: 'scale(1.02)' 
          },
        },
      },
    },
  },
  plugins: [],
}
