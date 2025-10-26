# Macro

Add support to macros, you can choose your traverser system.

## Config

```js
import ExtnMacro from '@extn/macro/vite';

export default {
  // ...
  plugins: [
    ExtnMacro({
      traverse: 'babel'
    })
  ]
}
```

## Use

```js
const toVar = macro<VariableDeclaration>(node => {
  if (node.node.kind !== "var") return;

  node.node.kind = "let";

  for (const decl of node.node.declarations) {
    if (decl.id.type !== "Identifier") continue;
    node.insertAfter(
      t.expressionStatement(
        t.callExpression(t.memberExpression(t.identifier("console"), t.identifier("log")), [
          t.identifier(decl.id.name)
        ])
      )
    );
  }
});

var myVar = 5 // transformed to: let myVar = 5

toVar(myVar);
```
