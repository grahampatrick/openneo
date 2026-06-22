import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// Base path for subpath deploys (openneo.org/read, /translate). Set at build
// time via BASE_PATH; empty for root/local dev.
const base = process.env.BASE_PATH ?? ''

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html', strict: false }),
    paths: { base },
  },
}
