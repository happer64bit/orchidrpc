import { OrchidRpcClient } from '@orchidrpc/client';

const client = new OrchidRpcClient({
  endpoint: "http://localhost:4000/orpc"
})

client.procedure("greet", {
  name: "John"
}).then(console.log)