import type { Procedure, RPC, RPCContext } from "./core";
import { IncomingMessage, ServerResponse } from "http";

// Interface to define the expected body of the request
interface RequestBody<TInput = unknown> {
  procedure: string;  // The name of the procedure to execute
  input?: TInput;     // The input data to pass to the procedure (optional)
}

/**
 * Handles all HTTP POST requests for RPC procedures.
 * This function processes the request, validates the input, and executes the specified procedure from the appRouter.
 * It sends appropriate responses based on the execution result or errors encountered.
 * 
 * @param rpc - An instance of the RPC class that executes the procedures.
 * @param appRouter - A record of named procedures that are available to handle requests.
 * @returns A function that handles HTTP POST requests.
 * @example
 * app.post('/rpc', handleAllHttp(rpc, appRouter));
 */
export function handleAllHttp(
  rpc: RPC,  // The RPC instance that provides procedure execution
  appRouter: Record<string, Procedure<any, any, any>>  // The available procedures to handle RPC calls
) {
  /**
   * Middleware function to handle HTTP requests for executing procedures.
   * @param req - The HTTP IncomingMessage object representing the request.
   * @param res - The HTTP ServerResponse object used to send the response.
   * @returns A promise that resolves when the response is sent.
   */
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // Reject non-POST methods
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("Method Not Allowed");
      return;
    }

    // Reject requests with unsupported content types
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("application/json")) {
      res.statusCode = 415;
      res.end("Unsupported Media Type: Expected application/json");
      return;
    }

    const chunks: Buffer[] = [];

    // Collect the data chunks from the request body
    req.on("data", (chunk: Buffer) => chunks.push(chunk));

    // When the request body is fully received
    req.on("end", async () => {
      try {
        // Parse the JSON body
        const body: RequestBody = JSON.parse(Buffer.concat(chunks).toString());

        // Check if the procedure name is missing or invalid
        if (!body || typeof body.procedure !== "string") {
          res.statusCode = 400;
          res.end("Bad Request: Missing procedure name");
          return;
        }

        // Find the procedure based on the provided procedure name
        const procedure = appRouter[body.procedure];
        if (!procedure) {
          res.statusCode = 404;
          res.end("Not Found: Procedure not found");
          return;
        }

        // Execute the procedure with the provided input
        const result = await rpc.execute(procedure, body.input || {}, req, res);

        // Respond based on whether the result is a string or object
        if (typeof result === "string") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/plain");
          res.end(result);
        } else {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ result }));
        }
      } catch (error) {
        // Handle any errors and respond with a 500 status
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
    });
  };
}
