# Repository Guidelines

## Project Structure & Module Organization

This repository is a NestJS 11 API written in TypeScript. Application bootstrap code lives in `src/main.ts`, and the root dependency graph begins in `src/app.module.ts`. Add features as focused Nest modules under `src/` (for example, `src/tours/tours.module.ts`) and keep controllers, services, DTOs, and related unit tests beside the feature they cover. End-to-end tests belong in `test/`; Jest's e2e configuration is `test/jest-e2e.json`. Product, domain, API, architecture, development, and operations plans are maintained in `docs/`. Treat those documents as design direction and verify that a described capability is implemented before relying on it.

## Build, Test, and Development Commands

Use pnpm because `pnpm-lock.yaml` is committed.

- `pnpm install` installs the locked dependencies.
- `pnpm start:dev` runs Nest in watch mode for local development.
- `pnpm build` compiles the application into `dist/`.
- `pnpm start:prod` runs the compiled entry point.
- `pnpm lint` checks TypeScript without mutating files; use `pnpm lint:fix` explicitly for fixes.
- `pnpm format` formats the repository; `pnpm format:check` is the non-mutating CI check.
- `pnpm test`, `pnpm test:watch`, and `pnpm test:cov` run unit tests normally, interactively, or with coverage.
- `pnpm test:e2e` runs the Supertest end-to-end suite.

Run lint, tests, e2e tests, and a production build before opening a pull request.

## Coding Style & Naming Conventions

Follow `.prettierrc`: two-space indentation, single quotes, trailing commas, and a 100-character line limit. ESLint uses type-aware TypeScript rules and reports Prettier differences as errors. Use Nest conventions: PascalCase classes (`ToursService`), camelCase methods and variables, kebab-case filenames (`create-tour.dto.ts`), and descriptive suffixes such as `.controller.ts`, `.service.ts`, and `.module.ts`. Avoid unhandled promises; explicitly `await` asynchronous Nest lifecycle and service calls.

## Testing Guidelines

Jest and `ts-jest` power the test suite; Supertest covers HTTP behavior. Name colocated unit tests `*.spec.ts` and e2e tests `*.e2e-spec.ts`. Test observable behavior, validation failures, and error paths—not only successful requests. No numeric coverage threshold is configured, but new behavior should arrive with proportionate tests; use `pnpm test:cov` to inspect gaps.

## Commit & Pull Request Guidelines

Recent history favors short, imperative subjects such as `connect to mongodb`; prefer the clearer Conventional Commit form, for example `feat: add tour search filters` or `fix: validate malformed tour ids`. Keep commits focused. Pull requests should summarize the change, explain testing performed, link relevant issues, and call out configuration or API-contract changes. Include request/response examples for endpoint changes and screenshots only when documentation or rendered UI is affected.
