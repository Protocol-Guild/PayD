# PayD Frontend

Vite + React 19 frontend for PayD.

## Testing

Unit/component tests use **Vitest** + **React Testing Library**, configured in
[`vitest.config.ts`](./vitest.config.ts) (jsdom environment, globals enabled,
setup in [`vitest.setup.ts`](./vitest.setup.ts) for `@testing-library/jest-dom`
matchers). Test files live next to the code they cover, as `*.test.ts(x)`.

```bash
npm run test        # run once (used in CI)
npm run test:watch  # watch mode
```

End-to-end tests (Playwright) are separate — see `test:e2e*` scripts in
`package.json` and [`playwright.config.ts`](./playwright.config.ts).
