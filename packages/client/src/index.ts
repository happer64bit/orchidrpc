import protobuf from "protobufjs";

// Define the Protobuf schema dynamically
const root = protobuf.Root.fromJSON({
    nested: {
        RpcRequest: {
            fields: {
                procedure: { type: "string", id: 1 },
                input: { type: "string", id: 2 },
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

/**
 * OrchidRpcClient is a lightweight RPC client that communicates with an OrchidRPC server using Protobuf.
 */
export class OrchidRpcClient {
    private endpoint: string;
    private options?: {
        headers?: { [key: string]: string };
        timeout?: number;
    };
    private onError?: () => void;
    private onSuccess?: () => void;
    private onRequestInitialized?: () => void;
    private RpcRequest: protobuf.Type;
    private RpcResponse: protobuf.Type;

    constructor({
        endpoint,
        options,
        onError,
        onSuccess,
        onRequestInitialized,
    }: {
        endpoint: string;
        options?: {
            headers?: { [key: string]: string };
            timeout?: number;
        };
        onError?: () => void;
        onSuccess?: () => void;
        onRequestInitialized?: () => void;
    }) {
        this.endpoint = endpoint;
        this.options = options;
        this.onError = onError;
        this.onSuccess = onSuccess;
        this.onRequestInitialized = onRequestInitialized;

        // Load protobuf message types
        this.RpcRequest = root.lookupType("RpcRequest");
        this.RpcResponse = root.lookupType("RpcResponse");
    }

    async procedure(name: string, input: any): Promise<any> {
        if (this.onRequestInitialized) {
            this.onRequestInitialized();
        }

        try {
            // Serialize request to Protobuf
            const requestPayload = { procedure: name, input: JSON.stringify(input) };
            const errMsg = this.RpcRequest.verify(requestPayload);
            if (errMsg) throw new Error(`Protobuf validation error: ${errMsg}`);

            const buffer = this.RpcRequest.encode(this.RpcRequest.create(requestPayload)).finish();

            // Prepare fetch options, including timeout handling
            const controller = new AbortController();
            const { timeout } = this.options || {};
            const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null;

            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: {
                    ...this.options?.headers,
                    "Content-Type": "application/x-protobuf",
                    "Accept": "application/x-protobuf",
                },
                body: buffer,
                signal: controller.signal,
            });

            if (timeoutId) clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }

            // Ensure the response is in Protobuf format
            const contentType = response.headers.get("Content-Type") || "";
            if (!contentType.includes("application/x-protobuf")) {
                throw new Error("Unsupported response format: Expected application/x-protobuf");
            }

            // Decode the Protobuf response
            const responseBuffer = await response.arrayBuffer();
            const decodedResponse = this.RpcResponse.decode(new Uint8Array(responseBuffer));
            const responseObject = this.RpcResponse.toObject(decodedResponse, { defaults: true });

            // Check for errors in the response
            if (responseObject.error) {
                throw new Error(`RPC Error: ${responseObject.error}`);
            }

            // Call onSuccess callback if provided
            if (this.onSuccess) {
                this.onSuccess();
            }
            try {
                return JSON.parse(responseObject.result);
            } catch {
                return responseObject.result
            }
        } catch (error) {
            if (this.onError) {
                this.onError();
            }
            console.error(`Error in procedure ${name}:`, error);
            throw error;
        }
    }
}
