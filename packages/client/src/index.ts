export class OrchidRpcClient {
    private endpoint: string;
    private options?: {
        headers?: { [key: string]: string };
        timeout?: number;
    };
    private onError?: () => void;
    private onSuccess?: () => void;
    private onRequestInitialized?: () => void;

    constructor({ endpoint, options, onError, onSuccess, onRequestInitialized }: {
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
    }

    async procedure(name: string, input: any): Promise<any> {
        if (this.onRequestInitialized) {
            this.onRequestInitialized();
        }

        try {
            const response = await fetch(`${this.endpoint}/orpc`, {
                method: 'POST',
                headers: {
                    ...this.options?.headers,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    procedure: name,
                    input,
                }),
            });

            if (this.onSuccess && response.ok) {
                this.onSuccess();
            }

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            if (this.onError) {
                this.onError();
            }

            console.error(`Error in procedure ${name}:`, error);
            throw error;
        }
    }
}
