import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      "public/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "web/**",
      "bin/**",
      "coverage.out",
      "benchmarks.txt",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;
