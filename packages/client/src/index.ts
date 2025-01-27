/**
 * Interface for the configuration options when initializing the OrchidRpcClient.
 */
export interface TOrchidRpcClient {
    /**
     * The base URL of the API endpoint.
     */
    endpoint: string;

    /**
     * Optional configuration options.
     */
    options?: {
        /**
         * Request headers to include in API requests.
         */
        headers?: { [key: string]: string };

        /**
         * Timeout duration (in milliseconds) for the API requests.
         */
        timeout?: number;
    };

    /**
     * Handler to be called when an error occurs during the request.
     * @returns A function to handle errors.
     */
    onError?: () => void;

    /**
     * Handler to be called when the request is successful.
     * @returns A function to handle success.
     */
    onSuccess?: () => void;

    /**
     * Handler to be called when the request is initialized (before sending the request).
     * @returns A function to handle request initialization.
     */
    onRequestInitialized?: () => void;
}

/**
 * Client for making HTTP requests to an API, dynamically handling methods like GET, POST, etc.
 */
export class OrchidRpcClient {
    endpoint: string;
    options?: {
        headers?: { [key: string]: string };
        timeout?: number;
    };
    onError?: () => void;
    onSuccess?: () => void;
    onRequestInitialized?: () => void;

    /**
     * Creates an instance of OrchidRpcClient.
     * @param {TOrchidRpcClient} config - Configuration object with the endpoint and options.
     * @example
     * const client = new OrchidRpcClient({
     *   endpoint: 'https://api.example.com',
     *   options: {
     *     headers: {
     *       'Authorization': 'Bearer token',
     *     },
     *   },
     * });
     */
    constructor({ endpoint, options, onError, onSuccess, onRequestInitialized }: TOrchidRpcClient) {
        this.endpoint = endpoint;
        this.options = options;
        this.onError = onError;
        this.onSuccess = onSuccess;
        this.onRequestInitialized = onRequestInitialized;

        return new Proxy(this, {
            get: (target, prop: string | symbol) => {
                if (typeof prop === 'string' && /^[A-Za-z]+$/.test(prop)) {
                    const httpMethod = prop.toUpperCase();
                    return this.createHttpMethod(httpMethod);
                }
                return target[prop as keyof OrchidRpcClient];
            }
        });
    }

    /**
     * Creates a dynamic HTTP method handler (e.g., GET, POST, PUT, DELETE).
     * @param method - The HTTP method (e.g., GET, POST, etc.).
     * @returns A function that performs the HTTP request for the given method.
     * @example
     * const client = new OrchidRpcClient({ endpoint: 'https://api.example.com' });
     * client.GET('/data')
     *   .then(response => console.log(response))
     *   .catch(error => console.error(error));
     */
    private createHttpMethod(method: string) {
        return async (path: string, data?: unknown) => {
            // Call onRequestInitialized handler if defined
            if (this.onRequestInitialized) {
                this.onRequestInitialized();
            }

            try {
                const response = await fetch(`${this.endpoint}${path}`, {
                    method,
                    headers: this.options?.headers,
                    body: method !== "GET" ? JSON.stringify(data) : undefined,
                });

                // Call onSuccess handler if defined and the response is successful
                if (this.onSuccess && response.ok) {
                    this.onSuccess();
                }

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }

                const result = await response.json();
                return result;
            } catch (error) {
                // Call onError handler if defined
                if (this.onError) {
                    this.onError();
                }

                console.error(`Error in ${method} ${path}:`, error);
                throw error;
            }
        };
    }
}