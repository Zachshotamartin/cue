import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { it, expect } from "vitest";
const files = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
it("keeps form controls and dialogs in the shared UI layer", () => {
  const violations: string[] = [];
  for (const file of files("apps/editor/components").filter(
    (f) => f.endsWith(".tsx") && !f.includes("/ui/"),
  )) {
    const source = fs.readFileSync(file, "utf8");
    if (
      /<(button|input|select|textarea|details|summary)(\s|>)/.test(source) ||
      /role="dialog"/.test(source)
    )
      violations.push(file);
  }
  expect(violations).toEqual([]);
});
it("defines React components at module scope, one per file", () => {
  const violations: string[] = [];
  for (const file of [
    ...files("apps/editor/components"),
    ...files("packages/compositor"),
  ].filter((f) => f.endsWith(".tsx"))) {
    const f = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const named: ts.Node[] = [];
    function visit(n: ts.Node) {
      if (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text))
        named.push(n);
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        /^[A-Z]/.test(n.name.text) &&
        n.initializer &&
        (ts.isArrowFunction(n.initializer) ||
          ts.isFunctionExpression(n.initializer))
      )
        named.push(n);
      ts.forEachChild(n, visit);
    }
    visit(f);
    if (
      named.length > 1 ||
      named.some((n) => ts.isFunctionDeclaration(n) && n.parent !== f)
    )
      violations.push(file);
  }
  expect(violations).toEqual([]);
});
