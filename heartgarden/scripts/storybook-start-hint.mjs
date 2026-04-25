console.log(`
heartgarden · Storybook
  • Keep this terminal open while you use Storybook.
  • The first compile often takes 30–90s — wait until the log shows a "Local:" URL before opening the browser.
  • Open in Chrome or Edge:  http://127.0.0.1:6006
  • If the browser says "connection refused", the dev server is not ready yet or the process exited (scroll up for errors).
  • Fallback (no HMR):  pnpm run storybook:static  →  http://127.0.0.1:6007
`);
