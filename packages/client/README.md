# @orchidrpc/client

A lightweight RPC client for communication with OrchidRPC servers using Protobuf serialization.

## Features

- **Protobuf Serialization**: Efficient encoding/decoding of data.
- **Timeout Support**: Configurable request timeouts.
- **Custom Callbacks**: Hooks for request initialization, success, and error events.
- **Error Handling**: Comprehensive error management.

## Installation

```bash
npm install @orchidrpc/client
```

or with Yarn:

```bash
yarn add @orchidrpc/client
```

## Usage

### Create a Client Instance

```javascript
import { OrchidRpcClient } from "@orchidrpc/client";

const client = new OrchidRpcClient({
    endpoint: "https://your-server-endpoint.com",
    options: { timeout: 5000 },
    onSuccess: () => console.log("Success!"),
    onError: () => console.log("Error!"),
});

```

### Call a Procedure

```javascript
const result = await client.procedure("exampleProcedure", { key: "value" });
console.log(result);
```

## License

MIT
