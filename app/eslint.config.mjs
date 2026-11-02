import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  {
    ignores: [".next*/**", "build-*/**", ".cache/**", "out/**", "build/**", "coverage/**", "playwright-report/**", "test-results/**", "supabase/functions/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Guard against client bundles reaching server-only modules (doc 06 §2).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/admin", "@/lib/auth/session-server"],
              message: "Server-only module: importing this into client code is forbidden.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
