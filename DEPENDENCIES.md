# Dependency maintenance

Last checked: October 14, 2026.

Use Node.js 24 and `npm ci` to reproduce the package-lock.json installation.

| Package | Installed version |
| --- | --- |
| next / eslint-config-next | 16.4.0 |
| react / react-dom | 19.3.0 |
| @prisma/client / prisma | 6.19.3 |
| @supabase/supabase-js | 2.117.3 |
| dotenv | 18.0.8 |
| jose | 6.2.12 |
| jspdf | 4.2.1 |
| lucide-react | 1.57.0 |
| papaparse | 5.7.0 |
| pg | 8.23.1 |
| xlsx | 0.20.3 |
| tailwindcss / @tailwindcss/postcss | 4.3.3 |
| typescript | 6.0.3 |
| eslint | 9.39.5 |
| @types/node | 24.19.2 |
| @types/react / @types/react-dom | 19.3.0 |
| @types/papaparse | 5.5.2 |

## Compatibility decisions

- Next.js, React, and eslint-config-next use exact matching versions where appropriate.
- Prisma remains on the newest 6.x release. Prisma 7 requires driver adapters and configuration changes; Prisma's npm `latest` tag currently points to an 8.x release candidate. Neither migration is part of this compatibility update.
- TypeScript 6.0.3 and ESLint 9.39.5 are the newest versions supported by the installed lint plugin chain. ESLint 9 is deprecated upstream, but ESLint 10 exceeds several plugin peer ranges. TypeScript 7 was tested and rejected by typescript-eslint; changing to TypeScript 6 resolves that incompatibility.
- Node type definitions follow the app's Node 24 runtime rather than Node 26.
- SheetJS is installed from its versioned official CDN tarball because the npm registry's xlsx release remains 0.18.5. See the [official installation instructions](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
- A scoped override installs deepmerge-ts 8.0.2 for @prisma/config, resolving [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). Prisma uses its standard deepmerge export for configuration objects; the [8.0 release notes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) retain this API. Revisit the override when upgrading Prisma.

## Verification and remaining findings

- Production build, Prisma client generation, and TypeScript checks passed.
- ESLint reports zero errors; existing warnings remain for loose types and unused variables.
- CSV parsing and XLS/XLSX payslip parsing passed, including uppercase file extensions. The existing may14_2026.xls parsed into 155 payslips without writing payroll data.
- `npm audit --omit=dev`: zero findings.
- Full `npm audit`: five high severity findings in the braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next chain. They share [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). npm's proposed forced fix downgrades eslint-config-next to 14.2.35, so it was not applied to this Next.js 16 app. Recheck this advisory when upstream releases a compatible fix.
- The installed dependency tree has no invalid peer dependencies.
- The restarted local server uses Next.js 16.4.0. The dashboard and login pages returned HTTP 200; concurrent staff, admin, delivery log, and attendance API reads all returned HTTP 200.

For future updates, run `npm outdated`, review compatibility, update package.json and package-lock.json together, and rerun `npm run build`, `npm run typecheck`, `npm run lint`, and `npm audit`.
