# OrchidRpc

Orchid RPC is a lightweight and flexible HTTP client designed to simplify interactions with APIs.

## Installation

### Server

```bash
npm install @orchidrpc/server
```

### Client

```bash
npm install @orchidrpc/client
```

## Example Usage

### Creating Server (Express.js)

```typescript
import Express from 'express'
import { RPC, handleAllHttp } from '@orchidrpc/server'

const app = Express();

const rpc = new RPC();

const appRouter = rpc.router({
    greet: rpc.procedure()
        .input((input) => {
            if (typeof input.name !== "string") throw new Error("Invalid name");
            return input;
        })
        .use(async (opts) => `Hello, ${opts.input.name}!`),
    
    add: rpc.procedure()
        .input((input) => {
            if (typeof input.a !== "number" || typeof input.b !== "number") {
                throw new Error("Inputs a and b must be numbers");
            }
            return input;
        })
        .use(async (opts) => opts.input.a + opts.input.b),
});

app.all("/orpc", handleAllHttp(rpc, appRouter))

app.listen(4000)
```

### Client

```typescript
import { OrchidRpcClient } from '@orchidrpc/client'

const client = new OrchidRpcClient({
    endpoint: 'https://api.example.com',
})

client.procedure("greet", { name: "Happer" })
```