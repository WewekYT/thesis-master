/** @type {import('jest').Config} */
module.exports = {
    preset: "ts-jest", // Use ts-jest for TypeScript support
    testEnvironment: "node", // Use Node.js environment for server-side testing
    moduleFileExtensions: ["ts", "js"], // Recognize .ts and .js files
    testMatch: ["**/*.test.ts"], // Look for test files with `.test.ts` suffix
    transform: {
      "^.+\\.ts$": "ts-jest", // Transform TypeScript files
    },
  };
  