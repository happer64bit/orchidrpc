# @orchidrpc/server

## Features

- **RPC Procedures**: Define custom procedures with input validation using TypeBox.
- **Global Context**: Share global context (e.g., authentication state) across RPC handlers.

## Installation

1. Install dependencies:

```bash
npm install @orchidrpc/server
```

## Usage (Express.JS)

```javascript
import Express from "express";
import { RPC, handleAllHttp, T } from "@orchidrpc/server";

const app = Express();

const rpc = new RPC({
  ending: "!", 
});

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; connect-src 'self' http://localhost:4000");
  next();
});

const appRouter = rpc.router({
  greet: rpc
    .procedure()
    .input(
      T.Object({
        name: T.String(),
      })
    )
    .use(async ({ input, context }) => {
      return `Hello, ${input.name} ${context.ending}`;
    }),
});

app.all("/orpc", handleAllHttp(rpc, appRouter));

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```