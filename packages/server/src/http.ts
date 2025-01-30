import { IncomingMessage, ServerResponse } from "http";
import protobuf from "protobufjs";
import type { Procedure, RPC } from "./core";

// Define the Protobuf schema dynamically
const root = protobuf.Root.fromJSON({
  nested: {
    RpcRequest: {
      fields: {
        procedure: { type: "string", id: 1 },
        input: { type: "string", id: 2 }, // Encoded as JSON string for flexibility
      },
    },
    RpcResponse: {
      fields: {
        result: { type: "string", id: 1 },
        error: { type: "string", id: 2 },
      },
    },
  },
});

// Retrieve the types from the schema
const RpcRequest = root.lookupType("RpcRequest");
const RpcResponse = root.lookupType("RpcResponse");

// Helper function to deserialize Protobuf data
function deserializeProtobuf(buffer: Buffer): any {
  try {
    // Decode the request using the specific Protobuf message type
    const decodedMessage = RpcRequest.decode(buffer);
    const decodedObject = RpcRequest.toObject(decodedMessage, { defaults: true });

    // Parse the 'input' if it's a stringified JSON object
    if (decodedObject.input && typeof decodedObject.input === "string") {
      decodedObject.input = JSON.parse(decodedObject.input);
    }

    return decodedObject;
  } catch (error) {
    throw new Error("Protobuf parse error: " + (error instanceof Error ? error.message : "Unknown error"));
  }
}

/**
 * Handles all HTTP POST requests for RPC procedures.
 * Only supports Protocol Buffers (application/x-protobuf).
 *
 * @param rpc - An instance of the RPC class that executes the procedures.
 * @param appRouter - A record of named procedures that are available to handle requests.
 * @returns A function that handles HTTP POST requests.
 */
export function handleAllHttp(
  rpc: RPC,
  appRouter: Record<string, Procedure<any, any, any>>
) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("Method Not Allowed");
      return;
    }

    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("application/x-protobuf")) {
      res.statusCode = 415;
      const errorResponse = RpcResponse.encode(
        RpcResponse.create({ error: "Unsupported Media Type: Expected application/x-protobuf" })
      ).finish();
      res.setHeader("Content-Type", "application/x-protobuf");
      res.end(errorResponse);
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        // Decode the request (Protobuf only)
        const buffer = Buffer.concat(chunks);
        const body = deserializeProtobuf(buffer);

        // Validate procedure name
        if (!body || typeof body.procedure !== "string") {
          res.statusCode = 400;
          const errorResponse = RpcResponse.encode(
            RpcResponse.create({ error: "Bad Request: Missing or invalid procedure name" })
          ).finish();
          res.setHeader("Content-Type", "application/x-protobuf");
          res.end(errorResponse);
          return;
        }

        const procedure = appRouter[body.procedure];
        if (!procedure) {
          res.statusCode = 404;
          const errorResponse = RpcResponse.encode(
            RpcResponse.create({ error: "Not Found: Procedure not found" })
          ).finish();
          res.setHeader("Content-Type", "application/x-protobuf");
          res.end(errorResponse);
          return;
        }

        // Execute procedure
        const result = await rpc.execute(procedure, body.input || {}, req, res);

        // Prepare response
        const responsePayload = { result: typeof result === "string" ? result : JSON.stringify(result) };

        // Encode response into Protobuf
        const responseBuffer = RpcResponse.encode(RpcResponse.create(responsePayload)).finish();

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/x-protobuf");
        res.end(responseBuffer);
      } catch (error) {
        console.error(error);
        res.statusCode = 500;
        const errorResponse = RpcResponse.encode(
          RpcResponse.create({ error: error instanceof Error ? error.message : "Internal Server Error" })
        ).finish();
        res.setHeader("Content-Type", "application/x-protobuf");
        res.end(errorResponse);
      }
    });
  };
}
