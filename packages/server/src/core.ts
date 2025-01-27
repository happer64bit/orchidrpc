import { IncomingMessage, ServerResponse } from 'http'

// Type to represent the context passed to the procedures
export type RPCContext = Record<string, any>;

/**
 * Represents the options available in each procedure, including input, context, request, and response.
 * @template TInput - The type of the input for the procedure.
 */
export interface ProcedureOptions<TInput> {
  input: TInput;                // Input data for the procedure
  context: RPCContext;          // The context that the procedure is executed in
  request: IncomingMessage;     // Incoming HTTP request
  response: ServerResponse;    // HTTP response to be sent
}

/**
 * A builder for creating a procedure within the given context.
 * @template TContext - The context type for the procedure.
 */
export interface ProcedureBuilder<TContext extends RPCContext> {
  /**
   * Adds input validation to the procedure and returns a procedure with input handling.
   * @template TInput - The type of the input data.
   * @param validate - An optional validation function to validate the input.
   * @returns A procedure that accepts input data with validation.
   */
  input<TInput>(validate?: (input: unknown) => TInput): ProcedureWithInput<TContext, TInput>;

  /**
   * Adds a global middleware to the procedure.
   * @template TResult - The return type of the handler function.
   * @param handler - The handler function that acts as middleware for the procedure.
   * @returns A procedure with global middleware.
   */
  use<TResult>(
    handler: (opts: ProcedureOptions<never>, next: () => Promise<TResult>) => TResult | Promise<TResult>
  ): Procedure<TContext, never, TResult>;
}

/**
 * A procedure that includes input validation and the ability to add middleware.
 * @template TContext - The context type for the procedure.
 * @template TInput - The type of input data that the procedure accepts.
 */
export interface ProcedureWithInput<TContext extends RPCContext, TInput> {
  /**
   * Adds middleware to the procedure.
   * @template TResult - The return type of the handler function.
   * @param handler - The middleware function that processes the procedure input.
   * @returns A procedure with input validation and middleware.
   */
  use<TResult>(
    handler: (opts: ProcedureOptions<TInput>, next: () => Promise<TResult>) => TResult | Promise<TResult>
  ): Procedure<TContext, TInput, TResult>;
}

/**
 * The main interface for defining a procedure with input validation, a handler, and middleware.
 * @template TContext - The context type for the procedure.
 * @template TInput - The type of input data the procedure accepts.
 * @template TResult - The result type the procedure returns.
 */
export interface Procedure<TContext extends RPCContext, TInput, TResult> {
  validateInput?: (input: unknown) => TInput;    // Optional input validation function
  handler: (opts: ProcedureOptions<TInput>) => TResult | Promise<TResult>;  // Main handler function for the procedure
  middleware: Array<(opts: ProcedureOptions<TInput>, next: () => Promise<TResult>) => TResult | Promise<TResult>>;  // Middleware chain
}

/**
 * The main class for managing RPC procedures and middleware.
 */
export class RPC {
  private context: RPCContext;  // The global context for the RPC
  private middleware: Array<(opts: any, next: () => Promise<any>) => any> = [];  // Global middleware array

  /**
   * Creates a new RPC instance with the given context.
   * @param context - The global context for the RPC instance.
   */
  constructor(context: RPCContext) {
    this.context = context;
  }

  /**
   * Builds a procedure with input validation and middleware.
   * @returns An object that allows you to define a procedure with input validation and middleware.
   */
  procedure(): ProcedureBuilder<RPCContext> {
    return {
      /**
       * Adds input validation to the procedure.
       * @template TInput - The type of the input data.
       * @param validate - An optional validation function to validate the input.
       * @returns A procedure that accepts input data with validation.
       */
      input: <TInput>(validate?: (input: unknown) => TInput) => ({
        /**
         * Adds middleware to the procedure with input validation.
         * @template TResult - The return type of the handler function.
         * @param handler - The middleware function that processes the procedure input.
         * @returns A procedure with input validation and middleware.
         */
        use: <TResult>(
          handler: (opts: ProcedureOptions<TInput>, next: () => Promise<TResult>) => TResult | Promise<TResult>
        ) => ({
          validateInput: validate,  // Assign input validation if provided
          handler: (opts: ProcedureOptions<TInput>) => handler(opts, async () => Promise.resolve() as unknown as TResult),
          middleware: [],  // Initialize with an empty middleware chain
        }),
      }),

      /**
       * Adds global middleware to the procedure.
       * @template TResult - The return type of the handler function.
       * @param handler - The middleware handler function.
       * @returns A procedure with global middleware.
       */
      use: <TResult>(
        handler: (opts: ProcedureOptions<never>, next: () => Promise<TResult>) => TResult | Promise<TResult>
      ): Procedure<RPCContext, never, TResult> => ({
        handler: (opts: ProcedureOptions<never>) => handler(opts, async () => Promise.resolve() as unknown as TResult),
        middleware: [],  // Initialize with an empty middleware chain
      }),
    };
  }

  /**
   * Executes a procedure with the given input and HTTP request/response.
   * This method validates the input, processes the middleware, and calls the procedure handler.
   * @template TInput - The type of the input data.
   * @template TResult - The return type of the procedure.
   * @template TProcedure - The procedure type.
   * @param procedure - The procedure to be executed.
   * @param input - The input data to be passed to the procedure.
   * @param request - The incoming HTTP request.
   * @param response - The HTTP response to be returned.
   * @returns A promise that resolves to the result of the procedure handler.
   */
  async execute<TInput, TResult, TProcedure extends Procedure<any, TInput, TResult>>(
    procedure: TProcedure,  // The procedure to be executed
    input: unknown,         // Input data to be validated and passed to the procedure
    request: IncomingMessage, // Incoming HTTP request
    response: ServerResponse  // HTTP response
  ): Promise<TResult> {
    // Validate input if a validation function is provided
    const validatedInput = procedure.validateInput ? procedure.validateInput(input) : (input as TInput);

    const context = {
      ...this.context,  // Include the global context
      request,
      response,
    };

    // Create the middleware chain to handle the procedure execution
    const handler = async (opts: ProcedureOptions<TInput>) => {
      let index = 0;

      const next = async () => {
        if (index < procedure.middleware.length) {
          // Execute the next middleware in the chain
          const middlewareFn = procedure.middleware[index++];
          return middlewareFn(opts, next);
        }
        // If no more middleware, execute the procedure handler
        return procedure.handler(opts);
      };

      return next();  // Start the middleware chain
    };

    // Execute the handler and return the result
    return handler({ input: validatedInput, context, request, response });
  }

  /**
   * Adds global middleware that applies to all procedures.
   * @param middleware - The middleware function to be added globally.
   */
  useMiddleware(middleware: (opts: any, next: () => Promise<any>) => any) {
    this.middleware.push(middleware);  // Add middleware to the global array
  }

  /**
   * Registers a collection of procedures and returns them as a router.
   * @param procedures - A record of named procedures to be used in the RPC router.
   * @returns An object representing the router with all the registered procedures.
   */
  router(procedures: Record<string, Procedure<any, any, any>>) {
    return procedures;  // Return the procedures as a router
  }
}
