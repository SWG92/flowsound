import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // 封面/头像全部来自第三方 CDN（网易云/QQ/酷狗），URL 自带动态裁剪参数
    // （如 ?param=100y100），用 next/image 需要在服务端代理所有外部图域，
    // 收益为负 —— 本项目刻意使用原生 <img>，关闭该规则。
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@next/next/no-img-element": "off",
      // 下划线前缀 = 刻意不使用的参数（如适配器接口强制要求但本平台不支持的 listId）
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
