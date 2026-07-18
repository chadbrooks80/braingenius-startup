import { registerHooks } from "node:module";

// Next aliases this marker to an empty module in server bundles. The plain Node
// test runner needs the same narrow alias without enabling React's react-server
// condition globally (which would remove client rendering exports from React).
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export {};",
        shortCircuit: true,
      };
    }

    return nextResolve(specifier, context);
  },
});
