# @orchidrpc/client

To install this

```bash
npm install @ochidrpc/client
```

## Usage

### Client

```typescript
import { OrchidRpcClient } from '@orchidrpc/client'

const client = new OrchidRpcClient({
    endpoint: 'https://api.example.com',
})

client.procedure("greet", { name: "Happer" })
```
