import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        include: ['runtime-tests/**/*.spec.{js,jsx}'],
        setupFiles: ['./runtime-tests/setup.js'],
        testTimeout: 20000,
    },
});
